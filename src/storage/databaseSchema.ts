export const DATABASE_SCHEMA_VERSION = 3;

export const PERSONAL_RATING_COLUMN_SQL = `
  personal_rating INTEGER NULL CHECK (
    personal_rating IS NULL OR (
      typeof(personal_rating) = 'integer' AND
      personal_rating >= 10 AND
      personal_rating <= 100
    )
  )
`;

export const APP_PREFERENCES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_preferences (
    key TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

export const TITLE_PINS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS title_pins (
    saved_title_id TEXT NOT NULL,
    context_type TEXT NOT NULL,
    context_key TEXT NOT NULL,
    pinned_at INTEGER NOT NULL CHECK (
      typeof(pinned_at) = 'integer' AND
      pinned_at >= 0 AND
      pinned_at <= 9007199254740991
    ),
    PRIMARY KEY (saved_title_id, context_type, context_key),
    FOREIGN KEY (saved_title_id)
      REFERENCES saved_titles(id)
      ON DELETE CASCADE,
    CHECK (
      (context_type = 'library' AND context_key = '') OR
      (context_type = 'tag' AND context_key <> '')
    )
  );
`;

export const TITLE_PINS_CONTEXT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_title_pins_context
  ON title_pins(context_type, context_key, saved_title_id);
`;

export const LIBRARY_SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS saved_titles (
    id TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    poster_url TEXT,
    overview TEXT,
    vote_average REAL,
    ${PERSONAL_RATING_COLUMN_SQL},
    genres_json TEXT,
    status TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_titles_provider_external
  ON saved_titles(provider, external_id);
`;

export type SchemaDatabase = {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: any[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

type TableInfoRow = { name: string; type: string; notnull: number; pk: number };
type ForeignKeyRow = { table: string; from: string; to: string; on_delete: string };
type IndexListRow = { name: string; unique: number };
type IndexInfoRow = { name: string };

export type DatabaseMigrationHooks = {
  beforeVersion2Published?: () => void | Promise<void>;
  beforeVersion3Published?: () => void | Promise<void>;
};

function normalizeSql(sql: string): string {
  return sql.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesColumns(
  actual: readonly TableInfoRow[],
  expected: readonly { name: string; type: string; notnull: number; pk: number }[]
): boolean {
  return actual.length === expected.length && expected.every((column, index) => {
    const found = actual[index];
    return found?.name === column.name && found.type.toUpperCase() === column.type &&
      found.notnull === column.notnull && found.pk === column.pk;
  });
}

export async function readUserVersion(db: SchemaDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const version = row?.user_version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new Error("No se pudo leer una versión válida del esquema SQLite.");
  }
  return version;
}

export async function enableAndVerifyForeignKeys(db: SchemaDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;");
  if (row?.foreign_keys !== 1) {
    throw new Error("No se pudo activar la integridad referencial de SQLite.");
  }
}

export async function ensureLibrarySchema(db: SchemaDatabase): Promise<void> {
  await db.execAsync(LIBRARY_SCHEMA_SQL);
  await db.execAsync("UPDATE saved_titles SET tags_json = '[]' WHERE tags_json IS NULL;");
  await db.execAsync("UPDATE saved_titles SET genres_json = '[]' WHERE genres_json IS NULL;");
}

export async function verifyAppPreferencesTable(db: SchemaDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_preferences' LIMIT 1;"
  );
  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(app_preferences);");
  const expected = [
    { name: "key", type: "TEXT", notnull: 1, pk: 1 },
    { name: "value", type: "TEXT", notnull: 1, pk: 0 },
    { name: "updated_at", type: "INTEGER", notnull: 1, pk: 0 },
  ];
  if (table?.name !== "app_preferences" || !matchesColumns(columns, expected)) {
    throw new Error("La estructura de app_preferences no coincide con el esquema esperado.");
  }
}

export async function verifyTitlePinsSchema(db: SchemaDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ name: string; sql: string }>(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = 'title_pins' LIMIT 1;"
  );
  if (table?.name !== "title_pins" || typeof table.sql !== "string") {
    throw new Error("No se pudo verificar la tabla title_pins.");
  }

  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(title_pins);");
  const expectedColumns = [
    { name: "saved_title_id", type: "TEXT", notnull: 1, pk: 1 },
    { name: "context_type", type: "TEXT", notnull: 1, pk: 2 },
    { name: "context_key", type: "TEXT", notnull: 1, pk: 3 },
    { name: "pinned_at", type: "INTEGER", notnull: 1, pk: 0 },
  ];
  if (!matchesColumns(columns, expectedColumns)) {
    throw new Error("Las columnas o la clave primaria de title_pins no coinciden.");
  }

  const foreignKeys = await db.getAllAsync<ForeignKeyRow>("PRAGMA foreign_key_list(title_pins);");
  const foreignKey = foreignKeys.length === 1 ? foreignKeys[0] : null;
  if (!foreignKey || foreignKey.table !== "saved_titles" ||
      foreignKey.from !== "saved_title_id" || foreignKey.to !== "id" ||
      foreignKey.on_delete.toUpperCase() !== "CASCADE") {
    throw new Error("La foreign key de title_pins no coincide con el esquema esperado.");
  }

  const indexes = await db.getAllAsync<IndexListRow>("PRAGMA index_list(title_pins);");
  const contextIndex = indexes.find((index) => index.name === "idx_title_pins_context");
  if (!contextIndex || contextIndex.unique !== 0) {
    throw new Error("No se pudo verificar idx_title_pins_context.");
  }
  const indexColumns = await db.getAllAsync<IndexInfoRow>(
    "PRAGMA index_info(idx_title_pins_context);"
  );
  const expectedIndexColumns = ["context_type", "context_key", "saved_title_id"];
  if (indexColumns.length !== expectedIndexColumns.length ||
      expectedIndexColumns.some((name, index) => indexColumns[index]?.name !== name)) {
    throw new Error("Las columnas de idx_title_pins_context no coinciden.");
  }

  const sql = normalizeSql(table.sql);
  const constraints = [
    "typeof(pinned_at) = 'integer'",
    "pinned_at >= 0",
    "pinned_at <= 9007199254740991",
    "context_type = 'library' and context_key = ''",
    "context_type = 'tag' and context_key <> ''",
  ];
  if (constraints.some((constraint) => !sql.includes(constraint))) {
    throw new Error("Los CHECK constraints de title_pins no coinciden.");
  }
  if (sql.includes("trim(context_key)")) {
    throw new Error("SQLite no debe normalizar context_key mediante trim.");
  }
}

export async function verifySavedTitlesV3Schema(db: SchemaDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ name: string; sql: string }>(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = 'saved_titles' LIMIT 1;"
  );
  if (table?.name !== "saved_titles" || typeof table.sql !== "string") {
    throw new Error("No se pudo verificar la tabla saved_titles.");
  }

  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(saved_titles);");
  const personalRating = columns.find((column) => column.name === "personal_rating");
  if (!personalRating || personalRating.type.toUpperCase() !== "INTEGER" ||
      personalRating.notnull !== 0 || personalRating.pk !== 0) {
    throw new Error("La columna personal_rating no coincide con el esquema v3 esperado.");
  }

  const tableSql = normalizeSql(table.sql);
  const constraints = [
    "personal_rating is null",
    "typeof(personal_rating) = 'integer'",
    "personal_rating >= 10",
    "personal_rating <= 100",
  ];
  if (constraints.some((constraint) => !tableSql.includes(constraint))) {
    throw new Error("El CHECK constraint de personal_rating no coincide.");
  }
  const invalidValue = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM saved_titles
     WHERE personal_rating IS NOT NULL AND (
       typeof(personal_rating) <> 'integer' OR
       personal_rating < 10 OR
       personal_rating > 100
     )
     LIMIT 1;`
  );
  if (invalidValue) {
    throw new Error("saved_titles contiene un personal_rating fuera del dominio v3.");
  }

  const indexes = await db.getAllAsync<IndexListRow>("PRAGMA index_list(saved_titles);");
  const identityIndex = indexes.find(
    (index) => index.name === "idx_saved_titles_provider_external"
  );
  if (!identityIndex || identityIndex.unique !== 1) {
    throw new Error("No se pudo verificar idx_saved_titles_provider_external.");
  }
  const indexColumns = await db.getAllAsync<IndexInfoRow>(
    "PRAGMA index_info(idx_saved_titles_provider_external);"
  );
  const expectedIndexColumns = ["provider", "external_id"];
  if (indexColumns.length !== expectedIndexColumns.length ||
      expectedIndexColumns.some((name, index) => indexColumns[index]?.name !== name)) {
    throw new Error("Las columnas de idx_saved_titles_provider_external no coinciden.");
  }
}

export async function evolveDatabaseSchema(
  db: SchemaDatabase,
  currentVersion: number,
  hooks: DatabaseMigrationHooks = {}
): Promise<void> {
  if (currentVersion > DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `Versión SQLite no soportada: ${currentVersion}. ` +
      `Esta aplicación admite hasta la versión ${DATABASE_SCHEMA_VERSION}.`
    );
  }

  await db.withTransactionAsync(async () => {
    await db.execAsync(APP_PREFERENCES_TABLE_SQL);
    await verifyAppPreferencesTable(db);
    if (currentVersion < 1) await db.execAsync("PRAGMA user_version = 1;");

    await db.execAsync(TITLE_PINS_TABLE_SQL);
    await db.execAsync(TITLE_PINS_CONTEXT_INDEX_SQL);
    await verifyTitlePinsSchema(db);
    await hooks.beforeVersion2Published?.();

    if (currentVersion < 3) {
      const savedTitleColumns = await db.getAllAsync<TableInfoRow>(
        "PRAGMA table_info(saved_titles);"
      );
      if (!savedTitleColumns.some((column) => column.name === "personal_rating")) {
        await db.execAsync(
          `ALTER TABLE saved_titles ADD COLUMN ${PERSONAL_RATING_COLUMN_SQL};`
        );
      }
    }
    await verifySavedTitlesV3Schema(db);
    await hooks.beforeVersion3Published?.();

    if (currentVersion < DATABASE_SCHEMA_VERSION) {
      await db.execAsync(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION};`);
    }
    const finalVersion = await readUserVersion(db);
    if (finalVersion !== DATABASE_SCHEMA_VERSION) {
      throw new Error(`La evolución SQLite no alcanzó la versión ${DATABASE_SCHEMA_VERSION}.`);
    }
  });
}

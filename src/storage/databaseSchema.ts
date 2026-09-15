import { createTmdbProviderReference } from "../core/tmdbSavedTitle";

export const DATABASE_SCHEMA_VERSION = 4;
export const LEGACY_BACKUP_FORMAT = "library-backup-v1-v4";

export const PERSONAL_RATING_COLUMN_SQL = `personal_rating INTEGER NULL CHECK (
  personal_rating IS NULL OR (
    typeof(personal_rating) = 'integer' AND personal_rating >= 10 AND personal_rating <= 100
  )
)`;

export const APP_PREFERENCES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS app_preferences (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);`;

export const SAVED_TITLES_V4_TABLE_SQL = `CREATE TABLE IF NOT EXISTS saved_titles (
  id TEXT NOT NULL PRIMARY KEY,
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
  updated_at INTEGER NOT NULL
);`;

export const MEDIA_PROVIDER_REFERENCES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS media_provider_references (
  provider TEXT NOT NULL,
  resource_namespace TEXT NOT NULL,
  external_id TEXT NOT NULL,
  saved_title_id TEXT NOT NULL,
  PRIMARY KEY (provider, resource_namespace, external_id),
  FOREIGN KEY (saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
  CHECK (length(trim(provider)) > 0),
  CHECK (provider = trim(provider)),
  CHECK (length(trim(resource_namespace)) > 0),
  CHECK (resource_namespace = trim(resource_namespace)),
  CHECK (length(trim(external_id)) > 0)
);`;

export const MEDIA_PROVIDER_REFERENCES_SAVED_TITLE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_media_provider_references_saved_title
ON media_provider_references(saved_title_id);`;

export const LEGACY_SAVED_TITLE_IDENTITIES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS legacy_saved_title_identities (
  legacy_format TEXT NOT NULL,
  legacy_provider TEXT NOT NULL,
  legacy_external_id TEXT NOT NULL,
  saved_title_id TEXT NOT NULL,
  PRIMARY KEY (legacy_format, legacy_provider, legacy_external_id),
  FOREIGN KEY (saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
  CHECK (legacy_format = '${LEGACY_BACKUP_FORMAT}'),
  CHECK (legacy_provider = 'manual'),
  CHECK (length(legacy_external_id) > 0)
);`;

export const LEGACY_SAVED_TITLE_IDENTITIES_SAVED_TITLE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_legacy_saved_title_identities_saved_title
ON legacy_saved_title_identities(saved_title_id);`;

export const TITLE_PINS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS title_pins (
  saved_title_id TEXT NOT NULL,
  context_type TEXT NOT NULL,
  context_key TEXT NOT NULL,
  pinned_at INTEGER NOT NULL CHECK (
    typeof(pinned_at) = 'integer' AND pinned_at >= 0 AND pinned_at <= 9007199254740991
  ),
  PRIMARY KEY (saved_title_id, context_type, context_key),
  FOREIGN KEY (saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
  CHECK (
    (context_type = 'library' AND context_key = '') OR
    (context_type = 'tag' AND context_key <> '')
  )
);`;

export const TITLE_PINS_CONTEXT_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_title_pins_context
ON title_pins(context_type, context_key, saved_title_id);`;

/** @deprecated Historical v3 schema, retained only for migration fixtures and verification. */
export const LIBRARY_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS saved_titles (
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
ON saved_titles(provider, external_id);`;

export type SchemaDatabase = {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: any[]): Promise<T[]>;
  runAsync(source: string, ...params: any[]): Promise<{ changes: number }>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

type TableInfoRow = { name: string; type: string; notnull: number; pk: number };
type ForeignKeyRow = { table: string; from: string; to: string; on_delete: string };
type IndexListRow = { name: string; unique: number };
type IndexInfoRow = { name: string };
type LegacySavedTitleRow = { id: string; provider: string; external_id: string; type: string };

export type DatabaseMigrationHooks = {
  beforeVersion2Published?: () => void | Promise<void>;
  beforeVersion3Published?: () => void | Promise<void>;
  afterV4TargetTablesCreated?: () => void | Promise<void>;
  afterV4ItemsCopied?: () => void | Promise<void>;
  afterV4IdentitiesCopied?: () => void | Promise<void>;
  afterV4PinsCopied?: () => void | Promise<void>;
  beforeV4Verification?: () => void | Promise<void>;
  beforeVersion4Published?: () => void | Promise<void>;
  afterVersion4Published?: () => void | Promise<void>;
};

function normalizeSql(sql: string): string {
  return sql.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesColumns(actual: readonly TableInfoRow[], expected: readonly TableInfoRow[]): boolean {
  return actual.length === expected.length && expected.every((column, index) => {
    const found = actual[index];
    return found?.name === column.name && found.type.toUpperCase() === column.type &&
      found.notnull === column.notnull && found.pk === column.pk;
  });
}

async function tableExists(db: SchemaDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1;", [name]
  );
  return row?.name === name;
}

async function verifyIndex(
  db: SchemaDatabase,
  table: string,
  name: string,
  unique: number,
  expectedColumns: readonly string[]
): Promise<void> {
  const indexes = await db.getAllAsync<IndexListRow>(`PRAGMA index_list(${table});`);
  const found = indexes.find((index) => index.name === name);
  if (!found || found.unique !== unique) throw new Error(`No se pudo verificar ${name}.`);
  const columns = await db.getAllAsync<IndexInfoRow>(`PRAGMA index_info(${name});`);
  if (columns.length !== expectedColumns.length ||
      expectedColumns.some((column, index) => columns[index]?.name !== column)) {
    throw new Error(`Las columnas de ${name} no coinciden.`);
  }
}

async function verifyCascadeForeignKey(db: SchemaDatabase, table: string): Promise<void> {
  const keys = await db.getAllAsync<ForeignKeyRow>(`PRAGMA foreign_key_list(${table});`);
  const key = keys.length === 1 ? keys[0] : null;
  if (!key || key.table !== "saved_titles" || key.from !== "saved_title_id" ||
      key.to !== "id" || key.on_delete.toUpperCase() !== "CASCADE") {
    throw new Error(`La foreign key de ${table} no coincide con el esquema esperado.`);
  }
}

export async function readUserVersion(db: SchemaDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  if (typeof row?.user_version !== "number" || !Number.isInteger(row.user_version) ||
      row.user_version < 0) {
    throw new Error("No se pudo leer una versión válida del esquema SQLite.");
  }
  return row.user_version;
}

export async function enableAndVerifyForeignKeys(db: SchemaDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;");
  if (row?.foreign_keys !== 1) throw new Error("No se pudo activar la integridad referencial de SQLite.");
}

export async function verifyAppPreferencesTable(db: SchemaDatabase): Promise<void> {
  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(app_preferences);");
  const expected = [
    { name: "key", type: "TEXT", notnull: 1, pk: 1 },
    { name: "value", type: "TEXT", notnull: 1, pk: 0 },
    { name: "updated_at", type: "INTEGER", notnull: 1, pk: 0 },
  ];
  if (!matchesColumns(columns, expected)) {
    throw new Error("La estructura de app_preferences no coincide con el esquema esperado.");
  }
}

export async function verifyTitlePinsSchema(db: SchemaDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'title_pins' LIMIT 1;"
  );
  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(title_pins);");
  const expected = [
    { name: "saved_title_id", type: "TEXT", notnull: 1, pk: 1 },
    { name: "context_type", type: "TEXT", notnull: 1, pk: 2 },
    { name: "context_key", type: "TEXT", notnull: 1, pk: 3 },
    { name: "pinned_at", type: "INTEGER", notnull: 1, pk: 0 },
  ];
  if (!table?.sql || !matchesColumns(columns, expected)) {
    throw new Error("Las columnas o la clave primaria de title_pins no coinciden.");
  }
  await verifyCascadeForeignKey(db, "title_pins");
  await verifyIndex(db, "title_pins", "idx_title_pins_context", 0,
    ["context_type", "context_key", "saved_title_id"]);
  const sql = normalizeSql(table.sql);
  const checks = ["typeof(pinned_at) = 'integer'", "pinned_at >= 0",
    "pinned_at <= 9007199254740991", "context_type = 'library' and context_key = ''",
    "context_type = 'tag' and context_key <> ''"];
  if (checks.some((check) => !sql.includes(check)) || sql.includes("trim(context_key)")) {
    throw new Error("Los CHECK constraints de title_pins no coinciden.");
  }
}

function verifyRatingCheck(sql: string): void {
  const normalized = normalizeSql(sql);
  const checks = ["personal_rating is null", "typeof(personal_rating) = 'integer'",
    "personal_rating >= 10", "personal_rating <= 100"];
  if (checks.some((check) => !normalized.includes(check))) {
    throw new Error("El CHECK constraint de personal_rating no coincide.");
  }
}

export async function verifySavedTitlesV3Schema(db: SchemaDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'saved_titles' LIMIT 1;"
  );
  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(saved_titles);");
  const rating = columns.find((column) => column.name === "personal_rating");
  if (!table?.sql || !rating || rating.type.toUpperCase() !== "INTEGER" ||
      rating.notnull !== 0 || rating.pk !== 0) {
    throw new Error("La columna personal_rating no coincide con el esquema v3 esperado.");
  }
  verifyRatingCheck(table.sql);
  const invalidRating = await db.getFirstAsync<{ id: string }>(`SELECT id FROM saved_titles
    WHERE personal_rating IS NOT NULL AND (
      typeof(personal_rating) <> 'integer' OR personal_rating < 10 OR personal_rating > 100
    ) LIMIT 1;`);
  if (invalidRating) throw new Error("saved_titles contiene un personal_rating fuera del dominio v3.");
  await verifyIndex(db, "saved_titles", "idx_saved_titles_provider_external", 1,
    ["provider", "external_id"]);
}

export async function verifySavedTitlesV4Schema(db: SchemaDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'saved_titles' LIMIT 1;"
  );
  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(saved_titles);");
  const expected = [
    { name: "id", type: "TEXT", notnull: 1, pk: 1 },
    { name: "type", type: "TEXT", notnull: 1, pk: 0 },
    { name: "title", type: "TEXT", notnull: 1, pk: 0 },
    { name: "year", type: "INTEGER", notnull: 0, pk: 0 },
    { name: "poster_url", type: "TEXT", notnull: 0, pk: 0 },
    { name: "overview", type: "TEXT", notnull: 0, pk: 0 },
    { name: "vote_average", type: "REAL", notnull: 0, pk: 0 },
    { name: "personal_rating", type: "INTEGER", notnull: 0, pk: 0 },
    { name: "genres_json", type: "TEXT", notnull: 0, pk: 0 },
    { name: "status", type: "TEXT", notnull: 1, pk: 0 },
    { name: "tags_json", type: "TEXT", notnull: 1, pk: 0 },
    { name: "notes", type: "TEXT", notnull: 0, pk: 0 },
    { name: "created_at", type: "INTEGER", notnull: 1, pk: 0 },
    { name: "updated_at", type: "INTEGER", notnull: 1, pk: 0 },
  ];
  if (!table?.sql || !matchesColumns(columns, expected)) {
    throw new Error("La estructura de saved_titles v4 no coincide.");
  }
  verifyRatingCheck(table.sql);
  const invalidRating = await db.getFirstAsync<{ id: string }>(`SELECT id FROM saved_titles
    WHERE personal_rating IS NOT NULL AND (
      typeof(personal_rating) <> 'integer' OR personal_rating < 10 OR personal_rating > 100
    ) LIMIT 1;`);
  if (invalidRating) throw new Error("saved_titles contiene un personal_rating fuera del dominio v4.");
  if (columns.some((column) => column.name === "provider" || column.name === "external_id")) {
    throw new Error("saved_titles v4 conserva identidad externa legacy.");
  }
}

export async function verifyProviderReferencesSchema(db: SchemaDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'media_provider_references' LIMIT 1;"
  );
  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(media_provider_references);");
  const expected = [
    { name: "provider", type: "TEXT", notnull: 1, pk: 1 },
    { name: "resource_namespace", type: "TEXT", notnull: 1, pk: 2 },
    { name: "external_id", type: "TEXT", notnull: 1, pk: 3 },
    { name: "saved_title_id", type: "TEXT", notnull: 1, pk: 0 },
  ];
  if (!table?.sql || !matchesColumns(columns, expected)) {
    throw new Error("La estructura de media_provider_references no coincide.");
  }
  await verifyCascadeForeignKey(db, "media_provider_references");
  await verifyIndex(db, "media_provider_references", "idx_media_provider_references_saved_title", 0,
    ["saved_title_id"]);
  const sql = normalizeSql(table.sql);
  const checks = ["length(trim(provider)) > 0", "provider = trim(provider)",
    "length(trim(resource_namespace)) > 0", "resource_namespace = trim(resource_namespace)",
    "length(trim(external_id)) > 0"];
  if (checks.some((check) => !sql.includes(check))) {
    throw new Error("Los CHECK constraints de media_provider_references no coinciden.");
  }
}

export async function verifyLegacyIdentitiesSchema(db: SchemaDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'legacy_saved_title_identities' LIMIT 1;"
  );
  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(legacy_saved_title_identities);");
  const expected = [
    { name: "legacy_format", type: "TEXT", notnull: 1, pk: 1 },
    { name: "legacy_provider", type: "TEXT", notnull: 1, pk: 2 },
    { name: "legacy_external_id", type: "TEXT", notnull: 1, pk: 3 },
    { name: "saved_title_id", type: "TEXT", notnull: 1, pk: 0 },
  ];
  if (!table?.sql || !matchesColumns(columns, expected)) {
    throw new Error("La estructura de legacy_saved_title_identities no coincide.");
  }
  await verifyCascadeForeignKey(db, "legacy_saved_title_identities");
  await verifyIndex(db, "legacy_saved_title_identities",
    "idx_legacy_saved_title_identities_saved_title", 0, ["saved_title_id"]);
  const sql = normalizeSql(table.sql);
  const checks = [`legacy_format = '${LEGACY_BACKUP_FORMAT}'`,
    "legacy_provider = 'manual'", "length(legacy_external_id) > 0"];
  if (checks.some((check) => !sql.includes(check))) {
    throw new Error("Los CHECK constraints de legacy_saved_title_identities no coinciden.");
  }
}

export async function verifyV4Schema(db: SchemaDatabase): Promise<void> {
  await verifyAppPreferencesTable(db);
  await verifySavedTitlesV4Schema(db);
  await verifyProviderReferencesSchema(db);
  await verifyLegacyIdentitiesSchema(db);
  await verifyTitlePinsSchema(db);
  const violation = await db.getFirstAsync<Record<string, unknown>>("PRAGMA foreign_key_check;");
  if (violation) throw new Error("El esquema v4 contiene referencias huérfanas.");
}

async function createV4Tables(db: SchemaDatabase): Promise<void> {
  await db.execAsync(APP_PREFERENCES_TABLE_SQL);
  await db.execAsync(SAVED_TITLES_V4_TABLE_SQL);
  await db.execAsync(MEDIA_PROVIDER_REFERENCES_TABLE_SQL);
  await db.execAsync(MEDIA_PROVIDER_REFERENCES_SAVED_TITLE_INDEX_SQL);
  await db.execAsync(LEGACY_SAVED_TITLE_IDENTITIES_TABLE_SQL);
  await db.execAsync(LEGACY_SAVED_TITLE_IDENTITIES_SAVED_TITLE_INDEX_SQL);
  await db.execAsync(TITLE_PINS_TABLE_SQL);
  await db.execAsync(TITLE_PINS_CONTEXT_INDEX_SQL);
}

async function prepareHistoricalSchemaThroughV3(
  db: SchemaDatabase,
  currentVersion: number,
  hooks: DatabaseMigrationHooks
): Promise<void> {
  await db.execAsync(APP_PREFERENCES_TABLE_SQL);
  await verifyAppPreferencesTable(db);
  if (currentVersion < 1) await db.execAsync("PRAGMA user_version = 1;");
  await db.execAsync(TITLE_PINS_TABLE_SQL);
  await db.execAsync(TITLE_PINS_CONTEXT_INDEX_SQL);
  await verifyTitlePinsSchema(db);
  await hooks.beforeVersion2Published?.();
  if (currentVersion < 3) {
    const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(saved_titles);");
    if (!columns.some((column) => column.name === "personal_rating")) {
      await db.execAsync(`ALTER TABLE saved_titles ADD COLUMN ${PERSONAL_RATING_COLUMN_SQL};`);
    }
  }
  // Compatibilidad pre-v4: el bootstrap histórico normalizaba únicamente esta
  // columna nullable antes de evolucionar. No se aplica a reaperturas v4.
  await db.execAsync("UPDATE saved_titles SET genres_json = '[]' WHERE genres_json IS NULL;");
  await verifySavedTitlesV3Schema(db);
  await hooks.beforeVersion3Published?.();
}

async function verifyMigrationData(
  db: SchemaDatabase,
  sourceRows: readonly LegacySavedTitleRow[],
  sourcePinCount: number
): Promise<void> {
  const titleCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM saved_titles;");
  const pinCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM title_pins;");
  if (titleCount?.count !== sourceRows.length || pinCount?.count !== sourcePinCount) {
    throw new Error("La migración v4 no preservó los conteos de títulos o pins.");
  }
  const changedTitle = await db.getFirstAsync<Record<string, unknown>>(`SELECT id, type, title, year,
    poster_url, overview, vote_average, personal_rating, genres_json, status, tags_json, notes,
    created_at, updated_at FROM saved_titles_v3 EXCEPT SELECT id, type, title, year, poster_url,
    overview, vote_average, personal_rating, genres_json, status, tags_json, notes, created_at,
    updated_at FROM saved_titles LIMIT 1;`);
  const changedPin = await db.getFirstAsync<Record<string, unknown>>(`SELECT saved_title_id,
    context_type, context_key, pinned_at FROM title_pins_v3 EXCEPT SELECT saved_title_id,
    context_type, context_key, pinned_at FROM title_pins LIMIT 1;`);
  if (changedTitle || changedPin) throw new Error("La migración v4 alteró títulos o pins históricos.");
  for (const row of sourceRows) {
    if (row.provider === "tmdb") {
      const ref = createTmdbProviderReference(row.type as "movie" | "tv", row.external_id);
      const migrated = await db.getFirstAsync<{ saved_title_id: string }>(`SELECT saved_title_id
        FROM media_provider_references WHERE provider = ? AND resource_namespace = ?
        AND external_id = ? LIMIT 1;`, [ref.provider, ref.resourceNamespace, ref.externalId]);
      if (migrated?.saved_title_id !== row.id) throw new Error(`Referencia TMDB inválida para ${row.id}.`);
    } else {
      const migrated = await db.getFirstAsync<{ saved_title_id: string }>(`SELECT saved_title_id
        FROM legacy_saved_title_identities WHERE legacy_format = ? AND legacy_provider = 'manual'
        AND legacy_external_id = ? LIMIT 1;`, [LEGACY_BACKUP_FORMAT, row.external_id]);
      if (migrated?.saved_title_id !== row.id) throw new Error(`Identidad manual inválida para ${row.id}.`);
    }
  }
  await verifyV4Schema(db);
}

async function migrateV3ToV4(db: SchemaDatabase, hooks: DatabaseMigrationHooks): Promise<void> {
  const rows = await db.getAllAsync<LegacySavedTitleRow>(
    "SELECT id, provider, external_id, type FROM saved_titles ORDER BY id;"
  );
  const pinCount = (await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM title_pins;"
  ))?.count ?? -1;
  const canonical = new Map<string, string>();
  for (const row of rows) {
    if (typeof row.id !== "string" || !row.id || typeof row.external_id !== "string" ||
        !row.external_id || (row.type !== "movie" && row.type !== "tv") ||
        (row.provider !== "tmdb" && row.provider !== "manual")) {
      throw new Error(`Identidad histórica inválida en saved_titles: ${String(row.id)}.`);
    }
    if (row.provider === "tmdb") {
      const ref = createTmdbProviderReference(row.type as "movie" | "tv", row.external_id);
      const key = `${ref.provider}\u0000${ref.resourceNamespace}\u0000${ref.externalId}`;
      const existingId = canonical.get(key);
      if (existingId && existingId !== row.id) {
        throw new Error("Dos títulos históricos producen la misma referencia TMDB canónica.");
      }
      canonical.set(key, row.id);
    }
  }
  await db.execAsync("ALTER TABLE title_pins RENAME TO title_pins_v3;");
  await db.execAsync("DROP INDEX idx_title_pins_context;");
  await db.execAsync("ALTER TABLE saved_titles RENAME TO saved_titles_v3;");
  await createV4Tables(db);
  await hooks.afterV4TargetTablesCreated?.();
  await db.execAsync(`INSERT INTO saved_titles (id, type, title, year, poster_url, overview,
    vote_average, personal_rating, genres_json, status, tags_json, notes, created_at, updated_at)
    SELECT id, type, title, year, poster_url, overview, vote_average, personal_rating,
    genres_json, status, tags_json, notes, created_at, updated_at FROM saved_titles_v3;`);
  await hooks.afterV4ItemsCopied?.();
  for (const row of rows) {
    if (row.provider === "tmdb") {
      const ref = createTmdbProviderReference(row.type as "movie" | "tv", row.external_id);
      await db.runAsync(`INSERT INTO media_provider_references
        (provider, resource_namespace, external_id, saved_title_id) VALUES (?, ?, ?, ?);`,
        ref.provider, ref.resourceNamespace, ref.externalId, row.id);
    } else {
      await db.runAsync(`INSERT INTO legacy_saved_title_identities
        (legacy_format, legacy_provider, legacy_external_id, saved_title_id)
        VALUES (?, 'manual', ?, ?);`, LEGACY_BACKUP_FORMAT, row.external_id, row.id);
    }
  }
  await hooks.afterV4IdentitiesCopied?.();
  await db.execAsync(`INSERT INTO title_pins (saved_title_id, context_type, context_key, pinned_at)
    SELECT saved_title_id, context_type, context_key, pinned_at FROM title_pins_v3;`);
  await hooks.afterV4PinsCopied?.();
  await hooks.beforeV4Verification?.();
  await verifyMigrationData(db, rows, pinCount);
  await db.execAsync("DROP TABLE title_pins_v3;");
  await db.execAsync("DROP TABLE saved_titles_v3;");
}

/** Version-aware compatibility entry point; it never installs v3 before inspecting user_version. */
export async function ensureLibrarySchema(db: SchemaDatabase): Promise<void> {
  await evolveDatabaseSchema(db, await readUserVersion(db));
}

export async function evolveDatabaseSchema(
  db: SchemaDatabase,
  currentVersion: number,
  hooks: DatabaseMigrationHooks = {}
): Promise<void> {
  if (currentVersion > DATABASE_SCHEMA_VERSION) {
    throw new Error(`Versión SQLite no soportada: ${currentVersion}. ` +
      `Esta aplicación admite hasta la versión ${DATABASE_SCHEMA_VERSION}.`);
  }
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.withTransactionAsync(async () => {
    if (currentVersion === DATABASE_SCHEMA_VERSION) {
      await verifyV4Schema(db);
      return;
    }
    const hasSavedTitles = await tableExists(db, "saved_titles");
    if (currentVersion === 0 && !hasSavedTitles) {
      await createV4Tables(db);
      await hooks.afterV4TargetTablesCreated?.();
      await hooks.beforeV4Verification?.();
      await verifyV4Schema(db);
    } else {
      if (!hasSavedTitles) throw new Error(`El esquema SQLite v${currentVersion} no contiene saved_titles.`);
      await prepareHistoricalSchemaThroughV3(db, currentVersion, hooks);
      await migrateV3ToV4(db, hooks);
    }
    await hooks.beforeVersion4Published?.();
    await db.execAsync(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION};`);
    await hooks.afterVersion4Published?.();
    if (await readUserVersion(db) !== DATABASE_SCHEMA_VERSION) {
      throw new Error(`La evolución SQLite no alcanzó la versión ${DATABASE_SCHEMA_VERSION}.`);
    }
  });
}

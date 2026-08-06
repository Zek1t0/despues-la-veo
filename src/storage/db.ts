import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "despues-la-veo.db";
export const DATABASE_SCHEMA_VERSION = 1;

export const APP_PREFERENCES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_preferences (
    key TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

type UserVersionRow = { user_version: number };
type TableInfoRow = {
  name: string;
  type: string;
  notnull: number;
  pk: number;
};

async function readUserVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<UserVersionRow>("PRAGMA user_version;");
  const version = row?.user_version;
  if (!Number.isInteger(version) || typeof version !== "number" || version < 0) {
    throw new Error("No se pudo leer una versión válida del esquema SQLite.");
  }
  return version;
}

async function verifyAppPreferencesTable(db: SQLite.SQLiteDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_preferences' LIMIT 1;"
  );
  if (table?.name !== "app_preferences") {
    throw new Error("No se pudo verificar la tabla app_preferences.");
  }

  const columns = await db.getAllAsync<TableInfoRow>("PRAGMA table_info(app_preferences);");
  const expected = [
    { name: "key", type: "TEXT", notnull: 1, pk: 1 },
    { name: "value", type: "TEXT", notnull: 1, pk: 0 },
    { name: "updated_at", type: "INTEGER", notnull: 1, pk: 0 },
  ];

  const matches =
    columns.length === expected.length &&
    expected.every((column, index) => {
      const actual = columns[index];
      return (
        actual?.name === column.name &&
        actual.type.toUpperCase() === column.type &&
        actual.notnull === column.notnull &&
        actual.pk === column.pk
      );
    });

  if (!matches) {
    throw new Error("La estructura de app_preferences no coincide con el esquema esperado.");
  }
}

async function ensureLibrarySchema(db: SQLite.SQLiteDatabase): Promise<void> {
  // Esquema existente de la biblioteca. Esta evolución no altera saved_titles ni su índice.
  await db.execAsync(`
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
  `);

  // Defaults existentes para filas viejas.
  await db.execAsync(`UPDATE saved_titles SET tags_json = '[]' WHERE tags_json IS NULL;`);
  await db.execAsync(`UPDATE saved_titles SET genres_json = '[]' WHERE genres_json IS NULL;`);
}

async function evolveDatabaseToVersion1(
  db: SQLite.SQLiteDatabase,
  currentVersion: number
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(APP_PREFERENCES_TABLE_SQL);
    await verifyAppPreferencesTable(db);

    if (currentVersion < DATABASE_SCHEMA_VERSION) {
      await db.execAsync(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION};`);
    }

    const finalVersion = await readUserVersion(db);
    if (finalVersion !== DATABASE_SCHEMA_VERSION) {
      throw new Error(
        `La evolución SQLite no alcanzó la versión ${DATABASE_SCHEMA_VERSION}.`
      );
    }
  });
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  try {
    const currentVersion = await readUserVersion(db);
    if (currentVersion > DATABASE_SCHEMA_VERSION) {
      throw new Error(
        `Versión SQLite no soportada: ${currentVersion}. ` +
          `Esta aplicación admite hasta la versión ${DATABASE_SCHEMA_VERSION}.`
      );
    }

    await ensureLibrarySchema(db);
    await evolveDatabaseToVersion1(db, currentVersion);
    return db;
  } catch (error) {
    try {
      await db.closeAsync();
    } catch {
      // Se conserva el error original de inicialización.
    }
    throw error;
  }
}

export async function initDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = initializeDatabase()
    .then((db) => {
      _db = db;
      return db;
    })
    .catch((error: unknown) => {
      _initPromise = null;
      throw error;
    });

  return _initPromise;
}

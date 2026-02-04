import * as SQLite from "expo-sqlite";

const DB_NAME = "despueslaveo.db";

// Usamos un singleton para no abrir 20 veces la DB
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

export async function initDb() {
  const db = await getDb();

  // WAL mejora durabilidad y performance
  // execAsync sirve para ejecutar varias sentencias juntas (no parametriza).
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS saved_titles (
      id TEXT PRIMARY KEY NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      poster_url TEXT,
      status TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_saved_titles_status ON saved_titles(status);
    CREATE INDEX IF NOT EXISTS idx_saved_titles_title  ON saved_titles(title);
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider_external ON saved_titles(provider, external_id);

  `);

  return db;
}

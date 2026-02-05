import * as SQLite from "expo-sqlite";

const DB_NAME = "despueslaveo.db";
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  return dbPromise;
}

export async function initDb() {
  const db = await getDb();

  await db.execAsync(`PRAGMA journal_mode = WAL;`);

  await db.execAsync(`
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
  `);

  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_saved_titles_status ON saved_titles(status);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_saved_titles_title  ON saved_titles(title);`);

  // 1) Deduplicar (nos quedamos con el más viejo por provider+external_id)
  await db.execAsync(`
    DELETE FROM saved_titles
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM saved_titles
      GROUP BY provider, external_id
    );
  `);

  // 2) índice único
  await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider_external
    ON saved_titles(provider, external_id);
  `);

  return db;
}

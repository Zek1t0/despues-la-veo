import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initDb() {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync("despues-la-veo.db");

    // Tabla principal
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

    // Defaults para filas viejas
    await db.execAsync(`UPDATE saved_titles SET tags_json = '[]' WHERE tags_json IS NULL;`);
    await db.execAsync(`UPDATE saved_titles SET genres_json = '[]' WHERE genres_json IS NULL;`);

    _db = db;
    return db;
  })();

  return _initPromise;
}
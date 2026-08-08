import * as SQLite from "expo-sqlite";

import {
  DATABASE_SCHEMA_VERSION,
  enableAndVerifyForeignKeys,
  ensureLibrarySchema,
  evolveDatabaseSchema,
  readUserVersion,
} from "./databaseSchema";

export { APP_PREFERENCES_TABLE_SQL, DATABASE_SCHEMA_VERSION } from "./databaseSchema";

const DATABASE_NAME = "despues-la-veo.db";
let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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

    await enableAndVerifyForeignKeys(db);
    await ensureLibrarySchema(db);
    await evolveDatabaseSchema(db, currentVersion);
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

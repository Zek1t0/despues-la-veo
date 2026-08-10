import type { SavedTitle } from "../core/savedTitle";
import { parsePersonalRating, type PersonalRating } from "../core/personalRating";
import { nextSavedTitleUpdatedAt } from "../core/savedTitleTimestamp";
import {
  materializeTmdbSavedTitle,
  type TmdbSavedTitleSnapshot,
} from "../core/tmdbSavedTitle";
import type { NormalizedBackupSavedTitle } from "../core/libraryBackupV1";
import type { ParsedLibraryBackup } from "../core/libraryBackup";
import { initDb } from "./db";
import {
  mergeLibraryBackupItemsWithDb,
  mergeLibraryBackupWithDb,
  rowToSavedTitle,
  type LibraryImportIssue,
  type LibraryImportMergeResult,
  type LibraryBackupMergeResult,
} from "./libraryBackupMerge";
import {
  deleteSavedTitleAndPinsWithDb,
  upsertSavedTitleAndCleanPinsWithDb,
} from "./savedTitleIntegrity";
import { runSerializedStorageMutation } from "./storageMutationQueue";

export type { LibraryImportIssue, LibraryImportMergeResult };
export type { LibraryBackupMergeResult };

export type SavedTitlesReadDatabase = {
  getAllAsync<T>(source: string, ...params: any[]): Promise<T[]>;
};

export type SavedTitlesMutationDatabase = SavedTitlesReadDatabase & {
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  runAsync(source: string, ...params: any[]): Promise<{ changes: number }>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

function assertSavedTitleId(id: string): void {
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("El id del título guardado debe ser un string no vacío.");
  }
}

/** Actualiza sólo un título existente y retorna su nuevo updatedAt confirmado. */
export async function setPersonalRatingWithDb(
  db: SavedTitlesMutationDatabase,
  id: string,
  value: PersonalRating,
  now: () => number = Date.now
): Promise<number> {
  assertSavedTitleId(id);
  const personalRating = parsePersonalRating(value);
  const current = await db.getFirstAsync<{ updated_at: number }>(
    "SELECT updated_at FROM saved_titles WHERE id = ? LIMIT 1;",
    [id]
  );
  if (!current) throw new Error("El título guardado no existe.");

  const nextUpdatedAt = nextSavedTitleUpdatedAt(current.updated_at, now());
  const result = await db.runAsync(
    `UPDATE saved_titles
     SET personal_rating = ?, updated_at = ?
     WHERE id = ?;`,
    personalRating,
    nextUpdatedAt,
    id
  );
  if (result.changes !== 1) {
    throw new Error("El título guardado dejó de existir antes de actualizar su puntuación.");
  }
  return nextUpdatedAt;
}

export async function setPersonalRating(
  id: string,
  value: PersonalRating
): Promise<number> {
  const db = await initDb();
  return runSerializedStorageMutation(async () => {
    let updatedAt: number | null = null;
    await db.withTransactionAsync(async () => {
      updatedAt = await setPersonalRatingWithDb(db, id, value);
    });
    if (updatedAt === null) {
      throw new Error("No se pudo confirmar la actualización de la puntuación personal.");
    }
    return updatedAt;
  });
}

export async function saveTmdbTitleWithDb(
  db: SavedTitlesMutationDatabase,
  snapshot: TmdbSavedTitleSnapshot,
  generateId: () => string,
  now = Date.now()
): Promise<string> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM saved_titles
     WHERE provider = 'tmdb' AND external_id = ? LIMIT 1;`,
    [snapshot.externalId]
  );
  const existing = row ? rowToSavedTitle(row) : null;
  const item = materializeTmdbSavedTitle(snapshot, existing, generateId, now);
  return upsertSavedTitleAndCleanPinsWithDb(db, item);
}

export async function saveTmdbTitle(
  snapshot: TmdbSavedTitleSnapshot,
  generateId: () => string
): Promise<string> {
  const db = await initDb();
  return runSerializedStorageMutation(async () => {
    let savedTitleId: string | null = null;
    await db.withTransactionAsync(async () => {
      savedTitleId = await saveTmdbTitleWithDb(db, snapshot, generateId);
    });
    if (!savedTitleId) throw new Error("No se pudo completar el guardado del título TMDB.");
    return savedTitleId;
  });
}

export async function getSavedTitleByIdWithDb(
  db: SavedTitlesReadDatabase,
  id: string
): Promise<SavedTitle | null> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM saved_titles WHERE id = ? LIMIT 1",
    id
  );
  return rows.length ? rowToSavedTitle(rows[0]) : null;
}

export async function listSavedTitlesWithDb(
  db: SavedTitlesReadDatabase
): Promise<SavedTitle[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM saved_titles ORDER BY created_at DESC"
  );
  return rows.map(rowToSavedTitle);
}

export async function listSavedTitles(): Promise<SavedTitle[]> {
  return listSavedTitlesWithDb(await initDb());
}

export async function getAllSavedTitles(): Promise<SavedTitle[]> {
  return listSavedTitles();
}

export async function upsertSavedTitle(item: SavedTitle): Promise<string> {
  const db = await initDb();
  return runSerializedStorageMutation(async () => {
    let savedTitleId: string | null = null;
    await db.withTransactionAsync(async () => {
      savedTitleId = await upsertSavedTitleAndCleanPinsWithDb(db, item);
    });
    if (!savedTitleId) throw new Error("No se pudo completar el guardado del título.");
    return savedTitleId;
  });
}

export async function mergeLibraryBackupItems(
  items: NormalizedBackupSavedTitle[],
  generateId: () => string
): Promise<LibraryImportMergeResult> {
  const db = await initDb();
  return runSerializedStorageMutation(() =>
    mergeLibraryBackupItemsWithDb(db, items, generateId)
  );
}

export async function mergeLibraryBackup(
  payload: ParsedLibraryBackup,
  generateId: () => string
): Promise<LibraryBackupMergeResult> {
  const db = await initDb();
  return runSerializedStorageMutation(() =>
    mergeLibraryBackupWithDb(
      db,
      payload.items,
      payload.version === 2 ? payload.pins : null,
      generateId
    )
  );
}

export async function deleteSavedTitle(id: string): Promise<void> {
  const db = await initDb();
  return runSerializedStorageMutation(() =>
    db.withTransactionAsync(() => deleteSavedTitleAndPinsWithDb(db, id))
  );
}

export async function getSavedTitleById(id: string): Promise<SavedTitle | null> {
  return getSavedTitleByIdWithDb(await initDb(), id);
}

export async function getByProviderExternal(
  provider: string,
  externalId: string
): Promise<SavedTitle | null> {
  const db = await initDb();
  const rows = await db.getAllAsync(
    "SELECT * FROM saved_titles WHERE provider = ? AND external_id = ? LIMIT 1",
    provider,
    externalId
  );
  return rows.length ? rowToSavedTitle(rows[0]) : null;
}

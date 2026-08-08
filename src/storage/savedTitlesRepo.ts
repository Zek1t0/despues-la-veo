import type { SavedTitle } from "../core/savedTitle";
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
  const db = await initDb();
  const rows = await db.getAllAsync("SELECT * FROM saved_titles WHERE id = ? LIMIT 1", id);
  return rows.length ? rowToSavedTitle(rows[0]) : null;
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

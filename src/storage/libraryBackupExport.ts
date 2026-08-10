import type { SavedTitle } from "../core/savedTitle";
import { initDb } from "./db";
import { rowToSavedTitle } from "./libraryBackupMerge";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import {
  listAllPinsForBackupWithDb,
  type BackupTitlePinRow,
  type TitlePinsDatabase,
} from "./titlePinsRepo";

export type LibraryBackupExportData = {
  items: SavedTitle[];
  pins: BackupTitlePinRow[];
};

type LibraryBackupExportDatabase = TitlePinsDatabase;

export async function getLibraryBackupExportDataWithDb(
  db: LibraryBackupExportDatabase
): Promise<LibraryBackupExportData> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM saved_titles ORDER BY created_at DESC, id ASC"
  );
  const items = rows.map(rowToSavedTitle);
  const pins = await listAllPinsForBackupWithDb(db);
  return { items, pins };
}

export async function getLibraryBackupExportData(): Promise<LibraryBackupExportData> {
  return runSerializedStorageMutation(async () =>
    getLibraryBackupExportDataWithDb(await initDb())
  );
}

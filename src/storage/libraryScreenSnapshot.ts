import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
import { LIBRARY_PIN_CONTEXT, type TitlePin } from "../core/contextualPin";
import { initDb } from "./db";
import { listSavedTitlesWithDb } from "./savedTitlesRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { listTitlePinsForContextWithDb } from "./titlePinsRepo";
import { listPersonalProgressWithDb, type ProgressDatabase } from "./personalProgressRepo";
import type { PersonalProgress } from "../core/personalProgress";

export type LibraryScreenSnapshot = {
  items: SavedTitleWithProviderReferences[];
  pins: TitlePin[];
  progressById: Record<string, PersonalProgress> | null;
  progressReadError: unknown | null;
};

export async function getLibraryScreenSnapshot(
  database?: Parameters<typeof listSavedTitlesWithDb>[0] & Parameters<typeof listTitlePinsForContextWithDb>[0] & ProgressDatabase
): Promise<LibraryScreenSnapshot> {
  return runSerializedStorageMutation(async () => {
    const db = database ?? await initDb();
    let snapshot!: LibraryScreenSnapshot;
    await db.withTransactionAsync(async () => {
      const items = await listSavedTitlesWithDb(db);
      const pins = await listTitlePinsForContextWithDb(db, LIBRARY_PIN_CONTEXT);
      let progressById: Record<string, PersonalProgress> | null = null, progressReadError: unknown | null = null;
      try { progressById = await listPersonalProgressWithDb(db, items.map(item => item.id)); }
      catch (error) { progressReadError = error; }
      snapshot = { items, pins, progressById, progressReadError };
    });
    return snapshot;
  });
}

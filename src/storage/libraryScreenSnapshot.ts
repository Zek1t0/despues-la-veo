import type { SavedTitle } from "../core/savedTitle";
import { LIBRARY_PIN_CONTEXT, type TitlePin } from "../core/contextualPin";
import { initDb } from "./db";
import { listSavedTitlesWithDb } from "./savedTitlesRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { listTitlePinsForContextWithDb } from "./titlePinsRepo";

export type LibraryScreenSnapshot = {
  items: SavedTitle[];
  pins: TitlePin[];
};

export async function getLibraryScreenSnapshot(): Promise<LibraryScreenSnapshot> {
  return runSerializedStorageMutation(async () => {
    const db = await initDb();
    const items = await listSavedTitlesWithDb(db);
    const pins = await listTitlePinsForContextWithDb(db, LIBRARY_PIN_CONTEXT);
    return { items, pins };
  });
}

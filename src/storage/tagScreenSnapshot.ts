import type { SavedTitle } from "../core/savedTitle";
import { createTagPinContext, type TagPinContext, type TitlePin } from "../core/contextualPin";
import { initDb } from "./db";
import { listSavedTitlesWithDb } from "./savedTitlesRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { listTitlePinsForContextWithDb } from "./titlePinsRepo";

export type TagScreenSnapshot = {
  context: TagPinContext;
  items: SavedTitle[];
  pins: TitlePin[];
};

export function getTagScreenSnapshot(tag: string): Promise<TagScreenSnapshot> {
  const context = createTagPinContext(tag);
  return runSerializedStorageMutation(async () => {
    const db = await initDb();
    const items = await listSavedTitlesWithDb(db);
    const pins = await listTitlePinsForContextWithDb(db, context);
    return { context, items, pins };
  });
}

import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { listCollectionsWithDb, listMembershipsWithDb } from "./collectionsRepo";
import { listSavedTitlesWithReferencesWithDb } from "./savedTitleStorage";
import { readMediaPreferencesWithDb } from "./mediaPreferencesRepo";
import type { PersonalCollection, CollectionMembership } from "../core/personalCollection";
import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
import type { PortableMediaPreferences } from "../core/mediaPreferences";
export type OrganizationSnapshot = { collections: PersonalCollection[]; memberships: CollectionMembership[];
  items: SavedTitleWithProviderReferences[]; preferences: PortableMediaPreferences };
export async function getOrganizationSnapshot(): Promise<OrganizationSnapshot> {
  return runSerializedStorageMutation(async () => {
    const db = await initDb(); let value!: OrganizationSnapshot;
    await db.withTransactionAsync(async () => {
      value = { collections: await listCollectionsWithDb(db), memberships: await listMembershipsWithDb(db),
        items: await listSavedTitlesWithReferencesWithDb(db), preferences: await readMediaPreferencesWithDb(db) };
    }); return value;
  });
}

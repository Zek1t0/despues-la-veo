import { listGranularCountsWithDb } from "./granularPresentationRepo";
import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { listCollectionsWithDb, listMembershipsWithDb } from "./collectionsRepo";
import { listSavedTitlesWithReferencesWithDb } from "./savedTitleStorage";
import { readMediaPreferencesWithDb } from "./mediaPreferencesRepo";
import type { PersonalCollection, CollectionMembership } from "../core/personalCollection";
import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
import type { PortableMediaPreferences } from "../core/mediaPreferences";
import type { PersonalProgress } from "../core/personalProgress";
import { listPersonalProgressWithDb, type ProgressDatabase } from "./personalProgressRepo";
export type OrganizationSnapshot = { collections: PersonalCollection[]; memberships: CollectionMembership[];
  items: SavedTitleWithProviderReferences[]; preferences: PortableMediaPreferences;
  granularCounts?: Record<string, number>; progressById: Record<string, PersonalProgress> | null; progressReadError: unknown | null };
export async function getOrganizationSnapshot(database?: ProgressDatabase): Promise<OrganizationSnapshot> {
  return runSerializedStorageMutation(async () => {
    const db = database ?? await initDb(); let value!: OrganizationSnapshot;
    await db.withTransactionAsync(async () => {
      const items = await listSavedTitlesWithReferencesWithDb(db);
      let granularCounts: Record<string, number> | undefined;
      let progressById: Record<string, PersonalProgress> | null = null, progressReadError: unknown | null = null;
      try { const ids = items.map(item=>item.id); progressById = await listPersonalProgressWithDb(db, ids); granularCounts = await listGranularCountsWithDb(db, ids); }
      catch (error) { progressReadError = error; }
      value = { collections: await listCollectionsWithDb(db), memberships: await listMembershipsWithDb(db),
        items, preferences: await readMediaPreferencesWithDb(db), granularCounts, progressById, progressReadError };
    }); return value;
  });
}

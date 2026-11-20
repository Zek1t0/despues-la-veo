import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { listRecommendationsWithDb } from "./recommendationInboxRepo";
import { listSavedTitlesWithReferencesWithDb } from "./savedTitleStorage";
import { readMediaPreferencesWithDb } from "./mediaPreferencesRepo";
export async function getRecommendationSnapshot() {
  return runSerializedStorageMutation(async()=>{
    const db=await initDb();let value!: { recommendations: Awaited<ReturnType<typeof listRecommendationsWithDb>>; items: Awaited<ReturnType<typeof listSavedTitlesWithReferencesWithDb>>; preferences: Awaited<ReturnType<typeof readMediaPreferencesWithDb>> };
    await db.withTransactionAsync(async()=>{value={recommendations:await listRecommendationsWithDb(db),items:await listSavedTitlesWithReferencesWithDb(db),preferences:await readMediaPreferencesWithDb(db)};});return value;
  });
}
export type RecommendationSnapshot=Awaited<ReturnType<typeof getRecommendationSnapshot>>;

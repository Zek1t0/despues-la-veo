import type { ProviderMaterializationInput } from "../providers/providerContracts";
import type { ManualContentInput } from "../core/manualContentEntry";
import { getRecommendationWithDb, setRecommendationStateWithDb } from "./recommendationInboxRepo";
import { getSavedTitleByProviderReferenceWithDb } from "./savedTitleStorage";
import { saveProviderTitleWithDb, type SavedTitlesMutationDatabase } from "./savedTitlesRepo";
import { createManualContentWithDb } from "./manualContentEntries";
import { generateManualEntryIdentity } from "../core/manualEntryIdentity";
import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { publishOrganization } from "./organizationInvalidation";
import { publishLibraryInvalidation } from "./libraryInvalidation";

/** Caller owns the transaction. Existing links return before materialization; no refresh side effects. */
export async function incorporateRecommendationWithDb(db: SavedTitlesMutationDatabase, id: string,
  input: { provider: ProviderMaterializationInput; generateId: () => string; allowed: () => boolean } | { manual: ManualContentInput }, now=Date.now()): Promise<string> {
  const recommendation = await getRecommendationWithDb(db,id);
  if (!recommendation) throw new Error("La recomendación ya no existe.");
  if (recommendation.status === "incorporated" && recommendation.linkedItemId) {
    if ("provider" in input && (await getSavedTitleByProviderReferenceWithDb(db,input.provider.reference))?.id!==recommendation.linkedItemId) {
      throw new Error("La recomendación ya está vinculada a otra obra. Reabrila antes de elegir un destino diferente.");
    }
    return recommendation.linkedItemId;
  }
  if (recommendation.status !== "pending") throw new Error("Reabrí la recomendación antes de incorporarla.");
  let itemId: string;
  if ("provider" in input) {
    const existing = await getSavedTitleByProviderReferenceWithDb(db,input.provider.reference);
    if (existing) itemId=existing.id;
    else {
      if (!input.allowed()) throw new Error("El catálogo no está disponible para guardar en esta plataforma.");
      itemId=await saveProviderTitleWithDb(db,input.provider,input.generateId,now);
    }
  } else itemId=await createManualContentWithDb(db,input.manual,generateManualEntryIdentity,generateManualEntryIdentity,now);
  await setRecommendationStateWithDb(db,id,"incorporated",itemId,now);
  return itemId;
}
async function incorporate(id:string,input:Parameters<typeof incorporateRecommendationWithDb>[2],database?:SavedTitlesMutationDatabase):Promise<string>{
  return runSerializedStorageMutation(async()=>{
    const db=database??await initDb();let itemId="";
    await db.withTransactionAsync(async()=>{itemId=await incorporateRecommendationWithDb(db,id,input);});
    publishOrganization();publishLibraryInvalidation([itemId]);return itemId;
  });
}
export const incorporateProviderRecommendation=(id:string,provider:ProviderMaterializationInput,generateId:()=>string,allowed:()=>boolean,database?:SavedTitlesMutationDatabase)=>incorporate(id,{provider,generateId,allowed},database);
export const incorporateManualRecommendation=(id:string,manual:ManualContentInput,database?:SavedTitlesMutationDatabase)=>incorporate(id,{manual},database);

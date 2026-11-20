import { parseRecommendation, parseRecommendationCapture, type Recommendation, type RecommendationCapture, type RecommendationStatus } from "../core/recommendationInbox";
import { organizationId, organizationTimestamp } from "../core/personalCollection";
import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { publishOrganization } from "./organizationInvalidation";
import type { CollectionsDb } from "./collectionsRepo";
export type InboxDb = CollectionsDb;
export function recommendationFromRow(r: Record<string, unknown>): Recommendation {
  return parseRecommendation({ id: r.id, name: r.name, url: r.url, person: r.person, origin: r.origin, comment: r.comment,
    reference: r.provider === null ? null : { provider: r.provider, resourceNamespace: r.resource_namespace, externalId: r.external_id },
    originalCapture: JSON.parse(String(r.original_capture_json)), status: r.status, linkedItemId: r.linked_saved_title_id,
    createdAt: r.created_at, updatedAt: r.updated_at });
}
export async function getRecommendationWithDb(db: InboxDb, id: string): Promise<Recommendation | null> {
  organizationId(id);
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM recommendation_inbox WHERE id=?;",id);
  return row ? recommendationFromRow(row) : null;
}
export async function listRecommendationsWithDb(db: InboxDb): Promise<Recommendation[]> {
  return (await db.getAllAsync<Record<string,unknown>>("SELECT * FROM recommendation_inbox ORDER BY created_at DESC,id;")).map(recommendationFromRow);
}
export async function insertRecommendationWithDb(db: InboxDb, value: Recommendation): Promise<void> {
  const v = parseRecommendation(value), ref = v.reference;
  await db.runAsync(`INSERT INTO recommendation_inbox
    (id,original_capture_json,capture_kind,name,url,provider,resource_namespace,external_id,person,origin,comment,status,linked_saved_title_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,v.id,JSON.stringify(v.originalCapture),v.originalCapture.reference ? "reference" : v.originalCapture.url ? "url" : "name",
    v.name,v.url,ref?.provider ?? null,ref?.resourceNamespace ?? null,ref?.externalId ?? null,v.person,v.origin,v.comment,v.status,v.linkedItemId,v.createdAt,v.updatedAt);
}
export async function createRecommendationWithDb(db: InboxDb, id: string, capture: RecommendationCapture, now=Date.now()): Promise<boolean> {
  organizationId(id); organizationTimestamp(now);
  const fields = parseRecommendationCapture(capture,true), old = await getRecommendationWithDb(db,id);
  if (old) {
    if (JSON.stringify(old.originalCapture) !== JSON.stringify(fields)) throw new Error("Este ID ya corresponde a otra captura. Abrila para editarla.");
    return false;
  }
  await insertRecommendationWithDb(db,{id,...fields,originalCapture:fields,status:"pending",linkedItemId:null,createdAt:now,updatedAt:now}); return true;
}
export async function editRecommendationWithDb(db: InboxDb, id: string, capture: RecommendationCapture, now=Date.now()): Promise<boolean> {
  const fields = parseRecommendationCapture(capture,true), old = await getRecommendationWithDb(db,id);
  if (!old) throw new Error("La recomendación ya no existe.");
  if (JSON.stringify(parseRecommendationCapture(old)) === JSON.stringify(fields)) return false;
  const ref = fields.reference, stamp = organizationTimestamp(Math.max(now,old.updatedAt+1));
  await db.runAsync(`UPDATE recommendation_inbox SET name=?,url=?,provider=?,resource_namespace=?,external_id=?,person=?,origin=?,comment=?,updated_at=? WHERE id=?;`,
    fields.name,fields.url,ref?.provider ?? null,ref?.resourceNamespace ?? null,ref?.externalId ?? null,fields.person,fields.origin,fields.comment,stamp,id); return true;
}
export async function setRecommendationStateWithDb(db: InboxDb, id: string, status: RecommendationStatus, itemId: string | null, now=Date.now()): Promise<boolean> {
  const old = await getRecommendationWithDb(db,id);
  if (!old) throw new Error("La recomendación ya no existe.");
  parseRecommendation({...old,status,linkedItemId:itemId});
  if (status === "incorporated" && !await db.getFirstAsync("SELECT id FROM saved_titles WHERE id=?;",itemId)) throw new Error("El título ya no está en Biblioteca.");
  if (old.status === status && old.linkedItemId === itemId) return false;
  if (status === "incorporated" && old.status !== "pending") throw new Error("Reabrí la recomendación antes de elegir otro título.");
  await db.runAsync("UPDATE recommendation_inbox SET status=?,linked_saved_title_id=?,updated_at=? WHERE id=?;",status,itemId,organizationTimestamp(Math.max(now,old.updatedAt+1)),id); return true;
}
export async function mutateInbox(action: (db: InboxDb) => Promise<boolean>, database?: InboxDb): Promise<void> {
  return runSerializedStorageMutation(async () => {
    const db = database ?? await initDb(); let changed=false;
    await db.withTransactionAsync(async()=>{changed=await action(db);});
    if(changed)publishOrganization();
  });
}
export const createRecommendation = (id:string,capture:RecommendationCapture)=>mutateInbox(db=>createRecommendationWithDb(db,id,capture));
export const editRecommendation = (id:string,capture:RecommendationCapture)=>mutateInbox(db=>editRecommendationWithDb(db,id,capture));
export const transitionRecommendation = (id:string,status:"pending"|"discarded")=>mutateInbox(db=>setRecommendationStateWithDb(db,id,status,null));
export const linkRecommendation = (id:string,itemId:string)=>mutateInbox(db=>setRecommendationStateWithDb(db,id,"incorporated",itemId));

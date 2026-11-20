import { collectionFields, organizationId, organizationTimestamp, type PersonalCollection, type CollectionMembership } from "../core/personalCollection";
import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { publishOrganization } from "./organizationInvalidation";
import type { TitlePinsDatabase } from "./titlePinsRepo";

export type CollectionsDb = TitlePinsDatabase;
type Row = { id: string; name: string; description: string | null; created_at: number; updated_at: number };
const fromRow = (r: Row): PersonalCollection => ({ id: r.id, name: r.name, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at });
export async function listCollectionsWithDb(db: CollectionsDb): Promise<PersonalCollection[]> {
  return (await db.getAllAsync<Row>("SELECT * FROM personal_collections ORDER BY name COLLATE NOCASE,id;")).map(fromRow);
}
export async function listMembershipsWithDb(db: CollectionsDb): Promise<CollectionMembership[]> {
  return db.getAllAsync<CollectionMembership>("SELECT collection_id AS collectionId,saved_title_id AS itemId,added_at AS addedAt,updated_at AS updatedAt FROM collection_memberships ORDER BY collection_id,saved_title_id;");
}
export async function createCollectionWithDb(db: CollectionsDb, id: string, name: string, description: string | null, now = Date.now()): Promise<boolean> {
  organizationId(id); organizationTimestamp(now);
  const fields = collectionFields(name, description);
  const old = await db.getFirstAsync<Row>("SELECT * FROM personal_collections WHERE id=?;", id);
  if (old) {
    if (old.name !== fields.name || old.description !== fields.description) throw new Error("Este ID ya corresponde a otra colección. Abrila para editarla.");
    return false;
  }
  await db.runAsync("INSERT INTO personal_collections VALUES (?,?,?,?,?);", id, fields.name, fields.description, now, now);
  return true;
}
export async function editCollectionWithDb(db: CollectionsDb, id: string, name: string, description: string | null, now = Date.now()): Promise<boolean> {
  organizationId(id); organizationTimestamp(now);
  const fields = collectionFields(name, description);
  const old = await db.getFirstAsync<Row>("SELECT * FROM personal_collections WHERE id=?;", id);
  if (!old) throw new Error("La colección ya no existe.");
  if (old.name === fields.name && old.description === fields.description) return false;
  const updatedAt = organizationTimestamp(Math.max(now, old.updated_at + 1));
  await db.runAsync("UPDATE personal_collections SET name=?,description=?,updated_at=? WHERE id=?;", fields.name, fields.description, updatedAt, id);
  return true;
}
export async function deleteCollectionWithDb(db: CollectionsDb, id: string): Promise<boolean> {
  organizationId(id);
  if (!await db.getFirstAsync("SELECT id FROM personal_collections WHERE id=?;", id)) return false;
  await db.runAsync("DELETE FROM personal_collections WHERE id=?;", id); return true;
}
export async function setCollectionMemberWithDb(db: CollectionsDb, collectionId: string, itemId: string, member: boolean, now = Date.now()): Promise<boolean> {
  organizationId(collectionId); organizationId(itemId); organizationTimestamp(now);
  const old = await db.getFirstAsync("SELECT 1 FROM collection_memberships WHERE collection_id=? AND saved_title_id=?;", collectionId, itemId);
  if (!!old === member) return false;
  if (member) {
    if (!await db.getFirstAsync("SELECT id FROM personal_collections WHERE id=?;", collectionId) || !await db.getFirstAsync("SELECT id FROM saved_titles WHERE id=?;", itemId)) throw new Error("La colección o el título ya no existe.");
    await db.runAsync("INSERT INTO collection_memberships VALUES (?,?,?,?);", collectionId, itemId, now, now);
  } else await db.runAsync("DELETE FROM collection_memberships WHERE collection_id=? AND saved_title_id=?;", collectionId, itemId);
  return true;
}
export async function mutateCollections(action: (db: CollectionsDb) => Promise<boolean>, database?: CollectionsDb): Promise<void> {
  return runSerializedStorageMutation(async () => {
    const db = database ?? await initDb(); let changed = false;
    await db.withTransactionAsync(async () => { changed = await action(db); });
    if (changed) publishOrganization();
  });
}
export const createCollection = (id: string, name: string, description: string | null) => mutateCollections(db => createCollectionWithDb(db,id,name,description));
export const editCollection = (id: string, name: string, description: string | null) => mutateCollections(db => editCollectionWithDb(db,id,name,description));
export const deleteCollection = (id: string) => mutateCollections(db => deleteCollectionWithDb(db,id));
export const setCollectionMember = (collectionId: string, itemId: string, member: boolean) => mutateCollections(db => setCollectionMemberWithDb(db,collectionId,itemId,member));

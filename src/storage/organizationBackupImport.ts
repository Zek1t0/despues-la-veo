import { getRecommendationWithDb, insertRecommendationWithDb } from "./recommendationInboxRepo";
import type { ParsedLibraryBackupV9 } from "../core/libraryBackupV9";
import { listCollectionsWithDb, listMembershipsWithDb, type CollectionsDb } from "./collectionsRepo";

export type OrganizationImportCount = { inserted: number; updated: number; preserved: number; issues: string[] };
export type OrganizationImportResult = { collections: OrganizationImportCount; memberships: OrganizationImportCount; recommendations: OrganizationImportCount & { degraded: number } };
export async function mergeOrganizationWithDb(db: CollectionsDb, payload: ParsedLibraryBackupV9, mapping: Map<string,string>): Promise<OrganizationImportResult> {
  const count = (): OrganizationImportCount => ({ inserted: 0, updated: 0, preserved: 0, issues: [] });
  const result = { collections: count(), memberships: count(), recommendations: { ...count(), degraded: 0 } };
  result.recommendations.issues.push(...payload.recommendationIssues);
  result.collections.issues.push(...payload.organizationIssues);
  const eligible = new Set<string>();
  async function unit(target: OrganizationImportCount, label: string, action: () => Promise<"inserted" | "updated" | "preserved">): Promise<boolean> {
    await db.runAsync("SAVEPOINT organization_record;");
    try {
      const outcome = await action();
      await db.runAsync("RELEASE SAVEPOINT organization_record;"); target[outcome]++; return true;
    } catch (error) {
      await db.runAsync("ROLLBACK TO SAVEPOINT organization_record;"); await db.runAsync("RELEASE SAVEPOINT organization_record;");
      target.issues.push(`${label}: ${error instanceof Error ? error.message : "No se pudo restaurar."}`); return false;
    }
  }
  const locals = new Map((await listCollectionsWithDb(db)).map(v => [v.id,v]));
  for (const entry of payload.collections) {
    if (await unit(result.collections, entry.name, async () => {
      const old = locals.get(entry.id);
      if (old && entry.updatedAt <= old.updatedAt) return "preserved";
      if (old) await db.runAsync("UPDATE personal_collections SET name=?,description=?,updated_at=? WHERE id=?;", entry.name,entry.description,entry.updatedAt,entry.id);
      else await db.runAsync("INSERT INTO personal_collections VALUES (?,?,?,?,?);",entry.id,entry.name,entry.description,entry.createdAt,entry.updatedAt);
      return old ? "updated" : "inserted";
    })) eligible.add(entry.id);
  }
  const memberships = new Map((await listMembershipsWithDb(db)).map(v => [JSON.stringify([v.collectionId,v.itemId]),v]));
  const effectiveMemberships = new Map<string, { entry: ParsedLibraryBackupV9["collectionMemberships"][number]; conflict: boolean }>();
  for (const entry of payload.collectionMemberships) {
    const itemId = mapping.get(entry.itemId);
    if (!eligible.has(entry.collectionId) || !itemId) { result.memberships.issues.push(`Membresía ${entry.collectionId}/${entry.itemId}: destino no restaurable.`); continue; }
    const key = JSON.stringify([entry.collectionId,itemId]);
    const resolved = {...entry,itemId}, previous = effectiveMemberships.get(key);
    if (!previous || resolved.updatedAt > previous.entry.updatedAt) effectiveMemberships.set(key,{entry:resolved,conflict:false});
    else if (resolved.updatedAt === previous.entry.updatedAt && resolved.addedAt !== previous.entry.addedAt) previous.conflict=true;
  }
  for (const [key,{entry,conflict}] of effectiveMemberships) {
    if(conflict){result.memberships.issues.push(`Membresía ${key}: datos contradictorios con igual fecha después del remapeo.`);continue;}
    const itemId=entry.itemId;
    await unit(result.memberships, key, async () => {
      const old = memberships.get(key);
      if (old && entry.updatedAt <= old.updatedAt) return "preserved";
      if (old) await db.runAsync("UPDATE collection_memberships SET added_at=?,updated_at=? WHERE collection_id=? AND saved_title_id=?;",entry.addedAt,entry.updatedAt,entry.collectionId,itemId);
      else await db.runAsync("INSERT INTO collection_memberships VALUES (?,?,?,?);",entry.collectionId,itemId,entry.addedAt,entry.updatedAt);
      memberships.set(key,{...entry,itemId});
      return old ? "updated" : "inserted";
    });
  }
  for (const incoming of payload.recommendations ?? []) {
    let degraded = false;
    const applied = await unit(result.recommendations,incoming.id,async()=>{
      const old=await getRecommendationWithDb(db,incoming.id);
      if(old && JSON.stringify(old.originalCapture)!==JSON.stringify(incoming.originalCapture)) throw new Error("Conflicto de captura original para el mismo ID de recomendación.");
      if(old && incoming.updatedAt<=old.updatedAt)return "preserved";
      const linkedItemId=incoming.linkedItemId ? mapping.get(incoming.linkedItemId)??null : null;
      degraded=incoming.status==="incorporated"&&!linkedItemId;
      const value={...incoming,linkedItemId,status:degraded?"pending" as const:incoming.status};
      if(!old)await insertRecommendationWithDb(db,value);
      else {
        const ref=value.reference;
        await db.runAsync(`UPDATE recommendation_inbox SET name=?,url=?,provider=?,resource_namespace=?,external_id=?,person=?,origin=?,comment=?,status=?,linked_saved_title_id=?,updated_at=? WHERE id=?;`,
          value.name,value.url,ref?.provider??null,ref?.resourceNamespace??null,ref?.externalId??null,value.person,value.origin,value.comment,value.status,value.linkedItemId,value.updatedAt,value.id);
      }
      return old?"updated":"inserted";
    });
    if(applied && degraded){result.recommendations.degraded++;result.recommendations.issues.push(`${incoming.id}: conservada Pendiente porque su título no pudo resolverse.`);}
  }
  return result;
}

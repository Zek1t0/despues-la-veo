import type { ParsedLibraryBackupV9 } from "../core/libraryBackupV9";
import { listCollectionsWithDb, listMembershipsWithDb, type CollectionsDb } from "./collectionsRepo";

export type OrganizationImportCount = { inserted: number; updated: number; preserved: number; issues: string[] };
export type OrganizationImportResult = { collections: OrganizationImportCount; memberships: OrganizationImportCount };
export async function mergeOrganizationWithDb(db: CollectionsDb, payload: ParsedLibraryBackupV9, mapping: Map<string,string>): Promise<OrganizationImportResult> {
  const count = (): OrganizationImportCount => ({ inserted: 0, updated: 0, preserved: 0, issues: [] });
  const result = { collections: count(), memberships: count() };
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
  for (const entry of payload.collectionMemberships) {
    const itemId = mapping.get(entry.itemId);
    if (!eligible.has(entry.collectionId) || !itemId) { result.memberships.issues.push(`Membresía ${entry.collectionId}/${entry.itemId}: destino no restaurable.`); continue; }
    const key = JSON.stringify([entry.collectionId,itemId]);
    await unit(result.memberships, key, async () => {
      const old = memberships.get(key);
      if (old && entry.updatedAt <= old.updatedAt) return "preserved";
      if (old) await db.runAsync("UPDATE collection_memberships SET added_at=?,updated_at=? WHERE collection_id=? AND saved_title_id=?;",entry.addedAt,entry.updatedAt,entry.collectionId,itemId);
      else await db.runAsync("INSERT INTO collection_memberships VALUES (?,?,?,?);",entry.collectionId,itemId,entry.addedAt,entry.updatedAt);
      memberships.set(key,{...entry,itemId});
      return old ? "updated" : "inserted";
    });
  }
  return result;
}

import { generateManualEntryIdentity } from "../core/manualEntryIdentity";
import { parsePortableActivity, type PortableActivityEvent } from "../core/libraryBackupV8";
import type { MetadataDb } from "./mediaMetadataRepo";
import { markActivityWrite } from "./libraryActivitySignals";

export type ActivityFilter = "all" | "metadata" | "personal";
export type ActivityCursor = Readonly<{ occurredAt: number; eventId: string }>;
export const ACTIVITY_RETENTION_MS = 90 * 86400000;
export async function hasActivityWithDb(db: Pick<MetadataDb,"getFirstAsync">) {
  return !!await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='library_activity_events';");
}
/** Caller owns the transaction. Never accepts private values; portable validator is shared with v8. */
export async function recordActivityWithDb(db: MetadataDb, itemId: string, kind: string, fields: readonly string[],
  occurredAt: number, operationKey?: string): Promise<void> {
  if (!await hasActivityWithDb(db)) return; // Historical schemas retain their original semantics.
  const id = generateManualEntryIdentity().replace(/^manual-/,"activity-");
  const event = parsePortableActivity({ id,itemId,kind,origin:kind==="metadata"?"metadata":"personal",fields,occurredAt,
    operationKey:operationKey??JSON.stringify(["personal",itemId,kind,id]) });
  if (await db.getFirstAsync("SELECT id FROM library_activity_events WHERE operation_key=?;",event.operationKey)) return;
  await db.runAsync("INSERT INTO library_activity_events VALUES (?,?,?,?,?,?,?);",event.id,itemId,occurredAt,kind,event.origin,JSON.stringify(event.fields),event.operationKey);
  await pruneLibraryActivityWithDb(db);
  markActivityWrite();
}
/** Indexed SQL, no history materialized in JS. Both limits apply in the writer's transaction. */
export async function pruneLibraryActivityWithDb(db: MetadataDb, now=Date.now()) {
  await db.runAsync("DELETE FROM library_activity_events WHERE occurred_at<?;",now-ACTIVITY_RETENTION_MS);
  await db.runAsync("DELETE FROM library_activity_events WHERE id IN (SELECT id FROM library_activity_events ORDER BY occurred_at DESC,id DESC LIMIT -1 OFFSET 2000);");
}
export async function readActivityPageWithDb(db: MetadataDb, filter: ActivityFilter, cursor?: ActivityCursor, limit=40, now=Date.now()) {
  await pruneLibraryActivityWithDb(db,now);
  const take=Math.max(1,Math.min(100,Math.floor(limit)));
  const rows=await db.getAllAsync<Record<string,unknown>>(`SELECT e.* FROM library_activity_events e
    INNER JOIN saved_titles s ON s.id=e.saved_title_id
    WHERE e.occurred_at>=? ${filter==="all"?"":"AND e.origin=?"}
    ${cursor?"AND (e.occurred_at<? OR (e.occurred_at=? AND e.id<?))":""}
    ORDER BY e.occurred_at DESC,e.id DESC LIMIT ?;`,now-ACTIVITY_RETENTION_MS,...(filter==="all"?[]:[filter]),
    ...(cursor?[cursor.occurredAt,cursor.occurredAt,cursor.eventId]:[]),take+1);
  const events=rows.slice(0,take).map(row=>parsePortableActivity({id:row.id,itemId:row.saved_title_id,occurredAt:row.occurred_at,
    kind:row.kind,origin:row.origin,fields:JSON.parse(String(row.fields_json)),operationKey:row.operation_key}));
  const last=events[events.length-1];
  return {events,next:rows.length>take&&last?{occurredAt:last.occurredAt,eventId:last.id}:undefined};
}
export type ActivityPage = Awaited<ReturnType<typeof readActivityPageWithDb>>;
export type { PortableActivityEvent };

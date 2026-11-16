import { DEFAULT_MEDIA_PREFERENCES, parseMediaPreferences, type PortableMediaPreferences } from "../core/mediaPreferences";
import type { MetadataDb } from "./mediaMetadataRepo";
import type { MediaPreferences } from "../core/mediaPreferences";
import { runSerializedStorageMutation } from "./storageMutationQueue";
const KEY = "metadata.preferences";
const listeners = new Set<(value: PortableMediaPreferences) => void>();
export const subscribeMediaPreferences = (listener: (value: PortableMediaPreferences) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function publishMediaPreferences(value: PortableMediaPreferences): void { for (const listener of listeners) { try { listener(value); } catch { /* postcommit observer */ } } }
export async function readMediaPreferencesWithDb(db: Pick<MetadataDb, "getFirstAsync">): Promise<PortableMediaPreferences> {
  const row = await db.getFirstAsync<{ value: string; updated_at: number }>("SELECT value,updated_at FROM app_preferences WHERE key=?;", KEY);
  return row ? parseMediaPreferences({ value: JSON.parse(row.value), updatedAt: row.updated_at }) : { value: DEFAULT_MEDIA_PREFERENCES, updatedAt: 0 };
}
export async function mergeMediaPreferencesWithDb(db: MetadataDb, incoming: PortableMediaPreferences): Promise<boolean> {
  const checked = parseMediaPreferences(incoming), local = await readMediaPreferencesWithDb(db);
  if (checked.updatedAt <= local.updatedAt) return false;
  await db.runAsync(`INSERT INTO app_preferences VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;`, KEY, JSON.stringify(checked.value), checked.updatedAt);
  return true;
}
export async function setMediaPreferences(value: MediaPreferences, now = Date.now(),
  database?: MetadataDb & { withTransactionAsync(task: () => Promise<void>): Promise<void> }): Promise<void> {
  const db = database ?? await (await import("./db")).initDb();
  await runSerializedStorageMutation(async () => {
    let committed: PortableMediaPreferences | undefined;
    await db.withTransactionAsync(async () => {
      const old = await readMediaPreferencesWithDb(db);
      const incoming = parseMediaPreferences({ value, updatedAt: Math.max(now, old.updatedAt + 1) });
      if (await mergeMediaPreferencesWithDb(db, incoming)) committed = incoming;
    });
    if (committed) publishMediaPreferences(committed);
  });
}

export async function getMediaPreferences(): Promise<PortableMediaPreferences> {
  return runSerializedStorageMutation(async () => readMediaPreferencesWithDb(await (await import("./db")).initDb()));
}
/** Change only languages, after rereading the other preferences inside the transaction. */
export async function setMediaLanguages(languages: readonly string[], now = Date.now(),
  database?: MetadataDb & { withTransactionAsync(task: () => Promise<void>): Promise<void> }): Promise<void> {
  const db = database ?? await (await import("./db")).initDb();
  await runSerializedStorageMutation(async () => {
    let committed: PortableMediaPreferences | undefined;
    await db.withTransactionAsync(async () => {
      const old = await readMediaPreferencesWithDb(db);
      const next = parseMediaPreferences({ value: { ...old.value, languages }, updatedAt: Math.max(now,old.updatedAt+1) });
      if (JSON.stringify(next.value.languages) === JSON.stringify(old.value.languages)) return;
      if (await mergeMediaPreferencesWithDb(db,next)) committed=next;
    });
    if (committed) publishMediaPreferences(committed);
  });
}

/** Re-read the other preferences inside the transaction; never overwrite a concurrent language edit. */
export async function setMediaAutoRefresh(autoRefresh: MediaPreferences["autoRefresh"], now = Date.now(),
  database?: MetadataDb & { withTransactionAsync(task: () => Promise<void>): Promise<void> }): Promise<void> {
  const db = database ?? await (await import("./db")).initDb();
  await runSerializedStorageMutation(async () => {
    let committed: PortableMediaPreferences | undefined;
    await db.withTransactionAsync(async () => {
      const old = await readMediaPreferencesWithDb(db);
      const next = parseMediaPreferences({ value: { ...old.value, autoRefresh }, updatedAt: Math.max(now, old.updatedAt + 1) });
      if (JSON.stringify(next.value.autoRefresh) === JSON.stringify(old.value.autoRefresh)) return;
      if (await mergeMediaPreferencesWithDb(db, next)) committed = next;
    });
    if (committed) publishMediaPreferences(committed);
  });
}

/** Update only the visibility policy. Item/document/history data is never rewritten. */
export async function setMediaHideSensitive(hideSensitive:boolean, now=Date.now(),
  database?: MetadataDb & {withTransactionAsync(task:()=>Promise<void>):Promise<void>}):Promise<void> {
 const db=database??await(await import("./db")).initDb();
 await runSerializedStorageMutation(async()=>{
  let committed:PortableMediaPreferences|undefined;
  await db.withTransactionAsync(async()=>{
   const old=await readMediaPreferencesWithDb(db);
   const next=parseMediaPreferences({value:{...old.value,hideSensitive},updatedAt:Math.max(now,old.updatedAt+1)});
   if(next.value.hideSensitive===old.value.hideSensitive)return;
   if(await mergeMediaPreferencesWithDb(db,next))committed=next;
  });
  if(committed)publishMediaPreferences(committed);
 });
}

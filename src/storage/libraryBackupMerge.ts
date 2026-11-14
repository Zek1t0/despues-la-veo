import { legacyMetadataSnapshot, initialMetadataState, type MediaMetadataState } from "../core/mediaMetadataState";
import { historicalBaselineItemWithDb, hasMetadataSchemaWithDb, writeMetadataStateWithDb } from "./mediaMetadataRepo";
import { mergeMetadataStateWithDb, MetadataImportConflict } from "./mediaMetadataImport";
import { mergeMediaPreferencesWithDb } from "./mediaPreferencesRepo";
import type { PortableMediaPreferences } from "../core/mediaPreferences";
import { attachManualIdentityWithDb, assignManualIdentityWithDb, manualIdentityOwnerWithDb, ManualIdentityConflict } from "./manualEntryIdentities";
import { classificationFromHistoricalType } from "../core/mediaClassification";
import { savedTitleFromHistorical } from "../core/legacyMediaBoundary";
import type { SavedTitle } from "../core/savedTitle";
import { createTmdbProviderReference } from "../core/tmdbSavedTitle";
import { parsePersonalRating } from "../core/personalRating";
import { materializeSavedTitleForInsert, type NormalizedBackupSavedTitle } from "../core/libraryBackupV1";
import type { LibraryBackupPinV2 } from "../core/libraryBackupV2";
import type { BackupPinV6, BackupLegacyIdentityV6 } from "../core/libraryBackupV6";
import type { NormalizedBackupMediaItemV6 } from "../core/libraryBackupV6";
import type { ParsedLibraryBackup } from "../core/libraryBackup";
import { upsertSavedTitleAndCleanPinsWithDb } from "./savedTitleIntegrity";
import { mergeBackupPinWithDb } from "./titlePinsBackup";
import { parsePinContext } from "../core/contextualPin";
import { attachProviderReferenceWithDb, getSavedTitleByProviderReferenceWithDb, getSavedTitleWithReferencesByIdWithDb, rowToSavedTitle } from "./savedTitleStorage";

export { rowToSavedTitle } from "./savedTitleStorage";
export type LibraryImportIssue = { reference: string; reason: string };
export type LibraryImportMergeResult = { inserted: number; updated: number; skipped: number; conflicts: LibraryImportIssue[]; failed: LibraryImportIssue[] };
export type LibraryPinImportResult = { inserted: number; preserved: number; invalid: LibraryImportIssue[]; failed: LibraryImportIssue[] };
export type LibraryBackupMergeResult = LibraryImportMergeResult & { pins: LibraryPinImportResult; changedIds?: string[]; preferencesChanged?: PortableMediaPreferences; activityIssues?: string[] };
export type LibraryBackupMergeDb = { getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>; getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>; runAsync(sql: string, ...params: any[]): Promise<any>; withTransactionAsync(task: () => Promise<void>): Promise<void> };
class ImportConflict extends Error {}

type ImportMediaItem = Omit<NormalizedBackupMediaItemV6, "contentFamily"> & {
  contentFamily?: NormalizedBackupMediaItemV6["contentFamily"];
  manualIdentity?: string;
  metadataState?: MediaMetadataState;
};

/** Historical files supply medium/format, but have no family field to restore. */
function historicalClassificationForUpdate(type: NormalizedBackupSavedTitle["type"]) {
  const { contentFamily: _, ...classification } = classificationFromHistoricalType(type);
  return classification;
}

function safeArray(value: string): string[] { try { const v = JSON.parse(value); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } }
async function savepoint<T>(db: LibraryBackupMergeDb, name: "backup_item" | "backup_pin", task: () => Promise<T>): Promise<T> {
  await db.runAsync(`SAVEPOINT ${name};`);
  try { const value = await task(); await db.runAsync(`RELEASE SAVEPOINT ${name};`); return value; }
  catch (error) { await db.runAsync(`ROLLBACK TO SAVEPOINT ${name};`); await db.runAsync(`RELEASE SAVEPOINT ${name};`); throw error; }
}
async function occupied(db: LibraryBackupMergeDb, id: string) { return !!(await db.getFirstAsync("SELECT id FROM saved_titles WHERE id = ? LIMIT 1;", [id])); }
async function freeId(db: LibraryBackupMergeDb, preferred: string, generateId: () => string, remap = true): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const id = (i === 0 ? preferred : generateId()).trim();
    if (!id) throw new Error("El generador de IDs devolvió un ID vacío o inválido.");
    if (!(await occupied(db, id))) return id;
    if (!remap) throw new ImportConflict("El ID local está ocupado y el item no tiene identidad portable que permita remapearlo.");
  }
  throw new Error("No se pudo generar un ID libre después de 25 intentos.");
}
function updateFrom(local: SavedTitle, incoming: Omit<NormalizedBackupMediaItemV6, "providerReferences" | "legacyIdentity" | "contentFamily" | "id"> & { contentFamily?: NormalizedBackupMediaItemV6["contentFamily"] }): SavedTitle {
  return { ...local, medium: incoming.medium, contentFamily: incoming.contentFamily === undefined ? local.contentFamily : incoming.contentFamily, primaryFormat: incoming.primaryFormat, title: incoming.title,
    year: incoming.year.present ? incoming.year.value : local.year ?? null,
    posterUrl: incoming.posterUrl.present ? incoming.posterUrl.value : local.posterUrl ?? null,
    overview: incoming.overview.present ? incoming.overview.value : local.overview ?? null,
    voteAverage: incoming.voteAverage.present ? incoming.voteAverage.value : local.voteAverage ?? null,
    personalRating: incoming.personalRating.present ? parsePersonalRating(incoming.personalRating.value) : local.personalRating,
    genres: incoming.genres.present ? incoming.genres.value : local.genres ?? [], status: incoming.status.present ? incoming.status.value : local.status,
    tags: incoming.tags.present ? incoming.tags.value : local.tags ?? [], notes: incoming.notes.present ? incoming.notes.value : local.notes ?? null,
    updatedAt: incoming.updatedAt.present ? incoming.updatedAt.value : local.updatedAt };
}
function materializeImportItem(incoming: NormalizedBackupMediaItemV6, id: string, now = Date.now()): SavedTitle {
  return { id, medium: incoming.medium, contentFamily: incoming.contentFamily, primaryFormat: incoming.primaryFormat, title: incoming.title, year: incoming.year.present ? incoming.year.value : null,
    posterUrl: incoming.posterUrl.present ? incoming.posterUrl.value : null, overview: incoming.overview.present ? incoming.overview.value : null,
    voteAverage: incoming.voteAverage.present ? incoming.voteAverage.value : null, personalRating: incoming.personalRating.present ? parsePersonalRating(incoming.personalRating.value) : null,
    genres: incoming.genres.present ? incoming.genres.value : [], status: incoming.status.present ? incoming.status.value : "planned",
    tags: incoming.tags.present ? incoming.tags.value : [], notes: incoming.notes.present ? incoming.notes.value : null,
    createdAt: incoming.createdAt.present ? incoming.createdAt.value : now, updatedAt: incoming.updatedAt.present ? incoming.updatedAt.value : now };
}
async function resolveLegacy(db: LibraryBackupMergeDb, legacy: BackupLegacyIdentityV6): Promise<SavedTitle | null> {
  const row = await db.getFirstAsync<{ saved_title_id: string }>("SELECT saved_title_id FROM legacy_saved_title_identities WHERE legacy_format = ? AND legacy_provider = ? AND legacy_external_id = ? LIMIT 1;", [legacy.format, legacy.provider, legacy.externalId]);
  return row ? getSavedTitleWithReferencesByIdWithDb(db, row.saved_title_id) : null;
}
async function attachLegacy(db: LibraryBackupMergeDb, legacy: BackupLegacyIdentityV6, id: string) {
  const owner = await db.getFirstAsync<{ saved_title_id: string }>("SELECT saved_title_id FROM legacy_saved_title_identities WHERE legacy_format = ? AND legacy_provider = ? AND legacy_external_id = ? LIMIT 1;", [legacy.format, legacy.provider, legacy.externalId]);
  if (owner && owner.saved_title_id !== id) throw new ImportConflict("La identidad manual legacy ya pertenece a otro MediaItem.");
  if (owner) return;
  const existing = await db.getFirstAsync<{ legacy_external_id: string }>("SELECT legacy_external_id FROM legacy_saved_title_identities WHERE saved_title_id = ? LIMIT 1;", [id]);
  if (existing) throw new ImportConflict("El MediaItem ya tiene una identidad manual legacy diferente.");
  await db.runAsync("INSERT INTO legacy_saved_title_identities (legacy_format, legacy_provider, legacy_external_id, saved_title_id) VALUES (?, ?, ?, ?);", legacy.format, legacy.provider, legacy.externalId, id);
}
type Internal = LibraryImportMergeResult & { mapping: Map<string, string>; changedIds: string[] };
function baseResult(): Internal { return { inserted: 0, updated: 0, skipped: 0, conflicts: [], failed: [], mapping: new Map(), changedIds: [] }; }
function report(result: Internal, error: unknown, reference: string) { const issue = { reference, reason: error instanceof Error ? error.message : "No se pudo persistir el elemento." }; (error instanceof ImportConflict || error instanceof ManualIdentityConflict || error instanceof MetadataImportConflict ? result.conflicts : result.failed).push(issue); }

async function mergePortableItems(db: LibraryBackupMergeDb, items: ImportMediaItem[], generateId: () => string): Promise<Internal> {
  const result = baseResult();
  for (const incoming of items) {
    const backupId = incoming.id.value, label = `${incoming.title} [itemId=${backupId}]`;
    try {
      const resolved: SavedTitle[] = [];
      for (const reference of incoming.providerReferences) { const item = await getSavedTitleByProviderReferenceWithDb(db, reference); if (item) resolved.push(item); }
      if (incoming.legacyIdentity) { const item = await resolveLegacy(db, incoming.legacyIdentity); if (item) resolved.push(item); }
      if (incoming.manualIdentity !== undefined) {
        const owner = await manualIdentityOwnerWithDb(db, incoming.manualIdentity);
        if (owner !== null) {
          const item = await getSavedTitleWithReferencesByIdWithDb(db, owner);
          if (!item) throw new Error("Identidad manual huérfana.");
          resolved.push(item);
        }
      }
      const ids = [...new Set(resolved.map((item) => item.id))];
      if (ids.length > 1) throw new ImportConflict("Las identidades entrantes resuelven MediaItems locales diferentes.");
      const local = ids.length ? await getSavedTitleWithReferencesByIdWithDb(db, ids[0]) : null;
      const outcome = await savepoint(db, "backup_item", async () => {
        if (local) {
          if (local.medium !== incoming.medium) throw new ImportConflict("El medio entrante no coincide con el MediaItem local resuelto.");
          if (incoming.manualIdentity !== undefined) await attachManualIdentityWithDb(db, incoming.manualIdentity, local.id);
          for (const reference of incoming.providerReferences) await attachProviderReferenceWithDb(db, reference, local.id);
          if (incoming.legacyIdentity) await attachLegacy(db, incoming.legacyIdentity, local.id);
          if (!incoming.updatedAt.present || incoming.updatedAt.value <= local.updatedAt) {
            const changed = incoming.metadataState ? await mergeMetadataStateWithDb(db, local.id, incoming.metadataState, false) : false;
            return { id: local.id, count: changed ? "updated" as const : "skipped" as const };
          }
          const historical = await historicalBaselineItemWithDb(db, local);
          const personalInput = incoming.metadataState ? { ...incoming, ...Object.fromEntries(Object.entries(legacyMetadataSnapshot(historical)).map(([key,value]) =>
            [key, ["title","medium","contentFamily","primaryFormat"].includes(key) ? value : { present: true, value }])) } as ImportMediaItem : incoming;
          await upsertSavedTitleAndCleanPinsWithDb(db, updateFrom(historical, personalInput), { preserveMetadataBaseline: !!incoming.metadataState });
          if (incoming.metadataState) await mergeMetadataStateWithDb(db, local.id, incoming.metadataState, false);
          return { id: local.id, count: "updated" as const };
        } else {
          const id = await freeId(db, backupId, generateId, incoming.providerReferences.length > 0 || !!incoming.legacyIdentity || incoming.manualIdentity !== undefined);
          await upsertSavedTitleAndCleanPinsWithDb(db, materializeImportItem({ ...incoming, contentFamily: incoming.contentFamily ?? null }, id));
          for (const reference of incoming.providerReferences) await attachProviderReferenceWithDb(db, reference, id);
          if (incoming.legacyIdentity) await attachLegacy(db, incoming.legacyIdentity, id);
          if (incoming.manualIdentity !== undefined) await attachManualIdentityWithDb(db, incoming.manualIdentity, id);
          else if (incoming.providerReferences.length === 0 && !incoming.legacyIdentity) await assignManualIdentityWithDb(db, id);
          if (incoming.metadataState) await mergeMetadataStateWithDb(db, id, incoming.metadataState, true);
          else if (await hasMetadataSchemaWithDb(db)) {
            const inserted = await getSavedTitleWithReferencesByIdWithDb(db, id);
            if (inserted) await writeMetadataStateWithDb(db, id, initialMetadataState(inserted, inserted.providerReferences));
          }
          return { id, count: "inserted" as const };
        }
      });
      result[outcome.count]++;
      result.mapping.set(backupId, outcome.id);
      if (outcome.count !== "skipped") result.changedIds.push(outcome.id);
    } catch (error) { report(result, error, label); }
  }
  return result;
}

async function historicalLocal(db: LibraryBackupMergeDb, item: NormalizedBackupSavedTitle) {
  return item.provider === "tmdb" ? getSavedTitleByProviderReferenceWithDb(db, createTmdbProviderReference(item.type, item.externalId)) : resolveLegacy(db, { format: "library-backup-v1-v4", provider: "manual", externalId: item.externalId });
}
async function attachHistorical(db: LibraryBackupMergeDb, item: NormalizedBackupSavedTitle, id: string) {
  if (item.provider === "tmdb") await attachProviderReferenceWithDb(db, createTmdbProviderReference(item.type, item.externalId), id);
  else await attachLegacy(db, { format: "library-backup-v1-v4", provider: "manual", externalId: item.externalId }, id);
}
async function mergeHistorical(db: LibraryBackupMergeDb, items: NormalizedBackupSavedTitle[], generateId: () => string): Promise<Internal & { historical: Map<string, string[]> }> {
  const result = { ...baseResult(), historical: new Map<string, string[]>() };
  for (const incoming of items) {
    const label = `${incoming.title} [${incoming.provider}/${incoming.type}/${incoming.externalId}]`;
    try {
      let local = await historicalLocal(db, incoming);
      const count = await savepoint(db, "backup_item", async () => {
        if (local) {
          if (local.medium !== "audiovisual") throw new ImportConflict("El medio histórico no coincide con el MediaItem local resuelto.");
          if (!incoming.updatedAt.present || incoming.updatedAt.value <= local.updatedAt) return "skipped" as const;
          await upsertSavedTitleAndCleanPinsWithDb(db, updateFrom(await historicalBaselineItemWithDb(db, local), { ...incoming, ...historicalClassificationForUpdate(incoming.type) }));
          return "updated" as const;
        }
        const item = savedTitleFromHistorical(materializeSavedTitleForInsert(incoming, generateId));
        item.id = await freeId(db, item.id, generateId);
        await upsertSavedTitleAndCleanPinsWithDb(db, item);
        await attachHistorical(db, incoming, item.id);
        if (await hasMetadataSchemaWithDb(db)) {
          const inserted = await getSavedTitleWithReferencesByIdWithDb(db, item.id);
          if (inserted) await writeMetadataStateWithDb(db, item.id, initialMetadataState(inserted, inserted.providerReferences));
        }
        local = item;
        return "inserted" as const;
      });
      result[count]++;
      if (local && count !== "skipped") result.changedIds.push(local.id);
      if (local) { const key = `${incoming.provider}\u0000${incoming.externalId}`; result.historical.set(key, [...(result.historical.get(key) ?? []), local.id]); }
    } catch (error) { report(result, error, label); }
  }
  return result;
}
export async function mergeLibraryBackupItemsWithDb(db: LibraryBackupMergeDb, items: NormalizedBackupSavedTitle[], generateId: () => string): Promise<LibraryImportMergeResult> { const { mapping: _, historical: __, changedIds: ___, ...result } = await mergeHistorical(db, items, generateId); return result; }
function pinResult(): LibraryPinImportResult { return { inserted: 0, preserved: 0, invalid: [], failed: [] }; }
async function mappedPin(db: LibraryBackupMergeDb, result: LibraryPinImportResult, id: string | undefined, pin: { contextType: unknown; contextKey: unknown; pinnedAt: number }, label: string) {
  if (!id) { result.invalid.push({ reference: label, reason: "El item referido no existe o no pudo importarse." }); return; }
  const context = parsePinContext(pin.contextType, pin.contextKey);
  if (!context) { result.invalid.push({ reference: label, reason: "El contexto del pin no es aplicable." }); return; }
  if (context.contextType === "tag") { const row = await db.getFirstAsync<{ tags_json: string }>("SELECT tags_json FROM saved_titles WHERE id = ? LIMIT 1;", [id]); if (!row || !safeArray(row.tags_json).map((x) => x.trim()).includes(context.contextKey)) { result.invalid.push({ reference: label, reason: "El título final no pertenece exactamente a la etiqueta indicada." }); return; } }
  try { const outcome = await savepoint(db, "backup_pin", () => mergeBackupPinWithDb(db, id, context, pin.pinnedAt)); result[outcome]++; } catch (error) { result.failed.push({ reference: label, reason: error instanceof Error ? error.message : "No se pudo persistir el pin." }); }
}
async function portablePins(db: LibraryBackupMergeDb, pins: BackupPinV6[], mapping: Map<string, string>) { const result = pinResult(); for (const pin of pins) await mappedPin(db, result, mapping.get(pin.itemId), pin, `${pin.itemId} (${pin.contextType}:${pin.contextKey})`); return result; }
async function historicalPins(db: LibraryBackupMergeDb, pins: LibraryBackupPinV2[], candidates: Map<string, string[]>) {
  const result = pinResult();
  for (const pin of pins) { const label = `${pin.provider}:${pin.externalId} (${pin.contextType}:${pin.contextKey})`; const ids = [...new Set(candidates.get(`${pin.provider}\u0000${pin.externalId}`) ?? [])]; if (ids.length !== 1) { result.invalid.push({ reference: label, reason: ids.length ? "El pin es ambiguo entre varios items del mismo backup." : "El backup no contiene un item elegible para este pin." }); } else await mappedPin(db, result, ids[0], pin, label); }
  return result;
}
export async function mergeLibraryBackupWithDb(
  db: LibraryBackupMergeDb,
  payloadOrItems: ParsedLibraryBackup | NormalizedBackupSavedTitle[],
  generateIdOrPins: (() => string) | LibraryBackupPinV2[] | null,
  legacyGenerateId?: () => string
): Promise<LibraryBackupMergeResult> {
  const payload: ParsedLibraryBackup = Array.isArray(payloadOrItems)
    ? (generateIdOrPins === null
      ? { version: 1, items: payloadOrItems, invalid: [] }
      : { version: 2, items: payloadOrItems, invalid: [], pins: generateIdOrPins as LibraryBackupPinV2[], invalidPins: [] })
    : payloadOrItems;
  const generateId = (Array.isArray(payloadOrItems) ? legacyGenerateId : generateIdOrPins) as () => string;
  if (payload.version === 5 || payload.version === 6 || payload.version === 7 || payload.version === 8) {
    const items = payload.version === 6 || payload.version === 7 || payload.version === 8 ? payload.items : payload.items.map(item => {
      const { type, ...historical } = item;
      return { ...historical, ...historicalClassificationForUpdate(type) };
    });
    const internal = await mergePortableItems(db, items, generateId);
    const pins = await portablePins(db, payload.pins, internal.mapping);
    const activityIssues: string[] = [];
    let preferencesChanged: PortableMediaPreferences | undefined;
    if (payload.version === 8) {
      if (payload.preferences && await mergeMediaPreferencesWithDb(db, payload.preferences)) preferencesChanged = payload.preferences;
      for (const event of payload.activity ?? []) {
        const id = internal.mapping.get(event.itemId);
        if (!id) { activityIssues.push("El evento refiere un item no restaurable."); continue; }
        try {
          const existing = await db.getFirstAsync<{ id: string; saved_title_id: string; occurred_at: number; kind: string; origin: string; fields_json: string }>(
            "SELECT * FROM library_activity_events WHERE id=? OR operation_key=?;", event.id, event.operationKey);
          if (existing && (existing.saved_title_id !== id || existing.occurred_at !== event.occurredAt || existing.kind !== event.kind ||
              existing.origin !== event.origin || existing.fields_json !== JSON.stringify(event.fields))) {
            activityIssues.push("Conflicto de identidad o contenido del evento."); continue;
          }
          await db.runAsync("INSERT OR IGNORE INTO library_activity_events VALUES (?,?,?,?,?,?,?);", event.id, id, event.occurredAt, event.kind, event.origin, JSON.stringify(event.fields), event.operationKey);
        }
        catch { activityIssues.push("No se pudo restaurar un evento."); }
      }
      await db.runAsync("DELETE FROM library_activity_events WHERE occurred_at<?;", Date.now() - 90 * 86400000);
      await db.runAsync("DELETE FROM library_activity_events WHERE id NOT IN (SELECT id FROM library_activity_events ORDER BY occurred_at DESC,id DESC LIMIT 2000);");
    }
    const { mapping: _, ...titles } = internal;
    return { ...titles, pins, ...(preferencesChanged ? { preferencesChanged } : {}), ...(activityIssues.length ? { activityIssues } : {}) }; }
  const internal = await mergeHistorical(db, payload.items, generateId); const pins = payload.version === 1 ? pinResult() : await historicalPins(db, payload.pins, internal.historical); const { mapping: _, historical: __, ...titles } = internal; return { ...titles, pins };
}

import type { SavedTitle } from "../core/savedTitle";
import { createTmdbProviderReference } from "../core/tmdbSavedTitle";
import { parsePersonalRating } from "../core/personalRating";
import { materializeSavedTitleForInsert, type NormalizedBackupSavedTitle } from "../core/libraryBackupV1";
import type { LibraryBackupPinV2 } from "../core/libraryBackupV2";
import type { BackupPinV5, NormalizedBackupMediaItemV5, BackupLegacyIdentityV5 } from "../core/libraryBackupV5";
import type { ParsedLibraryBackup } from "../core/libraryBackup";
import { upsertSavedTitleAndCleanPinsWithDb } from "./savedTitleIntegrity";
import { mergeBackupPinWithDb } from "./titlePinsBackup";
import { parsePinContext } from "../core/contextualPin";
import { attachProviderReferenceWithDb, getSavedTitleByProviderReferenceWithDb, getSavedTitleWithReferencesByIdWithDb, rowToSavedTitle } from "./savedTitleStorage";

export { rowToSavedTitle } from "./savedTitleStorage";
export type LibraryImportIssue = { reference: string; reason: string };
export type LibraryImportMergeResult = { inserted: number; updated: number; skipped: number; conflicts: LibraryImportIssue[]; failed: LibraryImportIssue[] };
export type LibraryPinImportResult = { inserted: number; preserved: number; invalid: LibraryImportIssue[]; failed: LibraryImportIssue[] };
export type LibraryBackupMergeResult = LibraryImportMergeResult & { pins: LibraryPinImportResult };
export type LibraryBackupMergeDb = { getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>; getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>; runAsync(sql: string, ...params: any[]): Promise<any>; withTransactionAsync(task: () => Promise<void>): Promise<void> };
class ImportConflict extends Error {}

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
function updateFrom(local: SavedTitle, incoming: Omit<NormalizedBackupSavedTitle, "provider" | "externalId">): SavedTitle {
  return { ...local, title: incoming.title,
    year: incoming.year.present ? incoming.year.value : local.year ?? null,
    posterUrl: incoming.posterUrl.present ? incoming.posterUrl.value : local.posterUrl ?? null,
    overview: incoming.overview.present ? incoming.overview.value : local.overview ?? null,
    voteAverage: incoming.voteAverage.present ? incoming.voteAverage.value : local.voteAverage ?? null,
    personalRating: incoming.personalRating.present ? parsePersonalRating(incoming.personalRating.value) : local.personalRating,
    genres: incoming.genres.present ? incoming.genres.value : local.genres ?? [], status: incoming.status.present ? incoming.status.value : local.status,
    tags: incoming.tags.present ? incoming.tags.value : local.tags ?? [], notes: incoming.notes.present ? incoming.notes.value : local.notes ?? null,
    updatedAt: incoming.updatedAt.present ? incoming.updatedAt.value : local.updatedAt };
}
function insertV5(incoming: NormalizedBackupMediaItemV5, id: string, now = Date.now()): SavedTitle {
  return { id, type: incoming.type, title: incoming.title, year: incoming.year.present ? incoming.year.value : null,
    posterUrl: incoming.posterUrl.present ? incoming.posterUrl.value : null, overview: incoming.overview.present ? incoming.overview.value : null,
    voteAverage: incoming.voteAverage.present ? incoming.voteAverage.value : null, personalRating: incoming.personalRating.present ? parsePersonalRating(incoming.personalRating.value) : null,
    genres: incoming.genres.present ? incoming.genres.value : [], status: incoming.status.present ? incoming.status.value : "planned",
    tags: incoming.tags.present ? incoming.tags.value : [], notes: incoming.notes.present ? incoming.notes.value : null,
    createdAt: incoming.createdAt.present ? incoming.createdAt.value : now, updatedAt: incoming.updatedAt.present ? incoming.updatedAt.value : now };
}
async function resolveLegacy(db: LibraryBackupMergeDb, legacy: BackupLegacyIdentityV5): Promise<SavedTitle | null> {
  const row = await db.getFirstAsync<{ saved_title_id: string }>("SELECT saved_title_id FROM legacy_saved_title_identities WHERE legacy_format = ? AND legacy_provider = ? AND legacy_external_id = ? LIMIT 1;", [legacy.format, legacy.provider, legacy.externalId]);
  return row ? getSavedTitleWithReferencesByIdWithDb(db, row.saved_title_id) : null;
}
async function attachLegacy(db: LibraryBackupMergeDb, legacy: BackupLegacyIdentityV5, id: string) {
  const owner = await db.getFirstAsync<{ saved_title_id: string }>("SELECT saved_title_id FROM legacy_saved_title_identities WHERE legacy_format = ? AND legacy_provider = ? AND legacy_external_id = ? LIMIT 1;", [legacy.format, legacy.provider, legacy.externalId]);
  if (owner && owner.saved_title_id !== id) throw new ImportConflict("La identidad manual legacy ya pertenece a otro MediaItem.");
  if (owner) return;
  const existing = await db.getFirstAsync<{ legacy_external_id: string }>("SELECT legacy_external_id FROM legacy_saved_title_identities WHERE saved_title_id = ? LIMIT 1;", [id]);
  if (existing) throw new ImportConflict("El MediaItem ya tiene una identidad manual legacy diferente.");
  await db.runAsync("INSERT INTO legacy_saved_title_identities (legacy_format, legacy_provider, legacy_external_id, saved_title_id) VALUES (?, ?, ?, ?);", legacy.format, legacy.provider, legacy.externalId, id);
}
type Internal = LibraryImportMergeResult & { mapping: Map<string, string> };
function baseResult(): Internal { return { inserted: 0, updated: 0, skipped: 0, conflicts: [], failed: [], mapping: new Map() }; }
function report(result: Internal, error: unknown, reference: string) { const issue = { reference, reason: error instanceof Error ? error.message : "No se pudo persistir el elemento." }; (error instanceof ImportConflict ? result.conflicts : result.failed).push(issue); }

async function mergeV5Items(db: LibraryBackupMergeDb, items: NormalizedBackupMediaItemV5[], generateId: () => string): Promise<Internal> {
  const result = baseResult();
  for (const incoming of items) {
    const backupId = incoming.id.value, label = `${incoming.title} [itemId=${backupId}]`;
    try {
      const resolved: SavedTitle[] = [];
      for (const reference of incoming.providerReferences) { const item = await getSavedTitleByProviderReferenceWithDb(db, reference); if (item) resolved.push(item); }
      if (incoming.legacyIdentity) { const item = await resolveLegacy(db, incoming.legacyIdentity); if (item) resolved.push(item); }
      const ids = [...new Set(resolved.map((item) => item.id))];
      if (ids.length > 1) throw new ImportConflict("Las identidades entrantes resuelven MediaItems locales diferentes.");
      const local = ids.length ? await getSavedTitleWithReferencesByIdWithDb(db, ids[0]) : null;
      await savepoint(db, "backup_item", async () => {
        if (local) {
          if (local.type !== incoming.type) throw new ImportConflict("El tipo movie/tv entrante no coincide con el MediaItem local resuelto.");
          for (const reference of incoming.providerReferences) await attachProviderReferenceWithDb(db, reference, local.id);
          if (incoming.legacyIdentity) await attachLegacy(db, incoming.legacyIdentity, local.id);
          if (!incoming.updatedAt.present || incoming.updatedAt.value <= local.updatedAt) result.skipped++;
          else { await upsertSavedTitleAndCleanPinsWithDb(db, updateFrom(local, incoming)); result.updated++; }
          result.mapping.set(backupId, local.id);
        } else {
          const id = await freeId(db, backupId, generateId, incoming.providerReferences.length > 0 || !!incoming.legacyIdentity);
          await upsertSavedTitleAndCleanPinsWithDb(db, insertV5(incoming, id));
          for (const reference of incoming.providerReferences) await attachProviderReferenceWithDb(db, reference, id);
          if (incoming.legacyIdentity) await attachLegacy(db, incoming.legacyIdentity, id);
          result.inserted++; result.mapping.set(backupId, id);
        }
      });
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
      await savepoint(db, "backup_item", async () => {
        if (local) { if (local.type !== incoming.type) throw new ImportConflict("El tipo movie/tv histórico no coincide con el MediaItem local resuelto."); if (!incoming.updatedAt.present || incoming.updatedAt.value <= local.updatedAt) result.skipped++; else { await upsertSavedTitleAndCleanPinsWithDb(db, updateFrom(local, incoming)); result.updated++; } }
        else { const item = materializeSavedTitleForInsert(incoming, generateId); item.id = await freeId(db, item.id, generateId); await upsertSavedTitleAndCleanPinsWithDb(db, item); await attachHistorical(db, incoming, item.id); local = item; result.inserted++; }
      });
      if (local) { const key = `${incoming.provider}\u0000${incoming.externalId}`; result.historical.set(key, [...(result.historical.get(key) ?? []), local.id]); }
    } catch (error) { report(result, error, label); }
  }
  return result;
}
export async function mergeLibraryBackupItemsWithDb(db: LibraryBackupMergeDb, items: NormalizedBackupSavedTitle[], generateId: () => string): Promise<LibraryImportMergeResult> { const { mapping: _, historical: __, ...result } = await mergeHistorical(db, items, generateId); return result; }
function pinResult(): LibraryPinImportResult { return { inserted: 0, preserved: 0, invalid: [], failed: [] }; }
async function mappedPin(db: LibraryBackupMergeDb, result: LibraryPinImportResult, id: string | undefined, pin: { contextType: unknown; contextKey: unknown; pinnedAt: number }, label: string) {
  if (!id) { result.invalid.push({ reference: label, reason: "El item referido no existe o no pudo importarse." }); return; }
  const context = parsePinContext(pin.contextType, pin.contextKey);
  if (!context) { result.invalid.push({ reference: label, reason: "El contexto del pin no es aplicable." }); return; }
  if (context.contextType === "tag") { const row = await db.getFirstAsync<{ tags_json: string }>("SELECT tags_json FROM saved_titles WHERE id = ? LIMIT 1;", [id]); if (!row || !safeArray(row.tags_json).map((x) => x.trim()).includes(context.contextKey)) { result.invalid.push({ reference: label, reason: "El título final no pertenece exactamente a la etiqueta indicada." }); return; } }
  try { const outcome = await savepoint(db, "backup_pin", () => mergeBackupPinWithDb(db, id, context, pin.pinnedAt)); result[outcome]++; } catch (error) { result.failed.push({ reference: label, reason: error instanceof Error ? error.message : "No se pudo persistir el pin." }); }
}
async function v5Pins(db: LibraryBackupMergeDb, pins: BackupPinV5[], mapping: Map<string, string>) { const result = pinResult(); for (const pin of pins) await mappedPin(db, result, mapping.get(pin.itemId), pin, `${pin.itemId} (${pin.contextType}:${pin.contextKey})`); return result; }
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
  if (payload.version === 5) { const internal = await mergeV5Items(db, payload.items, generateId); const pins = await v5Pins(db, payload.pins, internal.mapping); const { mapping: _, ...titles } = internal; return { ...titles, pins }; }
  const internal = await mergeHistorical(db, payload.items, generateId); const pins = payload.version === 1 ? pinResult() : await historicalPins(db, payload.pins, internal.historical); const { mapping: _, historical: __, ...titles } = internal; return { ...titles, pins };
}

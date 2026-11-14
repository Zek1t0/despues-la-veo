import type { SavedTitle } from "../core/savedTitle";
import { initialMetadataState, legacyMetadataSnapshot, parseMediaMetadataState, parsePortableMetadata, projectMediaMetadata, type MediaMetadataState, type LegacyMetadataSnapshot } from "../core/mediaMetadataState";
import { providerReferencesEqual, type ProviderReference } from "../core/providerReference";
import type { EnrichedMediaMetadata } from "../core/enrichedMediaMetadata";
import { metadataTimestamp } from "../core/metadataValidation";
import { rowToSavedTitle, listProviderReferencesForSavedTitleWithDb } from "./savedTitleRows";
import type { SavedTitleStorageReadDatabase } from "./savedTitleStorage";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import { metadataSemanticKey } from "../core/metadataSemanticKey";
import { publishLibraryInvalidation } from "./libraryInvalidation";
import type { MetadataPatch } from "../core/metadataPatch";
import { METADATA_FIELD_NAMES, metadataObject } from "../core/metadataValidation";
import { generateManualEntryIdentity } from "../core/manualEntryIdentity";

export type MetadataDb = SavedTitleStorageReadDatabase & { runAsync(source: string, ...params: any[]): Promise<unknown> };
export async function hasMetadataSchemaWithDb(db: SavedTitleStorageReadDatabase): Promise<boolean> {
  return !!await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='media_metadata_selection';");
}
export async function readMetadataStateWithDb(db: SavedTitleStorageReadDatabase, id: string): Promise<MediaMetadataState | undefined> {
  if (!await hasMetadataSchemaWithDb(db)) return undefined;
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM media_metadata_selection WHERE saved_title_id=?;", id);
  if (!row) return undefined;
  const docs = await db.getAllAsync<{ document_json: string; metadata_changed_at: number }>(
    "SELECT document_json,metadata_changed_at FROM media_metadata WHERE saved_title_id=? ORDER BY provider,resource_namespace,external_id;", id);
  const state: MediaMetadataState = { version: 1, baseline: { snapshot: JSON.parse(String(row.legacy_snapshot_json)), reference: row.baseline_reference_json ? JSON.parse(String(row.baseline_reference_json)) : null,
    updatedAt: Number(row.baseline_updated_at) }, selection: { reference: row.provider === null ? null : {
      provider: String(row.provider), resourceNamespace: String(row.resource_namespace), externalId: String(row.external_id) }, updatedAt: Number(row.selected_at) },
    documents: docs.map(doc => {
      const stored = JSON.parse(doc.document_json);
      return { metadata: stored.metadata ?? stored, changedAt: doc.metadata_changed_at, ...(stored.snapshot ? { snapshot: stored.snapshot } : {}) };
    }) };
  return parseMediaMetadataState(state, await listProviderReferencesForSavedTitleWithDb(db, id), state.baseline.snapshot.medium);
}
export async function writeMetadataStateWithDb(db: MetadataDb, id: string, state: MediaMetadataState): Promise<void> {
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM saved_titles WHERE id=?;", id);
  if (!row) throw new Error("El título dejó de existir.");
  const references = await listProviderReferencesForSavedTitleWithDb(db, id);
  const checked = parseMediaMetadataState(state, references, String(row.medium));
  const ref = checked.selection.reference;
  await db.runAsync(`INSERT INTO media_metadata_selection VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(saved_title_id) DO UPDATE SET
    provider=excluded.provider,resource_namespace=excluded.resource_namespace,external_id=excluded.external_id,selected_at=excluded.selected_at,
    legacy_snapshot_json=excluded.legacy_snapshot_json,baseline_reference_json=excluded.baseline_reference_json,baseline_updated_at=excluded.baseline_updated_at;`,
    id, ref?.provider ?? null, ref?.resourceNamespace ?? null, ref?.externalId ?? null, checked.selection.updatedAt,
    JSON.stringify(checked.baseline.snapshot), checked.baseline.reference ? JSON.stringify(checked.baseline.reference) : null, checked.baseline.updatedAt);
  for (const doc of checked.documents) {
    const source = doc.metadata.provenance.reference;
    await db.runAsync(`INSERT INTO media_metadata VALUES (?,?,?,?,1,?,?,?,?,1) ON CONFLICT(saved_title_id,provider,resource_namespace,external_id) DO UPDATE SET
      document_json=excluded.document_json,metadata_changed_at=excluded.metadata_changed_at,checked_at=excluded.checked_at,source_updated_at=excluded.source_updated_at,revision=media_metadata.revision+1;`,
      id, source.provider, source.resourceNamespace, source.externalId, JSON.stringify({ metadata: doc.metadata, ...(doc.snapshot ? { snapshot: doc.snapshot } : {}) }), doc.changedAt, doc.metadata.provenance.checkedAt, doc.metadata.provenance.sourceUpdatedAt);
    await db.runAsync("DELETE FROM media_title_aliases WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=?;", id, source.provider, source.resourceNamespace, source.externalId);
    for (const title of [...doc.metadata.fields.titles ?? [], ...doc.metadata.fields.abbreviatedTitles ?? []]) {
      await db.runAsync("INSERT OR IGNORE INTO media_title_aliases VALUES (?,?,?,?,?,?,?,?);", id, source.provider, source.resourceNamespace, source.externalId,
        title.value, normalizeMetadataAlias(title.value), title.language, title.script);
    }
  }
  const projection = projectMediaMetadata(checked);
  await db.runAsync(`UPDATE saved_titles SET title=?,year=?,poster_url=?,overview=?,vote_average=?,genres_json=?,medium=?,content_family=?,primary_format=? WHERE id=?;`,
    projection.title, projection.year, projection.posterUrl, projection.overview, projection.voteAverage, JSON.stringify(projection.genres),
    projection.medium, projection.contentFamily, projection.primaryFormat, id);
}
export function normalizeMetadataAlias(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}
export async function ensureMetadataStateWithDb(db: MetadataDb, item: SavedTitle): Promise<MediaMetadataState | undefined> {
  if (!await hasMetadataSchemaWithDb(db)) return undefined;
  const previous = await readMetadataStateWithDb(db, item.id);
  if (previous) return previous;
  const state = initialMetadataState(item, await listProviderReferencesForSavedTitleWithDb(db, item.id));
  await writeMetadataStateWithDb(db, item.id, state);
  return state;
}
/** Legacy writes change only the independent historical baseline; documents keep authority. */
export async function acceptLegacyMetadataWriteWithDb(db: MetadataDb, item: SavedTitle, previous: SavedTitle | null): Promise<void> {
  const state = await ensureMetadataStateWithDb(db, item);
  if (!state) return;
  if (!previous || JSON.stringify(legacyMetadataSnapshot(previous)) !== JSON.stringify(legacyMetadataSnapshot(item))) {
    await writeMetadataStateWithDb(db, item.id, { ...state, baseline: { ...state.baseline,
      snapshot: legacyMetadataSnapshot(item), updatedAt: item.updatedAt } });
  } else await writeMetadataStateWithDb(db, item.id, state);
}
export async function historicalBaselineItemWithDb<T extends SavedTitle>(db: SavedTitleStorageReadDatabase, item: T): Promise<T> {
  const state = await readMetadataStateWithDb(db, item.id);
  return state ? { ...item, ...state.baseline.snapshot } : item;
}

export async function beginMetadataRequestWithDb(db: MetadataDb, id: string, reference: ProviderReference): Promise<number> {
  await db.runAsync(`INSERT INTO media_refresh_state (saved_title_id,provider,resource_namespace,external_id,generation) VALUES (?,?,?,?,1)
    ON CONFLICT(saved_title_id,provider,resource_namespace,external_id) DO UPDATE SET generation=generation+1;`, id, reference.provider, reference.resourceNamespace, reference.externalId);
  const row = await db.getFirstAsync<{ generation: number }>("SELECT generation FROM media_refresh_state WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=?;", id, reference.provider, reference.resourceNamespace, reference.externalId);
  return row!.generation;
}
export async function updateMediaMetadataWithDb(db: MetadataDb, id: string, value: EnrichedMediaMetadata, now: number,
  generation?: number, eventId?: string, snapshot?: LegacyMetadataSnapshot): Promise<{ changed: boolean; discarded: boolean; checkedAt?: number | null }> {
  if (!metadataTimestamp(now)) throw new Error("Reloj de metadata inválido.");
  const metadata = parsePortableMetadata(value), reference = metadata.provenance.reference;
  const owner = await db.getFirstAsync("SELECT saved_title_id FROM media_provider_references WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=?;", id, reference.provider, reference.resourceNamespace, reference.externalId);
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM saved_titles WHERE id=?;", id);
  if (!row || !owner) return { changed: false, discarded: true };
  if (generation !== undefined) {
    const current = await db.getFirstAsync<{ generation: number }>("SELECT generation FROM media_refresh_state WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=?;", id, reference.provider, reference.resourceNamespace, reference.externalId);
    if (current?.generation !== generation) return { changed: false, discarded: true };
  }
  const state = (await ensureMetadataStateWithDb(db, rowToSavedTitle(row)))!;
  const old = state.documents.find(doc => providerReferencesEqual(doc.metadata.provenance.reference, reference));
  if (old && old.changedAt <= Date.now() && now < old.changedAt) return { changed: false, discarded: true };
  const fields = { ...old?.metadata.fields, ...metadata.fields };
  const changed = metadataSemanticKey(fields) !== metadataSemanticKey(old?.metadata.fields ?? {}) ||
    (snapshot !== undefined && metadataSemanticKey(snapshot) !== metadataSemanticKey(old?.snapshot));
  const merged = parsePortableMetadata({ ...metadata, fields, provenance: { ...metadata.provenance,
    fetchedAt: metadata.provenance.fetchedAt ?? old?.metadata.provenance.fetchedAt ?? null,
    checkedAt: metadata.provenance.checkedAt ?? old?.metadata.provenance.checkedAt ?? null, sourceUpdatedAt: metadata.provenance.sourceUpdatedAt ?? old?.metadata.provenance.sourceUpdatedAt ?? null } });
  const document = { metadata: merged, ...(snapshot ?? old?.snapshot ? { snapshot: snapshot ?? old!.snapshot } : {}), changedAt: changed ? Math.max(now, (old && old.changedAt <= Date.now() ? old.changedAt : -1) + 1) : old?.changedAt ?? now };
  await writeMetadataStateWithDb(db, id, { ...state, documents: [...state.documents.filter(doc => !providerReferencesEqual(doc.metadata.provenance.reference, reference)), document] });
  if (changed) {
    const operation = JSON.stringify(["metadata", id, reference.provider, reference.resourceNamespace, reference.externalId, document.changedAt]);
    const previousEvent = await db.getFirstAsync("SELECT id FROM library_activity_events WHERE operation_key=?;", operation);
    if (!previousEvent) {
      let inserted = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        const candidate = eventId ?? generateManualEntryIdentity().replace(/^manual-/, "activity-");
        if (await db.getFirstAsync("SELECT id FROM library_activity_events WHERE id=?;", candidate)) {
          if (eventId) throw new Error("El ID de actividad ya pertenece a otra operación.");
          continue;
        }
        await db.runAsync("INSERT INTO library_activity_events VALUES (?,?,?,'metadata','metadata',?,?);",
          candidate, id, now, JSON.stringify(Object.keys(metadata.fields)), operation);
        inserted = true; break;
      }
      if (!inserted) throw new Error("No se pudo generar un ID de actividad libre.");
    }
  }
  return { changed, discarded: false, checkedAt: merged.provenance.checkedAt };
}
export async function updateMediaMetadata(id: string, metadata: EnrichedMediaMetadata, now = Date.now(), generation?: number,
  database?: MetadataDb & { withTransactionAsync(task: () => Promise<void>): Promise<void> }) {
  const db = database ?? await (await import("./db")).initDb();
  return runSerializedStorageMutation(async () => {
    let result: Awaited<ReturnType<typeof updateMediaMetadataWithDb>> = { changed: false, discarded: false };
    await db.withTransactionAsync(async () => { result = await updateMediaMetadataWithDb(db, id, metadata, now, generation); });
    if (result.changed) publishLibraryInvalidation([id]);
    return result;
  });
}
export async function patchMediaMetadataWithDb(db: MetadataDb, id: string, reference: ProviderReference, patch: MetadataPatch,
  now: number, generation?: number) {
  const fields: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(patch)) {
    if (!METADATA_FIELD_NAMES.includes(key as never) || !metadataObject(entry) ||
        Object.keys(entry).some(name => !["kind","value"].includes(name)) ||
        !["not-provided","unknown","known"].includes(entry.kind as string) ||
        entry.kind === "known" && (entry.value === null || entry.value === undefined) ||
        entry.kind !== "known" && Object.prototype.hasOwnProperty.call(entry,"value")) throw new Error("Patch remoto inválido.");
    if (entry.kind !== "not-provided") fields[key] = entry.kind === "unknown" ? null : entry.value;
  }
  return updateMediaMetadataWithDb(db, id, parsePortableMetadata({ version: 1, provenance: { reference, normalizerVersion: 1,
    fetchedAt: null, checkedAt: null, sourceUpdatedAt: null }, fields }), now, generation);
}
export async function selectMetadataSourceWithDb(db: MetadataDb, id: string, reference: ProviderReference, now: number): Promise<boolean> {
  if (!metadataTimestamp(now)) throw new Error("Reloj de selección inválido.");
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM saved_titles WHERE id=?;", id);
  if (!row) throw new Error("El título no existe.");
  const state = (await ensureMetadataStateWithDb(db, rowToSavedTitle(row)))!;
  if (state.selection.reference && providerReferencesEqual(state.selection.reference, reference)) return false;
  await writeMetadataStateWithDb(db, id, { ...state, selection: { reference, updatedAt: Math.max(now, state.selection.updatedAt + 1) } });
  return true;
}

export async function selectMetadataSource(id: string, reference: ProviderReference, now = Date.now(),
  database?: MetadataDb & { withTransactionAsync(task: () => Promise<void>): Promise<void> }): Promise<boolean> {
  const db = database ?? await (await import("./db")).initDb();
  return runSerializedStorageMutation(async () => {
    let changed = false;
    await db.withTransactionAsync(async () => { changed = await selectMetadataSourceWithDb(db, id, reference, now); });
    if (changed) publishLibraryInvalidation([id]);
    return changed;
  });
}

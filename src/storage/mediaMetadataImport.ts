import { parseMediaMetadataState, type MediaMetadataState } from "../core/mediaMetadataState";
import { providerReferenceKey } from "../core/providerReference";
import { readMetadataStateWithDb, writeMetadataStateWithDb, type MetadataDb } from "./mediaMetadataRepo";
import { listProviderReferencesForSavedTitleWithDb } from "./savedTitleStorage";

import { metadataSemanticKey } from "../core/metadataSemanticKey";
export class MetadataImportConflict extends Error {}
export async function mergeMetadataStateWithDb(db: MetadataDb, id: string, incoming: MediaMetadataState, inserted: boolean): Promise<boolean> {
  const row = await db.getFirstAsync<{ medium: string }>("SELECT medium FROM saved_titles WHERE id=?;", id);
  if (!row) throw new Error("El item de metadata no existe.");
  const checked = parseMediaMetadataState(incoming, await listProviderReferencesForSavedTitleWithDb(db, id), row.medium);
  const local = await readMetadataStateWithDb(db, id);
  if (!local || inserted) { await writeMetadataStateWithDb(db, id, checked); return true; }
  const documents = new Map(local.documents.map(doc => [providerReferenceKey(doc.metadata.provenance.reference), doc]));
  let changed = false;
  for (const doc of checked.documents) {
    const key = providerReferenceKey(doc.metadata.provenance.reference), old = documents.get(key);
    if (old && doc.changedAt < old.changedAt) continue;
    if (old && doc.changedAt === old.changedAt) {
      const mergedFields = { ...old.metadata.fields, ...doc.metadata.fields };
      if (metadataSemanticKey(old.metadata.fields) !== metadataSemanticKey(mergedFields) ||
          doc.snapshot !== undefined && metadataSemanticKey(doc.snapshot) !== metadataSemanticKey(old.snapshot)) throw new MetadataImportConflict("Conflicto de metadata: misma fecha con contenido diferente.");
      const incomingCheck = doc.metadata.provenance.checkedAt, localCheck = old.metadata.provenance.checkedAt;
      if (incomingCheck !== null && incomingCheck <= Date.now() && incomingCheck > (localCheck ?? -1)) {
        documents.set(key, { ...old, metadata: { ...old.metadata, provenance: { ...old.metadata.provenance, checkedAt: incomingCheck } } });
      }
      continue;
    }
    documents.set(key, { ...doc, ...(doc.snapshot ?? old?.snapshot ? { snapshot: doc.snapshot ?? old!.snapshot } : {}), metadata: { ...doc.metadata, fields: { ...old?.metadata.fields, ...doc.metadata.fields } } });
    changed = true;
  }
  const selection = checked.selection.updatedAt > local.selection.updatedAt ? checked.selection : local.selection;
  const baseline = checked.baseline.updatedAt > local.baseline.updatedAt ? checked.baseline : local.baseline;
  changed ||= metadataSemanticKey(selection) !== metadataSemanticKey(local.selection) || metadataSemanticKey(baseline) !== metadataSemanticKey(local.baseline);
  await writeMetadataStateWithDb(db, id, { ...local, selection, baseline, documents: [...documents.values()] });
  return changed;
}

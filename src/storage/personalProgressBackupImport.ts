import type { ParsedLibraryBackupV10, ProgressBackupIssue } from "../core/libraryBackupV10";
import { nextProgressTimestamp, parsePersonalProgress, progressPositionCompatible, progressPositionsEqual, progressVersionsEqual, type PersonalProgress } from "../core/personalProgress";
import type { MediaClassification } from "../core/mediaClassification";
import { getSavedTitleWithReferencesByIdWithDb } from "./savedTitleStorage";
import { getPersonalProgressWithDb, ProgressConflict, type ProgressDatabase, type ProgressWriteDb } from "./personalProgressRepo";
import { initDb } from "./db";
import { publishLibraryInvalidation } from "./libraryInvalidation";
import { runSerializedStorageMutation } from "./storageMutationQueue";

export type ProgressImportConflict = Readonly<{ itemId: string; title: string; local: PersonalProgress; incoming: PersonalProgress; identity: string }>;
export type ProgressImportResult = { inserted: number; preservedEqual: number; conflicts: ProgressImportConflict[]; invalid: ProgressBackupIssue[]; failed: ProgressBackupIssue[]; warnings: ProgressBackupIssue[]; changedIds: string[] };

/** Includes classification and every local identity, but no personal/editorial clocks. */
async function identityWithDb(db: ProgressWriteDb, itemId: string): Promise<{ key: string; title: string; classification: MediaClassification }> {
  const item = await getSavedTitleWithReferencesByIdWithDb(db, itemId);
  if (!item) throw new ProgressConflict();
  const legacy = await db.getAllAsync<{ legacy_format: string; legacy_provider: string; legacy_external_id: string }>(
    "SELECT legacy_format,legacy_provider,legacy_external_id FROM legacy_saved_title_identities WHERE saved_title_id=? ORDER BY legacy_format,legacy_provider,legacy_external_id;", itemId);
  return { title: item.title, classification: item, key: JSON.stringify([item.medium, item.contentFamily, item.primaryFormat, item.manualIdentity ?? null,
    item.providerReferences.map(ref => JSON.stringify([ref.provider, ref.resourceNamespace, ref.externalId])).sort(), legacy]) };
}
/** Caller owns the transaction. Incompatible positions are valid imported personal data. */
export async function writeImportedProgressWithDb(db: ProgressWriteDb, value: PersonalProgress): Promise<void> {
  const progress = parsePersonalProgress(value), p = progress.position;
  const result = await db.runAsync(`INSERT INTO personal_title_progress
    (saved_title_id,shape_version,mode,season,episode,chapter,label,updated_at) VALUES (?,1,?,?,?,?,?,?)
    ON CONFLICT(saved_title_id) DO UPDATE SET mode=excluded.mode,season=excluded.season,episode=excluded.episode,
      chapter=excluded.chapter,label=excluded.label,updated_at=excluded.updated_at;`, progress.itemId, p?.mode ?? null,
    p?.mode === "season-episode" ? p.season : null, p?.mode === "episode" || p?.mode === "season-episode" ? p.episode : null,
    p?.mode === "chapter" ? p.chapter : null, p?.mode === "special" ? p.label : null, progress.updatedAt);
  if (result.changes !== 1) throw new Error("No se pudo confirmar el progreso importado.");
}
export async function mergeProgressWithDb(db: ProgressWriteDb, payload: ParsedLibraryBackupV10, mapping: Map<string, string>): Promise<ProgressImportResult> {
  const result: ProgressImportResult = { inserted: 0, preservedEqual: 0, conflicts: [], invalid: [...payload.progressIssues], failed: [], warnings: [], changedIds: [] };
  const candidates = new Map<string, PersonalProgress>(), blocked = new Set<string>();
  for (const incoming of payload.progress) {
    const target = mapping.get(incoming.itemId);
    if (!target) { result.invalid.push({ reference: incoming.itemId, reason: "El título no pudo resolverse; no se usa el ID ocupado como alternativa." }); continue; }
    const candidate = parsePersonalProgress({ ...incoming, itemId: target }), old = candidates.get(target);
    if (old && !progressVersionsEqual(old, candidate)) {
      blocked.add(target); result.invalid.push({ reference: target, reason: "Progresos contradictorios tras remapear varios títulos al mismo destino." });
    } else candidates.set(target, candidate);
  }
  for (const [itemId, incoming] of candidates) {
    if (blocked.has(itemId)) continue;
    await db.runAsync("SAVEPOINT progress_record;");
    try {
      const identity = await identityWithDb(db, itemId), local = await getPersonalProgressWithDb(db, itemId);
      let conflict: ProgressImportConflict | undefined;
      if (!local) await writeImportedProgressWithDb(db, incoming);
      else if (!progressPositionsEqual(local.position, incoming.position)) conflict = { itemId, title: identity.title, identity: identity.key, local, incoming };
      await db.runAsync("RELEASE SAVEPOINT progress_record;");
      if (!progressPositionCompatible(identity.classification, incoming.position)) result.warnings.push({ reference: identity.title, reason: "La posición del backup no coincide con la clasificación actual. Se conserva sin convertirla." });
      if (!local) { result.inserted++; result.changedIds.push(itemId); }
      else if (conflict) result.conflicts.push(conflict);
      else result.preservedEqual++;
    } catch (error) {
      await db.runAsync("ROLLBACK TO SAVEPOINT progress_record;"); await db.runAsync("RELEASE SAVEPOINT progress_record;");
      result.failed.push({ reference: itemId, reason: error instanceof Error ? error.message : "No se pudo restaurar el progreso." });
    }
  }
  return result;
}
/** A separate explicit decision: no global import is replayed and stale bases always fail. */
export async function applyProgressImportConflictWithDb(db: ProgressWriteDb, conflict: ProgressImportConflict, now = Date.now()): Promise<PersonalProgress> {
  const local = parsePersonalProgress(conflict.local), incoming = parsePersonalProgress(conflict.incoming);
  if (local.itemId !== conflict.itemId || incoming.itemId !== conflict.itemId) throw new ProgressConflict();
  const current = await getPersonalProgressWithDb(db, conflict.itemId), identity = await identityWithDb(db, conflict.itemId);
  if (!progressVersionsEqual(current, local) || identity.key !== conflict.identity) throw new ProgressConflict();
  const value = parsePersonalProgress({ ...incoming, updatedAt: nextProgressTimestamp(Math.max(local.updatedAt, incoming.updatedAt), now) });
  await writeImportedProgressWithDb(db, value);
  return value;
}
export function applyProgressImportConflict(conflict: ProgressImportConflict, database?: ProgressDatabase, now = Date.now()): Promise<PersonalProgress> {
  return runSerializedStorageMutation(async () => {
    const db = database ?? await initDb(); let confirmed!: PersonalProgress;
    await db.withTransactionAsync(async () => { confirmed = await applyProgressImportConflictWithDb(db, conflict, now); });
    publishLibraryInvalidation([conflict.itemId]); return confirmed;
  });
}

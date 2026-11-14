import { ensureMetadataStateWithDb, acceptLegacyMetadataWriteWithDb } from "./mediaMetadataRepo";
import { validateManualContent, type ManualContentInput } from "../core/manualContentEntry";
import { generateManualEntryIdentity } from "../core/manualEntryIdentity";
import { nextSavedTitleUpdatedAt } from "../core/savedTitleTimestamp";
import { initDb } from "./db";
import { assignManualIdentityWithDb } from "./manualEntryIdentities";
import { getSavedTitleWithReferencesByIdWithDb, type SavedTitleStorageReadDatabase } from "./savedTitleStorage";
import type { SavedTitlesMutationDatabase } from "./savedTitlesRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";

export async function isManualContentEditableWithDb(db: SavedTitleStorageReadDatabase, id: string): Promise<boolean> {
  const item = await getSavedTitleWithReferencesByIdWithDb(db, id);
  if (!item || item.providerReferences.length) return false;
  if (item.manualIdentity) return true;
  const legacy = await db.getAllAsync<{ legacy_external_id: string }>(
    `SELECT legacy_external_id FROM legacy_saved_title_identities WHERE saved_title_id = ?
     AND legacy_format = 'library-backup-v1-v4' AND legacy_provider = 'manual';`, [id]);
  return legacy.length === 1 && typeof legacy[0].legacy_external_id === "string" && legacy[0].legacy_external_id.length > 0;
}

/** Caller owns one serialized transaction; INSERT never overwrites an existing row. */
export async function createManualContentWithDb(db: SavedTitlesMutationDatabase, input: ManualContentInput,
  generateId = generateManualEntryIdentity, generateIdentity = generateManualEntryIdentity, now = Date.now()): Promise<string> {
  const value = validateManualContent(input);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Timestamp inválido.");
  for (let attempt = 0; attempt < 25; attempt++) {
    const id = generateId();
    if (typeof id !== "string" || !id.trim()) throw new Error("ID local inválido.");
    if (await db.getFirstAsync("SELECT id FROM saved_titles WHERE id = ?;", [id])) continue;
    await db.runAsync(`INSERT INTO saved_titles
      (id, medium, content_family, primary_format, title, year, poster_url, overview, vote_average,
       personal_rating, genres_json, status, tags_json, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, '[]', 'planned', '[]', NULL, ?, ?);`,
    id, value.medium, value.contentFamily, value.primaryFormat, value.title, value.year, value.overview, now, now);
    await assignManualIdentityWithDb(db, id, generateIdentity);
    const created = await getSavedTitleWithReferencesByIdWithDb(db, id);
    if (created) await ensureMetadataStateWithDb(db, created);
    return id;
  }
  throw new Error("No se pudo generar un ID local libre después de 25 intentos.");
}

export async function editManualContentWithDb(db: SavedTitlesMutationDatabase, id: string, input: ManualContentInput, now = Date.now()): Promise<string> {
  const value = validateManualContent(input);
  if (!await isManualContentEditableWithDb(db, id)) throw new Error("Este título no permite edición manual.");
  const current = await getSavedTitleWithReferencesByIdWithDb(db, id);
  if (!current) throw new Error("El título dejó de existir.");
  const result = await db.runAsync(`UPDATE saved_titles SET title = ?, medium = ?, content_family = ?, primary_format = ?,
    year = ?, overview = ?, updated_at = ? WHERE id = ?;`, value.title, value.medium, value.contentFamily,
    value.primaryFormat, value.year, value.overview, nextSavedTitleUpdatedAt(current.updatedAt, now), id);
  await acceptLegacyMetadataWriteWithDb(db, { ...current, ...value, updatedAt: nextSavedTitleUpdatedAt(current.updatedAt, now) }, current);
  if (result.changes !== 1) throw new Error("No se pudo actualizar el título.");
  return id;
}

export async function saveManualContent(input: ManualContentInput, id?: string, database?: SavedTitlesMutationDatabase): Promise<string> {
  const db = database ?? await initDb();
  return runSerializedStorageMutation(async () => {
    let result: string | undefined;
    await db.withTransactionAsync(async () => {
      result = id ? await editManualContentWithDb(db, id, input) : await createManualContentWithDb(db, input);
    });
    if (!result) throw new Error("No se pudo confirmar el guardado.");
    return result;
  });
}

export async function isManualContentEditable(id: string): Promise<boolean> {
  return isManualContentEditableWithDb(await initDb(), id);
}

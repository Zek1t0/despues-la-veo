import { metadataSemanticKey } from "../core/metadataSemanticKey";
import { assertMetadataReference } from "../core/metadataValidation";
import { validateProviderMaterializationInput } from "../core/providerMaterializationValidation";
import { publishMediaPreferences } from "./mediaPreferencesRepo";
import { ensureMetadataStateWithDb, hasMetadataSchemaWithDb, updateMediaMetadataWithDb, writeMetadataStateWithDb } from "./mediaMetadataRepo";
import { initialMetadataState, legacyMetadataSnapshot as providerSnapshot } from "../core/mediaMetadataState";
import { publishLibraryInvalidation } from "./libraryInvalidation";
import type {
  SavedTitle,
  SavedTitleWithProviderReferences,
} from "../core/savedTitle";
import type { ProviderReference } from "../core/providerReference";
import type { ProviderMaterializationInput } from "../providers/providerContracts";
import { materializeProviderSavedTitle } from "../core/providerSavedTitle";
import { parsePersonalRating, type PersonalRating } from "../core/personalRating";
import { nextSavedTitleUpdatedAt } from "../core/savedTitleTimestamp";
import {
  createTmdbProviderReference,
  createTmdbSavedTitleMaterializationInput,
  type LegacyTmdbSavedTitleSnapshot,
  legacyTmdbSnapshotToCurrent,
} from "../core/tmdbSavedTitle";
import type { NormalizedBackupSavedTitle } from "../core/libraryBackupV1";
import type { ParsedLibraryBackup } from "../core/libraryBackup";
import { initDb } from "./db";
import {
  mergeLibraryBackupItemsWithDb,
  mergeLibraryBackupWithDb,
  type LibraryImportIssue,
  type LibraryImportMergeResult,
  type LibraryBackupMergeResult,
} from "./libraryBackupMerge";
import {
  deleteSavedTitleAndPinsWithDb,
  upsertSavedTitleAndCleanPinsWithDb,
} from "./savedTitleIntegrity";
import { runSerializedStorageMutation } from "./storageMutationQueue";
import {
  attachProviderReferenceWithDb,
  getSavedTitleByProviderReferenceWithDb,
  getSavedTitleWithReferencesByIdWithDb,
  listProviderReferencesForSavedTitleWithDb,
  listSavedTitlesWithReferencesWithDb,
} from "./savedTitleStorage";

export {
  attachProviderReferenceWithDb,
  getSavedTitleByProviderReferenceWithDb,
  getSavedTitleWithReferencesByIdWithDb,
  listProviderReferencesForSavedTitleWithDb,
  listSavedTitlesWithReferencesWithDb,
};

export type { LibraryImportIssue, LibraryImportMergeResult };
export type { LibraryBackupMergeResult };

export type SavedTitlesReadDatabase = {
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: any[]): Promise<T[]>;
};

export type SavedTitlesMutationDatabase = SavedTitlesReadDatabase & {
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  runAsync(source: string, ...params: any[]): Promise<{ changes: number }>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

export type SavedTitleMetadataPatch = Partial<
  Pick<SavedTitle, "status" | "tags" | "notes">
>;

function assertSavedTitleId(id: string): void {
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("El id del título guardado debe ser un string no vacío.");
  }
}

function assertSavedTitleMetadataPatch(patch: SavedTitleMetadataPatch): void {
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !["status", "tags", "notes"].includes(key))) {
    throw new Error("El cambio de metadata debe limitarse a status, tags o notes.");
  }
}

/** Lee y actualiza metadata editable del detalle dentro de la transacción activa. */
export async function updateSavedTitleMetadataWithDb(
  db: SavedTitlesMutationDatabase,
  id: string,
  patch: SavedTitleMetadataPatch,
  now: () => number = Date.now
): Promise<SavedTitleWithProviderReferences> {
  assertSavedTitleId(id);
  assertSavedTitleMetadataPatch(patch);
  const current = await getSavedTitleByIdWithDb(db, id);
  if (!current) throw new Error("El título guardado no existe.");

  const updated: SavedTitleWithProviderReferences = {
    ...current,
    ...patch,
    updatedAt: nextSavedTitleUpdatedAt(current.updatedAt, now()),
  };
  await upsertSavedTitleAndCleanPinsWithDb(db, updated);
  return updated;
}

/** Serializa una sola transacción atómica de metadata del detalle completo. */
export async function updateSavedTitleMetadata(
  id: string,
  patch: SavedTitleMetadataPatch
): Promise<SavedTitleWithProviderReferences> {
  const db = await initDb();
  return runSerializedStorageMutation(async () => {
    let updated: SavedTitleWithProviderReferences | null = null;
    await db.withTransactionAsync(async () => {
      updated = await updateSavedTitleMetadataWithDb(db, id, patch);
    });
    if (!updated) throw new Error("No se pudo completar la actualización de metadata.");
    return updated;
  });
}

/** Actualiza sólo un título existente y retorna su nuevo updatedAt confirmado. */
export async function setPersonalRatingWithDb(
  db: SavedTitlesMutationDatabase,
  id: string,
  value: PersonalRating,
  now: () => number = Date.now
): Promise<number> {
  assertSavedTitleId(id);
  const personalRating = parsePersonalRating(value);
  const current = await db.getFirstAsync<{ updated_at: number }>(
    "SELECT updated_at FROM saved_titles WHERE id = ? LIMIT 1;",
    [id]
  );
  if (!current) throw new Error("El título guardado no existe.");

  const nextUpdatedAt = nextSavedTitleUpdatedAt(current.updated_at, now());
  const result = await db.runAsync(
    `UPDATE saved_titles
     SET personal_rating = ?, updated_at = ?
     WHERE id = ?;`,
    personalRating,
    nextUpdatedAt,
    id
  );
  if (result.changes !== 1) {
    throw new Error("El título guardado dejó de existir antes de actualizar su puntuación.");
  }
  return nextUpdatedAt;
}

export async function setPersonalRating(
  id: string,
  value: PersonalRating
): Promise<number> {
  const db = await initDb();
  return runSerializedStorageMutation(async () => {
    let updatedAt: number | null = null;
    await db.withTransactionAsync(async () => {
      updatedAt = await setPersonalRatingWithDb(db, id, value);
    });
    if (updatedAt === null) {
      throw new Error("No se pudo confirmar la actualización de la puntuación personal.");
    }
    return updatedAt;
  });
}

/** Composes lookup, materialization and persistence inside the caller's transaction. */
export async function saveProviderTitleWithDb(
  db: SavedTitlesMutationDatabase,
  input: ProviderMaterializationInput,
  generateId: () => string,
  now = Date.now()
): Promise<string> {
  validateProviderMaterializationInput(input);
  if (input.metadata) assertMetadataReference(input.metadata, input.reference);
  const existing = await getSavedTitleByProviderReferenceWithDb(db, input.reference);
  const metadataEnabled = await hasMetadataSchemaWithDb(db);
  if (existing && metadataEnabled) {
    const fields = input.metadata?.fields ?? { canonicalTitle: input.snapshot.title, synopsis: input.snapshot.overview === null ? null : { text: input.snapshot.overview, language: null },
      genres: [...input.snapshot.genres] };
    await updateMediaMetadataWithDb(db, existing.id, { version: 1, provenance: input.metadata?.provenance ?? {
      reference: input.reference, normalizerVersion: 1, fetchedAt: null, checkedAt: null, sourceUpdatedAt: null }, fields }, now, undefined, undefined, providerSnapshot({ ...existing, ...input.snapshot, genres: [...input.snapshot.genres], voteAverage: input.snapshot.voteAverage ?? null }));
    return existing.id;
  }
  const item = materializeProviderSavedTitle(
    input,
    existing,
    generateId,
    now
  );
  if (!existing && (typeof item.id !== "string" || !item.id.trim() ||
      await db.getFirstAsync("SELECT id FROM saved_titles WHERE id = ? LIMIT 1;", item.id))) {
    throw new Error("El ID local generado es inválido o está ocupado; se conservó la biblioteca.");
  }
  await upsertSavedTitleAndCleanPinsWithDb(db, item);
  if (!existing) {
    await attachProviderReferenceWithDb(db, input.reference, item.id);
  }
  if (metadataEnabled) {
    const state = initialMetadataState(item, [input.reference]);
    await writeMetadataStateWithDb(db, item.id, state);
    if (input.metadata) await updateMediaMetadataWithDb(db, item.id, input.metadata, now, undefined, undefined, providerSnapshot(item));
  }
  return item.id;
}

export async function saveProviderTitle(
  input: ProviderMaterializationInput,
  generateId: () => string,
  database?: SavedTitlesMutationDatabase
): Promise<string> {
  const db = database ?? await initDb();
  return runSerializedStorageMutation(async () => {
    const before = await getSavedTitleByProviderReferenceWithDb(db, input.reference);
    let savedTitleId: string | null = null;
    await db.withTransactionAsync(async () => {
      savedTitleId = await saveProviderTitleWithDb(db, input, generateId);
    });
    if (!savedTitleId) throw new Error("No se pudo completar el guardado del título.");
    const after = await getSavedTitleByProviderReferenceWithDb(db, input.reference);
    if (observableSavedTitle(before) !== observableSavedTitle(after)) publishLibraryInvalidation([savedTitleId]);
    return savedTitleId;
  });
}

function legacyTmdbMaterializationInput(
  snapshot: LegacyTmdbSavedTitleSnapshot
): ProviderMaterializationInput {
  return createTmdbSavedTitleMaterializationInput(
    createTmdbProviderReference(snapshot.type, snapshot.externalId),
    legacyTmdbSnapshotToCurrent(snapshot)
  );
}

/** Compatibility adapter for the remote TMDB consumer pending its migration. */
export async function saveTmdbTitleWithDb(
  db: SavedTitlesMutationDatabase,
  snapshot: LegacyTmdbSavedTitleSnapshot,
  generateId: () => string,
  now = Date.now()
): Promise<string> {
  return saveProviderTitleWithDb(db, legacyTmdbMaterializationInput(snapshot), generateId, now);
}

export async function saveTmdbTitle(
  snapshot: LegacyTmdbSavedTitleSnapshot,
  generateId: () => string
): Promise<string> {
  return saveProviderTitle(legacyTmdbMaterializationInput(snapshot), generateId);
}

export async function getSavedTitleByIdWithDb(
  db: SavedTitlesReadDatabase,
  id: string
): Promise<SavedTitleWithProviderReferences | null> {
  return getSavedTitleWithReferencesByIdWithDb(db, id);
}

export async function listSavedTitlesWithDb(
  db: SavedTitlesReadDatabase
): Promise<SavedTitleWithProviderReferences[]> {
  return listSavedTitlesWithReferencesWithDb(db);
}

export async function listSavedTitles(): Promise<SavedTitleWithProviderReferences[]> {
  return listSavedTitlesWithDb(await initDb());
}

export async function getAllSavedTitles(): Promise<SavedTitleWithProviderReferences[]> {
  return listSavedTitles();
}

export async function upsertSavedTitle(item: SavedTitle): Promise<string> {
  const db = await initDb();
  return runSerializedStorageMutation(async () => {
    let savedTitleId: string | null = null;
    await db.withTransactionAsync(async () => {
      savedTitleId = await upsertSavedTitleAndCleanPinsWithDb(db, item);
    });
    if (!savedTitleId) throw new Error("No se pudo completar el guardado del título.");
    publishLibraryInvalidation([savedTitleId]);
    return savedTitleId;
  });
}

export async function mergeLibraryBackupItems(
  items: NormalizedBackupSavedTitle[],
  generateId: () => string
): Promise<LibraryImportMergeResult> {
  const db = await initDb();
  return runSerializedStorageMutation(async () => {
    let result: LibraryImportMergeResult | null = null;
    await db.withTransactionAsync(async () => {
      result = await mergeLibraryBackupItemsWithDb(db, items, generateId);
    });
    if (!result) throw new Error("No se pudo completar el merge de títulos.");
    return result;
  });
}

export async function mergeLibraryBackup(
  payload: ParsedLibraryBackup,
  generateId: () => string,
  database?: SavedTitlesMutationDatabase
): Promise<LibraryBackupMergeResult> {
  const db = database ?? await initDb();
  return runSerializedStorageMutation(async () => {
    let result: LibraryBackupMergeResult | null = null;
    await db.withTransactionAsync(async () => {
      result = await mergeLibraryBackupWithDb(
        db,
        payload,
        generateId
      );
    });
    if (!result) throw new Error("No se pudo completar la importación del backup.");
    const committed = result as LibraryBackupMergeResult;
    publishLibraryInvalidation(committed.changedIds ?? []);
    if (committed.preferencesChanged) publishMediaPreferences(committed.preferencesChanged);
    return committed;
  });
}

export async function deleteSavedTitle(id: string): Promise<void> {
  const db = await initDb();
  return runSerializedStorageMutation(() =>
    db.withTransactionAsync(() => deleteSavedTitleAndPinsWithDb(db, id))
  );
}

export async function getSavedTitleById(id: string): Promise<SavedTitleWithProviderReferences | null> {
  return getSavedTitleByIdWithDb(await initDb(), id);
}

export async function getByProviderReference(
  reference: ProviderReference
): Promise<SavedTitleWithProviderReferences | null> {
  const db = await initDb();
  return getSavedTitleByProviderReferenceWithDb(db, reference);
}

function observableSavedTitle(item: SavedTitleWithProviderReferences | null): string {
  if (!item) return "null";
  const { metadataState, ...local } = item;
  return metadataSemanticKey({ ...local, metadata: metadataState ? {
    selected: metadataState.selection.reference,
    documents: metadataState.documents.map(doc => ({ reference: doc.metadata.provenance.reference, fields: doc.metadata.fields, snapshot: doc.snapshot })),
  } : undefined });
}

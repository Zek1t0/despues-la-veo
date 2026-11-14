import { rowToSavedTitle, listProviderReferencesForSavedTitleWithDb } from "./savedTitleRows";
export { rowToSavedTitle, listProviderReferencesForSavedTitleWithDb } from "./savedTitleRows";
import { readMetadataStateWithDb } from "./mediaMetadataRepo";
import { manualIdentityForItemWithDb } from "./manualEntryIdentities";
import { createProviderReference, type ProviderReference } from "../core/providerReference";
import { createTmdbProviderReference } from "../core/tmdbProviderReference";
import type {
  SavedTitle,
  SavedTitleWithProviderReferences,
} from "../core/savedTitle";

export type SavedTitleStorageReadDatabase = {
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: any[]): Promise<T[]>;
};

export type SavedTitleStorageMutationDatabase = SavedTitleStorageReadDatabase & {
  runAsync(source: string, ...params: any[]): Promise<{ changes: number }>;
};

export async function getSavedTitleWithReferencesByIdWithDb(
  db: SavedTitleStorageReadDatabase,
  id: string
): Promise<SavedTitleWithProviderReferences | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM saved_titles WHERE id = ? LIMIT 1;",
    [id]
  );
  if (!row) return null;
  const manualIdentity = await manualIdentityForItemWithDb(db, id);
  return {
    ...rowToSavedTitle(row),
    ...await localMetadataWithDb(db, id),
    providerReferences: await listProviderReferencesForSavedTitleWithDb(db, id),
    ...(manualIdentity !== undefined ? { manualIdentity } : {}),
  };
}

export async function getSavedTitleByProviderReferenceWithDb(
  db: SavedTitleStorageReadDatabase,
  reference: ProviderReference
): Promise<SavedTitleWithProviderReferences | null> {
  const canonical = createProviderReference(reference);
  const row = await db.getFirstAsync<{ saved_title_id: string }>(
    `SELECT saved_title_id FROM media_provider_references
     WHERE provider = ? AND resource_namespace = ? AND external_id = ? LIMIT 1;`,
    [canonical.provider, canonical.resourceNamespace, canonical.externalId]
  );
  return row ? getSavedTitleWithReferencesByIdWithDb(db, row.saved_title_id) : null;
}

export async function attachProviderReferenceWithDb(
  db: SavedTitleStorageMutationDatabase,
  reference: ProviderReference,
  savedTitleId: string
): Promise<void> {
  const canonical = createProviderReference(reference);
  if (canonical.provider === "tmdb") {
    const tmdb = createTmdbProviderReference(
      canonical.resourceNamespace as "movie" | "tv", canonical.externalId
    );
    if (tmdb.externalId !== canonical.externalId) throw new Error("La referencia TMDB debe ser canónica.");
  }
  const owner = await db.getFirstAsync<{ saved_title_id: string }>(
    `SELECT saved_title_id FROM media_provider_references
     WHERE provider = ? AND resource_namespace = ? AND external_id = ? LIMIT 1;`,
    [canonical.provider, canonical.resourceNamespace, canonical.externalId]
  );
  if (owner) {
    if (owner.saved_title_id !== savedTitleId) {
      throw new Error("La referencia externa ya pertenece a otro MediaItem.");
    }
  }
  const target = await db.getFirstAsync<{ id: string; medium: string }>(
    "SELECT id, medium FROM saved_titles WHERE id = ? LIMIT 1;",
    [savedTitleId]
  );
  if (!target) throw new Error("El MediaItem destino no existe.");
  if (canonical.provider === "tmdb" && target.medium !== "audiovisual") {
    throw new Error("Una referencia TMDB requiere un MediaItem audiovisual.");
  }
  if (owner) return;
  await db.runAsync(
    `INSERT INTO media_provider_references
       (provider, resource_namespace, external_id, saved_title_id)
     VALUES (?, ?, ?, ?);`,
    canonical.provider,
    canonical.resourceNamespace,
    canonical.externalId,
    savedTitleId
  );
}

export async function listSavedTitlesWithReferencesWithDb(
  db: SavedTitleStorageReadDatabase
): Promise<SavedTitleWithProviderReferences[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM saved_titles ORDER BY created_at DESC;"
  );
  return Promise.all(rows.map(async (row) => {
    const item = rowToSavedTitle(row);
    const manualIdentity = await manualIdentityForItemWithDb(db, item.id);
    return {
      ...item,
      ...await localMetadataWithDb(db, item.id),
      providerReferences: await listProviderReferencesForSavedTitleWithDb(db, item.id),
      ...(manualIdentity !== undefined ? { manualIdentity } : {}),
    };
  }));
}

async function localMetadataWithDb(db: SavedTitleStorageReadDatabase, id: string) {
  const metadataState = await readMetadataStateWithDb(db, id);
  if (!metadataState) return {};
  const rows = await db.getAllAsync<{ value: string }>("SELECT value FROM media_title_aliases WHERE saved_title_id=? ORDER BY normalized,value;", id);
  return { metadataState, localAliases: [...new Set(rows.map(row => row.value))] };
}

import { createProviderReference, type ProviderReference } from "../core/providerReference";
import { parsePersonalRating } from "../core/personalRating";
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

type ProviderReferenceRow = {
  provider: string;
  resource_namespace: string;
  external_id: string;
};

function parseJsonStringArray(value: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function rowToSavedTitle(row: Record<string, unknown>): SavedTitle {
  return {
    id: String(row.id),
    type: row.type as SavedTitle["type"],
    title: String(row.title),
    year: row.year == null ? null : Number(row.year),
    posterUrl: row.poster_url == null ? null : String(row.poster_url),
    overview: row.overview == null ? null : String(row.overview),
    voteAverage: row.vote_average == null ? null : Number(row.vote_average),
    personalRating: parsePersonalRating(row.personal_rating),
    genres: parseJsonStringArray(row.genres_json),
    status: row.status as SavedTitle["status"],
    tags: parseJsonStringArray(row.tags_json),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToProviderReference(row: ProviderReferenceRow): ProviderReference {
  return createProviderReference({
    provider: row.provider,
    resourceNamespace: row.resource_namespace,
    externalId: row.external_id,
  });
}

export async function listProviderReferencesForSavedTitleWithDb(
  db: SavedTitleStorageReadDatabase,
  savedTitleId: string
): Promise<ProviderReference[]> {
  const rows = await db.getAllAsync<ProviderReferenceRow>(
    `SELECT provider, resource_namespace, external_id
     FROM media_provider_references
     WHERE saved_title_id = ?
     ORDER BY provider, resource_namespace, external_id;`,
    [savedTitleId]
  );
  return rows.map(rowToProviderReference);
}

export async function getSavedTitleWithReferencesByIdWithDb(
  db: SavedTitleStorageReadDatabase,
  id: string
): Promise<SavedTitleWithProviderReferences | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM saved_titles WHERE id = ? LIMIT 1;",
    [id]
  );
  if (!row) return null;
  return {
    ...rowToSavedTitle(row),
    providerReferences: await listProviderReferencesForSavedTitleWithDb(db, id),
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
  const owner = await db.getFirstAsync<{ saved_title_id: string }>(
    `SELECT saved_title_id FROM media_provider_references
     WHERE provider = ? AND resource_namespace = ? AND external_id = ? LIMIT 1;`,
    [canonical.provider, canonical.resourceNamespace, canonical.externalId]
  );
  if (owner) {
    if (owner.saved_title_id !== savedTitleId) {
      throw new Error("La referencia externa ya pertenece a otro MediaItem.");
    }
    return;
  }
  const target = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM saved_titles WHERE id = ? LIMIT 1;",
    [savedTitleId]
  );
  if (!target) throw new Error("El MediaItem destino no existe.");
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
    return {
      ...item,
      providerReferences: await listProviderReferencesForSavedTitleWithDb(db, item.id),
    };
  }));
}

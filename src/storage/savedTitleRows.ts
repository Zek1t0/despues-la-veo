import { assertMediaClassification } from "../core/mediaClassification";
import { parsePersonalRating } from "../core/personalRating";
import { createProviderReference, type ProviderReference } from "../core/providerReference";
import type { SavedTitle } from "../core/savedTitle";
import type { SavedTitleStorageReadDatabase } from "./savedTitleStorage";

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
  const classification = { medium: row.medium, contentFamily: row.content_family, primaryFormat: row.primary_format };
  assertMediaClassification(classification);
  return {
    id: String(row.id),
    ...classification,
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

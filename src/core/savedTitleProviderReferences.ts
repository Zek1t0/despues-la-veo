import type { ProviderReference } from "./providerReference";
import type { SavedTitleWithProviderReferences } from "./savedTitle";
import {
  createTmdbProviderReference,
  type TmdbProviderReference,
} from "./tmdbSavedTitle";

function asCanonicalTmdbReference(
  reference: ProviderReference,
  medium: SavedTitleWithProviderReferences["medium"]
): TmdbProviderReference | null {
  if (reference.provider !== "tmdb" || medium !== "audiovisual") return null;
  try {
    const canonical = createTmdbProviderReference(reference.resourceNamespace as "movie" | "tv", reference.externalId);
    return canonical.externalId === reference.externalId ? canonical : null;
  } catch {
    return null;
  }
}

/** Namespace identifies the external resource; it does not dictate local format. */
export function findUnambiguousTmdbReference(
  item: SavedTitleWithProviderReferences
): TmdbProviderReference | null {
  const matches = item.providerReferences
    .map((reference) => asCanonicalTmdbReference(reference, item.medium))
    .filter((reference): reference is TmdbProviderReference => reference !== null);
  return matches.length === 1 ? matches[0] : null;
}

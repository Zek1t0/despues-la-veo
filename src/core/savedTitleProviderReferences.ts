import type { ProviderReference } from "./providerReference";
import type { SavedTitleWithProviderReferences } from "./savedTitle";
import {
  createTmdbProviderReference,
  type TmdbProviderReference,
} from "./tmdbSavedTitle";

function asCanonicalTmdbReference(
  reference: ProviderReference,
  type: SavedTitleWithProviderReferences["type"]
): TmdbProviderReference | null {
  if (reference.provider !== "tmdb" || reference.resourceNamespace !== type) return null;
  try {
    const canonical = createTmdbProviderReference(type, reference.externalId);
    return canonical.externalId === reference.externalId ? canonical : null;
  } catch {
    return null;
  }
}

/** Returns a TMDB reference only when exactly one canonical, type-compatible match exists. */
export function findUnambiguousTmdbReference(
  item: SavedTitleWithProviderReferences
): TmdbProviderReference | null {
  const matches = item.providerReferences
    .map((reference) => asCanonicalTmdbReference(reference, item.type))
    .filter((reference): reference is TmdbProviderReference => reference !== null);
  return matches.length === 1 ? matches[0] : null;
}

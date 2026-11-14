import type { EnrichedMediaMetadata } from "../../core/enrichedMediaMetadata";
import { parseEnrichedMediaMetadata } from "../../core/metadataValidation";
import { parsePublicRating } from "../../core/publicRating";
import { createTmdbProviderReference, type TmdbResourceNamespace } from "../../core/tmdbSavedTitle";

/** Separate projection of a supplied TMDB score. The legacy snapshot is not reinterpreted. */
export function tmdbPublicMetadata(namespace: TmdbResourceNamespace, externalId: number, input: { vote_average?: unknown }): EnrichedMediaMetadata | undefined {
  if (!Object.prototype.hasOwnProperty.call(input, "vote_average")) return undefined;
  let publicRating = null;
  if (input.vote_average !== null) {
    // Unlike Kitsu, TMDB's existing DTO specifies a number, not a decimal string.
    if (typeof input.vote_average !== "number") return undefined;
    try { publicRating = parsePublicRating({ provider: "tmdb", originalValue: input.vote_average, originalScale: { min: 0, max: 10 } }); }
    catch { return undefined; }
  }
  return parseEnrichedMediaMetadata({ version: 1, provenance: {
    reference: createTmdbProviderReference(namespace, externalId), normalizerVersion: 1,
    fetchedAt: null, checkedAt: null, sourceUpdatedAt: null,
  }, fields: { publicRating } });
}

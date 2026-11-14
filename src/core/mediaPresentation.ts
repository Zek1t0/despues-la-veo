import type { EnrichedMediaMetadata } from "./enrichedMediaMetadata";
import { activeMetadataDocument } from "./mediaMetadataState";
import { providerReferencesEqual } from "./providerReference";
import type { SavedTitleWithProviderReferences } from "./savedTitle";
import type { PublicRating } from "./publicRating";
import { parsePublicRating, publicRatingOverTen } from "./publicRating";

export function savedMediaPresentation(item: SavedTitleWithProviderReferences): {
  imageProvider: string | null; metadata?: EnrichedMediaMetadata; rating: PublicRating | null;
} {
  const state = item.metadataState;
  const reference = state ? state.selection.reference : item.providerReferences.length === 1 ? item.providerReferences[0] : null;
  const metadata = state ? activeMetadataDocument(state)?.metadata : undefined;
  const legacyCompatible = !state || !!reference && !!state.baseline.reference && providerReferencesEqual(reference, state.baseline.reference);
  const document = state ? activeMetadataDocument(state) : null;
  const legacy = reference?.provider === "tmdb" ? document?.snapshot?.voteAverage ?? (legacyCompatible ? item.voteAverage : null) : null;
  return { imageProvider: reference?.provider ?? null, metadata,
    rating: resolvePublicRating(reference?.provider, metadata, legacy) };
}
export function resolvePublicRating(provider: string | null | undefined, metadata?: EnrichedMediaMetadata, legacy?: number | null): PublicRating | null {
  if (provider !== "kitsu" && provider !== "tmdb") return null;
  const fields = metadata?.provenance.reference.provider === provider ? metadata.fields : undefined;
  const raw = fields && Object.prototype.hasOwnProperty.call(fields, "publicRating") ? fields.publicRating :
    provider === "tmdb" && typeof legacy === "number" ? { provider, originalValue: legacy, originalScale: { min: 0, max: 10 } } : null;
  if (!raw || raw.provider !== provider) return null;
  try { return parsePublicRating(raw); } catch { return null; }
}
export function publicRatingLabel(rating: PublicRating | null | undefined): string | null {
  if (!rating) return null;
  try {
    const value = publicRatingOverTen(rating).toFixed(1).replace(".", ",");
    const source = rating.provider === "kitsu" ? "Kitsu" : rating.provider === "tmdb" ? "TMDB" : null;
    return source ? `Puntuación pública · ${source}: ${value}/10` : null;
  } catch { return null; }
}

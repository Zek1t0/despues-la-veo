import type { MediaClassification } from "./mediaClassification";
import type { ProviderReference } from "./providerReference";
import type { PublicRating } from "./publicRating";

export type AlternateMediaTitle = Readonly<{
  value: string;
  language: string | null;
  script: string | null;
  kind: "localized" | "abbreviation";
}>;
export type MetadataImageVariant = Readonly<{
  url: string;
  variant: string;
  width?: number;
  height?: number;
}>;
export type MetadataEditorialStatus = Readonly<{
  original: string;
  normalized: "current" | "finished" | "upcoming" | "unreleased" | "tba" | "unknown";
}>;

/** Only provider-owned fields. Optional key = not supplied; null = authoritative unknown.
 * Consumers must not use nullish coalescing to replace authoritative nulls from another source.
 */
export type EnrichedMetadataValues = {
  canonicalTitle: string;
  titles: readonly AlternateMediaTitle[];
  /** Separate completeness boundary: an omitted abbreviation field cannot erase localized titles. */
  abbreviatedTitles: readonly AlternateMediaTitle[];
  synopsis: Readonly<{ text: string; language: string | null }>;
  posterImages: readonly MetadataImageVariant[];
  bannerImages: readonly MetadataImageVariant[];
  publicRating: PublicRating;
  classification: Readonly<MediaClassification>;
  startDate: string;
  endDate: string;
  editorialStatus: MetadataEditorialStatus;
  episodeCount: number;
  episodeLengthMinutes: number;
  totalLengthMinutes: number;
  genres: readonly string[];
  categories: readonly string[];
  ageRating: Readonly<{ value: string; system: string }>;
  ageRatingGuide: string;
  sensitive: boolean;
  warnings: readonly string[];
};
export type EnrichedMetadataFields = Readonly<{
  [K in keyof EnrichedMetadataValues]?: EnrichedMetadataValues[K] | null;
}>;
export type MetadataProvenance = Readonly<{
  reference: ProviderReference;
  normalizerVersion: 1;
  /** No wall clock inferred from item.updatedAt or sourceUpdatedAt. */
  fetchedAt: number | null;
  checkedAt: number | null;
  sourceUpdatedAt: number | null;
}>;
export type EnrichedMediaMetadata = Readonly<{
  version: 1;
  provenance: MetadataProvenance;
  fields: EnrichedMetadataFields;
}>;
export type MetadataDiagnostic = Readonly<{
  field: string;
  reason: "invalid" | "limit" | "incomplete" | "image-not-admitted";
}>;

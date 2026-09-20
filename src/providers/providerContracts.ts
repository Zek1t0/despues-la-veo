import type { ProviderReference } from "../core/providerReference";
import type { TitleType } from "../core/savedTitle";

/** Remote search metadata already normalized for the current search UI. */
export type ProviderSearchResult = Readonly<{
  reference: ProviderReference;
  displayTitle: string;
  releaseLabel: string | null;
  posterUrl: string | null;
  description: string | null;
  kindLabel: string;
}>;

/** Remote snapshot fields that the current local media domain can persist. */
export type ProviderLocalSnapshot = Readonly<{
  type: TitleType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  /** Existing local snapshot field; not a cross-provider rating ontology. */
  voteAverage: number | null;
}>;

/** Portable provider metadata, separate from local item-creation policy. */
export type ProviderMediaDetails = Readonly<{
  reference: ProviderReference;
  snapshot: ProviderLocalSnapshot;
}>;

/** Explicit input for local creation/refresh, including provider-supplied initial tags. */
export type ProviderMaterializationInput = Readonly<{
  reference: ProviderReference;
  snapshot: ProviderLocalSnapshot;
  initialTags: readonly string[];
}>;

/** The only shared remote operation currently required by an application consumer. */
export interface ProviderSearchCapability {
  search(query: string): Promise<readonly ProviderSearchResult[]>;
}

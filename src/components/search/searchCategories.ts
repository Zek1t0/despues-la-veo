import type { ProviderSearchCapability, ProviderSearchResult } from "../../providers/providerContracts";
import { createTmdbProviderReference } from "../../core/tmdbProviderReference";

export type SearchCategoryId = "movie" | "tv" | "manga" | "manhwa" | "manhua";
export type SearchSource = "tmdb" | "mangaupdates";
export type SearchCategory = Readonly<{
  id: SearchCategoryId;
  label: string;
  source: SearchSource;
  remoteResource: "movie" | "tv" | "Manga" | "Manhwa" | "Manhua";
}>;

/** Product categories, not a registry of executable providers. */
export const SEARCH_CATEGORIES: readonly SearchCategory[] = Object.freeze([
  { id: "movie", label: "Películas", source: "tmdb", remoteResource: "movie" },
  { id: "tv", label: "Series", source: "tmdb", remoteResource: "tv" },
  { id: "manga", label: "Manga", source: "mangaupdates", remoteResource: "Manga" },
  { id: "manhwa", label: "Manhwa", source: "mangaupdates", remoteResource: "Manhwa" },
  { id: "manhua", label: "Manhua", source: "mangaupdates", remoteResource: "Manhua" },
]);

export function productionSearchCategories(platform: string): readonly SearchCategory[] {
  if (platform !== "web" && platform !== "android" && platform !== "ios") return [];
  // MangaUpdates product integration/native validation remain pending; Web lacks usable CORS.
  return SEARCH_CATEGORIES.filter(category => category.source === "tmdb");
}

/** A known future destination is not permission to activate an adapter or screen. */
export function searchResultDestination(category: SearchCategory, result: ProviderSearchResult):
  `/tmdb/movie/${string}` | `/tmdb/tv/${string}` | `/mangaupdates/series/${string}` | null {
  const { reference } = result;
  if (reference.provider !== category.source) return null;
  if (category.id === "movie" || category.id === "tv") {
    if (category.source !== "tmdb" || reference.resourceNamespace !== category.id) return null;
    try {
      const canonical = createTmdbProviderReference(category.id, reference.externalId);
      if (canonical.externalId !== reference.externalId) return null;
      return category.id === "movie" ? `/tmdb/movie/${canonical.externalId}` : `/tmdb/tv/${canonical.externalId}`;
    } catch { return null; }
  }
  if ((category.id !== "manga" && category.id !== "manhwa" && category.id !== "manhua") ||
      category.source !== "mangaupdates" || reference.resourceNamespace !== "series" ||
      !/^[1-9]\d*$/.test(reference.externalId)) return null;
  return `/mangaupdates/series/${reference.externalId}`;
}

export type ResolvedSearchCategory = Readonly<{
  category: SearchCategory;
  capability: ProviderSearchCapability;
  destination: (result: ProviderSearchResult) => ReturnType<typeof searchResultDestination>;
}>;

export function resolveProductionSearchCategory(
  id: SearchCategoryId,
  platform: string,
  tmdb: Readonly<{ movie: ProviderSearchCapability; tv: ProviderSearchCapability }>,
): ResolvedSearchCategory | null {
  const category = productionSearchCategories(platform).find(candidate => candidate.id === id);
  if (!category || (category.id !== "movie" && category.id !== "tv")) return null;
  return { category, capability: tmdb[category.id], destination: result => searchResultDestination(category, result) };
}

import type { ProviderSearchCapability, ProviderSearchResult } from "../../providers/providerContracts";
import { createTmdbProviderReference } from "../../core/tmdbProviderReference";
import { mangaUpdatesAvailability } from "../../providers/mangaupdates/availability";
import { canonicalSeriesId } from "../../providers/mangaupdates/identity";

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
  return SEARCH_CATEGORIES.filter(category => category.source === "tmdb" || mangaUpdatesAvailability(platform).productionEnabled);
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
      reference.externalId.trim() !== reference.externalId) return null;
  try { return `/mangaupdates/series/${canonicalSeriesId(reference.externalId)}`; }
  catch { return null; }
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
  mangaUpdates?: Readonly<{ manga: ProviderSearchCapability; manhwa: ProviderSearchCapability; manhua: ProviderSearchCapability }>,
): ResolvedSearchCategory | null {
  const category = productionSearchCategories(platform).find(candidate => candidate.id === id);
  if (!category) return null;
  const capability = category.id === "movie" || category.id === "tv" ? tmdb[category.id] : mangaUpdates?.[category.id];
  if (!capability) return null;
  return { category, capability, destination: result => searchResultDestination(category, result) };
}

import type { ProviderSearchCapability } from "../providerContracts";
import { searchMulti, searchMovies, searchTv } from "./tmdbApi";
import { mapTmdbSearchResults } from "./tmdbMappers";
import type { TmdbSearchMultiItem } from "./tmdbTypes";

type TmdbSearchRequest = (
  query: string,
  page: number,
) => Promise<{ results: readonly TmdbSearchMultiItem[] }>;

export function createTmdbSearchCapability(
  request: TmdbSearchRequest = searchMulti,
): ProviderSearchCapability {
  return {
    async search(query) {
      const response = await request(query, 1);
      return mapTmdbSearchResults(response.results);
    },
  };
}

export const tmdbSearchCapability: ProviderSearchCapability = createTmdbSearchCapability();

export function createTmdbCategorySearchCapability(
  namespace: "movie" | "tv",
  request: (query: string, page: number) => Promise<{ results: readonly Omit<TmdbSearchMultiItem, "media_type">[] }> =
    namespace === "movie" ? searchMovies : searchTv,
): ProviderSearchCapability {
  return {
    async search(query) {
      const response = await request(query, 1);
      return mapTmdbSearchResults(response.results.map(item => ({ ...item, media_type: namespace })));
    },
  };
}

export const tmdbMovieSearchCapability = createTmdbCategorySearchCapability("movie");
export const tmdbTvSearchCapability = createTmdbCategorySearchCapability("tv");

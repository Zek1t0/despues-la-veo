import type { ProviderSearchCapability } from "../providerContracts";
import { searchMulti } from "./tmdbApi";
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

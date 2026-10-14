import type { ProviderSearchCapability } from "../providerContracts";
import { getMangaUpdatesClient, type MangaUpdatesClient } from "./client";
import { mapMangaUpdatesSearchResult, type MangaUpdatesCoverPolicy } from "./mapping";
import { admittedType, type MangaUpdatesType } from "./validation";

/** Ready for a future explicit category consumer; not registered or connected to production Buscar. */
export function createMangaUpdatesSearchCapability(
  type: MangaUpdatesType, client: MangaUpdatesClient = getMangaUpdatesClient(), coverPolicy: MangaUpdatesCoverPolicy = "omit",
): ProviderSearchCapability {
  admittedType(type);
  return Object.freeze({ async search(query: string) {
    const response = await client.searchSeries(query, type);
    return Object.freeze(response.records.map(record => mapMangaUpdatesSearchResult(record, coverPolicy)));
  } });
}

import type { ProviderReference } from "../../core/providerReference";
import type { ProviderSearchCapability } from "../providerContracts";
import { kitsuAvailability } from "./availability";
import { createKitsuClient, type KitsuClient } from "./client";
import { KitsuError } from "./errors";
import { assertKitsuReference, canonicalAnimeId, KITSU_API_BASE } from "./identity";
import { mapKitsuSearchResult } from "./mapping";
let shared: KitsuClient | undefined;
function enabled(platform: string) {
  if (!kitsuAvailability(platform).productionEnabled) throw new KitsuError("unavailable");
}
function client() { return shared ??= createKitsuClient({ fetchImplementation: fetch }); }
export function createKitsuSearchCapability(injected: KitsuClient): ProviderSearchCapability {
  return { search: async (query, signal) => (await injected.searchAnime(query, 0, signal)).map(mapKitsuSearchResult) };
}
export function kitsuProductSearch(platform: () => string): ProviderSearchCapability {
  return { search: async (query, signal) => { enabled(platform()); return createKitsuSearchCapability(client()).search(query, signal); } };
}
export async function loadKitsuProductDetail(id: string, platform: string, signal?: AbortSignal) {
  canonicalAnimeId(id); enabled(platform); return client().getAnime(id, signal);
}
export function localKitsuSources(references: readonly ProviderReference[], platform: string) {
  return references.flatMap(reference => {
    if (reference.provider !== "kitsu") return [];
    try {
      const id = assertKitsuReference(reference);
      return [{ label: "Datos: Kitsu", sourceUrl: `${KITSU_API_BASE}/anime/${id}`, reference,
        destination: kitsuAvailability(platform).productionEnabled ? `/kitsu/anime/${id}` as const : null }];
    } catch { return []; }
  });
}

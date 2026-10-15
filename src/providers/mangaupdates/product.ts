import type { ProviderReference } from "../../core/providerReference";
import type { MangaUpdatesClient } from "./client";
import { getMangaUpdatesClient } from "./client";
import { mangaUpdatesAvailability } from "./availability";
import { MangaUpdatesError } from "./errors";
import { canonicalSeriesId, mangaUpdatesDetailDestination } from "./identity";
import { mangaUpdatesProvenance } from "./attribution";
import type { MangaUpdatesType } from "./validation";

/** Product gate is separate from the diagnostic transport, and checked before HTTP/cache. */
export async function loadMangaUpdatesProductDetail(
  id: string, platform: string, selectedType?: MangaUpdatesType, signal?: AbortSignal,
  client?: MangaUpdatesClient,
) {
  canonicalSeriesId(id);
  if (!mangaUpdatesAvailability(platform).productionEnabled) throw new MangaUpdatesError("platform-unavailable");
  return (client ?? getMangaUpdatesClient()).getSeries(id, selectedType, signal);
}

/** Local provenance uses references only and never fetches remote metadata. */
export function localMangaUpdatesSources(references: readonly ProviderReference[], platform: string) {
  return references.flatMap(reference => {
    if (reference.provider !== "mangaupdates") return [];
    try {
      return [{ ...mangaUpdatesProvenance(reference), reference,
        destination: mangaUpdatesAvailability(platform).productionEnabled
          ? mangaUpdatesDetailDestination(reference) : null }];
    } catch { return []; }
  });
}

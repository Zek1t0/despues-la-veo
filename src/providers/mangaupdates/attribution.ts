import type { ProviderReference } from "../../core/providerReference";
import { MANGAUPDATES_API_BASE, assertMangaUpdatesReference } from "./identity";
export { mangaUpdatesAvailability } from "./availability";

export const MANGAUPDATES_ATTRIBUTION = Object.freeze({
  label: "Datos: MangaUpdates", providerName: "MangaUpdates", providerUrl: "https://www.mangaupdates.com/",
});

/** The canonical public API record is an honest source link, without guessing a website slug. */
export function mangaUpdatesProvenance(reference: ProviderReference) {
  return Object.freeze({ ...MANGAUPDATES_ATTRIBUTION,
    sourceUrl: `${MANGAUPDATES_API_BASE}/v1/series/${assertMangaUpdatesReference(reference)}` });
}

import { Platform } from "react-native";
import type { ProviderSearchCapability } from "../../providers/providerContracts";
import { createMangaUpdatesSearchCapability } from "../../providers/mangaupdates/adapter";
import { mangaUpdatesAvailability } from "../../providers/mangaupdates/availability";
import { MangaUpdatesError } from "../../providers/mangaupdates/errors";
import type { MangaUpdatesType } from "../../providers/mangaupdates/validation";

function productSearch(type: MangaUpdatesType): ProviderSearchCapability {
  let capability: ProviderSearchCapability | undefined;
  return Object.freeze({ search(query: string) {
    if (!mangaUpdatesAvailability(Platform.OS).productionEnabled) {
      return Promise.reject(new MangaUpdatesError("platform-unavailable"));
    }
    // The default cover policy is omit; technical URL support is not rights authorization.
    capability ??= createMangaUpdatesSearchCapability(type);
    return capability.search(query);
  } });
}

export const mangaUpdatesSearchCapabilities = Object.freeze({
  manga: productSearch("Manga"), manhwa: productSearch("Manhwa"), manhua: productSearch("Manhua"),
});

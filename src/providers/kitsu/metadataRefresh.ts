import { refreshReference } from "../../application/metadataRefreshBinding";
import type { ProviderMetadataRefreshCapability } from "../providerRefreshContracts";
import { assertKitsuReference } from "./identity";
import { kitsuAvailability } from "./availability";
import { loadKitsuProductDetail } from "./product";
import { mapKitsuDetails } from "./mapping";
export function createKitsuRefreshCapability(platform: () => string, load = loadKitsuProductDetail): ProviderMetadataRefreshCapability {
    return { fields: ["titles", "synopsis", "posterImages", "bannerImages", "publicRating", "classification", "editorialStatus", "genres", "categories", "sensitive", "ageRating", "ageRatingGuide"], scope: () => "development",
        eligibility(item) { try {
            assertKitsuReference(refreshReference(item)!);
            return kitsuAvailability(platform()).enabled ? { enabled: true } : { enabled: false, reason: "Kitsu solo está habilitado en Web/Android de desarrollo." };
        }
        catch {
            return { enabled: false, reason: "Referencia Kitsu inválida." };
        } },
        async load(item, signal) {
            if (!this.eligibility(item).enabled)
                throw Object.assign(Error(), { code: "unavailable" });
            const ref = refreshReference(item)!;
            const anime = await load(assertKitsuReference(ref), platform(), signal), details = mapKitsuDetails(anime);
            if (anime.id !== ref.externalId || !details.metadata)
                throw Object.assign(Error(), { code: "invalid-response" });
            return { metadata: details.metadata, diagnostics: anime.metadataDiagnostics ?? [] };
        } };
}

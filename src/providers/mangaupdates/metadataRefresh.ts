import { refreshReference } from "../../application/metadataRefreshBinding";
import type { ProviderMetadataRefreshCapability } from "../providerRefreshContracts";
import { parsePortableMetadata } from "../../core/mediaMetadataState";
import { assertMangaUpdatesReference } from "./identity";
import { mangaUpdatesAvailability } from "./availability";
import { loadMangaUpdatesProductDetail } from "./product";
import { mapMangaUpdatesDetails } from "./mapping";
import type { MangaUpdatesType } from "./validation";
const selectedType = (family: unknown): MangaUpdatesType | null => family === "manga" ? "Manga" : family === "manhwa" ? "Manhwa" : family === "manhua" ? "Manhua" : null;
export function createMangaUpdatesRefreshCapability(platform: () => string, load = loadMangaUpdatesProductDetail): ProviderMetadataRefreshCapability {
    return { fields: ["canonicalTitle", "classification", "synopsis", "genres"], scope: () => "android",
        eligibility(item) { try {
            assertMangaUpdatesReference(refreshReference(item)!);
            if (item.medium !== "comic" || !selectedType(item.contentFamily))
                throw Error();
            return mangaUpdatesAvailability(platform()).productionEnabled ? { enabled: true } : { enabled: false, reason: "MangaUpdates solo está habilitado en Android." };
        }
        catch {
            return { enabled: false, reason: "Referencia o tipo MangaUpdates incompatible." };
        } },
        async load(item, signal) {
            if (!this.eligibility(item).enabled)
                throw Object.assign(Error(), { code: "unavailable" });
            const ref = refreshReference(item)!;
            const record = await load(assertMangaUpdatesReference(ref), platform(), selectedType(item.contentFamily)!, signal, undefined, true);
            if (record.seriesId !== ref.externalId || record.type !== selectedType(item.contentFamily))
                throw Object.assign(Error(), { code: "invalid-response" });
            const { snapshot } = mapMangaUpdatesDetails(record, "omit");
            // The older DTO loses optional presence. Unknown/empty fields are deliberately non-authoritative.
            return { metadata: parsePortableMetadata({ version: 1, provenance: { reference: ref, normalizerVersion: 1, fetchedAt: null, checkedAt: null, sourceUpdatedAt: null }, fields: { canonicalTitle: snapshot.title,
                        classification: { medium: snapshot.medium, contentFamily: snapshot.contentFamily, primaryFormat: snapshot.primaryFormat },
                        ...(snapshot.overview ? { synopsis: { text: snapshot.overview, language: null } } : {}), ...(snapshot.genres.length ? { genres: snapshot.genres } : {}) } }),
                ...(snapshot.year !== null ? { snapshotPatch: { year: snapshot.year } } : {}), diagnostics: [...(!snapshot.overview ? [{ field: "synopsis", reason: "incomplete" as const }] : []), ...(!snapshot.genres.length ? [{ field: "genres", reason: "incomplete" as const }] : [])] };
        } };
}

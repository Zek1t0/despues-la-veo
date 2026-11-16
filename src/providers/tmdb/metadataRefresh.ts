import { createTmdbProviderReference } from "../../core/tmdbProviderReference";
import { metadataText, validMetadataField } from "../../core/metadataValidation";
import { parsePortableMetadata } from "../../core/mediaMetadataState";
import { providerReferencesEqual } from "../../core/providerReference";
import { refreshReference } from "../../application/metadataRefreshBinding";
import type { ProviderMetadataRefreshCapability } from "../providerRefreshContracts";
import type { EnrichedMetadataValues, MetadataDiagnostic } from "../../core/enrichedMediaMetadata";
import { mapTmdbMovieDetails, mapTmdbTvDetails } from "./tmdbMappers";
import type { TmdbMovieDetails, TmdbTvDetails } from "./tmdbTypes";
import { TMDB_IMAGE_HOSTS } from "../../core/mediaImagePresentation";
export function createTmdbRefreshCapability(options: {
    available(): boolean;
    generation(): number;
    load(type: "movie" | "tv", id: string, signal: AbortSignal): Promise<unknown>;
}): ProviderMetadataRefreshCapability {
    return { fields: ["canonicalTitle", "startDate", "synopsis", "genres", "totalLengthMinutes", "posterImages", "publicRating"], scope: () => String(options.generation()),
        eligibility(item) { try {
            const ref = refreshReference(item)!;
            if (!providerReferencesEqual(ref, createTmdbProviderReference(ref.resourceNamespace as "movie" | "tv", ref.externalId)))
                throw Error();
            return options.available() ? { enabled: true } : { enabled: false, reason: "Configurá una credencial TMDB disponible." };
        }
        catch {
            return { enabled: false, reason: "Referencia TMDB inválida." };
        } },
        async load(item, signal) {
            const ref = refreshReference(item)!;
            const raw = await options.load(ref.resourceNamespace as "movie" | "tv", ref.externalId, signal);
            if (!raw || typeof raw !== "object" || Array.isArray(raw))
                throw Object.assign(Error(), { code: "invalid-response" });
            const dto = raw as Record<string, unknown>, titleKey = ref.resourceNamespace === "movie" ? "title" : "name";
            if (String(dto.id) !== ref.externalId || !metadataText(dto[titleKey], 5000))
                throw Object.assign(Error(), { code: "invalid-response" });
            const diagnostics: MetadataDiagnostic[] = [], safe = { ...dto };
            const genresValid = Array.isArray(dto.genres) && dto.genres.length <= 128 && dto.genres.every(g => g && typeof g === "object" && metadataText((g as {
                name?: unknown;
            }).name, 500));
            if (!genresValid)
                delete safe.genres;
            if (typeof safe.overview !== "string" && safe.overview !== null)
                delete safe.overview;
            const mapped = ref.resourceNamespace === "movie" ? mapTmdbMovieDetails(safe as unknown as TmdbMovieDetails) : mapTmdbTvDetails(safe as unknown as TmdbTvDetails);
            const fields: Record<string, unknown> = { ...mapped.metadata?.fields };
            if (!genresValid) {
                delete fields.genres;
                if (Object.hasOwn(dto, "genres"))
                    diagnostics.push({ field: "genres", reason: "invalid" });
            }
            if (Object.hasOwn(dto, "poster_path")) {
                if (dto.poster_path === null)
                    fields.posterImages = null;
                else if (typeof dto.poster_path === "string" && dto.poster_path.startsWith("/") && mapped.snapshot.posterUrl)
                    fields.posterImages = [{ url: mapped.snapshot.posterUrl, variant: "w342", width: 342 }];
                else
                    diagnostics.push({ field: "posterImages", reason: "invalid" });
            }
            for (const [rawKey, key] of [["overview", "synopsis"], ["vote_average", "publicRating"], ["runtime", "totalLengthMinutes"], [ref.resourceNamespace === "movie" ? "release_date" : "first_air_date", "startDate"]] as const) {
                if (Object.hasOwn(dto, rawKey) && !Object.hasOwn(fields, key))
                    diagnostics.push({ field: key, reason: "invalid" });
            }
            for (const [key, value] of Object.entries(fields))
                if (value !== null && !validMetadataField(key as keyof EnrichedMetadataValues, value, "tmdb", TMDB_IMAGE_HOSTS)) {
                    delete fields[key];
                    diagnostics.push({ field: key, reason: "invalid" });
                }
            return { metadata: parsePortableMetadata({ version: 1, provenance: { reference: ref, normalizerVersion: 1, fetchedAt: null, checkedAt: null, sourceUpdatedAt: null }, fields }), diagnostics };
        } };
}

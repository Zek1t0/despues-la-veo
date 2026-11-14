import { assertMetadataReference, metadataDate } from "../../core/metadataValidation";
import { kitsuSummary } from "./enrichedMetadata";
import type { MediaPrimaryFormat } from "../../core/mediaClassification";
import type { ProviderMaterializationInput, ProviderMediaDetails, ProviderSearchResult } from "../providerContracts";
import { kitsuReference } from "./identity";
import type { KitsuAnime } from "./validation";
const formats: Readonly<Record<string, MediaPrimaryFormat>> = { TV: "tv", movie: "movie", OVA: "ova", ONA: "ona", special: "special", music: "music" };
/** Explicit narrative-only allowlist; excludes demographics, themes and arbitrary provider categories. */
export const KITSU_NARRATIVE_GENRES = Object.freeze(["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Science Fiction", "Slice of Life", "Sports", "Supernatural", "Thriller"]);
const approvedGenres = new Map(KITSU_NARRATIVE_GENRES.map(genre => [genre.toLocaleLowerCase("en"), genre]));
export function animeFormat(subtype: string | null): MediaPrimaryFormat {
  return subtype !== null && Object.prototype.hasOwnProperty.call(formats, subtype) ? formats[subtype] : null;
}
export function animeYear(date: string | null): number | null {
  return metadataDate(date) ? Number(date.slice(0, 4)) : null;
}
/** Kept as a compatibility export for the original Kitsu contracts. */
export const animeSummary = kitsuSummary;
export function mapKitsuDetails(anime: KitsuAnime): ProviderMediaDetails {
  const reference = kitsuReference(anime.id);
  if (anime.metadata) assertMetadataReference(anime.metadata, reference);
  const classification = { medium: "audiovisual" as const, contentFamily: "anime" as const,
    primaryFormat: animeFormat(anime.subtype) };
  const narrativeGenres = (categories: readonly string[]) => [...new Set(categories.flatMap(category => {
    const approved = approvedGenres.get(category.trim().toLocaleLowerCase("en"));
    return approved ? [approved] : [];
  }))];
  const snapshot = { ...classification, title: anime.title, year: animeYear(anime.startDate),
    overview: animeSummary(anime.synopsis), posterUrl: null, genres: narrativeGenres(anime.categories) };
  if (!anime.metadata) return { reference, snapshot };
  const fields = anime.metadata.fields;
  const metadata = Object.freeze({ ...anime.metadata, fields: Object.freeze({ ...fields,
    classification: Object.freeze(classification),
    ...(!Object.prototype.hasOwnProperty.call(fields, "genres") && Array.isArray(fields.categories)
      ? { genres: Object.freeze(narrativeGenres(fields.categories)) } : {}),
  }) });
  return { reference, snapshot, metadata };
}
export function kitsuMaterializationInput(anime: KitsuAnime): ProviderMaterializationInput {
  return { ...mapKitsuDetails(anime), initialTags: [] };
}
export function mapKitsuSearchResult(anime: KitsuAnime): ProviderSearchResult {
  const { reference, snapshot, metadata } = mapKitsuDetails(anime);
  return { reference, ...(metadata ? { metadata } : {}), displayTitle: snapshot.title, releaseLabel: snapshot.year === null ? null : String(snapshot.year),
    posterUrl: null, description: snapshot.overview, kindLabel: "Anime · Kitsu" };
}

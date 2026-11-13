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
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7)), day = Number(date.slice(8));
  if (year < 1 || month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1] ? year : null;
}
/** Text only. No HTML renderer, URL fetching or executable links. */
export function animeSummary(value: string | null): string | null {
  if (!value) return null;
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&([a-z]+);/gi, (match, key: string) => entities[key.toLowerCase()] ?? match)
    .replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]+/g, " ").trim() || null;
}
export function mapKitsuDetails(anime: KitsuAnime): ProviderMediaDetails {
  return { reference: kitsuReference(anime.id), snapshot: { medium: "audiovisual", contentFamily: "anime",
    primaryFormat: animeFormat(anime.subtype), title: anime.title, year: animeYear(anime.startDate),
    overview: animeSummary(anime.synopsis), posterUrl: null,
    genres: [...new Set(anime.categories.flatMap(category => {
      const approved = approvedGenres.get(category.trim().toLocaleLowerCase("en")); return approved ? [approved] : [];
    }))] } };
}
export function kitsuMaterializationInput(anime: KitsuAnime): ProviderMaterializationInput {
  return { ...mapKitsuDetails(anime), initialTags: [] };
}
export function mapKitsuSearchResult(anime: KitsuAnime): ProviderSearchResult {
  const { reference, snapshot } = mapKitsuDetails(anime);
  return { reference, displayTitle: snapshot.title, releaseLabel: snapshot.year === null ? null : String(snapshot.year),
    posterUrl: null, description: snapshot.overview, kindLabel: "Anime · Kitsu" };
}

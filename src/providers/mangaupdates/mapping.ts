import type { ProviderMaterializationInput, ProviderMediaDetails, ProviderSearchResult } from "../providerContracts";
import { mangaUpdatesReference } from "./identity";
import { admittedType, type MangaUpdatesSeries } from "./validation";

/** Explicit provider spellings, not a general genre ontology. Demographics/categories are excluded. */
export const MANGAUPDATES_NARRATIVE_GENRES = Object.freeze([
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance",
  "Sci-fi", "Slice of Life", "Sports", "Supernatural", "Psychological", "Historical", "Tragedy",
] as const);
const GENRES = new Map<string, string>(MANGAUPDATES_NARRATIVE_GENRES.map(genre => [genre.toLowerCase(), genre]));
GENRES.set("science fiction", "Sci-fi");

export type MangaUpdatesCoverPolicy = "omit" | "reference-https";

export function narrativeGenres(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.flatMap(value => {
    const approved = GENRES.get(value.trim().toLowerCase());
    return approved ? [approved] : [];
  }))]);
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};
export function plainMangaUpdatesDescription(value: string | null): string | null {
  if (!value) return null;
  const decoded = value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? entity;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : "";
  });
  return decoded.replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?(?:p|div|li|h[1-6]|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/\*\*|__|~~|`{1,3}/g, "")
    .replace(/\u0000|[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim() || null;
}

export function publicationYear(value: string | null): number | null {
  return value !== null && /^[1-9][0-9]{3}$/.test(value.trim()) ? parseInt(value.trim(), 10) : null;
}

/** Host/HTTPS checks are technical, not copyright or hotlink permission. Default is no cover. */
export function mangaUpdatesPoster(value: string | null, policy: MangaUpdatesCoverPolicy = "omit"): string | null {
  if (policy !== "reference-https" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "cdn.mangaupdates.com" ||
        url.username || url.password || (url.port && url.port !== "443")) return null;
    return url.href;
  } catch { return null; }
}

export function mapMangaUpdatesDetails(record: MangaUpdatesSeries, coverPolicy: MangaUpdatesCoverPolicy = "omit"): ProviderMediaDetails {
  const type = admittedType(record.type);
  const contentFamily = type === "Manga" ? "manga" : type === "Manhwa" ? "manhwa" : "manhua";
  // Deliberately enumerate local fields: no spread of ratings/categories/provider DTOs.
  return Object.freeze({ reference: mangaUpdatesReference(record.seriesId), snapshot: Object.freeze({
    medium: "comic", contentFamily, primaryFormat: null, title: record.title,
    year: publicationYear(record.year), posterUrl: mangaUpdatesPoster(record.originalImage, coverPolicy),
    overview: plainMangaUpdatesDescription(record.description), genres: narrativeGenres(record.genres),
  }) });
}

export function mangaUpdatesMaterializationInput(record: MangaUpdatesSeries, coverPolicy: MangaUpdatesCoverPolicy = "omit"): ProviderMaterializationInput {
  return Object.freeze({ ...mapMangaUpdatesDetails(record, coverPolicy), initialTags: Object.freeze([]) });
}

export function mapMangaUpdatesSearchResult(record: MangaUpdatesSeries, coverPolicy: MangaUpdatesCoverPolicy = "omit"): ProviderSearchResult {
  const detail = mapMangaUpdatesDetails(record, coverPolicy);
  return Object.freeze({ reference: detail.reference, displayTitle: detail.snapshot.title,
    releaseLabel: detail.snapshot.year === null ? null : String(detail.snapshot.year),
    posterUrl: mangaUpdatesPoster(record.thumbnailImage ?? record.originalImage, coverPolicy),
    description: detail.snapshot.overview, kindLabel: record.type,
  });
}

import { MangaUpdatesError } from "./errors";
import { canonicalSeriesId, seriesIdFromResponse } from "./identity";

export const MANGAUPDATES_TYPES = ["Manga", "Manhwa", "Manhua"] as const;
export type MangaUpdatesType = typeof MANGAUPDATES_TYPES[number];

/** Only consumed data is retained. Ratings/categories/authors/relations are intentionally absent. */
export type MangaUpdatesSeries = Readonly<{
  seriesId: string;
  title: string;
  type: MangaUpdatesType;
  year: string | null;
  description: string | null;
  originalImage: string | null;
  thumbnailImage: string | null;
  genres: readonly string[];
}>;
export type MangaUpdatesSearchResponse = Readonly<{
  totalHits: number; page: number; perPage: number;
  records: readonly MangaUpdatesSeries[];
}>;

function invalid(): never { throw new MangaUpdatesError("invalid-response"); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function nullableText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return invalid();
  return value;
}
function integer(value: unknown, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) return invalid();
  return value;
}
export function admittedType(value: unknown): MangaUpdatesType {
  if (value !== "Manga" && value !== "Manhwa" && value !== "Manhua") {
    throw new MangaUpdatesError("unsupported-type");
  }
  return value;
}

export function parseSeries(value: unknown): MangaUpdatesSeries {
  const input = object(value);
  const seriesId = seriesIdFromResponse(input.series_id);
  if (typeof input.title !== "string" || !input.title.trim()) return invalid();
  if (typeof input.type !== "string" || !input.type) return invalid();
  const type = admittedType(input.type);
  let originalImage: string | null = null, thumbnailImage: string | null = null;
  if (input.image !== undefined && input.image !== null) {
    const image = object(input.image);
    if (image.url !== undefined && image.url !== null) {
      const urls = object(image.url);
      originalImage = nullableText(urls.original);
      thumbnailImage = nullableText(urls.thumb);
    }
  }
  let genres: string[] = [];
  if (input.genres !== undefined && input.genres !== null) {
    if (!Array.isArray(input.genres) || input.genres.length > 100) return invalid();
    genres = input.genres.map(value => {
      const genre = object(value).genre;
      if (typeof genre !== "string" || !genre.trim()) return invalid();
      return genre;
    });
  }
  return Object.freeze({ seriesId, title: input.title.trim(), type,
    year: nullableText(input.year), description: nullableText(input.description),
    originalImage, thumbnailImage, genres: Object.freeze(genres) });
}

export function parseSearchResponse(value: unknown, selectedType: MangaUpdatesType): MangaUpdatesSearchResponse {
  admittedType(selectedType);
  const input = object(value);
  const totalHits = integer(input.total_hits, 0), page = integer(input.page, 1), perPage = integer(input.per_page, 1);
  if (!Array.isArray(input.results) || input.results.length > 100) return invalid();
  const records: MangaUpdatesSeries[] = [];
  for (const value of input.results) {
    const hit = object(value);
    nullableText(hit.hit_title); // Alternative match text is never canonical title/identity.
    try {
      const record = parseSeries(hit.record);
      if (record.type === selectedType) records.push(record);
    } catch (error) {
      if (!(error instanceof MangaUpdatesError) || error.code !== "unsupported-type") throw error;
    }
  }
  // Preserve one source's order. Do not deduplicate or fetch subsequent pages.
  return Object.freeze({ totalHits, page, perPage, records: Object.freeze(records) });
}

export function parseDetailResponse(value: unknown, requestedId: string, selectedType?: MangaUpdatesType): MangaUpdatesSeries {
  const record = parseSeries(value);
  if (record.seriesId !== canonicalSeriesId(requestedId)) return invalid();
  if (selectedType !== undefined && record.type !== admittedType(selectedType)) {
    throw new MangaUpdatesError("unsupported-type");
  }
  return record;
}

export function mangaUpdatesSearchBody(query: string, type: MangaUpdatesType, perPage = 25) {
  admittedType(type);
  if (typeof query !== "string" || !query.trim() || query.trim().length > 250 ||
      !Number.isInteger(perPage) || perPage < 1 || perPage > 25) throw new MangaUpdatesError("invalid-request");
  return { search: query.trim(), stype: "title" as const, type: [type], page: 1, perpage: perPage };
}

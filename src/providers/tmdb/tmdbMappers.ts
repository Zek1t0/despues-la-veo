import { assertMetadataReference, metadataDate, parseEnrichedMediaMetadata } from "../../core/metadataValidation";
import { createTmdbProviderReference, type TmdbResourceNamespace } from "../../core/tmdbSavedTitle";
import { classificationFromHistoricalType } from "../../core/mediaClassification";
import type {
  ProviderMaterializationInput,
  ProviderMediaDetails,
  ProviderSearchResult,
} from "../providerContracts";
import { posterUrl } from "./tmdbImages";
import { tmdbPublicMetadata } from "./publicMetadata";
import type {
  TmdbDetails,
  TmdbMovieDetails,
  TmdbSearchMultiItem,
  TmdbTvDetails,
} from "./tmdbTypes";

function displayYear(date: string | undefined): string | null {
  return date?.slice(0, 4) || null;
}

function snapshotYear(date: string | undefined): number | null {
  if (!date) return null;
  const year = date.slice(0, 4);
  return /^\d{4}$/.test(year) ? Number(year) : null;
}

function normalizedOverview(overview: string | null | undefined): string | null {
  return typeof overview === "string" && overview.trim().length > 0 ? overview : null;
}

export function mapTmdbSearchItem(item: TmdbSearchMultiItem): ProviderSearchResult | null {
  if (item.media_type !== "movie" && item.media_type !== "tv") return null;

  const isMovie = item.media_type === "movie";
  const metadata = tmdbPublicMetadata(item.media_type, item.id, item);
  return {
    ...(metadata ? { metadata } : {}),
    reference: createTmdbProviderReference(item.media_type, item.id),
    displayTitle: isMovie ? item.title ?? "Sin título" : item.name ?? "Sin nombre",
    releaseLabel: displayYear(isMovie ? item.release_date : item.first_air_date),
    posterUrl: posterUrl(item.poster_path, "w185"),
    description: item.overview ?? null,
    kindLabel: isMovie ? "Película" : "Serie",
  };
}

export function mapTmdbSearchResults(
  items: readonly TmdbSearchMultiItem[],
): readonly ProviderSearchResult[] {
  return items
    .map(mapTmdbSearchItem)
    .filter((item): item is ProviderSearchResult => item !== null);
}

export function mapTmdbMovieDetails(details: TmdbMovieDetails): ProviderMediaDetails {
  return mapTmdbDetails("movie", details, details.title ?? "Sin título", details.release_date);
}

export function mapTmdbTvDetails(details: TmdbTvDetails): ProviderMediaDetails {
  return mapTmdbDetails("tv", details, details.name ?? "Sin título", details.first_air_date);
}

function mapTmdbDetails(
  type: TmdbResourceNamespace,
  details: TmdbDetails,
  title: string,
  date: string | undefined,
): ProviderMediaDetails {
  const publicMetadata = tmdbPublicMetadata(type, details.id, details);
  const fields: Record<string, unknown> = { ...publicMetadata?.fields, canonicalTitle: title, genres: tmdbGenreNames(details) };
  if (metadataDate(date)) fields.startDate = date;
  if (details.overview === null) fields.synopsis = null;
  else if (normalizedOverview(details.overview)) fields.synopsis = { text: details.overview, language: null };
  if (type === "movie") {
    const runtime = (details as TmdbMovieDetails).runtime;
    if (runtime === null) fields.totalLengthMinutes = null;
    else if (typeof runtime === "number" && Number.isFinite(runtime) && runtime >= 0 && runtime <= 10000000) fields.totalLengthMinutes = runtime;
  }
  const metadata = parseEnrichedMediaMetadata({ version: 1, provenance: { reference: createTmdbProviderReference(type, details.id),
    normalizerVersion: 1, fetchedAt: null, checkedAt: null, sourceUpdatedAt: null }, fields });
  return {
    ...(metadata ? { metadata } : {}),
    reference: createTmdbProviderReference(type, details.id),
    snapshot: {
      ...classificationFromHistoricalType(type),
      title,
      year: snapshotYear(date),
      posterUrl: posterUrl(details.poster_path),
      overview: normalizedOverview(details.overview),
      genres: tmdbGenreNames(details),
      voteAverage: typeof details.vote_average === "number" ? details.vote_average : null,
    },
  };
}

function tmdbGenreNames(details: TmdbDetails): readonly string[] {
  return Array.isArray(details.genres)
    ? details.genres.map((genre) => String(genre.name)).filter(Boolean)
    : [];
}

/** TMDB creation policy; snapshot genres do not require matching initial tags. */
export function tmdbInitialTags(details: TmdbDetails): readonly string[] {
  return tmdbGenreNames(details);
}

export function createTmdbMaterializationInput(
  details: ProviderMediaDetails,
  initialTags: readonly string[],
): ProviderMaterializationInput {
  if (details.metadata) assertMetadataReference(details.metadata, details.reference);
  return {
    reference: details.reference,
    snapshot: details.snapshot,
    initialTags,
    ...(details.metadata ? { metadata: details.metadata } : {}),
  };
}

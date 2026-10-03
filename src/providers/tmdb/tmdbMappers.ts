import { createTmdbProviderReference, type TmdbResourceNamespace } from "../../core/tmdbSavedTitle";
import type {
  ProviderMaterializationInput,
  ProviderMediaDetails,
  ProviderSearchResult,
} from "../providerContracts";
import { posterUrl } from "./tmdbImages";
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
  return {
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
  return {
    reference: createTmdbProviderReference(type, details.id),
    snapshot: {
      type,
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
  return {
    reference: details.reference,
    snapshot: details.snapshot,
    initialTags,
  };
}

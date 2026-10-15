import { tmdbFetch } from "./tmdbClient";
import type {
  TmdbCreditsResponse,
  TmdbMovieDetails,
  TmdbSearchItem,
  TmdbTvDetails,
} from "./tmdbTypes";
export { posterUrl } from "./tmdbImages";

type SearchResponse = {
  page: number;
  results: TmdbSearchItem[];
  total_pages: number;
  total_results: number;
};

export async function searchMulti(query: string, page = 1) {
  return tmdbFetch<SearchResponse>("/search/multi", {
    query,
    page: String(page),
    include_adult: "false",
    language: "es-AR",
  });
}

type CategorySearchResponse = Omit<SearchResponse, "results"> & {
  results: Omit<TmdbSearchItem, "media_type">[];
};

export async function searchMovies(query: string, page = 1) {
  return tmdbFetch<CategorySearchResponse>("/search/movie", {
    query, page: String(page), include_adult: "false", language: "es-AR",
  });
}

export async function searchTv(query: string, page = 1) {
  return tmdbFetch<CategorySearchResponse>("/search/tv", {
    query, page: String(page), include_adult: "false", language: "es-AR",
  });
}

export async function getMovieDetails(id: number) {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, { language: "es-AR" });
}

export async function getTvDetails(id: number) {
  return tmdbFetch<TmdbTvDetails>(`/tv/${id}`, { language: "es-AR" });
}

export async function getMovieCredits(id: number) {
  return tmdbFetch<TmdbCreditsResponse>(`/movie/${id}/credits`, { language: "es-AR" });
}

export async function getTvCredits(id: number) {
  return tmdbFetch<TmdbCreditsResponse>(`/tv/${id}/credits`, { language: "es-AR" });
}

export function profileUrl(profilePath?: string | null, size: "w185" | "w342" = "w185") {
  if (!profilePath) return null;
  return `https://image.tmdb.org/t/p/${size}${profilePath}`;
}

import type { TmdbWatchProvidersResponse } from "./tmdbTypes";

export async function getWatchProviders(type: "movie" | "tv", id: number) {
  return tmdbFetch<TmdbWatchProvidersResponse>(`/${type}/${id}/watch/providers`, {});
}

export function providerLogoUrl(logoPath?: string | null, size: "w92" | "w154" = "w92") {
  if (!logoPath) return null;
  return `https://image.tmdb.org/t/p/${size}${logoPath}`;
}


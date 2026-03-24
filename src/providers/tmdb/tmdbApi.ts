import { tmdbFetch } from "./tmdbClient";
import type { TmdbSearchItem, TmdbCreditsResponse  } from "./tmdbTypes";

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

export async function getMovieDetails(id: number) {
  return tmdbFetch<any>(`/movie/${id}`, { language: "es-AR" });
}

export async function getTvDetails(id: number) {
  return tmdbFetch<any>(`/tv/${id}`, { language: "es-AR" });
}

// Para poster rápido (MVP). Luego hacemos config/size.
export function posterUrl(posterPath?: string | null, size: "w185" | "w342" = "w342") {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
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
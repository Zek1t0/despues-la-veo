import { civilConsumptionDate } from "../../core/granularTracking";

export type GuideFetch = (path: string, params: Record<string, string>, signal: AbortSignal) => Promise<unknown>;
export type SeasonIndexEntry = { id: string; number: number; count: number | null; title: string | null };
export type GuideEpisode = { id: string; number: number; title: string | null; overview: string | null;
  airDate: string | null; runtime: number | null; image: string | null };
export type SeasonGuide = { id: string; number: number; title: string | null; episodes: GuideEpisode[]; issues: string[] };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Respuesta TMDB inválida.");
  return value as Record<string, unknown>;
}
function integer(value: unknown, min: number, max = 2147483647): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error("Identidad o numeración TMDB inválida.");
  return value;
}
const id = (value: unknown) => String(integer(value, 1));
const optionalText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

export function parseSeasonIndex(raw: unknown, seriesId: string): SeasonIndexEntry[] {
  const value = record(raw);
  if (id(value.id) !== seriesId || !Array.isArray(value.seasons)) throw new Error("Índice TMDB incompatible.");
  const entries = value.seasons.map(rawEntry => {
    const entry = record(rawEntry);
    return { id: id(entry.id), number: integer(entry.season_number, 0, 9999),
      count: entry.episode_count == null ? null : integer(entry.episode_count, 0), title: optionalText(entry.name) };
  });
  if (new Set(entries.map(entry => entry.id)).size !== entries.length ||
      new Set(entries.map(entry => entry.number)).size !== entries.length) throw new Error("Índice TMDB contradictorio.");
  return entries;
}

export function parseSeasonGuide(raw: unknown, seriesId: string, season: number): SeasonGuide {
  const value = record(raw);
  const groupId = id(value.id);
  if (integer(value.season_number, 0, 9999) !== season || !Array.isArray(value.episodes) ||
      (value.show_id != null && id(value.show_id) !== seriesId)) throw new Error("Temporada TMDB incompatible.");
  const episodes: GuideEpisode[] = [], issues: string[] = [];
  const ids = new Set<string>(), numbers = new Set<number>();
  for (const rawEpisode of value.episodes) {
    try {
      const episode = record(rawEpisode);
      const episodeId = id(episode.id), number = integer(episode.episode_number, 0, 999999);
      if (integer(episode.season_number, 0, 9999) !== season ||
          (episode.show_id != null && id(episode.show_id) !== seriesId)) throw new Error("Episodio fuera del alcance.");
      if (ids.has(episodeId) || numbers.has(number)) throw new Error("Identidad o coordenada repetida.");
      const airDate = civilConsumptionDate(optionalText(episode.air_date));
      const runtime = episode.runtime == null ? null : integer(episode.runtime, 0);
      const image = optionalText(episode.still_path);
      if (image && !/^\/[\w.-]+$/.test(image)) throw new Error("Imagen TMDB inválida.");
      ids.add(episodeId);
      numbers.add(number);
      episodes.push({ id: episodeId, number, title: optionalText(episode.name), overview: optionalText(episode.overview), airDate, runtime, image });
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "Episodio inválido.");
    }
  }
  if (value.total_pages != null && value.total_pages !== 1) issues.push("Temporada paginada.");
  return { id: groupId, number: season, title: optionalText(value.name), episodes, issues };
}

export function createTmdbGuideAdapter(fetch: GuideFetch) {
  function path(seriesId: string) {
    if (id(Number(seriesId)) !== seriesId) throw new Error("Referencia de serie TMDB inválida.");
    return `/tv/${seriesId}`;
  }
  return {
    async index(seriesId: string, language: string, signal: AbortSignal) {
      return parseSeasonIndex(await fetch(path(seriesId), { language }, signal), seriesId);
    },
    async season(seriesId: string, number: number, language: string, signal: AbortSignal) {
      const route = `${path(seriesId)}/season/${integer(number, 0, 9999)}`;
      return parseSeasonGuide(await fetch(route, { language }, signal), seriesId, number);
    },
  };
}

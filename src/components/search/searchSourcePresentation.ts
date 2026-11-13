import { presentMangaUpdatesError } from "../../providers/mangaupdates/errorPresentation";
import { presentKitsuError } from "../../providers/kitsu/errors";
import type { SearchSource } from "./searchCategories";
export const SEARCH_SOURCE_NAMES: Readonly<Record<SearchSource, string>> = { tmdb: "TMDB", mangaupdates: "MangaUpdates", kitsu: "Kitsu" };
export function presentNonTmdbSearchError(source: SearchSource | undefined, error: unknown) {
  if (error === null) return null;
  switch (source) {
    case "mangaupdates": return presentMangaUpdatesError(error);
    case "kitsu": return presentKitsuError(error);
    default: return null;
  }
}

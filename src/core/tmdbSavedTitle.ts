import type { SavedTitle, TitleType } from "./savedTitle";
import { nextSavedTitleUpdatedAt } from "./savedTitleTimestamp";

export type TmdbSavedTitleSnapshot = {
  externalId: string;
  type: TitleType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
  voteAverage: number | null;
};

export function materializeTmdbSavedTitle(
  snapshot: TmdbSavedTitleSnapshot,
  existing: SavedTitle | null,
  generateId: () => string,
  now = Date.now()
): SavedTitle {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("El reloj no produjo un timestamp válido.");
  }

  const personalFields = existing
    ? {
        id: existing.id,
        status: existing.status,
        tags: existing.tags,
        notes: existing.notes ?? null,
        personalRating: existing.personalRating,
        createdAt: existing.createdAt,
        updatedAt: nextSavedTitleUpdatedAt(existing.updatedAt, now),
      }
    : {
        id: generateId(),
        status: "planned" as const,
        tags: [...snapshot.genres],
        notes: null,
        personalRating: null,
        createdAt: now,
        updatedAt: now,
      };

  return {
    ...personalFields,
    provider: "tmdb",
    externalId: snapshot.externalId,
    type: snapshot.type,
    title: snapshot.title,
    year: snapshot.year,
    posterUrl: snapshot.posterUrl,
    overview: snapshot.overview,
    genres: [...snapshot.genres],
    voteAverage: snapshot.voteAverage,
  };
}

import type { PersonalRating } from "./personalRating";

/** Frozen movie/TV representation for SQLite v4 and backups v1-v5 only. */
export type HistoricalTitleType = "movie" | "tv";
export type HistoricalTitleStatus = "planned" | "watching" | "done" | "dropped";
export type HistoricalSavedTitle = {
  id: string;
  type: HistoricalTitleType;
  title: string;
  year?: number | null;
  posterUrl?: string | null;
  overview?: string | null;
  voteAverage?: number | null;
  personalRating: PersonalRating;
  genres?: string[];
  status: HistoricalTitleStatus;
  tags: string[];
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
};
export type LegacySavedTitleProvider = "manual" | "tmdb";
export type LegacyPersistedSavedTitle = HistoricalSavedTitle & {
  provider: LegacySavedTitleProvider;
  externalId: string;
};

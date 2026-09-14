import type { PersonalRating } from "./personalRating";

export type TitleType = "movie" | "tv";
export type TitleStatus = "planned" | "watching" | "done" | "dropped";

export type SavedTitle = {
  id: string;
  type: TitleType;

  title: string;
  year?: number | null;
  posterUrl?: string | null;

  // ✅ NUEVO: snapshot liviano
  overview?: string | null;
  voteAverage?: number | null;
  personalRating: PersonalRating;
  genres?: string[]; // ["Drama", "Acción", ...]

  status: TitleStatus;

  tags: string[];

  notes?: string | null;

  createdAt: number;
  updatedAt: number;
};

/**
 * Transitional representation of the provider columns in SQLite v3 and backups v1-v4.
 * Sections 2/3 replace this boundary with provider-reference persistence; it is not a
 * ProviderReference and must not be used as the local item's identity.
 */
export type LegacySavedTitleProvider = "manual" | "tmdb";

export type LegacyPersistedSavedTitle = SavedTitle & {
  provider: LegacySavedTitleProvider;
  externalId: string;
};

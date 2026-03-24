export type TitleType = "movie" | "tv";
export type TitleStatus = "planned" | "watching" | "done" | "dropped";

export type SavedTitle = {
  id: string;

  provider: "manual" | "tmdb";
  externalId: string;

  type: TitleType;

  title: string;
  year?: number | null;
  posterUrl?: string | null;

  // ✅ NUEVO: snapshot liviano
  overview?: string | null;
  voteAverage?: number | null;
  genres?: string[]; // ["Drama", "Acción", ...]

  status: TitleStatus;

  tags: string[];

  notes?: string | null;

  createdAt: number;
  updatedAt: number;
};
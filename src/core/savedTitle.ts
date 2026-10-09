import type { PersonalRating } from "./personalRating";
import type { ProviderReference } from "./providerReference";
import type { MediaClassification } from "./mediaClassification";

export type TitleStatus = "planned" | "watching" | "done" | "dropped";

export type SavedTitle = MediaClassification & {
  id: string;

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

export type SavedTitleWithProviderReferences = SavedTitle & {
  providerReferences: ProviderReference[];
};


export type TitleType = "movie" | "tv";

export type TitleStatus = "planned" | "watching" | "done" | "dropped";

export type SavedTitle = {
  // id local (uuid)
  id: string;

  // de dónde viene el ítem (más adelante: tmdb, omdb, trakt, etc.)
  provider: "manual" | "tmdb";

  // id externo si viene de un provider; si es manual, lo dejamos vacío o igual al id
  externalId: string;

  type: TitleType;

  title: string;
  year?: number | null;
  posterUrl?: string | null;

  status: TitleStatus;

  // tags simples estilo Mihon: ["Con: Martina", "Recomendó: Juan", "Acción"]
  tags: string[];

  notes?: string | null;

  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

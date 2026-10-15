import type { TitleStatus } from "./savedTitle";
import { assertMediaClassification, type MediaClassification, type MediaMedium, type MediaPrimaryFormat } from "./mediaClassification";

const FORMAT_LABELS: Record<Exclude<MediaPrimaryFormat, null>, string> = {
  movie: "Película",
  tv: "Serie",
  ova: "OVA", ona: "ONA", special: "Especial", music: "Video musical",
  webtoon: "Webtoon", "one-shot": "One-shot", novel: "Novela", "light-novel": "Novela ligera",
};

const TITLE_STATUS_LABELS: Record<TitleStatus, string> = {
  planned: "Planeado",
  watching: "En curso",
  done: "Terminado",
  dropped: "Abandonado",
};

export function mediaClassificationLabel(classification: MediaClassification): string {
  assertMediaClassification(classification);
  const family = classification.contentFamily
    ? { anime: "Anime", manga: "Manga", manhwa: "Manhwa", manhua: "Manhua" }[classification.contentFamily] : null;
  const format = classification.primaryFormat ? FORMAT_LABELS[classification.primaryFormat] : null;
  return [family, format].filter(Boolean).join(" · ") ||
    { audiovisual: "Audiovisual", comic: "Cómic", literature: "Literatura" }[classification.medium];
}

/** Omitted medium is the mixed/global context. */
export function titleStatusLabel(status: TitleStatus, medium?: MediaMedium): string {
  if (status === "watching") return medium === "audiovisual" ? "Viendo" : medium ? "Leyendo" : "En curso";
  return TITLE_STATUS_LABELS[status];
}

export function mediaYearLabel(medium: MediaMedium): string {
  return medium === "audiovisual" ? "Estreno / inicio" : "Inicio / publicación";
}

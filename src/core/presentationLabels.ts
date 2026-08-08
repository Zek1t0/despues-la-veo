import type { TitleStatus, TitleType } from "./savedTitle";

const TITLE_TYPE_LABELS: Record<TitleType, string> = {
  movie: "Película",
  tv: "Serie",
};

const TITLE_STATUS_LABELS: Record<TitleStatus, string> = {
  planned: "Planeado",
  watching: "Viendo",
  done: "Terminado",
  dropped: "Abandonado",
};

export function titleTypeLabel(type: TitleType): string {
  return TITLE_TYPE_LABELS[type];
}

export function titleStatusLabel(status: TitleStatus): string {
  return TITLE_STATUS_LABELS[status];
}

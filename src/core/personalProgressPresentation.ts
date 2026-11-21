import { canonicalChapter, parseProgressPosition, type ProgressPosition, type PersonalProgress } from "./personalProgress";
import { providerReferencesEqual, type ProviderReference } from "./providerReference";

export const PROGRESS_MODE_LABELS = { episode: "Episodio continuo", "season-episode": "Temporada y episodio", chapter: "Capítulo decimal", special: "Posición especial" } as const;
export function progressPositionLabel(position: ProgressPosition, compact = false): string {
  switch (position.mode) {
    case "episode": return `${compact ? "Ep." : "Episodio"} ${position.episode}`;
    case "season-episode": return compact ? `T${position.season} · E${String(position.episode).padStart(2, "0")}` : `Temporada ${position.season} · Episodio ${position.episode}`;
    case "chapter": return `${compact ? "Cap." : "Capítulo"} ${position.chapter}`;
    case "special": return compact ? `Especial: ${position.label}` : `Posición especial: «${position.label}»`;
  }
}
export type ProgressDraft = { mode: ProgressPosition["mode"] | null; episode: string; season: string; chapter: string; label: string };
export function progressDraft(position: ProgressPosition | null): ProgressDraft {
  return { mode: position?.mode ?? null, episode: position?.mode === "episode" || position?.mode === "season-episode" ? String(position.episode) : "",
    season: position?.mode === "season-episode" ? String(position.season) : "", chapter: position?.mode === "chapter" ? position.chapter : "", label: position?.mode === "special" ? position.label : "" };
}
export function positionFromProgressDraft(draft: ProgressDraft): ProgressPosition {
  const number = (text: string) => {
    if (!/^\d+$/.test(text.trim())) throw new Error("Ingresá un número entero, sin signos ni separadores.");
    return Number(text.trim());
  };
  const value = draft.mode === "episode" ? { mode: draft.mode, episode: number(draft.episode) }
    : draft.mode === "season-episode" ? { mode: draft.mode, season: number(draft.season), episode: number(draft.episode) }
    : draft.mode === "chapter" ? { mode: draft.mode, chapter: canonicalChapter(draft.chapter) }
    : draft.mode === "special" ? { mode: draft.mode, label: draft.label.trim() } : undefined;
  const parsed = parseProgressPosition(value);
  if (!parsed) throw new Error("Elegí un tipo de numeración.");
  return parsed;
}
/** A future adapter must establish scope/numbering; episodeCount alone is never evidence. */
export type AccreditedPositionScale = Readonly<{ itemId: string; total: number; reference: ProviderReference;
  activeReference: ProviderReference; numbering: "continuous-from-one"; evidence: "verified-resource-numbering"; source: string }>;
export function progressPositionScale(progress: PersonalProgress | null, scale?: AccreditedPositionScale) {
  if (!scale || !progress || progress.position?.mode !== "episode" || scale.itemId !== progress.itemId ||
      scale.evidence !== "verified-resource-numbering" || scale.numbering !== "continuous-from-one" || !scale.source.trim() ||
      !Number.isSafeInteger(scale.total) || scale.total <= 0 || !providerReferencesEqual(scale.reference, scale.activeReference) ||
      progress.position.episode > scale.total) return null;
  return { label: `Posición ${progress.position.episode} de ${scale.total}`, ratio: progress.position.episode / scale.total, source: scale.source };
}

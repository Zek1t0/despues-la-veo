/** Provider-owned public rating. Never a personal rating or an aggregate of sources. */
export type PublicRating = Readonly<{
  provider: string;
  originalValue: number | string;
  originalScale: Readonly<{ min: number; max: number }>;
}>;

export function parsePublicRating(value: unknown): PublicRating {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Puntuación pública inválida.");
  const rating = value as Record<string, unknown>;
  const scale = rating.originalScale as Record<string, unknown> | undefined;
  const raw = rating.originalValue;
  if (typeof rating.provider !== "string" || !rating.provider.trim() || rating.provider !== rating.provider.trim() ||
      rating.provider.length > 100 || /[\u0000-\u001f\u007f]/.test(rating.provider) ||
      !scale || typeof scale.min !== "number" || typeof scale.max !== "number" ||
      !Number.isFinite(scale.min) || !Number.isFinite(scale.max) || scale.max <= scale.min ||
      !Number.isFinite(scale.max - scale.min) ||
      !(typeof raw === "number" || typeof raw === "string" && raw.length <= 40 && /^\d+(?:\.\d+)?$/.test(raw))) {
    throw new Error("Valor, escala o proveedor de puntuación inválido.");
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < scale.min || numeric > scale.max) throw new Error("Puntuación fuera de escala.");
  return Object.freeze({ provider: rating.provider, originalValue: raw,
    originalScale: Object.freeze({ min: scale.min, max: scale.max }) });
}

/** Numeric projection only; rounding/localization belongs to presentation. */
export function publicRatingOverTen(value: PublicRating): number {
  const rating = parsePublicRating(value);
  return (Number(rating.originalValue) - rating.originalScale.min) /
    (rating.originalScale.max - rating.originalScale.min) * 10;
}

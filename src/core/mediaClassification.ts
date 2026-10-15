export type MediaMedium = "audiovisual" | "comic" | "literature";
export type MediaContentFamily = "anime" | "manga" | "manhwa" | "manhua" | null;
export type MediaPrimaryFormat =
  | "movie" | "tv" | "ova" | "ona" | "special" | "music"
  | "webtoon" | "one-shot" | "novel" | "light-novel" | null;

export type MediaClassification = {
  medium: MediaMedium;
  contentFamily: MediaContentFamily;
  primaryFormat: MediaPrimaryFormat;
};

const FORMATS_BY_MEDIUM: Record<MediaMedium, readonly string[]> = {
  audiovisual: ["movie", "tv", "ova", "ona", "special", "music"],
  comic: ["webtoon", "one-shot"],
  literature: ["novel", "light-novel"],
};

export function isMediaClassification(value: unknown): value is MediaClassification {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { medium, contentFamily, primaryFormat } = value as Record<string, unknown>;
  if (medium !== "audiovisual" && medium !== "comic" && medium !== "literature") return false;
  const familyValid = contentFamily === null ||
    (medium === "audiovisual" && contentFamily === "anime") ||
    (medium === "comic" && (contentFamily === "manga" || contentFamily === "manhwa" || contentFamily === "manhua"));
  return familyValid && (primaryFormat === null ||
    (typeof primaryFormat === "string" && FORMATS_BY_MEDIUM[medium].includes(primaryFormat)));
}

export function assertMediaClassification(value: unknown): asserts value is MediaClassification {
  if (!isMediaClassification(value)) throw new Error("Clasificación de medio, familia o formato inválida.");
}

/** Remote refresh fills unknown classification; it never replaces known values. */
export function refineMediaClassification(
  incoming: MediaClassification,
  existing: MediaClassification | null
): MediaClassification {
  assertMediaClassification(incoming);
  if (!existing) return { medium: incoming.medium, contentFamily: incoming.contentFamily, primaryFormat: incoming.primaryFormat };
  assertMediaClassification(existing);
  if (incoming.medium !== existing.medium) throw new Error("El medio del recurso no coincide con el MediaItem local.");
  return {
    medium: existing.medium,
    contentFamily: existing.contentFamily ?? incoming.contentFamily,
    primaryFormat: existing.primaryFormat ?? incoming.primaryFormat,
  };
}

/** Explicit historical conversion; this is not a provider-namespace invariant. */
export function classificationFromHistoricalType(type: unknown): MediaClassification {
  if (type !== "movie" && type !== "tv") throw new Error("El tipo histórico debe ser movie o tv.");
  return { medium: "audiovisual", contentFamily: null, primaryFormat: type };
}

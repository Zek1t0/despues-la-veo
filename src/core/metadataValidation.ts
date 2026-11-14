import { isMediaClassification } from "./mediaClassification";
import { createProviderReference, providerReferencesEqual, type ProviderReference } from "./providerReference";
import { parsePublicRating } from "./publicRating";
import { metadataImageUrl, NO_METADATA_IMAGE_HOSTS, type MetadataImageHostPolicy } from "./metadataImageUrl";
import type { EnrichedMediaMetadata, EnrichedMetadataValues } from "./enrichedMediaMetadata";

export const METADATA_LIMITS = Object.freeze({ title: 5000, synopsis: 50000, titles: 64, images: 12,
  terms: 128, term: 500, timestamp: Number.MAX_SAFE_INTEGER, durationMinutes: 10_000_000 });

export const metadataObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export const metadataText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
export const metadataTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function metadataDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8));
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

const nullableToken = (value: unknown) => value === null || metadataText(value, 100);
const terms = (value: unknown) => Array.isArray(value) && value.length <= METADATA_LIMITS.terms &&
  value.every(term => metadataText(term, METADATA_LIMITS.term));
const count = (value: unknown) => metadataTimestamp(value);
const duration = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= METADATA_LIMITS.durationMinutes;
const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));

export function validMetadataField<K extends keyof EnrichedMetadataValues>(
  key: K, value: unknown, provider: string, imagePolicy: MetadataImageHostPolicy = NO_METADATA_IMAGE_HOSTS,
): value is EnrichedMetadataValues[K] {
  switch (key) {
    case "canonicalTitle": return metadataText(value, METADATA_LIMITS.title) && !/[\r\n\t]/.test(value);
    case "titles": case "abbreviatedTitles": return Array.isArray(value) && value.length <= METADATA_LIMITS.titles && value.every(title =>
      metadataObject(title) && onlyKeys(title, ["value", "language", "script", "kind"]) && metadataText(title.value, METADATA_LIMITS.title) && !/[\r\n\t]/.test(title.value) &&
      nullableToken(title.language) && nullableToken(title.script) && (title.kind === "localized" || title.kind === "abbreviation"));
    case "synopsis": return metadataObject(value) && onlyKeys(value, ["text", "language"]) && metadataText(value.text, METADATA_LIMITS.synopsis) && nullableToken(value.language);
    case "posterImages": case "bannerImages": return Array.isArray(value) && value.length <= METADATA_LIMITS.images && value.every(image =>
      metadataObject(image) && onlyKeys(image, ["url", "variant", "width", "height"]) && metadataImageUrl(image.url, imagePolicy) !== null && metadataText(image.variant, 100) &&
      [image.width, image.height].every(size => size === undefined || typeof size === "number" && Number.isSafeInteger(size) && size > 0 && size <= 100_000));
    case "publicRating": {
      try { return metadataObject(value) && onlyKeys(value, ["provider", "originalValue", "originalScale"]) &&
        metadataObject(value.originalScale) && onlyKeys(value.originalScale, ["min", "max"]) && parsePublicRating(value).provider === provider; } catch { return false; }
    }
    case "classification": return metadataObject(value) && onlyKeys(value, ["medium", "contentFamily", "primaryFormat"]) && isMediaClassification(value);
    case "startDate": case "endDate": return metadataDate(value);
    case "editorialStatus": return metadataObject(value) && onlyKeys(value, ["original", "normalized"]) && metadataText(value.original, 100) &&
      ["current", "finished", "upcoming", "unreleased", "tba", "unknown"].includes(value.normalized as string);
    case "episodeCount": return count(value);
    case "episodeLengthMinutes": case "totalLengthMinutes": return duration(value);
    case "genres": case "categories": case "warnings": return terms(value);
    case "ageRating": return metadataObject(value) && onlyKeys(value, ["value", "system"]) && metadataText(value.value, 100) && value.system === provider;
    case "ageRatingGuide": return metadataText(value, METADATA_LIMITS.term);
    case "sensitive": return typeof value === "boolean";
    default: return false;
  }
}

/** Explicit field allowlist: never accept arbitrary personal keys or a raw provider document. */
export const METADATA_FIELD_NAMES: readonly (keyof EnrichedMetadataValues)[] = Object.freeze([
  "canonicalTitle", "titles", "abbreviatedTitles", "synopsis", "posterImages", "bannerImages", "publicRating", "classification", "startDate", "endDate",
  "editorialStatus", "episodeCount", "episodeLengthMinutes", "totalLengthMinutes", "genres", "categories", "ageRating", "ageRatingGuide", "sensitive", "warnings",
]);

export function frozenMetadataCopy<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(frozenMetadataCopy)) as T;
  if (metadataObject(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, frozenMetadataCopy(entry)]))) as T;
  return value;
}

/** Strict normalized boundary, not a backup parser. Provider parsers omit invalid optional fields first. */
export function parseEnrichedMediaMetadata(value: unknown, imagePolicy: MetadataImageHostPolicy = NO_METADATA_IMAGE_HOSTS): EnrichedMediaMetadata {
  if (!metadataObject(value) || !onlyKeys(value, ["version", "provenance", "fields"]) || value.version !== 1 || !metadataObject(value.provenance) || !metadataObject(value.fields)) {
    throw new Error("Documento de metadata inválido.");
  }
  const p = value.provenance;
  if (!onlyKeys(p, ["reference", "normalizerVersion", "fetchedAt", "checkedAt", "sourceUpdatedAt"]) ||
      !metadataObject(p.reference) || !onlyKeys(p.reference, ["provider", "resourceNamespace", "externalId"])) throw new Error("Falta procedencia de metadata.");
  const reference = createProviderReference(p.reference as { provider: unknown; resourceNamespace: unknown; externalId: unknown });
  if (![reference.provider, reference.resourceNamespace, reference.externalId].every(token =>
    metadataText(token, METADATA_LIMITS.title) && !/[\r\n\t]/.test(token))) throw new Error("Referencia de metadata inválida.");
  if (p.normalizerVersion !== 1 || ![p.fetchedAt, p.checkedAt, p.sourceUpdatedAt].every(time => time === null || metadataTimestamp(time))) {
    throw new Error("Versión o fechas de procedencia inválidas.");
  }
  for (const [key, field] of Object.entries(value.fields)) {
    if (!METADATA_FIELD_NAMES.includes(key as keyof EnrichedMetadataValues) ||
        field !== null && !validMetadataField(key as keyof EnrichedMetadataValues, field, reference.provider, imagePolicy)) {
      throw new Error(`Campo de metadata inválido: ${key}.`);
    }
  }
  return frozenMetadataCopy({ version: 1, provenance: { reference, normalizerVersion: 1,
    fetchedAt: p.fetchedAt, checkedAt: p.checkedAt, sourceUpdatedAt: p.sourceUpdatedAt }, fields: value.fields }) as EnrichedMediaMetadata;
}

export function assertMetadataReference(metadata: EnrichedMediaMetadata, reference: ProviderReference): void {
  if (!providerReferencesEqual(metadata.provenance.reference, reference)) throw new Error("La metadata pertenece a otra referencia.");
}

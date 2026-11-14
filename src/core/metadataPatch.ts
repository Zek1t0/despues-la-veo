import type { EnrichedMetadataFields, EnrichedMetadataValues } from "./enrichedMediaMetadata";
import { METADATA_FIELD_NAMES, metadataObject, validMetadataField, frozenMetadataCopy } from "./metadataValidation";
import { NO_METADATA_IMAGE_HOSTS, type MetadataImageHostPolicy } from "./metadataImageUrl";

export type MetadataFieldPatch<T> = Readonly<
  { kind: "not-provided" } | { kind: "unknown" } | { kind: "known"; value: T }
>;
export type MetadataPatch = Readonly<{ [K in keyof EnrichedMetadataValues]?: MetadataFieldPatch<EnrichedMetadataValues[K]> }>;

/** Validation only: does not merge, materialize, select sources or write local data. */
export function parseMetadataPatch(value: unknown, provider: string,
  imagePolicy: MetadataImageHostPolicy = NO_METADATA_IMAGE_HOSTS): MetadataPatch {
  if (!metadataObject(value)) throw new Error("Patch de metadata inválido.");
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!METADATA_FIELD_NAMES.includes(key as keyof EnrichedMetadataValues) || !metadataObject(entry) ||
        !["not-provided", "unknown", "known"].includes(entry.kind as string) ||
        (entry.kind === "known" && !validMetadataField(key as keyof EnrichedMetadataValues, entry.value, provider, imagePolicy)) ||
        Object.keys(entry).some(name => name !== "kind" && name !== "value") ||
        (entry.kind !== "known" && Object.prototype.hasOwnProperty.call(entry, "value"))) throw new Error(`Patch inválido: ${key}.`);
    result[key] = Object.freeze(entry.kind === "known" ? { kind: "known", value: entry.value } : { kind: entry.kind });
  }
  return frozenMetadataCopy(result) as MetadataPatch;
}

/** Own keys matter: null is unknown; omission must never mean deletion. */
export function metadataFieldsToPatch(fields: EnrichedMetadataFields, provider: string,
  imagePolicy: MetadataImageHostPolicy = NO_METADATA_IMAGE_HOSTS): MetadataPatch {
  return parseMetadataPatch(Object.fromEntries(Object.entries(fields).map(([key, value]) =>
    [key, value === null ? { kind: "unknown" } : { kind: "known", value }])), provider, imagePolicy);
}

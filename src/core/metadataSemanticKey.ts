/** Stable equality for provider-owned objects and unordered collections. */
export function metadataSemanticKey(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...new Set(value.map(metadataSemanticKey))].sort());
  if (value && typeof value === "object") return JSON.stringify(Object.entries(value).sort(([a],[b]) => a.localeCompare(b))
    .map(([key, entry]) => [key, metadataSemanticKey(entry)]));
  return JSON.stringify(value);
}

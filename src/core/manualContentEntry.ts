import { assertMediaClassification, type MediaClassification } from "./mediaClassification";
import type { SavedTitleWithProviderReferences } from "./savedTitle";

export type ManualContentInput = MediaClassification & { title: string; year: number | null; overview: string | null };

export function validateManualContent(input: ManualContentInput): ManualContentInput {
  assertMediaClassification(input);
  if (typeof input.title !== "string" || !input.title.trim()) throw new Error("Ingresá un título.");
  if (input.year !== null && (!Number.isInteger(input.year) || input.year < 1 || input.year > 9999)) {
    throw new Error("El año debe ser un entero entre 1 y 9999.");
  }
  if (input.overview !== null && typeof input.overview !== "string") throw new Error("El resumen debe ser texto.");
  // Deliberately copy only editable snapshot fields, even for untyped callers.
  return { title: input.title.trim(), medium: input.medium, contentFamily: input.contentFamily,
    primaryFormat: input.primaryFormat, year: input.year, overview: input.overview };
}

export function normalizeManualTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function manualDuplicateCandidates(items: SavedTitleWithProviderReferences[], title: string, year: number | null, excludeId?: string) {
  const key = normalizeManualTitle(title);
  return key ? items.filter(item => item.id !== excludeId && normalizeManualTitle(item.title) === key &&
    (year == null || item.year == null || year === item.year)) : [];
}

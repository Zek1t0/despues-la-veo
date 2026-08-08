export type LibraryPinContext = { contextType: "library"; contextKey: "" };
export type TagPinContext = { contextType: "tag"; contextKey: string };
export type PinContext = LibraryPinContext | TagPinContext;

export type TitlePin = {
  savedTitleId: string;
  context: PinContext;
  pinnedAt: number;
};

export const LIBRARY_PIN_CONTEXT: LibraryPinContext = Object.freeze({
  contextType: "library",
  contextKey: "",
});

export function createLibraryPinContext(): LibraryPinContext {
  return LIBRARY_PIN_CONTEXT;
}

export function normalizeTagContextKey(value: string): string {
  if (typeof value !== "string") {
    throw new Error("La etiqueta del contexto debe ser un string.");
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("La etiqueta del contexto no puede quedar vacía después de trim.");
  }
  return normalized;
}

export function createTagPinContext(tag: string): TagPinContext {
  return { contextType: "tag", contextKey: normalizeTagContextKey(tag) };
}

export function parsePinContext(
  contextType: unknown,
  contextKey: unknown
): PinContext | null {
  if (contextType === "library" && contextKey === "") {
    return createLibraryPinContext();
  }
  if (contextType === "tag" && typeof contextKey === "string") {
    try {
      return createTagPinContext(contextKey);
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeSavedTitleTags(tags: readonly string[]): string[] {
  const normalized = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const value = tag.trim();
    if (value) normalized.add(value);
  }
  return [...normalized];
}

export function isValidPinnedAt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function assertValidPinnedAt(value: unknown): asserts value is number {
  if (!isValidPinnedAt(value)) {
    throw new Error("pinnedAt debe ser un number entero seguro y no negativo.");
  }
}

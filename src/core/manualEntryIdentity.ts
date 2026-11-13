/** Portable identity is independent of the local row ID and of every provider. */
export function parseManualEntryIdentity(value: unknown): string {
  if (typeof value !== "string" || !value || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("La identidad manual debe ser un token canónico no vacío.");
  }
  return value;
}

/** Available on Expo Android and Web without a native dependency. Not a security token. */
export function generateManualEntryIdentity(): string {
  return "manual-" + Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0")
  ).join("");
}

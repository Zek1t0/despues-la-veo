export function nextSavedTitleUpdatedAt(currentUpdatedAt: number, now = Date.now()): number {
  if (!Number.isSafeInteger(currentUpdatedAt) || currentUpdatedAt < 0) {
    throw new Error("El updatedAt actual del título guardado es inválido.");
  }
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("El reloj no produjo un timestamp válido.");
  }
  if (currentUpdatedAt >= Number.MAX_SAFE_INTEGER) {
    throw new Error("No se puede avanzar updatedAt sin perder precisión.");
  }
  return Math.max(now, currentUpdatedAt + 1);
}

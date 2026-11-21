/** Local date/time, matching the title detail screen. Never changes the stored clock. */
export function formatProgressConflictDate(value: unknown): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return "Fecha no disponible";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Fecha no disponible";
  try { return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date); }
  catch { return "Fecha no disponible"; }
}

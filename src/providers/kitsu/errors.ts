export type KitsuErrorCode = "unavailable" | "invalid-request" | "invalid-response" | "cancelled" | "timeout" | "network" | "not-found" | "rate-limited" | "access-rejected" | "server";
const messages: Record<KitsuErrorCode, string> = {
  unavailable: "Kitsu aún no está habilitado. Tu biblioteca local sigue disponible.",
  "invalid-request": "La consulta a Kitsu no es válida.", "invalid-response": "Kitsu devolvió datos que no podemos interpretar.",
  cancelled: "Consulta a Kitsu cancelada.", timeout: "Kitsu tardó demasiado en responder.", network: "No se pudo conectar con Kitsu. Revisá tu conexión.",
  "not-found": "No se encontró este anime en Kitsu.", "rate-limited": "Kitsu pidió esperar. Reintentá más tarde; no se enviarán consultas durante la espera.",
  "access-rejected": "Kitsu rechazó el acceso a esta consulta.", server: "No se pudo completar la consulta a Kitsu.",
};
export class KitsuError extends Error {
  constructor(readonly code: KitsuErrorCode, readonly retryAfterMs?: number) { super(messages[code]); this.name = "KitsuError"; }
}
export function presentKitsuError(error: unknown) {
  const known = error instanceof KitsuError;
  return { title: "No pudimos consultar Kitsu", message: known && error.code === "rate-limited" && error.retryAfterMs === undefined
    ? "Kitsu no indicó una espera válida o la cola está llena. La consulta queda suspendida; no se reintenta automáticamente."
    : known ? error.message : messages.server,
    retryable: !known || ["timeout", "network", "server"].includes(error.code) ||
      (error.code === "rate-limited" && Number.isFinite(error.retryAfterMs)) };
}

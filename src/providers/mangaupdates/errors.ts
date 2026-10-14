export type MangaUpdatesErrorCode =
  | "invalid-request" | "network" | "timeout" | "cancelled" | "http"
  | "access-rejected" | "rate-limited" | "not-found" | "invalid-response"
  | "unsupported-type" | "platform-unavailable";

const MESSAGES: Record<MangaUpdatesErrorCode, string> = {
  "invalid-request": "La solicitud a MangaUpdates no es válida.",
  network: "No se pudo conectar con MangaUpdates.",
  timeout: "MangaUpdates tardó demasiado en responder.",
  cancelled: "La solicitud a MangaUpdates fue cancelada.",
  http: "MangaUpdates devolvió un error HTTP.",
  "access-rejected": "MangaUpdates rechazó el acceso.",
  "rate-limited": "MangaUpdates requiere esperar antes de otra solicitud.",
  "not-found": "La obra no se encontró en MangaUpdates.",
  "invalid-response": "La respuesta de MangaUpdates no es válida.",
  "unsupported-type": "El tipo de obra de MangaUpdates está fuera de este alcance.",
  "platform-unavailable": "MangaUpdates no está disponible en este entorno Web.",
};

/** No credentials, raw response bodies or remote error strings escape this boundary. */
export class MangaUpdatesError extends Error {
  readonly name = "MangaUpdatesError";
  constructor(readonly code: MangaUpdatesErrorCode, readonly status?: number, readonly retryAfterMs?: number) {
    super(MESSAGES[code]);
  }
}

export type RefreshErrorCode = "offline" | "timeout" | "not-found" | "access-rejected" | "rate-limited" | "server" | "invalid-response" | "persistence" | "cancelled";
export class RefreshError extends Error {
    constructor(readonly code: RefreshErrorCode, readonly retryAfterMs?: number) { super(code); }
}
export function refreshError(error: unknown): RefreshError {
    if (error instanceof RefreshError)
        return error;
    const e = (error ?? {}) as {
        code?: string;
        kind?: string;
        status?: number;
        networkCause?: string;
        retryAfterMs?: number;
    };
    const code = e.code ?? e.kind;
    if (code === "cancelled" || code === "aborted")
        return new RefreshError("cancelled");
    if (code === "timeout" || e.networkCause === "timeout")
        return new RefreshError("timeout");
    if (code === "network")
        return new RefreshError("offline");
    if (code === "not-found" || e.status === 404)
        return new RefreshError("not-found");
    if (code?.startsWith("credential-") || code === "access-rejected" || e.status === 401 || e.status === 403)
        return new RefreshError("access-rejected");
    if (code === "rate-limited" || e.status === 429)
        return new RefreshError("rate-limited", Number.isSafeInteger(e.retryAfterMs) && e.retryAfterMs! >= 0 ? e.retryAfterMs : undefined);
    if (code === "server" || e.status && e.status >= 500)
        return new RefreshError("server");
    return new RefreshError("invalid-response");
}
export const REFRESH_ERROR_MESSAGES: Record<RefreshErrorCode, string> = { offline: "Sin conexión con la fuente.", timeout: "La fuente tardó demasiado en responder.", "not-found": "La fuente no encontró esta obra. Se conserva tu ficha.", "access-rejected": "La fuente rechazó el acceso. Revisá la configuración de la fuente.", "rate-limited": "La fuente requiere esperar; no se reintenta automáticamente si la espera es desconocida.", server: "La fuente no pudo completar la consulta.", "invalid-response": "La respuesta no es compatible; se conserva la metadata anterior.", persistence: "No se pudo confirmar la actualización local.", cancelled: "Consulta cancelada." };

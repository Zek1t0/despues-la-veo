export type TmdbErrorKind =
  | "credential-not-configured"
  | "credential-storage-error"
  | "credential-invalid"
  | "network"
  | "aborted"
  | "rate-limited"
  | "http"
  | "invalid-response";

export type TmdbNetworkCause = "transport" | "timeout";

type TmdbErrorDetails = Readonly<{
  status?: number;
  remoteCode?: number;
  networkCause?: TmdbNetworkCause;
}>;

const SAFE_MESSAGES: Record<TmdbErrorKind, string> = {
  "credential-not-configured": "TMDB no está configurado.",
  "credential-storage-error": "No se pudo acceder al almacenamiento de la credencial TMDB.",
  "credential-invalid": "La credencial TMDB no es válida.",
  network: "No se pudo conectar con TMDB.",
  aborted: "El request a TMDB fue cancelado.",
  "rate-limited": "TMDB limitó temporalmente los requests.",
  http: "TMDB respondió con un error HTTP.",
  "invalid-response": "TMDB devolvió una respuesta incompatible.",
};

export class TmdbError extends Error {
  readonly kind: TmdbErrorKind;
  readonly status?: number;
  readonly remoteCode?: number;
  readonly networkCause?: TmdbNetworkCause;

  constructor(kind: TmdbErrorKind, details: TmdbErrorDetails = {}) {
    super(SAFE_MESSAGES[kind]);
    this.name = "TmdbError";
    this.kind = kind;
    this.status = details.status;
    this.remoteCode = details.remoteCode;
    this.networkCause = details.networkCause;
  }
}

export function isTmdbError(error: unknown): error is TmdbError {
  return error instanceof TmdbError;
}

export function credentialNotConfiguredError(): TmdbError {
  return new TmdbError("credential-not-configured");
}

export function credentialStorageError(): TmdbError {
  return new TmdbError("credential-storage-error");
}


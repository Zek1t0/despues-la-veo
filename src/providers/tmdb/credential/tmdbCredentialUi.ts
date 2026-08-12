import type { TmdbCredentialSnapshot } from "./tmdbCredentialTypes";
import { isTmdbError } from "../tmdbErrors";

export const TMDB_SETTINGS_ROUTE = "/settings/tmdb" as const;
export const TMDB_TOKEN_URL = "https://www.themoviedb.org/settings/api";

export const TMDB_WEB_STORAGE_WARNING =
  "En web, el token se guarda en localStorage. No tiene la protección de SecureStore, Keychain o Keystore: JavaScript ejecutándose en este mismo origen puede acceder al almacenamiento, y borrar los datos del navegador puede eliminar la credencial.";

export type TmdbStatusPresentation = Readonly<{
  label: string;
  detail?: string;
  actionLabel?: string;
}>;

export function presentTmdbCredentialStatus(
  snapshot: TmdbCredentialSnapshot,
): TmdbStatusPresentation {
  switch (snapshot.status) {
    case "configured":
      return { label: "Configurado", actionLabel: "Cambiar token" };
    case "not-configured":
      return { label: "No configurado", actionLabel: "Configurar TMDB" };
    case "storage-error":
      return {
        label: "No pudimos acceder a la configuración",
        detail: "La Biblioteca local sigue disponible. Podés reintentar el acceso a la configuración.",
        actionLabel: "Configurar TMDB",
      };
    case "initializing":
      return { label: "Comprobando configuración..." };
  }
}

export type TmdbUiError = Readonly<{
  message: string | null;
  retryable: boolean;
}>;

export function presentTmdbMutationError(error: unknown): TmdbUiError {
  if (!isTmdbError(error)) {
    return {
      message: "No pudimos completar la operación. Intentá nuevamente.",
      retryable: true,
    };
  }

  switch (error.kind) {
    case "credential-invalid":
      return { message: "El token no es válido. Revisalo e intentá nuevamente.", retryable: false };
    case "network":
      return {
        message: "No pudimos conectar con TMDB. Revisá tu conexión y volvé a intentar.",
        retryable: true,
      };
    case "rate-limited":
      return {
        message: "TMDB limitó temporalmente las solicitudes. Esperá un momento y reintentá.",
        retryable: true,
      };
    case "http":
      return {
        message: "TMDB no pudo comprobar el token en este momento. Intentá nuevamente más tarde.",
        retryable: true,
      };
    case "invalid-response":
      return {
        message: "TMDB devolvió una respuesta inesperada. Intentá nuevamente.",
        retryable: true,
      };
    case "credential-storage-error":
      return {
        message: "No pudimos acceder o guardar la configuración de TMDB. Reintentá.",
        retryable: true,
      };
    case "aborted":
      return { message: null, retryable: false };
    case "credential-not-configured":
      return {
        message: "Primero necesitamos acceder a la configuración de TMDB. Reintentá la comprobación.",
        retryable: false,
      };
  }
}

export function presentTmdbDeleteError(error: unknown): string | null {
  if (isTmdbError(error) && error.kind === "aborted") return null;
  return "No pudimos eliminar la credencial. La configuración anterior continúa activa.";
}

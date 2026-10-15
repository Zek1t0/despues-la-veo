import { MangaUpdatesError } from "./errors";

export function presentMangaUpdatesError(error: unknown) {
  const known = error instanceof MangaUpdatesError;
  const code = known ? error.code : null;
  return {
    title: "No pudimos consultar MangaUpdates",
    message: known ? error.message : "No se pudo completar la consulta a MangaUpdates. Intentá nuevamente.",
    retryable: code === null || ["network", "timeout", "http", "rate-limited"].includes(code),
  };
}

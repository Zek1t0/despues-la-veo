import type { ProviderReference } from "../../core/providerReference";

// Candidate endpoint. Production must pass the separate M/T gates before use.
export const KITSU_API_BASE = "https://kitsu.app/api/edge";
export function canonicalAnimeId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) throw new Error("El identificador de anime Kitsu no es válido.");
  return value;
}
export function kitsuReference(id: string): ProviderReference {
  return { provider: "kitsu", resourceNamespace: "anime", externalId: canonicalAnimeId(id) };
}
export function assertKitsuReference(reference: ProviderReference): string {
  if (reference.provider !== "kitsu" || reference.resourceNamespace !== "anime") throw new Error("La referencia no corresponde a un anime de Kitsu.");
  return canonicalAnimeId(reference.externalId);
}

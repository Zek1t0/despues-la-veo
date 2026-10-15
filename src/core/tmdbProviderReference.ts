import { createProviderReference, type ProviderReference } from "./providerReference";

export type TmdbResourceNamespace = "movie" | "tv";
export type TmdbProviderReference = ProviderReference & Readonly<{
  provider: "tmdb";
  resourceNamespace: TmdbResourceNamespace;
}>;

function canonicalTmdbExternalId(value: number | string): string {
  const text = typeof value === "number" ? String(value) : value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error("El ID de TMDB debe representar un entero decimal positivo.");
  }
  const numericId = Number(text);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new Error("El ID de TMDB debe ser un entero seguro y positivo.");
  }
  return String(numericId);
}

export function createTmdbProviderReference(
  resourceNamespace: TmdbResourceNamespace,
  externalId: number | string
): TmdbProviderReference {
  if (resourceNamespace !== "movie" && resourceNamespace !== "tv") {
    throw new Error("El namespace de TMDB debe ser movie o tv.");
  }
  return createProviderReference({
    provider: "tmdb",
    resourceNamespace,
    externalId: canonicalTmdbExternalId(externalId),
  }) as TmdbProviderReference;
}

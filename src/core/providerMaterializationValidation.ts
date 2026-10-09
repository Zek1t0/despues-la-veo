import type { ProviderMaterializationInput } from "../providers/providerContracts";
import { createProviderReference } from "./providerReference";
import { createTmdbProviderReference } from "./tmdbProviderReference";

/** Validation of the narrow legacy exception; no remote DTOs or requests. */
export function validateProviderMaterializationInput(input: ProviderMaterializationInput): void {
  const reference = createProviderReference(input.reference);
  if (reference.provider === "tmdb") {
    const canonical = createTmdbProviderReference(reference.resourceNamespace as "movie" | "tv", reference.externalId);
    if (canonical.externalId !== reference.externalId || input.snapshot.medium !== "audiovisual") {
      throw new Error("La referencia TMDB debe ser canónica y corresponder a un medio audiovisual.");
    }
  }
  if (Object.prototype.hasOwnProperty.call(input.snapshot, "voteAverage") &&
      (reference.provider !== "tmdb" || !(input.snapshot.voteAverage === null ||
        typeof input.snapshot.voteAverage === "number" && Number.isFinite(input.snapshot.voteAverage)))) {
    throw new Error("voteAverage debe ser un número finito o null suministrado exclusivamente por TMDB.");
  }
}

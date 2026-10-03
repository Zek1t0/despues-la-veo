import type { ProviderMaterializationInput } from "../providers/providerContracts";
import { createProviderReference } from "./providerReference";
import type { SavedTitle } from "./savedTitle";
import { nextSavedTitleUpdatedAt } from "./savedTitleTimestamp";

/** Materializes local state only; reference ownership is resolved by the repository. */
export function materializeProviderSavedTitle(
  input: ProviderMaterializationInput,
  existing: SavedTitle | null,
  generateId: () => string,
  now = Date.now()
): SavedTitle {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("El reloj no produjo un timestamp válido.");
  }
  createProviderReference(input.reference);
  const { snapshot, initialTags } = input;

  const personalFields = existing
    ? {
        id: existing.id,
        status: existing.status,
        tags: [...existing.tags],
        notes: existing.notes ?? null,
        personalRating: existing.personalRating,
        createdAt: existing.createdAt,
        updatedAt: nextSavedTitleUpdatedAt(existing.updatedAt, now),
      }
    : {
        id: generateId(),
        status: "planned" as const,
        tags: [...initialTags],
        notes: null,
        personalRating: null,
        createdAt: now,
        updatedAt: now,
      };

  return {
    ...personalFields,
    type: snapshot.type,
    title: snapshot.title,
    year: snapshot.year,
    posterUrl: snapshot.posterUrl,
    overview: snapshot.overview,
    genres: [...snapshot.genres],
    voteAverage: snapshot.voteAverage,
  };
}

import {
  createProviderReference,
  type ProviderReference,
} from "./providerReference";
import type {
  LegacyPersistedSavedTitle,
  SavedTitle,
  TitleType,
} from "./savedTitle";
import { materializeProviderSavedTitle } from "./providerSavedTitle";
import type { ProviderMaterializationInput } from "../providers/providerContracts";

export type TmdbResourceNamespace = "movie" | "tv";
export type TmdbProviderReference = ProviderReference & Readonly<{
  provider: "tmdb";
  resourceNamespace: TmdbResourceNamespace;
}>;

export type TmdbSavedTitleSnapshot = {
  type: TitleType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
  voteAverage: number | null;
};

/** Compatibility input retained until the remote TMDB save consumer is migrated. */
export type LegacyTmdbSavedTitleSnapshot = TmdbSavedTitleSnapshot & {
  externalId: string;
};

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

export function materializeTmdbSavedTitle(
  reference: TmdbProviderReference,
  snapshot: TmdbSavedTitleSnapshot,
  existing: SavedTitle | null,
  generateId: () => string,
  now = Date.now()
): SavedTitle {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("El reloj no produjo un timestamp válido.");
  }
  return materializeProviderSavedTitle(
    createTmdbSavedTitleMaterializationInput(reference, snapshot),
    existing,
    generateId,
    now
  );
}

/** Adapts the existing TMDB snapshot and creation policy to normalized local input. */
export function createTmdbSavedTitleMaterializationInput(
  reference: TmdbProviderReference,
  snapshot: TmdbSavedTitleSnapshot
): ProviderMaterializationInput {
  if (reference.provider !== "tmdb" ||
      reference.resourceNamespace !== snapshot.type ||
      !providerReferenceIsCanonicalTmdb(reference)) {
    throw new Error("La referencia TMDB no coincide con el snapshot.");
  }

  return {
    reference,
    snapshot: {
      type: snapshot.type,
      title: snapshot.title,
      year: snapshot.year,
      posterUrl: snapshot.posterUrl,
      overview: snapshot.overview,
      genres: snapshot.genres,
      voteAverage: snapshot.voteAverage,
    },
    initialTags: snapshot.genres,
  };
}

function providerReferenceIsCanonicalTmdb(reference: TmdbProviderReference): boolean {
  try {
    return createTmdbProviderReference(
      reference.resourceNamespace,
      reference.externalId
    ).externalId === reference.externalId;
  } catch {
    return false;
  }
}

/**
 * Compile-safe bridge for SQLite v3. Remove when Sections 2/3 persist
 * media_provider_references and repositories return provider-independent items.
 */
export function materializeLegacyTmdbSavedTitle(
  snapshot: LegacyTmdbSavedTitleSnapshot,
  existing: LegacyPersistedSavedTitle | null,
  generateId: () => string,
  now = Date.now()
): LegacyPersistedSavedTitle {
  const reference = createTmdbProviderReference(snapshot.type, snapshot.externalId);
  const { externalId: _legacyExternalId, ...localSnapshot } = snapshot;
  return {
    ...materializeTmdbSavedTitle(reference, localSnapshot, existing, generateId, now),
    provider: "tmdb",
    externalId: reference.externalId,
  };
}

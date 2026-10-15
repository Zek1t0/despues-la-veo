import { createTmdbProviderReference, type TmdbProviderReference } from "./tmdbProviderReference";
export { createTmdbProviderReference, type TmdbProviderReference, type TmdbResourceNamespace } from "./tmdbProviderReference";

import type { SavedTitle } from "./savedTitle";
import type { LegacyPersistedSavedTitle, HistoricalTitleType } from "./historicalSavedTitle";
import { classificationFromHistoricalType } from "./mediaClassification";
import { savedTitleFromHistorical, savedTitleToHistorical } from "./legacyMediaBoundary";
import { materializeProviderSavedTitle } from "./providerSavedTitle";
import type { ProviderLocalSnapshot, ProviderMaterializationInput } from "../providers/providerContracts";

export type TmdbSavedTitleSnapshot = ProviderLocalSnapshot & { voteAverage: number | null };

export type LegacyTmdbSavedTitleSnapshot = {
  type: HistoricalTitleType;
  externalId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
  voteAverage: number | null;
};

/** Frozen compatibility input; active TMDB mappers use the classification snapshot. */
export function legacyTmdbSnapshotToCurrent(snapshot: LegacyTmdbSavedTitleSnapshot): TmdbSavedTitleSnapshot {
  const { type, externalId: _externalId, ...metadata } = snapshot;
  return { ...metadata, ...classificationFromHistoricalType(type) };
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
      snapshot.medium !== "audiovisual" ||
      !providerReferenceIsCanonicalTmdb(reference)) {
    throw new Error("La referencia TMDB no coincide con el snapshot.");
  }

  return {
    reference,
    snapshot: {
      medium: snapshot.medium,
      contentFamily: snapshot.contentFamily,
      primaryFormat: snapshot.primaryFormat,
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
  const localSnapshot = legacyTmdbSnapshotToCurrent(snapshot);
  return {
    ...savedTitleToHistorical(materializeTmdbSavedTitle(reference, localSnapshot,
      existing ? savedTitleFromHistorical(existing) : null, generateId, now)),
    provider: "tmdb",
    externalId: reference.externalId,
  };
}

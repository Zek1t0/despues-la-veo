import type { SavedTitle } from "./savedTitle";
import { createProviderReference, providerReferencesEqual, providerReferenceKey, type ProviderReference } from "./providerReference";
import { metadataObject, metadataTimestamp, parseEnrichedMediaMetadata, frozenMetadataCopy } from "./metadataValidation";
import type { EnrichedMediaMetadata } from "./enrichedMediaMetadata";
import { metadataImageUrl } from "./metadataImageUrl";
import { assertMediaClassification, refineMediaClassification } from "./mediaClassification";

export type LegacyMetadataSnapshot = Pick<SavedTitle, "title" | "medium" | "contentFamily" | "primaryFormat"> & {
  year: number | null; posterUrl: string | null; overview: string | null; voteAverage: number | null; genres: string[];
};
export type MetadataDocument = Readonly<{ metadata: EnrichedMediaMetadata; changedAt: number; snapshot?: LegacyMetadataSnapshot }>;
export type MediaMetadataState = Readonly<{
  version: 1;
  baseline: Readonly<{ snapshot: LegacyMetadataSnapshot; reference: ProviderReference | null; updatedAt: number }>;
  selection: Readonly<{ reference: ProviderReference | null; updatedAt: number }>;
  documents: readonly MetadataDocument[];
}>;
export function legacyMetadataSnapshot(item: SavedTitle): LegacyMetadataSnapshot {
  return { title: item.title, medium: item.medium, contentFamily: item.contentFamily, primaryFormat: item.primaryFormat,
    year: item.year ?? null, posterUrl: item.posterUrl ?? null, overview: item.overview ?? null,
    voteAverage: item.voteAverage ?? null, genres: [...item.genres ?? []] };
}
export function initialMetadataState(item: SavedTitle, references: readonly ProviderReference[]): MediaMetadataState {
  const reference = references.length === 1 ? references[0] : null;
  return { version: 1, baseline: { snapshot: legacyMetadataSnapshot(item), reference, updatedAt: item.updatedAt },
    selection: { reference, updatedAt: 0 }, documents: [] };
}

/** Storage validates URL safety without granting permission to render any received host.
 * Renderer approval stays separate and closed for Kitsu until its artwork section.
 */
export function parsePortableMetadata(value: unknown): EnrichedMediaMetadata {
  const hosts: string[] = [];
  if (metadataObject(value) && metadataObject(value.fields)) {
    for (const key of ["posterImages", "bannerImages"]) {
      const images = value.fields[key];
      if (Array.isArray(images)) for (const image of images) {
        if (metadataObject(image) && typeof image.url === "string") {
          try { hosts.push(new URL(image.url).hostname); } catch { /* strict validator below rejects */ }
        }
      }
    }
  }
  return parseEnrichedMediaMetadata(value, { exactHosts: hosts });
}

export function parseMediaMetadataState(value: unknown, references: readonly ProviderReference[], medium: string): MediaMetadataState {
  if (!metadataObject(value) || value.version !== 1 || !metadataObject(value.baseline) || !metadataObject(value.selection) ||
      !Array.isArray(value.documents) || value.documents.length > 32) throw new Error("Estado de metadata inválido.");
  const allowed = new Set(references.map(providerReferenceKey));
  function ref(input: unknown): ProviderReference | null {
    if (input === null) return null;
    if (!metadataObject(input)) throw new Error("Referencia de metadata inválida.");
    const reference = createProviderReference(input as { provider: unknown; resourceNamespace: unknown; externalId: unknown });
    if (!allowed.has(providerReferenceKey(reference))) throw new Error("La metadata refiere otra obra o fuente.");
    return reference;
  }
  const b = value.baseline, selection = value.selection;
  const snapshot = b.snapshot;
  if (!metadataObject(snapshot)) throw new Error("Baseline ausente.");
  assertMediaClassification({ medium: snapshot.medium, contentFamily: snapshot.contentFamily, primaryFormat: snapshot.primaryFormat });
  if (snapshot.medium !== medium || typeof snapshot.title !== "string" || !snapshot.title.trim() ||
      !(typeof b.updatedAt === "number" && Number.isFinite(b.updatedAt) && b.updatedAt >= 0) || !metadataTimestamp(selection.updatedAt) ||
      !(snapshot.year === null || typeof snapshot.year === "number" && Number.isFinite(snapshot.year)) ||
      ![snapshot.posterUrl, snapshot.overview].every(v => v === null || typeof v === "string") ||
      !(snapshot.voteAverage === null || typeof snapshot.voteAverage === "number" && Number.isFinite(snapshot.voteAverage)) ||
      !Array.isArray(snapshot.genres) || !snapshot.genres.every(v => typeof v === "string") ||
      Object.keys(snapshot).some(key => !["title","medium","contentFamily","primaryFormat","year","posterUrl","overview","voteAverage","genres"].includes(key))) throw new Error("Baseline inválido.");
  const seen = new Set<string>();
  const documents = value.documents.map(entry => {
    if (!metadataObject(entry) || !metadataTimestamp(entry.changedAt)) throw new Error("Documento o reloj inválido.");
    const metadata = parsePortableMetadata(entry.metadata);
    const reference = ref(metadata.provenance.reference)!;
    const key = providerReferenceKey(reference);
    if (seen.has(key)) throw new Error("Documento duplicado por fuente.");
    seen.add(key);
    if (metadata.fields.classification && metadata.fields.classification.medium !== medium) throw new Error("Medio de metadata incompatible.");
    let sourceSnapshot: LegacyMetadataSnapshot | undefined;
    if (entry.snapshot !== undefined) {
      const wrapper = parseMediaMetadataState({ version: 1, baseline: { snapshot: entry.snapshot, reference, updatedAt: entry.changedAt },
        selection: { reference, updatedAt: 0 }, documents: [] }, references, medium);
      sourceSnapshot = wrapper.baseline.snapshot;
      if (reference.provider !== "tmdb" && sourceSnapshot.voteAverage !== null) throw new Error("Score legacy ajeno a TMDB.");
    }
    return { metadata, changedAt: entry.changedAt, ...(sourceSnapshot ? { snapshot: sourceSnapshot } : {}) };
  });
  return frozenMetadataCopy({ version: 1, baseline: { snapshot, reference: ref(b.reference), updatedAt: b.updatedAt },
    selection: { reference: ref(selection.reference), updatedAt: selection.updatedAt }, documents }) as unknown as MediaMetadataState;
}

/** Single authority resolver for columns, local reads and exported compatible projection. */
export function activeMetadataDocument(state: MediaMetadataState): MetadataDocument | null {
  const reference = state.selection.reference;
  return reference ? state.documents.find(doc => providerReferencesEqual(doc.metadata.provenance.reference, reference)) ?? null : null;
}
export function projectMediaMetadata(state: MediaMetadataState): LegacyMetadataSnapshot {
  const baseline = state.baseline.snapshot, active = state.selection.reference;
  if (!active) return { ...baseline, genres: [...baseline.genres] };
  const compatible = state.baseline.reference !== null && providerReferencesEqual(active, state.baseline.reference);
  const document = activeMetadataDocument(state);
  const fields = document?.metadata.fields;
  const historical = document?.snapshot ?? (compatible ? baseline : { ...baseline, year: null, overview: null, posterUrl: null, voteAverage: null, genres: [] });
  const result: LegacyMetadataSnapshot = { ...historical, genres: [...historical.genres] };
  Object.assign(result, refineMediaClassification(fields?.classification ?? document?.snapshot ?? baseline, baseline));
  if (!fields) return result;
  if (Object.prototype.hasOwnProperty.call(fields, "canonicalTitle")) result.title = fields.canonicalTitle ?? baseline.title;
  if (Object.prototype.hasOwnProperty.call(fields, "startDate")) result.year = fields.startDate ? Number(fields.startDate.slice(0, 4)) : null;
  if (Object.prototype.hasOwnProperty.call(fields, "synopsis")) result.overview = fields.synopsis?.text ?? null;
  if (Object.prototype.hasOwnProperty.call(fields, "genres")) result.genres = [...fields.genres ?? []];
  if (Object.prototype.hasOwnProperty.call(fields, "posterImages")) {
    // Null/empty is authoritative. Received URLs do not grant artwork permission.
    // Only retain an already attributed TMDB snapshot, using its existing image host.
    // New artwork selection (including Kitsu) remains outside persistence.
    result.posterUrl = fields.posterImages === null || fields.posterImages?.length === 0 ? null :
      active.provider === "tmdb" ? metadataImageUrl(historical.posterUrl, { exactHosts: ["image.tmdb.org"] }) : null;
  }
  // The legacy column is not a universal score. Never project another provider into it.
  result.voteAverage = historical.voteAverage;
  if (active.provider !== "tmdb") result.voteAverage = compatible ? baseline.voteAverage : null;
  else if (Object.prototype.hasOwnProperty.call(fields, "publicRating")) {
    const score = fields.publicRating;
    result.voteAverage = score && score.provider === "tmdb" && score.originalScale.min === 0 && score.originalScale.max === 10 ? Number(score.originalValue) : null;
  }
  return result;
}

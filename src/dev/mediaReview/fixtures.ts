import corpus from "../../../docs/testing/expanded-media-domain/fixtures/review-corpus.json";
import { assertMediaClassification } from "../../core/mediaClassification";
import { createProviderReference, type ProviderReference } from "../../core/providerReference";
import type { ProviderLocalSnapshot, ProviderMaterializationInput, ProviderMediaDetails, ProviderSearchResult } from "../../providers/providerContracts";

export type ReviewFixture = Readonly<{
  key: string;
  reference: ProviderReference;
  snapshot: ProviderLocalSnapshot;
  initialTags: readonly string[];
  additionalReferences?: readonly ProviderReference[];
}>;

export function safeReviewText(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "").replace(/\s+/g, " ").trim() || null;
}

export function fixtureInput(fixture: ReviewFixture, patch: Partial<ProviderLocalSnapshot> = {}, reference = fixture.reference): ProviderMaterializationInput {
  const snapshot = { ...fixture.snapshot, ...patch };
  assertMediaClassification(snapshot);
  if (typeof snapshot.title !== "string" || !snapshot.title.trim() ||
      !Array.isArray(snapshot.genres) || snapshot.genres.some(genre => typeof genre !== "string") ||
      !(snapshot.year === null || Number.isSafeInteger(snapshot.year)) ||
      !(snapshot.overview === null || typeof snapshot.overview === "string") ||
      !(snapshot.posterUrl === null || typeof snapshot.posterUrl === "string")) throw new Error("Fixture malformada.");
  return { reference: createProviderReference(reference), snapshot: { ...snapshot, overview: safeReviewText(snapshot.overview) }, initialTags: fixture.initialTags };
}

export const reviewFixtures: readonly ReviewFixture[] = corpus.fixtures.map(value => {
  const fixture = value as ReviewFixture;
  fixtureInput(fixture);
  return fixture;
});
export const reviewRefreshPairs = corpus.refreshPairs;
export const reviewInvalidCases = corpus.invalidCases;
export const reviewRatingCases = corpus.ratingCases;

export function fixtureDetails(fixture: ReviewFixture): ProviderMediaDetails {
  const { reference, snapshot } = fixtureInput(fixture);
  return { reference, snapshot };
}

export function fixtureSearch(query: string): readonly ProviderSearchResult[] {
  return reviewFixtures.filter(fixture => fixture.snapshot.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .map(fixture => ({ reference: fixture.reference, displayTitle: fixture.snapshot.title,
      releaseLabel: fixture.snapshot.year === null ? null : String(fixture.snapshot.year),
      posterUrl: fixture.snapshot.posterUrl, description: safeReviewText(fixture.snapshot.overview), kindLabel: "TEST sintético" }));
}

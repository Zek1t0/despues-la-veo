import { createProviderReference, type ProviderReference } from "../../core/providerReference";
import { MangaUpdatesError } from "./errors";

export const MANGAUPDATES_API_BASE = "https://api.mangaupdates.com";

export function canonicalSeriesId(value: unknown): string {
  if (typeof value !== "string" || value.trim() !== value || !/^[1-9][0-9]*$/.test(value)) {
    throw new MangaUpdatesError("invalid-request");
  }
  return value;
}

/** The API declares integer IDs. Only already-safe JSON integers can become strings. */
export function seriesIdFromResponse(value: unknown): string {
  try {
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error();
      return canonicalSeriesId(String(value));
    }
    return canonicalSeriesId(value);
  } catch { throw new MangaUpdatesError("invalid-response"); }
}

export function mangaUpdatesReference(id: string): ProviderReference {
  return createProviderReference({ provider: "mangaupdates", resourceNamespace: "series", externalId: canonicalSeriesId(id) });
}

export function assertMangaUpdatesReference(reference: ProviderReference): string {
  if (reference.provider !== "mangaupdates" || reference.resourceNamespace !== "series") {
    throw new MangaUpdatesError("invalid-request");
  }
  return canonicalSeriesId(reference.externalId);
}

export function mangaUpdatesDetailDestination(reference: ProviderReference): `/mangaupdates/series/${string}` {
  return `/mangaupdates/series/${assertMangaUpdatesReference(reference)}`;
}

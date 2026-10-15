import type { HistoricalSavedTitle, HistoricalTitleType } from "./historicalSavedTitle";
import { assertMediaClassification, classificationFromHistoricalType, type MediaClassification } from "./mediaClassification";
import type { SavedTitle } from "./savedTitle";

/** Temporary lossless boundary. Remove the runtime v4 projection in Section 2. */
export function historicalTypeForV4(classification: MediaClassification): HistoricalTitleType {
  assertMediaClassification(classification);
  if (classification.medium !== "audiovisual" || classification.contentFamily !== null ||
      (classification.primaryFormat !== "movie" && classification.primaryFormat !== "tv")) {
    throw new Error("Esta clasificación requiere SQLite v5 y backup v6; no puede guardarse sin pérdida en v4/v5.");
  }
  return classification.primaryFormat;
}

export function savedTitleFromHistorical(item: HistoricalSavedTitle): SavedTitle {
  const { type, ...metadata } = item;
  const { provider: _provider, externalId: _externalId, ...fields } = metadata as typeof metadata & {
    provider?: unknown; externalId?: unknown;
  };
  return { ...fields, ...classificationFromHistoricalType(type) };
}

export function savedTitleToHistorical(item: SavedTitle): HistoricalSavedTitle {
  const type = historicalTypeForV4(item);
  const { medium, contentFamily, primaryFormat, ...fields } = item;
  return { ...fields, type };
}

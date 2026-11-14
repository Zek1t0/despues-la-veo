import { publicRatingLabel, savedMediaPresentation } from "../../core/mediaPresentation";
import type { SavedTitle, SavedTitleWithProviderReferences } from "../../core/savedTitle";
import { mediaClassificationLabel, titleStatusLabel } from "../../core/presentationLabels";
import { getPersonalRatingPresentation } from "./personalRatingPresentation";

/** Grid adds its own personal badge announcement; list rows include it here. */
export function savedTitleOpenAccessibilityLabel(item: SavedTitle | SavedTitleWithProviderReferences, includePersonalRating = false): string {
  const personalRating = includePersonalRating ? getPersonalRatingPresentation(item.personalRating) : null;
  return [
    `Abrir ${mediaClassificationLabel(item)} ${item.title}`,
    titleStatusLabel(item.status, item.medium),
    personalRating?.accessibilityLabel,
    includePersonalRating && "providerReferences" in item ? publicRatingLabel(savedMediaPresentation(item).rating) : null,
  ].filter(Boolean).join(". ");
}

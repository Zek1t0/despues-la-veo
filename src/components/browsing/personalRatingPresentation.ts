import {
  formatPersonalRating,
  type PersonalRating,
} from "../../core/personalRating";

export type PersonalRatingTone = "low" | "medium" | "high";

export type PersonalRatingPresentation = {
  canonicalValue: number;
  text: string;
  tone: PersonalRatingTone;
  accessibilityLabel: string;
};

function personalRatingTone(value: number): PersonalRatingTone {
  if (value <= 74) return "low";
  if (value <= 84) return "medium";
  return "high";
}

export function getPersonalRatingPresentation(
  value: PersonalRating
): PersonalRatingPresentation | null {
  if (value === null) return null;

  const text = formatPersonalRating(value);
  const tone = personalRatingTone(value);

  return {
    canonicalValue: value,
    text,
    tone,
    accessibilityLabel: `Mi puntuación: ${text} de 10`,
  };
}

export type PersonalRating = number | null;

export const PERSONAL_RATING_MIN = 10;
export const PERSONAL_RATING_MAX = 100;

export function isPersonalRatingValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= PERSONAL_RATING_MIN &&
    value <= PERSONAL_RATING_MAX
  );
}

export function isPersonalRating(value: unknown): value is PersonalRating {
  return value === null || isPersonalRatingValue(value);
}

export function assertPersonalRating(value: unknown): asserts value is PersonalRating {
  if (!isPersonalRating(value)) {
    throw new Error("personalRating debe ser null o un entero entre 10 y 100.");
  }
}

export function parsePersonalRating(value: unknown): PersonalRating {
  assertPersonalRating(value);
  return value;
}

export function formatPersonalRating(value: number): string {
  if (!isPersonalRatingValue(value)) {
    throw new Error("No se puede formatear un personalRating inválido.");
  }
  return `${Math.floor(value / 10)}.${value % 10}`;
}

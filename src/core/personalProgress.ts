import { assertMediaClassification, type MediaClassification } from "./mediaClassification";

export type ProgressPosition = Readonly<
  | { mode: "episode"; episode: number }
  | { mode: "season-episode"; season: number; episode: number }
  | { mode: "chapter"; chapter: string }
  | { mode: "special"; label: string }
>;
export type PersonalProgress = Readonly<{ version: 1; itemId: string; position: ProgressPosition | null; updatedAt: number }>;

function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Progreso inválido.");
}
function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).length !== expected.length || expected.some(key => !Object.prototype.hasOwnProperty.call(value, key)))
    throw new Error("Campos de progreso inválidos.");
}
function integer(value: unknown, max: number): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error("Número de progreso fuera de rango.");
}
/** Input normalization only. Stored positions must already be canonical. Never uses floating point. */
export function canonicalChapter(input: unknown): string {
  if (typeof input !== "string" || input.length > 128) throw new Error("Capítulo inválido.");
  const text = input.trim();
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(text)) throw new Error("Ingresá un capítulo con hasta seis decimales.");
  const [wholeInput, fractionInput = ""] = text.replace(",", ".").split(".");
  const whole = wholeInput.replace(/^0+(?=\d)/, "");
  if (whole.length > 6) throw new Error("El capítulo no puede superar 999999.999999.");
  const fraction = fractionInput.replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
export function parseProgressPosition(value: unknown): ProgressPosition | null {
  if (value === null) return null;
  object(value);
  switch (value.mode) {
    case "episode":
      keys(value, ["mode", "episode"]); integer(value.episode, 999999);
      return Object.freeze({ mode: value.mode, episode: value.episode });
    case "season-episode":
      keys(value, ["mode", "season", "episode"]); integer(value.season, 9999); integer(value.episode, 999999);
      return Object.freeze({ mode: value.mode, season: value.season, episode: value.episode });
    case "chapter":
      keys(value, ["mode", "chapter"]);
      if (canonicalChapter(value.chapter) !== value.chapter) throw new Error("El capítulo debe ser texto canónico.");
      return Object.freeze({ mode: value.mode, chapter: value.chapter as string });
    case "special": {
      keys(value, ["mode", "label"]);
      const label = value.label;
      if (typeof label !== "string" || label.trim() !== label || !label || [...label].length > 120 ||
          /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(label) || /[\uD800-\uDFFF]/u.test(label))
        throw new Error("El especial requiere texto de 1 a 120 caracteres sin controles.");
      return Object.freeze({ mode: value.mode, label });
    }
    default: throw new Error("Numeración de progreso desconocida.");
  }
}
export function parsePersonalProgress(value: unknown): PersonalProgress {
  object(value); keys(value, ["version", "itemId", "position", "updatedAt"]);
  if (value.version !== 1 || typeof value.itemId !== "string" || !value.itemId.trim()) throw new Error("Identidad de progreso inválida.");
  integer(value.updatedAt, Number.MAX_SAFE_INTEGER);
  return Object.freeze({ version: 1, itemId: value.itemId, position: parseProgressPosition(value.position), updatedAt: value.updatedAt });
}
export function progressPositionsEqual(a: ProgressPosition | null, b: ProgressPosition | null): boolean {
  return JSON.stringify(parseProgressPosition(a)) === JSON.stringify(parseProgressPosition(b));
}
export function progressVersionsEqual(a: PersonalProgress | null, b: PersonalProgress | null): boolean {
  return a === null || b === null ? a === b : a.itemId === b.itemId && a.updatedAt === b.updatedAt && progressPositionsEqual(a.position, b.position);
}
export function progressEligibility(classification: MediaClassification): "offered" | "explicit" | "none" {
  assertMediaClassification(classification);
  if (classification.medium === "comic") return classification.primaryFormat === "one-shot" ? "none" : classification.primaryFormat === null ? "explicit" : "offered";
  if (classification.medium !== "audiovisual") return "none";
  if (classification.primaryFormat === "tv") return "offered";
  if (classification.primaryFormat === null || classification.contentFamily === "anime" &&
      ["ova", "ona", "special"].includes(classification.primaryFormat)) return "explicit";
  return "none";
}
export function progressPositionCompatible(classification: MediaClassification, position: ProgressPosition | null): boolean {
  if (position === null) return true;
  if (progressEligibility(classification) === "none") return false;
  return position.mode === "special" || (position.mode === "chapter" ? classification.medium === "comic" : classification.medium === "audiovisual");
}
export function nextProgressEpisode(position: ProgressPosition | null): ProgressPosition | null {
  const parsed = parseProgressPosition(position);
  return parsed && (parsed.mode === "episode" || parsed.mode === "season-episode") && parsed.episode < 999999
    ? Object.freeze({ ...parsed, episode: parsed.episode + 1 }) : null;
}
export function nextProgressTimestamp(previous: number | undefined, now: number): number {
  integer(now, Number.MAX_SAFE_INTEGER);
  if (previous !== undefined) integer(previous, Number.MAX_SAFE_INTEGER);
  const next = Math.max(now, previous === undefined ? 0 : previous + 1);
  integer(next, Number.MAX_SAFE_INTEGER);
  return next;
}

import type { MediaClassification } from "./mediaClassification";
import { savedMediaPresentation } from "./mediaPresentation";
import { METADATA_LIMITS } from "./metadataValidation";
import { normalizeMediaSearch, presentSavedTitle } from "./mediaViewProjection";
import { titleStatusLabel } from "./presentationLabels";
import { providerReferencesEqual } from "./providerReference";
import type { SavedTitleWithProviderReferences, TitleStatus } from "./savedTitle";
import { savedContentVisible } from "./sensitiveContent";

export type PickerCriteria = Partial<{
  status: TitleStatus;
  medium: MediaClassification["medium"];
  contentFamily: NonNullable<MediaClassification["contentFamily"]>;
  primaryFormat: NonNullable<MediaClassification["primaryFormat"]>;
  genre: string;
  tag: string;
  minutes: number;
  shortest: boolean;
}>;

export const pickerGenreKey = (genre: string) => normalizeMediaSearch(genre.trim());
const byId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const byTitle = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

export function localPickerDay(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}

export function pickerDuration(item: SavedTitleWithProviderReferences) {
  const reference = item.metadataState?.selection.reference;
  if (item.manualIdentity || item.medium !== "audiovisual" || !reference ||
      !item.providerReferences.some(ref => providerReferencesEqual(ref, reference))) return null;

  const fields = savedMediaPresentation(item).metadata?.fields;
  const movie = item.primaryFormat === "movie";
  const episodic = item.primaryFormat === "tv" || item.primaryFormat === "ova" || item.primaryFormat === "ona";
  const minutes = movie ? fields?.totalLengthMinutes : episodic ? fields?.episodeLengthMinutes : null;
  return typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 &&
    minutes <= METADATA_LIMITS.durationMinutes ? { minutes, unit: movie ? "película" : "episodio" } : null;
}

export function visiblePickerTitles(items: readonly SavedTitleWithProviderReferences[], hideSensitive: boolean, languages: readonly string[]) {
  return items.filter(item => savedContentVisible(item, hideSensitive)).map(item => presentSavedTitle(item, languages));
}

export type PickerCandidate = Readonly<{
  item: SavedTitleWithProviderReferences;
  duration: ReturnType<typeof pickerDuration>;
  reasons: readonly string[];
}>;

function dailyRandom(key: string) {
  let seed = 2166136261;
  for (let index = 0; index < key.length; index++) seed = Math.imul(seed ^ key.charCodeAt(index), 16777619);
  return () => {
    // Mix a counter so nearby dates and filter values do not produce nearby draws.
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectLibraryCandidates(
  visibleItems: readonly SavedTitleWithProviderReferences[],
  criteria: Readonly<PickerCriteria>,
  day: string,
) {
  const { status, medium, contentFamily, primaryFormat, tag, minutes, shortest } = criteria;
  const genre = criteria.genre ? pickerGenreKey(criteria.genre) : undefined;
  const limit = minutes !== undefined && Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
  const candidates = new Map<string, PickerCandidate>();
  let missingDuration = 0, overTime = 0;
  for (const item of visibleItems) {
    if (status && item.status !== status || medium && item.medium !== medium ||
        contentFamily && item.contentFamily !== contentFamily || primaryFormat && item.primaryFormat !== primaryFormat ||
        tag && !item.tags.includes(tag)) continue;
    const matchingGenre = genre ? item.genres?.find(value => pickerGenreKey(value) === genre) : undefined;
    if (genre && !matchingGenre || candidates.has(item.id)) continue;
    const duration = pickerDuration(item);
    if (limit !== undefined && !duration) { missingDuration++; continue; }
    if (limit !== undefined && duration && duration.minutes > limit) { overTime++; continue; }
    candidates.set(item.id, { item, duration, reasons: [
      titleStatusLabel(item.status, item.medium),
      ...(matchingGenre ? [`Género: ${matchingGenre}`] : []),
      ...(tag ? [`Etiqueta: ${tag}`] : []),
      ...(duration ? [`${duration.minutes} min por ${duration.unit}`] :
        shortest ? ["Duración no informada"] : []),
    ] });
  }
  const eligible = [...candidates.values()].sort((a, b) => byId(a.item.id, b.item.id));
  const daily = [...eligible];
  if (shortest) {
    daily.sort((a, b) => (a.duration?.minutes ?? Infinity) - (b.duration?.minutes ?? Infinity) ||
      byTitle.compare(a.item.title, b.item.title) || byId(a.item.id, b.item.id));
  } else {
    const random = dailyRandom(JSON.stringify([day, status, medium, contentFamily, primaryFormat, genre, tag, limit]));
    for (let i = 0; i < Math.min(3, daily.length); i++) {
      const j = i + Math.floor(random() * (daily.length - i));
      [daily[i], daily[j]] = [daily[j], daily[i]];
    }
  }
  return { daily: daily.slice(0, 3), eligible, missingDuration, overTime };
}

export function surpriseCandidate(eligible: readonly PickerCandidate[], random = Math.random) {
  return eligible.length ? eligible[Math.floor(random() * eligible.length)] : undefined;
}

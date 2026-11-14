import type { EnrichedMediaMetadata, EnrichedMetadataValues, MetadataDiagnostic } from "../../core/enrichedMediaMetadata";
import { metadataImageUrl, NO_METADATA_IMAGE_HOSTS, type MetadataImageHostPolicy } from "../../core/metadataImageUrl";
import { METADATA_LIMITS, metadataObject, metadataText, metadataDate, metadataTimestamp, parseEnrichedMediaMetadata, validMetadataField } from "../../core/metadataValidation";
import { kitsuReference } from "./identity";

export type KitsuMetadataOptions = Readonly<{ imagePolicy?: MetadataImageHostPolicy }>;
type MutableFields = { -readonly [K in keyof EnrichedMetadataValues]?: EnrichedMetadataValues[K] | null };
const own = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/** Text only; no HTML renderer, executable links or remote requests. */
export function kitsuSummary(value: string | null): string | null {
  if (!value) return null;
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&([a-z]+);/gi, (match, key: string) => entities[key.toLowerCase()] ?? match)
    .replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]+/g, " ").trim() || null;
}

/** Parses only allowlisted fields; no raw Kitsu JSON is retained. Image hosts default closed.
 * Gates, HTTP projections, observed timestamps and renderer checks are owned by later sections.
 */
export function parseKitsuEnrichedMetadata(id: string, attributes: Record<string, unknown>, relationships: unknown,
  included: unknown, options: KitsuMetadataOptions = {}): Readonly<{ metadata: EnrichedMediaMetadata; diagnostics: readonly MetadataDiagnostic[] }> {
  const fields: MutableFields = {};
  const diagnostics: MetadataDiagnostic[] = [];
  const imagePolicy = options.imagePolicy ?? NO_METADATA_IMAGE_HOSTS;
  const issue = (field: string, reason: MetadataDiagnostic["reason"] = "invalid") => diagnostics.push(Object.freeze({ field, reason }));
  function set<K extends keyof EnrichedMetadataValues>(key: K, value: unknown) {
    if (value === null) fields[key] = null;
    else if (validMetadataField(key, value, "kitsu", imagePolicy)) fields[key] = value;
    else issue(key);
  }
  const direct: ReadonlyArray<readonly [string, keyof EnrichedMetadataValues]> = [
    ["canonicalTitle", "canonicalTitle"], ["startDate", "startDate"], ["endDate", "endDate"],
    ["episodeCount", "episodeCount"], ["episodeLength", "episodeLengthMinutes"], ["totalLength", "totalLengthMinutes"],
    ["ageRatingGuide", "ageRatingGuide"], ["nsfw", "sensitive"],
  ];
  for (const [raw, key] of direct) if (own(attributes, raw)) set(key, attributes[raw]);

  const titleValues: EnrichedMetadataValues["titles"][number][] = [];
  let titlesComplete = true, titlesPresent = false;
  if (own(attributes, "titles")) {
    titlesPresent = true;
    const titles = attributes.titles;
    if (titles === null) { set("titles", null); titlesPresent = false; }
    else if (!metadataObject(titles) || Object.keys(titles).length > METADATA_LIMITS.titles) titlesComplete = false;
    else for (const [locale, value] of Object.entries(titles)) {
      // Null locale entries do not assert a title and are not aliases.
      if (value === null) continue;
      if (!metadataText(value, METADATA_LIMITS.title) || /[\r\n\t]/.test(value) || !/^[a-z]{2,3}(?:[_-][a-zA-Z]{2,8})?$/.test(locale)) { titlesComplete = false; break; }
      const japanese = locale === "en_jp" || locale === "ja_jp";
      titleValues.push({ value: value.trim(), language: japanese ? "ja" : locale.replace("_", "-"),
        script: locale === "en_jp" ? "Latn" : locale === "ja_jp" ? "Jpan" : null, kind: "localized" });
    }
  }
  if (titlesPresent) {
    if (!titlesComplete) issue("titles", "incomplete");
    else set("titles", [...new Map(titleValues.map(title => [JSON.stringify(title), title])).values()]);
  }
  if (own(attributes, "abbreviatedTitles")) {
    const abbreviated = attributes.abbreviatedTitles;
    if (abbreviated === null) set("abbreviatedTitles", null);
    else if (!Array.isArray(abbreviated) || abbreviated.length > METADATA_LIMITS.titles ||
        !abbreviated.every(value => metadataText(value, METADATA_LIMITS.title) && !/[\r\n\t]/.test(value))) issue("abbreviatedTitles");
    else set("abbreviatedTitles", [...new Set(abbreviated)].map(value => ({ value: value.trim(), language: null, script: null, kind: "abbreviation" as const })));
  }

  const summaryKey = own(attributes, "description") ? "description" : own(attributes, "synopsis") ? "synopsis" : null;
  if (summaryKey) {
    const raw = attributes[summaryKey];
    if (raw === null) set("synopsis", null);
    else if (typeof raw === "string" && raw.length <= METADATA_LIMITS.synopsis) {
      const text = kitsuSummary(raw);
      set("synopsis", text === null ? null : { text, language: null });
    } else issue("synopsis");
  }
  if (own(attributes, "averageRating")) set("publicRating", attributes.averageRating === null ? null : {
    provider: "kitsu", originalValue: attributes.averageRating, originalScale: { min: 0, max: 100 },
  });
  if (own(attributes, "status")) {
    const original = attributes.status;
    set("editorialStatus", original === null ? null : { original,
      normalized: ["current", "finished", "upcoming", "unreleased", "tba"].includes(original as string) ? original : "unknown" });
  }
  if (own(attributes, "ageRating")) set("ageRating", attributes.ageRating === null ? null : { value: attributes.ageRating, system: "kitsu" });

  for (const [raw, key] of [["posterImage", "posterImages"], ["coverImage", "bannerImages"]] as const) {
    if (!own(attributes, raw)) continue;
    const images = attributes[raw];
    if (images === null) { set(key, null); continue; }
    if (!metadataObject(images)) { issue(key); continue; }
    const entries = Object.entries(images).filter(([name]) => name !== "meta");
    if (entries.length > METADATA_LIMITS.images) { issue(key, "limit"); continue; }
    const variants: EnrichedMetadataValues["posterImages"][number][] = [];
    let complete = true;
    for (const [variant, url] of entries) {
      if (url === null) continue;
      if (!metadataImageUrl(url, imagePolicy)) { complete = false; issue(key, "image-not-admitted"); continue; }
      const meta = metadataObject(images.meta) && metadataObject(images.meta.dimensions) ? images.meta.dimensions[variant] : undefined;
      const dimensions = metadataObject(meta) ? meta : {};
      const image = { variant, url: url as string,
        ...(typeof dimensions.width === "number" && Number.isSafeInteger(dimensions.width) && dimensions.width > 0 && dimensions.width <= 100_000 ? { width: dimensions.width } : {}),
        ...(typeof dimensions.height === "number" && Number.isSafeInteger(dimensions.height) && dimensions.height > 0 && dimensions.height <= 100_000 ? { height: dimensions.height } : {}) };
      variants.push(image);
    }
    // Never replace a complete image set with a partial/unsafe one or fabricated empty list.
    if (complete) set(key, variants);
  }

  for (const key of ["categories", "genres"] as const) {
    if (!metadataObject(relationships) || !own(relationships, key)) continue;
    const relation = relationships[key];
    if (!metadataObject(relation) || !Array.isArray(relation.data) || relation.data.length > METADATA_LIMITS.terms ||
        !Array.isArray(included) || included.length > 512 ||
        metadataObject(relation.links) && !!relation.links.next ||
        metadataObject(relation.meta) && own(relation.meta, "count") && relation.meta.count !== relation.data.length) {
      issue(key, "incomplete"); continue;
    }
    const names: string[] = [];
    let complete = true;
    const seen = new Set<string>();
    for (const link of relation.data) {
      if (!metadataObject(link) || link.type !== key || typeof link.id !== "string" || seen.has(link.id)) { complete = false; break; }
      seen.add(link.id);
      const matches = included.filter(entry => metadataObject(entry) && entry.type === key && entry.id === link.id);
      const entry = matches[0];
      const name = metadataObject(entry) && metadataObject(entry.attributes) ? entry.attributes[key === "genres" ? "name" : "title"] : undefined;
      if (matches.length !== 1 || !metadataText(name, METADATA_LIMITS.term)) { complete = false; break; }
      names.push(name.trim());
    }
    if (complete) set(key, [...new Set(names)]);
    else issue(key, "incomplete");
  }
  let sourceUpdatedAt: number | null = null;
  if (own(attributes, "updatedAt") && attributes.updatedAt !== null) {
    const raw = attributes.updatedAt;
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(raw) && metadataDate(raw.slice(0, 10)) && metadataTimestamp(Date.parse(raw))) sourceUpdatedAt = Date.parse(raw);
    else issue("sourceUpdatedAt");
  }
  return { metadata: parseEnrichedMediaMetadata({ version: 1, provenance: { reference: kitsuReference(id), normalizerVersion: 1,
    fetchedAt: null, checkedAt: null, sourceUpdatedAt }, fields }, imagePolicy), diagnostics: Object.freeze(diagnostics) };
}

import type { EnrichedMediaMetadata, MetadataDiagnostic } from "../../core/enrichedMediaMetadata";
import { parseKitsuEnrichedMetadata, type KitsuMetadataOptions } from "./enrichedMetadata";
import { canonicalAnimeId } from "./identity";
import { KitsuError } from "./errors";
export type KitsuAnime = Readonly<{ id: string; title: string; subtype: string | null; startDate: string | null; synopsis: string | null; categories: readonly string[]; metadata?: EnrichedMediaMetadata; metadataDiagnostics?: readonly MetadataDiagnostic[] }>;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const optionalText = (v: unknown): string | null => typeof v === "string" ? v : null;
export function parseAnime(value: unknown, included: unknown = [], options: KitsuMetadataOptions = {}): KitsuAnime {
  if (!object(value) || value.type !== "anime" || !object(value.attributes)) throw new KitsuError("invalid-response");
  let id: string;
  try { id = canonicalAnimeId(value.id); } catch { throw new KitsuError("invalid-response"); }
  const a = value.attributes;
  const titles = object(a.titles) ? a.titles : {};
  const title = [a.canonicalTitle, titles.en, titles.en_jp, titles.ja_jp].find(v => typeof v === "string" && v.trim());
  if (typeof title !== "string" || title.length > 5000 || /[\u0000-\u001f\u007f]/.test(title)) throw new KitsuError("invalid-response");
  const relationships = object(value.relationships) ? value.relationships : {};
  const categories = object(relationships.categories) ? relationships.categories.data : [];
  const ids = new Set(Array.isArray(categories) ? categories.filter(object).filter(v => v.type === "categories" && typeof v.id === "string").map(v => v.id) : []);
  const names = Array.isArray(included) && included.length <= 512 && ids.size <= 128 ? included.filter(object).flatMap(v => v.type === "categories" && ids.has(v.id) && object(v.attributes) && typeof v.attributes.title === "string" ? [v.attributes.title] : []) : [];
  const enriched = parseKitsuEnrichedMetadata(id, a, value.relationships, included, options);
  return Object.freeze({ metadata: enriched.metadata, metadataDiagnostics: enriched.diagnostics, id, title: title.trim(), subtype: optionalText(a.subtype), startDate: optionalText(a.startDate),
    synopsis: optionalText(a.synopsis)?.slice(0, 50000) ?? null, categories: Object.freeze(names) });
}
export function parseAnimeDetail(value: unknown, requestedId: string, options: KitsuMetadataOptions = {}): KitsuAnime {
  if (!object(value)) throw new KitsuError("invalid-response");
  const anime = parseAnime(value.data, value.included, options);
  if (anime.id !== requestedId) throw new KitsuError("invalid-response");
  return anime;
}
export function parseAnimeSearch(value: unknown, options: KitsuMetadataOptions = {}): readonly KitsuAnime[] {
  if (!object(value) || !Array.isArray(value.data) || value.data.length > 20) throw new KitsuError("invalid-response");
  const items = value.data.map(item => parseAnime(item, value.included, options));
  if (new Set(items.map(item => item.id)).size !== items.length) throw new KitsuError("invalid-response");
  return Object.freeze(items);
}

import { createProviderReference, providerReferencesEqual, type ProviderReference } from "./providerReference";
import { createTmdbProviderReference } from "./tmdbProviderReference";
import { organizationId, organizationTimestamp } from "./personalCollection";

export type RecommendationStatus = "pending" | "incorporated" | "discarded";
export type RecommendationCapture = { name: string | null; url: string | null; reference: ProviderReference | null;
  person: string | null; origin: string | null; comment: string | null };
export type Recommendation = RecommendationCapture & { id: string; originalCapture: RecommendationCapture;
  status: RecommendationStatus; linkedItemId: string | null; createdAt: number; updatedAt: number };
export const recommendationStatusLabel = (status: RecommendationStatus) => ({ pending: "Pendiente", incorporated: "Incorporada", discarded: "Descartada" })[status];
function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 100000 || value.includes("\u0000")) throw new Error("El texto de la recomendación no es válido.");
  return value.trim() || null;
}
export function recommendationUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("Ingresá un enlace HTTP(S) absoluto válido."); }
  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || /[\r\n\t]/.test(raw)) throw new Error("Ingresá un enlace HTTP(S) sin credenciales.");
  return raw;
}
/** Pure parsing of an explicit allowlist. Never visits a URL or resolves a slug. */
export function recognizeRecommendationUrl(raw: string | null): ProviderReference | null {
  if (!raw) return null;
  const url = new URL(recommendationUrl(raw)!);
  if (url.port || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (["themoviedb.org", "www.themoviedb.org"].includes(host)) {
    const match = /^\/(movie|tv)\/([1-9][0-9]*)(?:-[^/]+)?\/?$/.exec(url.pathname);
    if (match) { try { return createTmdbProviderReference(match[1] as "movie" | "tv", match[2]); } catch { return null; } }
  }
  if (["kitsu.io", "kitsu.app", "www.kitsu.io", "www.kitsu.app"].includes(host)) {
    const match = /^\/anime\/([1-9][0-9]*)\/?$/.exec(url.pathname);
    if (match) return { provider: "kitsu", resourceNamespace: "anime", externalId: match[1] };
  }
  // MangaUpdates' public series.html IDs are historical, not guaranteed API series_ids.
  // Preserve those URLs as context; never fabricate a modern API identity from them.
  return null;
}
export function recommendationReference(value: unknown): ProviderReference | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Referencia inválida.");
  const ref = createProviderReference(value as ProviderReference);
  if (ref.provider === "tmdb") {
    if (ref.resourceNamespace !== "movie" && ref.resourceNamespace !== "tv") throw new Error("Referencia TMDB inválida.");
    return createTmdbProviderReference(ref.resourceNamespace, ref.externalId);
  }
  if ((ref.provider === "kitsu" && ref.resourceNamespace !== "anime") || (ref.provider === "mangaupdates" && ref.resourceNamespace !== "series") ||
    (["kitsu","mangaupdates"].includes(ref.provider) && !/^[1-9][0-9]*$/.test(ref.externalId))) throw new Error("Referencia de catálogo inválida.");
  return ref;
}
export function parseRecommendationCapture(value: unknown, recognize = false): RecommendationCapture {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Captura inválida.");
  const v = value as RecommendationCapture;
  const url = recommendationUrl(v.url), reference = recommendationReference(v.reference) ?? (recognize ? recognizeRecommendationUrl(url) : null);
  const name = text(v.name);
  if (!name && !url && !reference) throw new Error("Ingresá un nombre, enlace o referencia para guardar la recomendación.");
  return { name, url, reference, person: text(v.person), origin: text(v.origin), comment: text(v.comment) };
}
export function parseRecommendation(value: unknown): Recommendation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Recomendación inválida.");
  const v = value as Recommendation;
  if (!["pending","incorporated","discarded"].includes(v.status)) throw new Error("Estado de recomendación inválido.");
  const linkedItemId = v.linkedItemId == null ? null : organizationId(v.linkedItemId);
  if ((v.status === "incorporated") !== (linkedItemId !== null)) throw new Error("El estado y el vínculo no son coherentes.");
  return { id: organizationId(v.id), ...parseRecommendationCapture(v), originalCapture: parseRecommendationCapture(v.originalCapture),
    status: v.status, linkedItemId, createdAt: organizationTimestamp(v.createdAt), updatedAt: organizationTimestamp(v.updatedAt) };
}
export const recommendationTitle = (v: RecommendationCapture) => v.name ?? v.url ?? `${v.reference?.provider}/${v.reference?.resourceNamespace}/${v.reference?.externalId}`;
export const recommendationsShareReference = (a: RecommendationCapture, b: RecommendationCapture) => !!a.reference && !!b.reference && providerReferencesEqual(a.reference,b.reference);

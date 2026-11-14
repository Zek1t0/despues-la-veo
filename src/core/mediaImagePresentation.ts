import { metadataImageUrl, NO_METADATA_IMAGE_HOSTS, type MetadataImageHostPolicy } from "./metadataImageUrl";
import type { MetadataImageVariant } from "./enrichedMediaMetadata";

// Evidence: docs/testing/enriched-media-metadata/section-3-live-evidence.json.
// No wildcard or response-derived approval. These are image hosts, not API hosts.
export const TMDB_IMAGE_HOSTS: MetadataImageHostPolicy = { exactHosts: ["image.tmdb.org"] };
export const KITSU_DEVELOPMENT_IMAGE_HOSTS: MetadataImageHostPolicy = { exactHosts: ["media.kitsu.app"] };
export const MANGAUPDATES_IMAGE_HOSTS: MetadataImageHostPolicy = { exactHosts: ["cdn.mangaupdates.com"] };
export type ImageRuntime = Readonly<{ platform: string; development: boolean }>;
export function providerImagePolicy(provider: string | null | undefined, runtime: ImageRuntime): MetadataImageHostPolicy {
  if (provider === "tmdb") return TMDB_IMAGE_HOSTS;
  if (provider === "kitsu" && runtime.development && ["web", "android"].includes(runtime.platform)) return KITSU_DEVELOPMENT_IMAGE_HOSTS;
  if (provider === "mangaupdates" && runtime.platform === "android") return MANGAUPDATES_IMAGE_HOSTS;
  return NO_METADATA_IMAGE_HOSTS;
}
export type ImageDestinationEvidence = Readonly<{ requiresRedirect?: boolean; destinations?: readonly string[] }>;
/** Only trusted adapter/runtime evidence, never a declaration taken from a backup.
 * Image has no pre-request redirect hook. Known uncheckable redirects fail closed.
 */
export function admittedImageUrl(value: unknown, policy: MetadataImageHostPolicy, evidence: ImageDestinationEvidence = {}): string | null {
  if (evidence.requiresRedirect && !evidence.destinations?.length) return null;
  if (evidence.destinations?.some(url => !metadataImageUrl(url, policy))) return null;
  return metadataImageUrl(value, policy);
}
export type ImageContext = "card" | "list" | "detail" | "banner";
const widths: Record<ImageContext, number> = { card: 180, list: 80, detail: 120, banner: 800 };
/** Pick the smallest received variant meeting the physical width, else largest.
 * Unknown dimensions are a deterministic last resort, not invented dimensions.
 */
export function selectImageVariant(images: readonly MetadataImageVariant[] | null | undefined,
  policy: MetadataImageHostPolicy, context: ImageContext, width = widths[context], density = 1,
  evidenceByUrl: Readonly<Record<string, ImageDestinationEvidence>> = {}): string | null {
  const target = (Number.isFinite(width) && width > 0 ? width : widths[context]) *
    (Number.isFinite(density) && density > 0 ? density : 1);
  const admitted = (images ?? []).filter(image => admittedImageUrl(image.url, policy, evidenceByUrl[image.url]));
  const sized = admitted.filter(image => typeof image.width === "number" && image.width > 0 && Number.isFinite(image.width))
    .sort((a, b) => a.width! - b.width! || a.variant.localeCompare(b.variant));
  return (sized.find(image => image.width! >= target) ?? sized[sized.length - 1] ??
    admitted.slice().sort((a,b) => a.variant.localeCompare(b.variant))[0])?.url ?? null;
}

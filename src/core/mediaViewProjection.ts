import type { SavedTitleWithProviderReferences } from "./savedTitle";
import type { ProviderSearchResult } from "../providers/providerContracts";
import { projectMediaMetadata } from "./mediaMetadataState";
import { savedMediaPresentation } from "./mediaPresentation";
import { resolveMediaTitle, type ResolvedMediaTitle } from "./mediaTitlePresentation";
import { providerReferencesEqual } from "./providerReference";
/** A detached view; original documents, names, personal clocks and identities are never written. */
export function presentSavedTitle<T extends SavedTitleWithProviderReferences>(item: T, languages?: readonly string[]): T & { resolvedTitle: ResolvedMediaTitle } {
  if (!item.providerReferences.length || item.manualIdentity) return {...item,resolvedTitle:resolveMediaTitle(undefined,item.title,languages,item.title)};
  const projected = item.metadataState ? {...item,...projectMediaMetadata(item.metadataState)} : item;
  const resolvedTitle = resolveMediaTitle(savedMediaPresentation(projected).metadata,projected.title,languages);
  return {...projected,title:resolvedTitle.title,resolvedTitle};
}
export function presentRemoteTitle<T extends ProviderSearchResult>(item: T, languages?: readonly string[]): T {
  const metadata=item.metadata && providerReferencesEqual(item.reference,item.metadata.provenance.reference) ? item.metadata : undefined;
  return {...item,displayTitle:resolveMediaTitle(metadata,item.displayTitle,languages).title};
}
/** Fold Latin accents only: dakuten/handakuten and other scripts keep their marks.
 * NFC restores canonical equivalence without changing stored titles or identifiers.
 */
export const normalizeMediaSearch = (value: string) => value.normalize("NFD")
  .replace(/(\p{Script=Latin})\p{M}+/gu,"$1").normalize("NFC").toLocaleLowerCase("es");
export function matchesLocalMediaQuery(item: {title:string;localAliases?:readonly string[];tags?:readonly string[]}, query: string): boolean {
  const needle=normalizeMediaSearch(query.trim());
  return !needle || [item.title,...item.localAliases ?? [],...item.tags ?? []].some(value=>normalizeMediaSearch(value).includes(needle));
}

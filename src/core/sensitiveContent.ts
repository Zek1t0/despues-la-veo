import type { EnrichedMediaMetadata } from "./enrichedMediaMetadata";
import type { SavedTitleWithProviderReferences } from "./savedTitle";
import type { ProviderSearchResult } from "../providers/providerContracts";
import { savedMediaPresentation } from "./mediaPresentation";
import { providerReferencesEqual } from "./providerReference";

/** Kitsu's explicit nsfw flag only. Never infer from ratings, words, categories or warnings. */
export function sensitiveSignal(metadata?: EnrichedMediaMetadata): boolean | null {
  const ref=metadata?.provenance.reference;
  if(ref?.provider!=="kitsu"||ref.resourceNamespace!=="anime"||!/^[1-9][0-9]*$/.test(ref.externalId))return null;
  return typeof metadata?.fields.sensitive==="boolean"?metadata.fields.sensitive:null;
}
export function savedSensitiveSignal(item:SavedTitleWithProviderReferences):boolean|null {
  if(item.manualIdentity||!item.providerReferences.length)return null;
  const metadata=savedMediaPresentation(item).metadata;
  if(!metadata||!item.providerReferences.some(ref=>providerReferencesEqual(ref,metadata.provenance.reference)))return null;
  return sensitiveSignal(metadata);
}
export const savedContentVisible=(item:SavedTitleWithProviderReferences,hide:boolean)=>!hide||savedSensitiveSignal(item)!==true;
export function remoteContentVisible(item:ProviderSearchResult,hide:boolean) {
  return !hide||!item.metadata||!providerReferencesEqual(item.reference,item.metadata.provenance.reference)||sensitiveSignal(item.metadata)!==true;
}
export const SENSITIVE_FILTER_COVERAGE="Filtrado parcial: solo se ocultan marcas explícitas conocidas. No garantiza que todo el contenido visible sea apto para menores.";

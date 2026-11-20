import type { RecommendationCapture } from "./recommendationInbox";
import type { SavedTitleWithProviderReferences } from "./savedTitle";
import { providerReferencesEqual } from "./providerReference";
import { matchesLocalMediaQuery, normalizeMediaSearch } from "./mediaViewProjection";
/** Search suggestions only: punctuation/spacing are not portable identity rules. */
const compactName = (value:string) => normalizeMediaSearch(value).replace(/[\p{P}\p{S}\s]+/gu,"");
function matchesRecommendationName(item:SavedTitleWithProviderReferences,query:string) {
  if(matchesLocalMediaQuery(item,query))return true;
  const needle=compactName(query);
  return !!needle && [item.title,...item.localAliases??[],...item.tags??[]].some(value=>compactName(value).includes(needle));
}
/** Suggestions only. Even a single textual match requires an explicit Vincular action. */
export function localRecommendationCandidates(capture:RecommendationCapture,items:SavedTitleWithProviderReferences[],query=capture.name??"") {
  return items.filter(item=>capture.reference&&item.providerReferences.some(ref=>providerReferencesEqual(ref,capture.reference!))||
    !!query.trim()&&matchesRecommendationName(item,query)).sort((a,b)=>{
    const strong=(item:SavedTitleWithProviderReferences)=>!!capture.reference&&item.providerReferences.some(ref=>providerReferencesEqual(ref,capture.reference!));
    return Number(strong(b))-Number(strong(a))||a.title.localeCompare(b.title,"es")||a.id.localeCompare(b.id);
  });
}

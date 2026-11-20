import { incorporateProviderRecommendation } from "../../../src/storage/recommendationIncorporation";
import { OrganizationButton } from "../../../src/components/organization/OrganizationUI";
import { defaultMediaLanguageServices } from "../../../src/components/browsing/useMediaLanguages";
import React from "react";
import { Linking, Platform } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KitsuAnimeDetail } from "../../../src/providers/kitsu/AnimeDetail";
import { kitsuAvailability } from "../../../src/providers/kitsu/availability";
import { loadKitsuProductDetail } from "../../../src/providers/kitsu/product";
import { KitsuError } from "../../../src/providers/kitsu/errors";
import { getByProviderReference, saveProviderTitle } from "../../../src/storage/savedTitlesRepo";
import { generateManualEntryIdentity } from "../../../src/core/manualEntryIdentity";

export default function KitsuAnimeScreen() {
  const { id, recommendationId } = useLocalSearchParams<{ id?: string | string[]; recommendationId?: string }>();
  const router = useRouter();
  return <><Stack.Screen options={{ title: "Anime · Kitsu" }} />
    {recommendationId&&<OrganizationButton label="Volver a la recomendación" onPress={()=>router.replace({pathname:"/organize/recommendations/[id]",params:{id:recommendationId}})}/>}
    <KitsuAnimeDetail id={id} services={{ recommendation:!!recommendationId, languagePreferences: defaultMediaLanguageServices, available: kitsuAvailability(Platform.OS).enabled,
      load: (animeId, signal) => loadKitsuProductDetail(animeId, Platform.OS, signal),
      saved: async input => {
        if (!kitsuAvailability(Platform.OS).enabled) throw new KitsuError("unavailable");
        return (await getByProviderReference(input.reference))?.id ?? null;
      },
      save: async input => {
        if (!kitsuAvailability(Platform.OS).enabled) return Promise.reject(new KitsuError("unavailable"));
        if(!recommendationId)return saveProviderTitle(input,generateManualEntryIdentity);
        const savedId=await incorporateProviderRecommendation(recommendationId,input,generateManualEntryIdentity,()=>kitsuAvailability(Platform.OS).enabled);
        router.replace({pathname:"/organize/recommendations/[id]",params:{id:recommendationId}});
        return savedId;
      },
      open: savedId => router.push({ pathname: "/title/[id]", params: { id: savedId } }), source: Linking.openURL }} />
  </>;
}

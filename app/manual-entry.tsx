import {savedContentVisible} from "../src/core/sensitiveContent";
import {getMediaPreferences} from "../src/storage/mediaPreferencesRepo";
import { incorporateManualRecommendation } from "../src/storage/recommendationIncorporation";
import { linkRecommendation } from "../src/storage/recommendationInboxRepo";
import React from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ManualEntryForm } from "../src/components/ManualEntryForm";
import { getSavedTitleById, listSavedTitles } from "../src/storage/savedTitlesRepo";
import { isManualContentEditable, saveManualContent } from "../src/storage/manualContentEntries";

export default function ManualEntryScreen() {
  const { id, recommendationId } = useLocalSearchParams<{ id?: string; recommendationId?: string }>();
  const router = useRouter();
  return <>
    <Stack.Screen options={{ title: id ? "Editar título" : "Agregar manualmente", headerBackVisible: false, gestureEnabled: false }} />
    <ManualEntryForm key={id ?? "new"} id={id} services={{ get: getSavedTitleById, list: recommendationId ? async()=>{const p=await getMediaPreferences();return (await listSavedTitles()).filter(v=>savedContentVisible(v,p.value.hideSensitive));} : listSavedTitles,
      eligible: isManualContentEditable, save: recommendationId ? input=>incorporateManualRecommendation(recommendationId,input) : saveManualContent,
      linkExisting: recommendationId ? itemId=>linkRecommendation(recommendationId,itemId) : undefined,
      inspect: itemId => router.push({ pathname: "/title/[id]", params: { id: itemId } }),
      done: itemId => recommendationId ? router.replace({pathname:"/organize/recommendations/[id]",params:{id:recommendationId}}) : router.replace({ pathname: "/title/[id]", params: { id: itemId } }),
      cancel: () => router.back() }} />
  </>;
}

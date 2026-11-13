import React from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ManualEntryForm } from "../src/components/ManualEntryForm";
import { getSavedTitleById, listSavedTitles } from "../src/storage/savedTitlesRepo";
import { isManualContentEditable, saveManualContent } from "../src/storage/manualContentEntries";

export default function ManualEntryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  return <>
    <Stack.Screen options={{ title: id ? "Editar título" : "Agregar manualmente", headerBackVisible: false, gestureEnabled: false }} />
    <ManualEntryForm key={id ?? "new"} id={id} services={{ get: getSavedTitleById, list: listSavedTitles,
      eligible: isManualContentEditable, save: saveManualContent,
      inspect: itemId => router.push({ pathname: "/title/[id]", params: { id: itemId } }),
      done: itemId => router.replace({ pathname: "/title/[id]", params: { id: itemId } }),
      cancel: () => router.back() }} />
  </>;
}

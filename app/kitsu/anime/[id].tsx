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
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  return <><Stack.Screen options={{ title: "Anime · Kitsu" }} />
    <KitsuAnimeDetail id={id} services={{ available: kitsuAvailability(Platform.OS).enabled,
      load: (animeId, signal) => loadKitsuProductDetail(animeId, Platform.OS, signal),
      saved: async input => {
        if (!kitsuAvailability(Platform.OS).enabled) throw new KitsuError("unavailable");
        return (await getByProviderReference(input.reference))?.id ?? null;
      },
      save: input => {
        if (!kitsuAvailability(Platform.OS).enabled) return Promise.reject(new KitsuError("unavailable"));
        return saveProviderTitle(input, generateManualEntryIdentity);
      },
      open: savedId => router.push({ pathname: "/title/[id]", params: { id: savedId } }), source: Linking.openURL }} />
  </>;
}

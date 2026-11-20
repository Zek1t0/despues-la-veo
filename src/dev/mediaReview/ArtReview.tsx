import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MediaBanner } from "../../components/browsing/MediaBanner";
import { MediaPoster } from "../../components/browsing/MediaPoster";
import { PublicRating } from "../../components/browsing/PublicRating";
import { TitleGridCard } from "../../components/browsing/TitleGridCard";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { parseAnime } from "../../providers/kitsu/validation";
import { KITSU_DEVELOPMENT_IMAGE_HOSTS } from "../../core/mediaImagePresentation";
import { resolvePublicRating } from "../../core/mediaPresentation";

// Received URLs from section-3-live-evidence.json. Synthetic presentation, not a live API response.
const metadata = parseAnime({ type: "anime", id: "1", attributes: { canonicalTitle: "TEST presentación",
  averageRating: "82.28", posterImage: {
    small: "https://media.kitsu.app/anime/poster_images/1/small.jpg",
    large: "https://media.kitsu.app/anime/poster_images/1/large.jpg",
    meta: { dimensions: { small: { width: 284, height: 402 }, large: { width: 550, height: 780 } } },
  }, coverImage: {
    tiny: "https://media.kitsu.app/anime/1/cover_image/tiny-1f92cfe65c1b31d8b47e36f025d32b35.jpeg",
    small: "https://media.kitsu.app/anime/1/cover_image/small-33ff2ab0f599bc15ed73856ecd13fe71.jpeg",
    meta: { dimensions: { tiny: { width: 840, height: 200 }, small: { width: 1680, height: 400 } } },
  },
} }, [], { imagePolicy: KITSU_DEVELOPMENT_IMAGE_HOSTS }).metadata;
export function ArtReview() {
  const { theme, setScheme } = useAppTheme();
  const [narrow, setNarrow] = useState(false), [identity, setIdentity] = useState(0);
  const rating = resolvePublicRating("kitsu", metadata);
  const button = (label: string, run: () => void) => <Pressable accessibilityRole="button" onPress={run}
    style={{ padding: 12, borderWidth: 1, borderColor: theme.global.border, borderRadius: 10 }}><Text style={{ color: theme.global.textPrimary }}>{label}</Text></Pressable>;
  return <ScrollView contentContainerStyle={{ padding: 12, gap: 12, alignItems: "center" }}>
    <Text style={{ color: theme.global.textPrimary }}>TEST sección 3 · URLs recibidas, sin API ni biblioteca personal</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {button("Tema claro", () => { void setScheme("light"); })}{button("Tema oscuro", () => { void setScheme("dark"); })}
      {button("Ancho compacto", () => setNarrow(value => !value))}{button("Cambiar identidad", () => setIdentity(value => value + 1))}
    </View>
    <View style={{ width: narrow ? 320 : "100%", maxWidth: 800, gap: 12 }}>
      <MediaBanner identity={`banner-${identity}`} imageProvider="kitsu" metadata={metadata} style={{ width: "100%", aspectRatio: 4.2 }} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <MediaPoster identity={`detail-${identity}`} imageProvider="kitsu" metadata={metadata} style={{ width: 120, height: 180 }} />
        <View style={{ flex: 1, gap: 8 }}><PublicRating value={rating} /><PublicRating value={resolvePublicRating("tmdb", undefined, 0)} />
          <Text style={{ color: theme.global.textPrimary }}>Mi puntuación: 9/10</Text>
          <Text style={{ color: theme.global.textSecondary }}>Sin imagen e imagen rechazada: placeholders seguros.</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TitleGridCard identity={`card-${identity}`} title="TEST Cowboy Bebop" kindLabel="Anime · Kitsu" imageProvider="kitsu" metadata={metadata}
          personalRating={90} onPress={() => {}} accessibilityLabel="TEST card Kitsu" style={{ width: 150 }} />
        <MediaPoster identity="missing" imageProvider="kitsu" style={{ width: 70, height: 105 }} />
        <MediaPoster identity="rejected" imageProvider="kitsu" posterUrl="https://127.0.0.1/rejected" style={{ width: 70, height: 105 }} />
      </View>
    </View>
  </ScrollView>;
}

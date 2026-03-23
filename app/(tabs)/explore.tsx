import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, Image } from "react-native";
import { useRouter } from "expo-router";
import { posterUrl, searchMulti } from "../../src/providers/tmdb/tmdbApi";
import type { TmdbSearchItem } from "../../src/providers/tmdb/tmdbTypes";
import { colors } from "../../src/theme/colors";

export default function ExploreScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<TmdbSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!debounced) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const res = await searchMulti(debounced, 1);
        const filtered = res.results.filter((r) => r.media_type === "movie" || r.media_type === "tv");
        if (!cancelled) setItems(filtered);
      } catch (e) {
        console.error(e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Buscar película o serie…"
        placeholderTextColor={colors.subtle}
        style={{
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border2,
          backgroundColor: colors.input,
          color: colors.text,
        }}
      />

      {loading && <Text style={{ color: colors.muted }}>Buscando…</Text>}
      {!loading && debounced.length > 0 && items.length === 0 && (
        <Text style={{ color: colors.subtle }}>No encontré resultados.</Text>
      )}

      <FlatList
        data={items}
        keyExtractor={(x) => `${x.media_type}-${x.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const title =
            item.media_type === "movie"
              ? item.title ?? "Sin título"
              : item.name ?? "Sin nombre";

          const year =
            item.media_type === "movie"
              ? item.release_date?.slice(0, 4)
              : item.first_air_date?.slice(0, 4);

          const img = item.poster_path ? posterUrl(item.poster_path, "w185") : null;

          return (
            <Pressable
              onPress={() => router.push(`/tmdb/${item.media_type}/${item.id}`)}
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                alignItems: "flex-start",
              }}
            >
              {img ? (
                <Image
                  source={{ uri: img }}
                  style={{ width: 80, height: 120, borderRadius: 10 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 120,
                    borderRadius: 10,
                    backgroundColor: colors.card2,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Sin póster</Text>
                </View>
              )}

              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                  {title} {year ? `(${year})` : ""}
                </Text>
                <Text style={{ color: colors.subtle, fontWeight: "700" }}>
                  {item.media_type.toUpperCase()}
                </Text>
                <Text style={{ color: colors.muted }} numberOfLines={4}>
                  {item.overview || "Sin descripción."}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
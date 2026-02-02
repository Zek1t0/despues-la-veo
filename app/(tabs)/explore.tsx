import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { posterUrl, searchMulti } from "../../src/providers/tmdb/tmdbApi";
import type { TmdbSearchItem } from "../../src/providers/tmdb/tmdbTypes";

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
        placeholderTextColor="#666"
        style={{
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#ccc",
          backgroundColor: "white",
          color: "black",
        }}
      />

      {loading && <Text>Buscando…</Text>}

      <FlatList
        data={items}
        keyExtractor={(x) => `${x.media_type}-${x.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const title = item.media_type === "movie" ? item.title ?? "Sin título" : item.name ?? "Sin nombre";
          const date = item.media_type === "movie" ? item.release_date : item.first_air_date;
          const year = date?.slice(0, 4) ?? "";

          return (
            <Pressable
              onPress={() => router.push(`/tmdb/${item.media_type}/${item.id}`)}
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#333",
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700" }}>
                {title} {year ? `(${year})` : ""}
              </Text>
              <Text style={{ opacity: 0.7 }}>{item.media_type.toUpperCase()}</Text>
              <Text style={{ opacity: 0.8 }} numberOfLines={3}>
                {item.overview || "Sin descripción."}
              </Text>
              <Text style={{ opacity: 0.6, fontSize: 12 }}>
                Poster: {posterUrl(item.poster_path) ? "sí" : "no"}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

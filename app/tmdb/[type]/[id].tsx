import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getMovieDetails, getTvDetails, posterUrl } from "../../../src/providers/tmdb/tmdbApi";
import type { SavedTitle } from "../../../src/core/savedTitle";
import { upsertSavedTitle } from "../../../src/storage/savedTitlesRepo";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function TmdbDetailScreen() {
  const router = useRouter();
  const { type, id } = useLocalSearchParams<{ type: "movie" | "tv"; id: string }>();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!type || !id) return;
      setLoading(true);
      try {
        const numId = Number(id);
        const d = type === "movie" ? await getMovieDetails(numId) : await getTvDetails(numId);
        if (!cancelled) setData(d);
      } catch (e) {
        console.error(e);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  async function saveToLibrary() {
    if (!data || !type || !id) return;

    const now = Date.now();
    const title = type === "movie" ? data.title : data.name;
    const date = type === "movie" ? data.release_date : data.first_air_date;
    const year = date ? Number(String(date).slice(0, 4)) : null;

    const item: SavedTitle = {
      id: uuid(),
      provider: "tmdb",
      externalId: String(id),
      type,
      title: title ?? "Sin título",
      year,
      posterUrl: posterUrl(data.poster_path),
      status: "planned",
      tags: [],
      notes: null,
      createdAt: now,
      updatedAt: now,
    };

    await upsertSavedTitle(item);
    router.push("/(tabs)/library");
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {loading ? (
        <Text>Cargando…</Text>
      ) : !data ? (
        <Text>No se pudo cargar.</Text>
      ) : (
        <>
          <Text style={{ fontSize: 22, fontWeight: "800" }}>{type === "movie" ? data.title : data.name}</Text>
          <Text style={{ opacity: 0.7 }}>TMDB • {type.toUpperCase()} • id {id}</Text>
          <Text style={{ opacity: 0.85 }}>{data.overview || "Sin descripción."}</Text>
          <Text style={{ opacity: 0.65, fontSize: 12 }}>Poster URL: {posterUrl(data.poster_path) ?? "—"}</Text>

          <Pressable
            onPress={saveToLibrary}
            style={{ padding: 12, borderRadius: 12, backgroundColor: "#222", alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Guardar en Biblioteca</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

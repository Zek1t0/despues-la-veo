import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Image, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { deleteSavedTitle, listSavedTitles, upsertSavedTitle } from "../../src/storage/savedTitlesRepo";
import type { SavedTitle, TitleStatus, TitleType } from "../../src/core/savedTitle";
import { colors } from "../../src/theme/colors";

type StatusFilter = "all" | TitleStatus;
type TypeFilter = "all" | TitleType;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.card2,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border2,
      }}
    >
      <Text style={{ color: active ? colors.bg : colors.text, fontWeight: active ? "900" : "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border2,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "800" }}>{text}</Text>
    </View>
  );
}

export default function LibraryScreen() {
  const router = useRouter();

  const [items, setItems] = useState<SavedTitle[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listSavedTitles());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return items.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (typeFilter !== "all" && it.type !== typeFilter) return false;

      if (!needle) return true;
      const inTitle = it.title.toLowerCase().includes(needle);
      const inTags = (it.tags ?? []).some((t) => t.toLowerCase().includes(needle));
      return inTitle || inTags;
    });
  }, [items, q, statusFilter, typeFilter]);

  async function remove(id: string) {
    if (Platform.OS === "web") {
      const ok = window.confirm("¿Seguro que querés borrar este ítem?");
      if (!ok) return;
      await deleteSavedTitle(id);
      await refresh();
      return;
    }

    Alert.alert("Borrar", "¿Seguro que querés borrar este ítem?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          await deleteSavedTitle(id);
          await refresh();
        },
      },
    ]);
  }

  async function toggleDone(item: SavedTitle) {
    const now = Date.now();
    const nextStatus: TitleStatus = item.status === "done" ? "planned" : "done";
    await upsertSavedTitle({ ...item, status: nextStatus, updatedAt: now });
    await refresh();
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Buscar en libreria (título o tags)…"
        placeholderTextColor={colors.subtle}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border2,
          color: colors.text,
          backgroundColor: colors.input,
        }}
      />

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip label="Status: Todos" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
          <Chip label="Planned" active={statusFilter === "planned"} onPress={() => setStatusFilter("planned")} />
          <Chip label="Watching" active={statusFilter === "watching"} onPress={() => setStatusFilter("watching")} />
          <Chip label="Done" active={statusFilter === "done"} onPress={() => setStatusFilter("done")} />
          <Chip label="Dropped" active={statusFilter === "dropped"} onPress={() => setStatusFilter("dropped")} />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip label="Tipo: Todos" active={typeFilter === "all"} onPress={() => setTypeFilter("all")} />
          <Chip label="Movies" active={typeFilter === "movie"} onPress={() => setTypeFilter("movie")} />
          <Chip label="TV" active={typeFilter === "tv"} onPress={() => setTypeFilter("tv")} />
        </View>

        <Text style={{ color: colors.subtle, fontWeight: "700" }}>
          Mostrando {filtered.length} / {items.length}
        </Text>
      </View>

      {loading ? (
        <Text style={{ color: colors.muted }}>Cargando…</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const rating = typeof item.voteAverage === "number" ? item.voteAverage.toFixed(1) : null;
            const overview = item.overview?.trim() ?? "";
            const tagsPreview = (item.tags ?? []).slice(0, 3);

            return (
              <Pressable onPress={() => router.push(`/title/${item.id}`)}>
                <View
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {item.posterUrl ? (
                      <Image
                        source={{ uri: item.posterUrl }}
                        style={{ width: 70, height: 105, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 70,
                          height: 105,
                          borderRadius: 12,
                          backgroundColor: colors.card2,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Sin póster</Text>
                      </View>
                    )}

                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
                        {item.title}
                        {item.year ? ` (${item.year})` : ""}
                      </Text>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Pill text={item.type.toUpperCase()} />
                        <Pill text={`Estado: ${item.status}`} />
                        {rating && <Pill text={`⭐ ${rating}/10`} />}
                      </View>

                      {!!overview && (
                        <Text style={{ color: colors.muted }} numberOfLines={3}>
                          {overview}
                        </Text>
                      )}

                      {tagsPreview.length > 0 && (
                        <Text style={{ color: colors.subtle }} numberOfLines={1}>
                          Tags: {tagsPreview.join(", ")}
                          {item.tags.length > 3 ? "…" : ""}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    <Pressable
                      onPress={() => toggleDone(item)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        backgroundColor: colors.card2,
                        borderWidth: 1,
                        borderColor: colors.border2,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>
                        {item.status === "done" ? "Marcar planned" : "Marcar done"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => remove(item.id)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        backgroundColor: colors.danger,
                        borderWidth: 1,
                        borderColor: colors.dangerBorder,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "800" }}>Borrar</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 20, gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>No hay resultados</Text>
              <Text style={{ color: colors.muted }}>Probá borrar filtros o buscar otra cosa.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
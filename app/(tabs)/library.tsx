import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { deleteSavedTitle, listSavedTitles, upsertSavedTitle } from "../../src/storage/savedTitlesRepo";
import type { SavedTitle, TitleStatus, TitleType } from "../../src/core/savedTitle";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type StatusFilter = "all" | TitleStatus;
type TypeFilter = "all" | TitleType;

export default function LibraryScreen() {
  const router = useRouter();

  const [items, setItems] = useState<SavedTitle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSavedTitles();
      setItems(data);
    } catch (e) {
      console.error("SQLite/web error:", e);
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

  async function addMock() {
    try {
      const now = Date.now();
      const id = uuid();

      const newItem: SavedTitle = {
        id,
        provider: "manual",
        externalId: id, // único
        type: "movie",
        title: `Recomendación ${items.length + 1}`,
        year: null,
        posterUrl: null,
        status: "planned",
        tags: ["Recomendó: (alguien)", "Con: (nombre)"],
        notes: "Nota rápida…",
        createdAt: now,
        updatedAt: now,
      };

      await upsertSavedTitle(newItem);
      await refresh();
    } catch (e) {
      console.error("addMock error:", e);
    }
  }

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

  function Chip({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: active ? "#111" : "#2a2a2a",
          borderWidth: 1,
          borderColor: active ? "#444" : "#333",
        }}
      >
        <Text style={{ color: "white", fontWeight: active ? "700" : "500" }}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Pressable
        onPress={addMock}
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: "#222",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>+ Agregar (mock)</Text>
      </Pressable>

      {/* Search */}
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Buscar en library (título o tags)…"
        placeholderTextColor="#777"
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#333",
          color: "white",
          backgroundColor: "#141414",
        }}
      />

      {/* Filters */}
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

        <Text style={{ opacity: 0.7, color: "white" }}>
          Mostrando {filtered.length} / {items.length}
        </Text>
      </View>

      {loading ? (
        <Text style={{ color: "white" }}>Cargando…</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/title/${item.id}`)}>
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#333",
                  gap: 6,
                  backgroundColor: "#101010",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "white" }}>
                  {item.title}
                </Text>

                <Text style={{ opacity: 0.75, color: "white" }}>
                  {item.type.toUpperCase()} • Estado: {item.status} • Tags: {item.tags.length}
                </Text>

                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Pressable
                    onPress={() => toggleDone(item)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: "#333",
                    }}
                  >
                    <Text style={{ color: "white" }}>
                      {item.status === "done" ? "Marcar planned" : "Marcar done"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => remove(item.id)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: "#4a1f1f",
                    }}
                  >
                    <Text style={{ color: "white" }}>Borrar</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 20, gap: 8 }}>
              <Text style={{ color: "white", fontWeight: "700" }}>No hay resultados</Text>
              <Text style={{ color: "white", opacity: 0.7 }}>
                Probá borrar filtros o buscar otra cosa.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

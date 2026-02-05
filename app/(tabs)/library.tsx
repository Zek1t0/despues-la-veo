import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Platform, Pressable, Text, View } from "react-native";
import { deleteSavedTitle, listSavedTitles, upsertSavedTitle } from "../../src/storage/savedTitlesRepo";
import type { SavedTitle } from "../../src/core/savedTitle";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";


function uuid() {
  // Simple UUID v4-ish (suficiente para MVP local)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function LibraryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SavedTitle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSavedTitles();
      setItems(data);
    } catch (e) {
      console.error("SQLite web error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function addMock() {
    try {
      const now = Date.now();
      const id = uuid();

      const newItem: SavedTitle = {
        id,
        provider: "manual",
        externalId: id, // <- CLAVE: único, nunca vacío
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
    const nextStatus = item.status === "done" ? "planned" : "done";
    await upsertSavedTitle({ ...item, status: nextStatus, updatedAt: now });
    await refresh();
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

      {loading ? (
        <Text>Cargando…</Text>
      ) : (
        <FlatList
          data={items}
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
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ opacity: 0.7 }}>
                  Estado: {item.status} • Tags: {item.tags.length}
                </Text>

                <View style={{ flexDirection: "row", gap: 10 }}>
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
                      {item.status === "done" ? "Marcar pendiente" : "Marcar visto"}
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
        />
      )}
    </View>
  );
}

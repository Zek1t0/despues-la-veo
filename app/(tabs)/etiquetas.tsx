import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { listSavedTitles } from "../../src/storage/savedTitlesRepo";
import type { SavedTitle } from "../../src/core/savedTitle";
import { colors } from "../../src/theme/colors";

type TagInfo = { tag: string; count: number };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 14,
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

export default function EtiquetasScreen() {
  const router = useRouter();

  const [items, setItems] = useState<SavedTitle[]>([]);
  const [q, setQ] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await listSavedTitles();
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const tagMap = useMemo(() => {
    const map = new Map<string, SavedTitle[]>();
    for (const it of items) {
      for (const t of it.tags ?? []) {
        const key = t.trim();
        if (!key) continue;
        const arr = map.get(key) ?? [];
        arr.push(it);
        map.set(key, arr);
      }
    }
    return map;
  }, [items]);

  const tagsList: TagInfo[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const arr: TagInfo[] = [];

    for (const [tag, list] of tagMap.entries()) {
      if (needle && !tag.toLowerCase().includes(needle)) continue;
      arr.push({ tag, count: list.length });
    }

    arr.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return arr;
  }, [q, tagMap]);

  const selectedItems = useMemo(() => {
    if (!selectedTag) return [];
    return (tagMap.get(selectedTag) ?? [])
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [selectedTag, tagMap]);

  // UX: si el usuario escribe en el buscador mientras está en “modo resultados”,
  // podés elegir: (A) no hacer nada, o (B) salir de resultados para buscar otra tag.
  // Yo hago (B) porque es más natural.
  const onChangeQuery = (text: string) => {
    setQ(text);
    if (selectedTag) setSelectedTag(null);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
        Buscador
      </Text>

      <TextInput
        value={q}
        onChangeText={onChangeQuery}
        placeholder="Buscar etiqueta…"
        placeholderTextColor={colors.subtle}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border2,
          backgroundColor: colors.input,
          color: colors.text,
        }}
      />

      {/* ===================== MODO RESULTADOS (oculta tags) ===================== */}
      {selectedTag ? (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
              Títulos con: {selectedTag}
            </Text>

            <Pressable
              onPress={() => setSelectedTag(null)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border2,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>Cerrar</Text>
            </Pressable>
          </View>

          {selectedItems.length === 0 ? (
            <Text style={{ color: colors.muted }}>No hay títulos con esa etiqueta.</Text>
          ) : (
            <View
              style={{
                maxHeight: 520,
                borderRadius: 14,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: colors.border2,
              }}
            >
              <ScrollView contentContainerStyle={{ gap: 10, padding: 10 }}>
                {selectedItems.map((it) => (
                  <Pressable
                    key={it.id}
                    onPress={() => router.push(`/title/${it.id}`)}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card2,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                      {it.title}
                    </Text>
                    <Text style={{ color: colors.muted, fontWeight: "700" }}>
                      {it.type.toUpperCase()} • {it.status}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={{ color: colors.subtle }}>
            Tip: desde el detalle de cada título podés agregar o quitar etiquetas, y se reflejarán automáticamente en esta lista.
          </Text>
        </Card>
      ) : (
        /* ===================== MODO TAGS ===================== */
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              Lista de etiquetas
            </Text>
            <Text style={{ color: colors.muted, fontWeight: "900" }}>{tagsList.length}</Text>
          </View>

          {tagsList.length === 0 ? (
            <Text style={{ color: colors.muted }}>
              Todavía no tenés etiquetas. Guardá algo desde TMDB o agregá tags desde el detalle.
            </Text>
          ) : (
            <View
              style={{
                maxHeight: 9 * 54, // ~9 visibles, después scroll interno
                borderRadius: 14,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: colors.border2,
              }}
            >
              <ScrollView contentContainerStyle={{ gap: 10, padding: 10 }}>
                {tagsList.map((t) => (
                  <Pressable
                    key={t.tag}
                    onPress={() => setSelectedTag(t.tag)}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card2,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                      {t.tag}
                    </Text>
                    <Text style={{ color: colors.muted, fontWeight: "900" }}>{t.count}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </Card>
      )}
    </ScrollView>
  );
}
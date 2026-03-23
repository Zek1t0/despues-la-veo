import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { listSavedTitles } from "../../src/storage/savedTitlesRepo";
import type { SavedTitle } from "../../src/core/savedTitle";
import { colors } from "../../src/theme/colors";

type TagInfo = { tag: string; count: number };

export default function TagsScreen() {
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
    return (tagMap.get(selectedTag) ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  }, [selectedTag, tagMap]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>Tags</Text>

      <TextInput
        value={q}
        onChangeText={(t) => {
          setQ(t);
          if (t.trim().length > 0) setSelectedTag(null);
        }}
        placeholder="Buscar tag…"
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

      {/* Lista de tags */}
      <FlatList
        data={tagsList}
        keyExtractor={(x) => x.tag}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted }}>
            Todavía no tenés tags. Agregá alguno desde el detalle.
          </Text>
        }
        renderItem={({ item }) => {
          const active = selectedTag === item.tag;
          return (
            <Pressable
              onPress={() => setSelectedTag(active ? null : item.tag)}
              style={{
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: colors.card,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>{item.tag}</Text>
              <Text style={{ color: colors.muted, fontWeight: "800" }}>{item.count}</Text>
            </Pressable>
          );
        }}
      />

      {/* Detalle del tag seleccionado */}
      {selectedTag && (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontWeight: "800" }}>
            Títulos con: <Text style={{ color: colors.text }}>{selectedTag}</Text>
          </Text>

          <FlatList
            data={selectedItems}
            keyExtractor={(x) => x.id}
            contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/title/${item.id}`)}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card2,
                  gap: 6,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>{item.title}</Text>
                <Text style={{ color: colors.muted, fontWeight: "700" }}>
                  {item.type.toUpperCase()} • {item.status}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}
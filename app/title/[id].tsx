import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { SavedTitle, TitleStatus } from "../../src/core/savedTitle";
import { deleteSavedTitle, getSavedTitleById, upsertSavedTitle } from "../../src/storage/savedTitlesRepo";

const STATUS_OPTIONS: { value: TitleStatus; label: string }[] = [
  { value: "planned", label: "Pendiente" },
  { value: "watching", label: "Viendo" },
  { value: "done", label: "Visto" },
  { value: "dropped", label: "Abandonado" },
];

export default function TitleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<SavedTitle | null>(null);
  const [loading, setLoading] = useState(true);

  // edición local
  const [notes, setNotes] = useState("");
  const [newTag, setNewTag] = useState("");

  const tags = useMemo(() => item?.tags ?? [], [item]);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getSavedTitleById(id);
      setItem(data);
      setNotes(data?.notes ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save(patch: Partial<SavedTitle>) {
    if (!item) return;
    const now = Date.now();
    const updated: SavedTitle = {
      ...item,
      ...patch,
      updatedAt: now,
    };
    await upsertSavedTitle(updated);
    setItem(updated);
  }

  async function saveNotes() {
    await save({ notes });
  }

  function addTag() {
    if (!item) return;
    const t = newTag.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setNewTag("");
      return;
    }
    save({ tags: [t, ...tags] });
    setNewTag("");
  }

  function removeTag(tag: string) {
    if (!item) return;
    save({ tags: tags.filter((x) => x !== tag) });
  }

  function confirmDelete() {
    if (!item) return;
    Alert.alert("Borrar", "¿Seguro que querés borrar este ítem?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          await deleteSavedTitle(item.id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Cargando…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <Text>No existe.</Text>
        <Pressable onPress={() => router.back()} style={{ padding: 12, borderRadius: 12, backgroundColor: "#222" }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>{item.title}</Text>
      <Text style={{ opacity: 0.7 }}>
        {item.type.toUpperCase()} • {item.provider.toUpperCase()}
      </Text>

      {/* STATUS */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Estado</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {STATUS_OPTIONS.map((s) => {
            const active = item.status === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => save({ status: s.value })}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: active ? "#444" : "#222",
                  borderWidth: 1,
                  borderColor: active ? "#666" : "#333",
                }}
              >
                <Text style={{ color: "white" }}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* TAGS */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Tags</Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={newTag}
            onChangeText={setNewTag}
            placeholder="Ej: Con: Martina"
            placeholderTextColor="#777"
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#333",
              color: "white",
            }}
          />
          <Pressable
            onPress={addTag}
            style={{ padding: 12, borderRadius: 12, backgroundColor: "#222", justifyContent: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Agregar</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {tags.length === 0 ? (
            <Text style={{ opacity: 0.7 }}>Sin tags</Text>
          ) : (
            tags.map((t) => (
              <Pressable
                key={t}
                onPress={() => removeTag(t)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: "#222",
                  borderWidth: 1,
                  borderColor: "#333",
                }}
              >
                <Text style={{ color: "white" }}>{t}  ✕</Text>
              </Pressable>
            ))
          )}
        </View>
      </View>

      {/* NOTES */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Notas</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Escribí una nota…"
          placeholderTextColor="#777"
          multiline
          style={{
            minHeight: 120,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#333",
            color: "white",
            textAlignVertical: "top",
          }}
        />
        <Pressable
          onPress={saveNotes}
          style={{ padding: 12, borderRadius: 12, backgroundColor: "#222", alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Guardar notas</Text>
        </Pressable>
      </View>

      {/* DELETE */}
      <Pressable
        onPress={confirmDelete}
        style={{ padding: 12, borderRadius: 12, backgroundColor: "#4a1f1f", alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>Borrar</Text>
      </Pressable>
    </ScrollView>
  );
}

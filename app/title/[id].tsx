import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import type { SavedTitle, TitleStatus } from "../../src/core/savedTitle";
import {
  deleteSavedTitle,
  getSavedTitleById,
  upsertSavedTitle,
} from "../../src/storage/savedTitlesRepo";

const STATUS_OPTIONS: { value: TitleStatus; label: string }[] = [
  { value: "planned", label: "Pendiente" },
  { value: "watching", label: "Viendo" },
  { value: "done", label: "Visto" },
  { value: "dropped", label: "Abandonado" },
];

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
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? "#ffffff" : "#1e1e1e",
        borderWidth: 1,
        borderColor: active ? "#ffffff" : "#333333",
      }}
    >
      <Text
        style={{
          color: active ? "#0b0b0b" : "#f2f2f2",
          fontWeight: active ? "800" : "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TagPill({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "#171717",
        borderWidth: 1,
        borderColor: "#2c2c2c",
      }}
    >
      <Text style={{ color: "#f2f2f2", fontWeight: "600" }}>{tag}</Text>
      <Pressable
        onPress={onRemove}
        hitSlop={10}
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2a2a2a",
        }}
      >
        <Text style={{ color: "#f2f2f2", fontWeight: "900" }}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function TitleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<SavedTitle | null>(null);
  const [loading, setLoading] = useState(true);

  // edición local
  const [notes, setNotes] = useState("");
  const [dirtyNotes, setDirtyNotes] = useState(false);

  // tags
  const [newTag, setNewTag] = useState("");
  const [tagHint, setTagHint] = useState<string | null>(null);

  const tags = useMemo(() => item?.tags ?? [], [item]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getSavedTitleById(String(id));
      setItem(data);
      setNotes(data?.notes ?? "");
      setDirtyNotes(false);
      setTagHint(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo cargar el título.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const save = useCallback(
    async (patch: Partial<SavedTitle>) => {
      if (!item) return;
      const now = Date.now();
      const updated: SavedTitle = { ...item, ...patch, updatedAt: now };

      await upsertSavedTitle(updated);
      setItem(updated);
    },
    [item]
  );

  // Status: auto-save
  const setStatus = useCallback(
    async (status: TitleStatus) => {
      try {
        await save({ status });
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo guardar el estado.");
      }
    },
    [save]
  );

  // Notes: guardar y volver (como antes)
  const saveNotesAndBack = useCallback(async () => {
    if (!item) return;

    try {
      await save({ notes: notes.trim() ? notes : null });
      setDirtyNotes(false);
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudieron guardar las notas.");
    }
  }, [item, notes, router, save]);

  // Tags: auto-save + feedback claro
  const addTag = useCallback(async () => {
    if (!item) return;

    const t = newTag.trim();
    if (!t) return;

    // Normalización suave (evita duplicados por espacios)
    const exists = tags.some((x) => x.toLowerCase() === t.toLowerCase());
    if (exists) {
      setTagHint("Ese tag ya existe.");
      setNewTag("");
      return;
    }

    try {
      await save({ tags: [t, ...tags] });
      setNewTag("");
      setTagHint(`Tag agregado: ${t}`);
      // borrar hint después de un ratito
      setTimeout(() => setTagHint(null), 1400);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo agregar el tag.");
    }
  }, [item, newTag, save, tags]);

  const removeTag = useCallback(
    async (tag: string) => {
      if (!item) return;
      try {
        await save({ tags: tags.filter((x) => x !== tag) });
        setTagHint(`Tag borrado: ${tag}`);
        setTimeout(() => setTagHint(null), 1400);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo borrar el tag.");
      }
    },
    [item, save, tags]
  );

  const doDelete = useCallback(async () => {
    if (!item) return;
    await deleteSavedTitle(item.id);
    router.back();
  }, [item, router]);

  const confirmDelete = useCallback(() => {
    if (!item) return;

    if (Platform.OS === "web") {
      const ok = window.confirm("¿Seguro que querés borrar este ítem?");
      if (ok) void doDelete();
      return;
    }

    Alert.alert("Borrar", "¿Seguro que querés borrar este ítem?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => void doDelete() },
    ]);
  }, [doDelete, item]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b0b0b", padding: 16, justifyContent: "center", gap: 10 }}>
        <ActivityIndicator />
        <Text style={{ color: "#f2f2f2", textAlign: "center" }}>Cargando…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b0b0b", padding: 16, gap: 10 }}>
        <Text style={{ color: "#f2f2f2", fontSize: 18, fontWeight: "800" }}>No encontrado</Text>
        <Text style={{ color: "#bdbdbd" }}>
          Este título no existe en tu biblioteca (o fue borrado).
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 12, borderRadius: 12, backgroundColor: "#1e1e1e", alignItems: "center" }}
        >
          <Text style={{ color: "#f2f2f2", fontWeight: "800" }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0b0b0b" }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: "#f2f2f2" }}>
            {item.title}
          </Text>
          <Text style={{ color: "#bdbdbd", fontWeight: "600" }}>
            {item.type.toUpperCase()} • {item.provider.toUpperCase()}
          </Text>
        </View>

        {/* Estado */}
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#242424",
            backgroundColor: "#101010",
            gap: 10,
          }}
        >
          <Text style={{ color: "#f2f2f2", fontWeight: "900", fontSize: 16 }}>Estado</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {STATUS_OPTIONS.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                active={item.status === s.value}
                onPress={() => void setStatus(s.value)}
              />
            ))}
          </View>
          <Text style={{ color: "#9a9a9a" }}>
            Se guarda automáticamente.
          </Text>
        </View>

        {/* Tags */}
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#242424",
            backgroundColor: "#101010",
            gap: 10,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ color: "#f2f2f2", fontWeight: "900", fontSize: 16 }}>Tags</Text>
            <Text style={{ color: "#9a9a9a" }}>
              Se guardan automáticamente al agregar o borrar.
            </Text>
            {!!tagHint && (
              <Text style={{ color: "#cfcfcf", fontWeight: "700" }}>{tagHint}</Text>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              value={newTag}
              onChangeText={setNewTag}
              placeholder="Ej: Con: Martina"
              placeholderTextColor="#777"
              onSubmitEditing={() => void addTag()}
              style={{
                flex: 1,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#2c2c2c",
                backgroundColor: "#0f0f0f",
                color: "#f2f2f2",
              }}
              returnKeyType="done"
            />
            <Pressable
              onPress={() => void addTag()}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#ffffff",
              }}
            >
              <Text style={{ color: "#0b0b0b", fontWeight: "900" }}>+ Tag</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {tags.length === 0 ? (
              <Text style={{ color: "#bdbdbd" }}>Sin tags todavía.</Text>
            ) : (
              tags.map((t) => (
                <TagPill key={t} tag={t} onRemove={() => void removeTag(t)} />
              ))
            )}
          </View>
        </View>

        {/* Notas */}
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#242424",
            backgroundColor: "#101010",
            gap: 10,
          }}
        >
          <Text style={{ color: "#f2f2f2", fontWeight: "900", fontSize: 16 }}>Notas</Text>

          <TextInput
            value={notes}
            onChangeText={(t) => {
              setNotes(t);
              setDirtyNotes(true);
            }}
            placeholder="Escribí una nota…"
            placeholderTextColor="#777"
            multiline
            style={{
              minHeight: 140,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#2c2c2c",
              backgroundColor: "#0f0f0f",
              color: "#f2f2f2",
              textAlignVertical: "top",
            }}
          />

          <Pressable
            onPress={() => void saveNotesAndBack()}
            disabled={!dirtyNotes}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: dirtyNotes ? "#ffffff" : "#3b3b3b",
              alignItems: "center",
            }}
          >
            <Text style={{ color: dirtyNotes ? "#0b0b0b" : "#e0e0e0", fontWeight: "900" }}>
              {dirtyNotes ? "Guardar y volver" : "Sin cambios"}
            </Text>
          </Pressable>

          <Text style={{ color: "#9a9a9a" }}>
            Updated: {new Date(item.updatedAt).toLocaleString()}
          </Text>
        </View>

        {/* Borrar */}
        <Pressable
          onPress={confirmDelete}
          style={{
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: "#4a1f1f",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#5a2a2a",
          }}
        >
          <Text style={{ color: "#f2f2f2", fontWeight: "900" }}>Borrar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
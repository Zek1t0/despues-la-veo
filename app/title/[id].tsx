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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import type { SavedTitle, TitleStatus } from "../../src/core/savedTitle";
import {
  deleteSavedTitle,
  getSavedTitleById,
  upsertSavedTitle,
} from "../../src/storage/savedTitlesRepo";
import { colors } from "../../src/theme/colors";

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
        backgroundColor: active ? colors.primary : colors.card2,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border2,
      }}
    >
      <Text
        style={{
          color: active ? colors.bg : colors.text,
          fontWeight: active ? "900" : "700",
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
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border2,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "700" }}>{tag}</Text>
      <Pressable
        onPress={onRemove}
        hitSlop={10}
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900" }}>✕</Text>
      </Pressable>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

export default function TitleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<SavedTitle | null>(null);

  const [notes, setNotes] = useState("");
  const [dirtyNotes, setDirtyNotes] = useState(false);

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
      setItem(null);
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

  const headerTitle = useMemo(() => {
    const t = item?.title ?? "Título";
    return t.length > 28 ? t.slice(0, 28) + "…" : t;
  }, [item]);

  const tmdbHref = useMemo(() => {
    if (!item) return null;
    if (item.provider !== "tmdb") return null;
    if (!item.type || !item.externalId) return null;
    return `/tmdb/${item.type}/${item.externalId}`;
  }, [item]);

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

  const addTag = useCallback(async () => {
    if (!item) return;
    const t = newTag.trim();
    if (!t) return;

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
      setTimeout(() => setTagHint(null), 1200);
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
        setTimeout(() => setTagHint(null), 1200);
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
      <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 10 }}>
        <ActivityIndicator />
        <Text style={{ color: colors.muted, textAlign: "center" }}>Cargando…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Título",
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <View style={{ flex: 1, padding: 16, gap: 10 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
            No encontrado
          </Text>
          <Text style={{ color: colors.muted }}>
            Este ítem no existe (o fue borrado).
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>Volver</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerRight: () =>
            tmdbHref ? (
              <Pressable
                onPress={() => router.push(tmdbHref)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>TMDB</Text>
              </Pressable>
            ) : null,
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>
            {item.title}
          </Text>
          <Text style={{ color: colors.muted, fontWeight: "700" }}>
            {item.type.toUpperCase()} • {item.provider.toUpperCase()}
          </Text>
        </View>

        {/* Estado */}
        <Card>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Estado</Text>
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
          <Text style={{ color: colors.subtle }}>Se guarda automáticamente.</Text>
        </Card>

        {/* Tags */}
        <Card>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Tags</Text>
            <Text style={{ color: colors.subtle }}>Se guardan automáticamente al agregar o borrar.</Text>
            {!!tagHint && <Text style={{ color: colors.muted, fontWeight: "800" }}>{tagHint}</Text>}
          </View>

          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              value={newTag}
              onChangeText={setNewTag}
              placeholder="Ej: Con: Martina"
              placeholderTextColor={colors.subtle}
              onSubmitEditing={() => void addTag()}
              style={{
                flex: 1,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border2,
                backgroundColor: colors.input,
                color: colors.text,
              }}
              returnKeyType="done"
            />
            <Pressable
              onPress={() => void addTag()}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: colors.primary,
                borderWidth: 1,
                borderColor: colors.primary,
              }}
            >
              <Text style={{ color: colors.bg, fontWeight: "900" }}>+ Tag</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {tags.length === 0 ? (
              <Text style={{ color: colors.muted }}>Sin tags todavía.</Text>
            ) : (
              tags.map((t) => <TagPill key={t} tag={t} onRemove={() => void removeTag(t)} />)
            )}
          </View>
        </Card>

        {/* Notas */}
        <Card>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Notas</Text>

          <TextInput
            value={notes}
            onChangeText={(t) => {
              setNotes(t);
              setDirtyNotes(true);
            }}
            placeholder="Escribí una nota…"
            placeholderTextColor={colors.subtle}
            multiline
            style={{
              minHeight: 140,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border2,
              backgroundColor: colors.input,
              color: colors.text,
              textAlignVertical: "top",
            }}
          />

          <Pressable
            onPress={() => void saveNotesAndBack()}
            disabled={!dirtyNotes}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: dirtyNotes ? colors.primary : "#3b3b3b",
              alignItems: "center",
            }}
          >
            <Text style={{ color: dirtyNotes ? colors.bg : colors.text, fontWeight: "900" }}>
              {dirtyNotes ? "Guardar y volver" : "Sin cambios"}
            </Text>
          </Pressable>

          <Text style={{ color: colors.subtle }}>
            Updated: {new Date(item.updatedAt).toLocaleString()}
          </Text>
        </Card>

        <Pressable
          onPress={confirmDelete}
          style={{
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: colors.danger,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.dangerBorder,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>Borrar</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
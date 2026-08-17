import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SavedTitle, TitleStatus } from "../../src/core/savedTitle";
import { titleStatusLabel, titleTypeLabel } from "../../src/core/presentationLabels";
import { type PinContext } from "../../src/core/contextualPin";
import { ContextualPinIntentQueue } from "../../src/core/contextualPinIntent";
import {
  formatPersonalRating,
  PERSONAL_RATING_MAX,
  PERSONAL_RATING_MIN,
  type PersonalRating,
} from "../../src/core/personalRating";
import {
  applyPersonalRatingConfirmation,
  applyPersonalRatingRollback,
  PersonalRatingIntentQueue,
} from "../../src/core/personalRatingIntent";
import {
  titleDetailPinContextKey,
  titleDetailPinContextLabel,
} from "../../src/core/titleDetailPinContext";
import {
  deleteSavedTitle,
  setPersonalRating,
  updateSavedTitleMetadata,
  type SavedTitleMetadataPatch,
} from "../../src/storage/savedTitlesRepo";
import { getTitleDetailPinSnapshot } from "../../src/storage/titleDetailPinSnapshot";
import { setTitlePinState } from "../../src/storage/titlePinsRepo";
import { colors } from "../../src/theme/colors";
import { useAppTheme } from "../../src/theme/AppThemeProvider";

const STATUS_OPTIONS: { value: TitleStatus; label: string }[] = ([
  "planned",
  "watching",
  "done",
  "dropped",
] satisfies TitleStatus[]).map((value) => ({
  value,
  label: titleStatusLabel(value),
}));

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const INITIAL_PERSONAL_RATING = 70;

function formatUpdatedAt(value: number): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  try {
    return UPDATED_AT_FORMATTER.format(date);
  } catch {
    return null;
  }
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      focusable
      onPress={onPress}
      style={{
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
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
        accessibilityLabel={`Quitar etiqueta ${tag}`}
        accessibilityRole="button"
        focusable
        onPress={onRemove}
        hitSlop={10}
        style={{
          minWidth: 44,
          minHeight: 44,
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
  const { theme } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { id, pinContext, tag } = useLocalSearchParams<{
    id?: string | string[];
    pinContext?: string | string[];
    tag?: string | string[];
  }>();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<SavedTitle | null>(null);
  const [effectivePinContext, setEffectivePinContext] = useState<PinContext | null>(null);
  const [pinnedAt, setPinnedAt] = useState<number | null>(null);
  const [pinReady, setPinReady] = useState(false);
  const [pinReadError, setPinReadError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [dirtyNotes, setDirtyNotes] = useState(false);
  const notesDraft = useRef("");
  const notesDraftDirty = useRef(false);

  const [newTag, setNewTag] = useState("");
  const [tagHint, setTagHint] = useState<string | null>(null);
  const [ratingPending, setRatingPending] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const loadGeneration = useRef(0);
  const visibleTitleId = useRef<string | null>(null);
  const deletedTitleIds = useRef<Set<string>>(new Set());
  const visiblePinContextKey = useRef<string | null>(null);
  const pinIntentQueues = useRef<Map<string, ContextualPinIntentQueue>>(new Map());
  const ratingIntentQueues = useRef<Map<string, PersonalRatingIntentQueue>>(new Map());

  const tags = useMemo(() => item?.tags ?? [], [item]);
  const formattedUpdatedAt = item ? formatUpdatedAt(item.updatedAt) : null;

  const load = useCallback(async (options?: { preserveNotesDraft?: boolean }) => {
    const savedTitleId = typeof id === "string" ? id : null;
    const generation = ++loadGeneration.current;
    setLoading(true);
    setPinReady(false);
    setPinReadError(null);
    setRatingPending(false);
    setRatingError(null);
    visibleTitleId.current = savedTitleId;
    visiblePinContextKey.current = null;
    if (!savedTitleId) {
      setItem(null);
      setEffectivePinContext(null);
      setPinnedAt(null);
      visibleTitleId.current = null;
      setLoading(false);
      return;
    }
    try {
      const titleQueuePrefix = `${savedTitleId}\u0000`;
      await Promise.all(
        [...pinIntentQueues.current.entries()]
          .filter(([key]) => key.startsWith(titleQueuePrefix))
          .map(([, queue]) => queue.whenIdle())
      );
      await ratingIntentQueues.current.get(savedTitleId)?.whenIdle();
      const snapshot = await getTitleDetailPinSnapshot(savedTitleId, { pinContext, tag });
      if (generation !== loadGeneration.current) return;
      setItem(snapshot.item);
      if (snapshot.item) {
        const ratingQueue = ratingIntentQueues.current.get(savedTitleId);
        const confirmed = {
          value: snapshot.item.personalRating,
          updatedAt: snapshot.item.updatedAt,
        };
        if (ratingQueue) ratingQueue.reconcileConfirmed(confirmed);
        else ratingIntentQueues.current.set(savedTitleId, new PersonalRatingIntentQueue(confirmed));
      }
      if (options?.preserveNotesDraft && notesDraftDirty.current) {
        setNotes(notesDraft.current);
        setDirtyNotes(true);
      } else {
        const persistedNotes = snapshot.item?.notes ?? "";
        notesDraft.current = persistedNotes;
        notesDraftDirty.current = false;
        setNotes(persistedNotes);
        setDirtyNotes(false);
      }
      setTagHint(null);
      setEffectivePinContext(snapshot.context);
      setPinnedAt(snapshot.pinnedAt);

      if (snapshot.item && snapshot.pinReadError === null) {
        const contextKey = titleDetailPinContextKey(snapshot.item.id, snapshot.context);
        visiblePinContextKey.current = contextKey;
        pinIntentQueues.current.set(
          contextKey,
          new ContextualPinIntentQueue(snapshot.pinnedAt)
        );
        setPinReady(true);
      } else if (snapshot.item) {
        const message = "No se pudo leer el estado de fijado. Podés volver a intentar.";
        setPinReadError(message);
        Alert.alert("Error al cargar el pin", message);
      }
    } catch (e: any) {
      if (generation !== loadGeneration.current) return;
      Alert.alert("Error", e?.message ?? "No se pudo cargar el título.");
      setItem(null);
      setEffectivePinContext(null);
      setPinnedAt(null);
      visibleTitleId.current = null;
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [id, pinContext, tag]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const pinContextLabel = effectivePinContext
    ? titleDetailPinContextLabel(effectivePinContext)
    : "Biblioteca";

  const showPinWriteError = useCallback((contextLabel: string) => {
    const message = `No se pudo cambiar el pin en ${contextLabel}. Se restauró el último estado confirmado.`;
    Alert.alert("Error al fijar", message);
  }, []);

  const requestPersonalRating = useCallback((next: PersonalRating) => {
    if (!item) return;
    const savedTitleId = item.id;
    const intent = ratingIntentQueues.current.get(savedTitleId) ??
      new PersonalRatingIntentQueue({
        value: item.personalRating,
        updatedAt: item.updatedAt,
      });
    ratingIntentQueues.current.set(savedTitleId, intent);
    if (next === intent.getLatest()) return;

    const isVisible = () =>
      visibleTitleId.current === savedTitleId && !deletedTitleIds.current.has(savedTitleId);
    setRatingError(null);
    setRatingPending(true);
    void intent.request(next, (value) => setPersonalRating(savedTitleId, value), {
      onOptimistic: (value) => {
        if (!isVisible()) return;
        setItem((current) => current?.id === savedTitleId
          ? { ...current, personalRating: value }
          : current);
      },
      onConfirmed: ({ confirmed, latest }) => {
        if (!isVisible()) return;
        setItem((current) => current?.id === savedTitleId
          ? applyPersonalRatingConfirmation(current, { confirmed, latest })
          : current);
      },
      onRollback: (confirmed) => {
        if (!isVisible()) return;
        setItem((current) => current?.id === savedTitleId
          ? applyPersonalRatingRollback(current, confirmed)
          : current);
      },
      onError: (error) => {
        console.error("No se pudo guardar la puntuación personal.", error);
        if (!isVisible()) return;
        setRatingError("No se pudo guardar tu puntuación. Se restauró el último valor confirmado.");
      },
    }).then(() => {
      if (isVisible()) setRatingPending(intent.isPending());
    });
  }, [item]);

  const adjustPersonalRating = useCallback((delta: number) => {
    if (!item) return;
    const ratingQueue = ratingIntentQueues.current.get(item.id);
    const currentValue = ratingQueue?.getLatest() ?? item.personalRating;
    if (currentValue === null) return;
    const next = currentValue + delta;
    if (next < PERSONAL_RATING_MIN || next > PERSONAL_RATING_MAX) return;
    requestPersonalRating(next);
  }, [item, requestPersonalRating]);

  const togglePin = useCallback(() => {
    if (!item || !effectivePinContext || !pinReady) return;
    const context = effectivePinContext;
    const contextKey = titleDetailPinContextKey(item.id, context);
    const intent =
      pinIntentQueues.current.get(contextKey) ?? new ContextualPinIntentQueue(pinnedAt);
    pinIntentQueues.current.set(contextKey, intent);
    const nextPinnedAt = intent.getLatest() === null ? Date.now() : null;

    const updateVisibleState = (next: number | null) => {
      if (visiblePinContextKey.current !== contextKey) return;
      setPinnedAt(next);
    };

    void intent.request(
      nextPinnedAt,
      (next) => setTitlePinState(item.id, context, next),
      {
        onOptimistic: updateVisibleState,
        onRollback: updateVisibleState,
        onError: (error) => {
          console.error(`No se pudo cambiar el pin en ${titleDetailPinContextLabel(context)}.`, error);
          if (visiblePinContextKey.current === contextKey) {
            showPinWriteError(titleDetailPinContextLabel(context));
          }
        },
      }
    );
  }, [effectivePinContext, item, pinReady, pinnedAt, showPinWriteError]);

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
    async (patch: SavedTitleMetadataPatch) => {
      if (!item) return;
      const savedTitleId = item.id;
      await ratingIntentQueues.current.get(savedTitleId)?.whenIdle();
      const updated = await updateSavedTitleMetadata(savedTitleId, patch);
      if (patch.tags) await load({ preserveNotesDraft: true });
      else if (visibleTitleId.current === savedTitleId) {
        const ratingQueue = ratingIntentQueues.current.get(savedTitleId);
        setItem((current) => current?.id === savedTitleId
          ? {
              ...updated,
              personalRating: ratingQueue
                ? ratingQueue.getLatest()
                : updated.personalRating,
              updatedAt: Math.max(current.updatedAt, updated.updatedAt),
            }
          : current);
      }
    },
    [item, load]
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
      notesDraft.current = notes;
      notesDraftDirty.current = false;
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
      setTagHint("Esa etiqueta ya existe.");
      setNewTag("");
      return;
    }

    try {
      await save({ tags: [t, ...tags] });
      setNewTag("");
      setTagHint(`Etiqueta agregada: ${t}`);
      setTimeout(() => setTagHint(null), 1200);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo agregar la etiqueta.");
    }
  }, [item, newTag, save, tags]);

  const removeTag = useCallback(
    async (tag: string) => {
      if (!item) return;
      try {
        await save({ tags: tags.filter((x) => x !== tag) });
        setTagHint(`Etiqueta borrada: ${tag}`);
        setTimeout(() => setTagHint(null), 1200);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo borrar la etiqueta.");
      }
    },
    [item, save, tags]
  );

  const doDelete = useCallback(async () => {
    if (!item) return;
    const savedTitleId = item.id;
    await ratingIntentQueues.current.get(savedTitleId)?.whenIdle();
    deletedTitleIds.current.add(savedTitleId);
    try {
      await deleteSavedTitle(savedTitleId);
      visibleTitleId.current = null;
      router.back();
    } catch (error) {
      deletedTitleIds.current.delete(savedTitleId);
      throw error;
    }
  }, [item, router]);

  const confirmDelete = useCallback(() => {
    if (!item) return;

    if (Platform.OS === "web") {
      const ok = window.confirm("¿Seguro que querés borrar este título?");
      if (ok) void doDelete();
      return;
    }

    Alert.alert("Borrar", "¿Seguro que querés borrar este título?", [
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
            accessibilityRole="button"
            focusable
            onPress={() => router.back()}
            style={{
              minHeight: 44,
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
          headerRight: () =>
            tmdbHref ? (
              <Pressable
                accessibilityLabel="Abrir este título en TMDB"
                accessibilityRole="button"
                focusable
                onPress={() => router.push(tmdbHref)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: theme.global.surface,
                  borderWidth: 1,
                  borderColor: theme.global.border,
                }}
              >
                <Text style={{ color: theme.global.textPrimary, fontWeight: "900" }}>TMDB</Text>
              </Pressable>
            ) : null,
        }}
      />

      <ScrollView
        contentContainerStyle={{
          alignSelf: "center",
          gap: 16,
          maxWidth: 800,
          padding: 16,
          paddingBottom: 16 + (Platform.OS === "web" ? 0 : insets.bottom),
          width: "100%",
        }}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>
            {item.title}
          </Text>
          <Text style={{ color: colors.muted, fontWeight: "700" }}>
            {titleTypeLabel(item.type)} • {item.provider.toUpperCase()}
          </Text>
        </View>

        <Card>
          {pinReady ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: pinnedAt !== null }}
              focusable
              onPress={togglePin}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: pinnedAt === null ? colors.primary : colors.card2,
                borderColor: pinnedAt === null ? colors.primary : colors.border2,
                borderRadius: 12,
                borderWidth: 1,
                justifyContent: "center",
                minHeight: 44,
                opacity: pressed ? 0.78 : 1,
                paddingHorizontal: 14,
                paddingVertical: 10,
              })}
            >
              <Text
                style={{
                  color: pinnedAt === null ? colors.bg : colors.text,
                  fontWeight: "900",
                }}
              >
                {pinnedAt === null
                  ? `Fijar en ${pinContextLabel}`
                  : `Desfijar de ${pinContextLabel}`}
              </Text>
            </Pressable>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.muted }}>
                {pinReadError ?? "Cargando estado de fijado…"}
              </Text>
              {pinReadError ? (
                <Pressable
                  accessibilityRole="button"
                  focusable
                  onPress={() => void load()}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: colors.card2,
                    borderColor: colors.border2,
                    borderRadius: 12,
                    borderWidth: 1,
                    justifyContent: "center",
                    minHeight: 44,
                    opacity: pressed ? 0.78 : 1,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  })}
                >
                  <Text style={{ color: colors.text, fontWeight: "900" }}>Reintentar</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </Card>

        {/* Puntuaciones */}
        <Card>
          <View
            style={{
              flexDirection: windowWidth < 390 ? "column" : "row",
              gap: 16,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                Tu puntuación
              </Text>
              <Text
                accessibilityLabel={item.personalRating === null
                  ? "Mi puntuación: sin calificar"
                  : `Mi puntuación: ${formatPersonalRating(item.personalRating)} de 10`}
                style={{ color: colors.text, fontSize: 26, fontWeight: "900" }}
              >
                {item.personalRating === null
                  ? "Sin calificar"
                  : `${formatPersonalRating(item.personalRating)} / 10`}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                TMDB
              </Text>
              <Text style={{ color: colors.muted, fontSize: 26, fontWeight: "800" }}>
                {typeof item.voteAverage === "number" && Number.isFinite(item.voteAverage)
                  ? `${item.voteAverage.toFixed(1)} / 10`
                  : "— / 10"}
              </Text>
            </View>
          </View>

          {item.personalRating === null ? (
            <Pressable
              accessibilityLabel="Comenzar mi puntuación en 7.0 de 10"
              accessibilityRole="button"
              focusable
              onPress={() => requestPersonalRating(INITIAL_PERSONAL_RATING)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: colors.primary,
                borderColor: colors.primary,
                borderRadius: 12,
                borderWidth: 1,
                justifyContent: "center",
                minHeight: 44,
                opacity: pressed ? 0.78 : 1,
                paddingHorizontal: 14,
                paddingVertical: 10,
              })}
            >
              <Text style={{ color: colors.bg, fontWeight: "900" }}>Calificar con 7.0</Text>
            </Pressable>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([
                  { delta: -10, text: "−1.0", label: "Disminuir mi puntuación en 1.0" },
                  { delta: -1, text: "−0.1", label: "Disminuir mi puntuación en 0.1" },
                  { delta: 1, text: "+0.1", label: "Aumentar mi puntuación en 0.1" },
                  { delta: 10, text: "+1.0", label: "Aumentar mi puntuación en 1.0" },
                ] as const).map((control) => {
                  const next = item.personalRating! + control.delta;
                  const disabled = next < PERSONAL_RATING_MIN || next > PERSONAL_RATING_MAX;
                  return (
                    <Pressable
                      key={control.delta}
                      accessibilityLabel={control.label}
                      accessibilityRole="button"
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      focusable
                      onPress={() => adjustPersonalRating(control.delta)}
                      style={({ pressed }) => ({
                        alignItems: "center",
                        backgroundColor: colors.card2,
                        borderColor: colors.border2,
                        borderRadius: 12,
                        borderWidth: 1,
                        flexGrow: 1,
                        justifyContent: "center",
                        minHeight: 44,
                        minWidth: 72,
                        opacity: disabled ? 0.4 : pressed ? 0.78 : 1,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      })}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900" }}>{control.text}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                accessibilityLabel="Quitar mi puntuación"
                accessibilityRole="button"
                focusable
                onPress={() => requestPersonalRating(null)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  borderColor: colors.border2,
                  borderRadius: 12,
                  borderWidth: 1,
                  justifyContent: "center",
                  minHeight: 44,
                  opacity: pressed ? 0.78 : 1,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                })}
              >
                <Text style={{ color: colors.text, fontWeight: "800" }}>Quitar puntuación</Text>
              </Pressable>
            </>
          )}
          {ratingPending ? (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.subtle }}>
              Guardando puntuación…
            </Text>
          ) : null}
          {ratingError ? (
            <Text accessibilityLiveRegion="assertive" style={{ color: colors.dangerBorder }}>
              {ratingError}
            </Text>
          ) : null}
        </Card>

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

        {/* Etiquetas */}
        <Card>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Etiquetas</Text>
            <Text style={{ color: colors.subtle }}>Se guardan automáticamente al agregar o borrar.</Text>
            {!!tagHint && <Text style={{ color: colors.muted, fontWeight: "800" }}>{tagHint}</Text>}
          </View>

          <View
            style={{
              alignItems: "center",
              flexDirection: windowWidth < 390 ? "column" : "row",
              gap: 10,
            }}
          >
            <TextInput
              value={newTag}
              accessibilityLabel="Nueva etiqueta"
              onChangeText={setNewTag}
              placeholder="Ej: Con: Martina"
              placeholderTextColor={colors.subtle}
              onSubmitEditing={() => void addTag()}
              style={{
                flex: 1,
                minHeight: 44,
                width: windowWidth < 390 ? "100%" : undefined,
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
              accessibilityLabel="Agregar etiqueta"
              accessibilityRole="button"
              focusable
              onPress={() => void addTag()}
              style={{
                minHeight: 44,
                justifyContent: "center",
                width: windowWidth < 390 ? "100%" : undefined,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: colors.primary,
                borderWidth: 1,
                borderColor: colors.primary,
              }}
            >
              <Text style={{ color: colors.bg, fontWeight: "900" }}>Agregar</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {tags.length === 0 ? (
              <Text style={{ color: colors.muted }}>Todavía no hay etiquetas.</Text>
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
              notesDraft.current = t;
              notesDraftDirty.current = true;
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
            accessibilityRole="button"
            accessibilityState={{ disabled: !dirtyNotes }}
            focusable
            onPress={() => void saveNotesAndBack()}
            disabled={!dirtyNotes}
            style={{
              minHeight: 44,
              justifyContent: "center",
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
            {formattedUpdatedAt
              ? `Actualizado: ${formattedUpdatedAt}`
              : "Fecha de actualización no disponible."}
          </Text>
        </Card>

        <Pressable
          accessibilityRole="button"
          focusable
          onPress={confirmDelete}
          style={{
            minHeight: 44,
            justifyContent: "center",
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

import { controlTarget, gridItemKey, metadataPill, pressedFeedback, radius, space, titleGridColumns, type } from "../../src/theme/presentation";
import { savedContentVisible } from "../../src/core/sensitiveContent";
import { SensitiveFilterStatus } from "../../src/components/browsing/SensitiveContentNotice";
import { useMediaLanguages, type MediaLanguageServices } from "../../src/components/browsing/useMediaLanguages";
import { presentSavedTitle } from "../../src/core/mediaViewProjection";
import { PublicRating } from "../../src/components/browsing/PublicRating";
import { savedMediaPresentation } from "../../src/core/mediaPresentation";
import { MediaPoster } from "../../src/components/browsing/MediaPoster";
import { observeLibraryProjection } from "../../src/storage/libraryInvalidation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { deleteSavedTitle, upsertSavedTitle } from "../../src/storage/savedTitlesRepo";
import type { SavedTitleWithProviderReferences, TitleStatus } from "../../src/core/savedTitle";
import { LIBRARY_PIN_CONTEXT } from "../../src/core/contextualPin";
import {
  selectVisibleLibraryTitles,
  type LibraryStatusFilter,
  LIBRARY_CLASSIFICATION_FILTERS,
  isLibraryClassificationFilter,
  type LibraryClassificationFilter,
} from "../../src/core/libraryView";
import { ContextualPinIntentQueue } from "../../src/core/contextualPinIntent";
import { setTitlePinState } from "../../src/storage/titlePinsRepo";
import { getLibraryScreenSnapshot } from "../../src/storage/libraryScreenSnapshot";
import { titleStatusLabel, mediaClassificationLabel } from "../../src/core/presentationLabels";
import {
  VIEW_PREFERENCE_DEFAULTS,
  isLibrarySort,
  type LibrarySort,
  type LibraryViewMode,
} from "../../src/core/viewPreferences";
import {
  getViewPreference,
  setViewPreference,
} from "../../src/storage/viewPreferencesRepo";
import { useAppTheme } from "../../src/theme/AppThemeProvider";
import {
  savedTitleOpenAccessibilityLabel,
  PersonalRatingBadge,
  TitleGridCard,
  ViewOptionsPanel,
  type ViewOptionsSection,
} from "../../src/components/browsing";

type StatusFilter = LibraryStatusFilter;
type ClassificationFilter = LibraryClassificationFilter;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();

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
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: active
          ? theme.global.selectedSurface
          : theme.global.surfaceSecondary,
        borderWidth: 1,
        borderColor: active
          ? theme.global.selectedBorder
          : theme.global.borderStrong,
      }}
    >
      <Text
        style={{
          color: active
            ? theme.global.selectedForeground
            : theme.global.textPrimary,
          fontWeight: active ? "900" : "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Pill({
  accessibilityLabel,
  text,
}: {
  accessibilityLabel?: string;
  text: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View
      style={{
        ...metadataPill.container,
        backgroundColor: theme.global.surfaceSecondary,
        borderColor: theme.global.borderStrong,
      }}
    >
      <Text
        accessibilityLabel={accessibilityLabel}
        style={[metadataPill.text, { color: theme.global.textPrimary }]}
      >
        {text}
      </Text>
    </View>
  );
}

export type LibraryScreenServices = Readonly<{
  languagePreferences?: MediaLanguageServices;
  getLibraryScreenSnapshot: typeof getLibraryScreenSnapshot;
  deleteSavedTitle: typeof deleteSavedTitle;
  upsertSavedTitle: typeof upsertSavedTitle;
  setTitlePinState: typeof setTitlePinState;
  getViewPreference: typeof getViewPreference;
  setViewPreference: typeof setViewPreference;
  useFocusEffect: typeof useFocusEffect;
  useRouter: () => Pick<ReturnType<typeof useRouter>, "push">;
}>;
const personalLibraryServices: LibraryScreenServices = {
  getLibraryScreenSnapshot, deleteSavedTitle, upsertSavedTitle, setTitlePinState,
  getViewPreference, setViewPreference, useFocusEffect, useRouter,
};

/** Bindings are fixed for this mounted screen; default remains the personal repository. */
export default function LibraryScreen({ bindings }: { bindings?: LibraryScreenServices } = {}) {
  const {
    getLibraryScreenSnapshot, deleteSavedTitle, upsertSavedTitle, setTitlePinState,
    getViewPreference, setViewPreference, useFocusEffect, useRouter,
  } = bindings ?? personalLibraryServices;
  const router = useRouter();
  const { theme } = useAppTheme();
  const { languages,preference,ready:mediaReady,error:mediaError,retry:retryMedia } = useMediaLanguages(!bindings || !!bindings.languagePreferences, bindings?.languagePreferences);
  const { width: windowWidth, fontScale } = useWindowDimensions();

  const [items, setItems] = useState<SavedTitleWithProviderReferences[]>([]);
  const [pinnedAtById, setPinnedAtById] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>("all");
  const [viewMode, setViewMode] = useState<LibraryViewMode>(
    VIEW_PREFERENCE_DEFAULTS["library.viewMode"]
  );
  const [sort, setSort] = useState<LibrarySort>(
    VIEW_PREFERENCE_DEFAULTS["library.sort"]
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const confirmedViewMode = useRef<LibraryViewMode>(
    VIEW_PREFERENCE_DEFAULTS["library.viewMode"]
  );
  const confirmedSort = useRef<LibrarySort>(
    VIEW_PREFERENCE_DEFAULTS["library.sort"]
  );
  const latestViewMode = useRef<LibraryViewMode>(
    VIEW_PREFERENCE_DEFAULTS["library.viewMode"]
  );
  const latestSort = useRef<LibrarySort>(
    VIEW_PREFERENCE_DEFAULTS["library.sort"]
  );
  const viewModeWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const sortWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const viewModeSelectionId = useRef(0);
  const sortSelectionId = useRef(0);
  const latestPinnedAtById = useRef<Map<string, number>>(new Map());
  const pinIntentQueues = useRef<Map<string, ContextualPinIntentQueue>>(new Map());
  const mounted = useRef(true);

  const showPreferenceError = useCallback(() => {
    const message = "No se pudo guardar la preferencia. Se restauró el valor anterior.";
    if (Platform.OS === "web") {
      window.alert(message);
      return;
    }
    Alert.alert("Error al guardar", message);
  }, []);

  useEffect(() => {
    let active = true;
    mounted.current = true;

    async function loadPreferences() {
      const [viewResult, sortResult] = await Promise.allSettled([
        getViewPreference("library.viewMode"),
        getViewPreference("library.sort"),
      ]);
      if (!active) return;

      const loadedViewMode =
        viewResult.status === "fulfilled"
          ? viewResult.value
          : VIEW_PREFERENCE_DEFAULTS["library.viewMode"];
      const loadedSort =
        sortResult.status === "fulfilled"
          ? sortResult.value
          : VIEW_PREFERENCE_DEFAULTS["library.sort"];

      confirmedViewMode.current = loadedViewMode;
      confirmedSort.current = loadedSort;
      latestViewMode.current = loadedViewMode;
      latestSort.current = loadedSort;
      setViewMode(loadedViewMode);
      setSort(loadedSort);
      setPreferencesReady(true);
    }

    void loadPreferences();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  const selectViewMode = useCallback(
    (next: LibraryViewMode) => {
      if (!preferencesReady || next === latestViewMode.current) return;
      const selectionId = ++viewModeSelectionId.current;
      latestViewMode.current = next;
      setViewMode(next);

      viewModeWriteQueue.current = viewModeWriteQueue.current
        .then(async () => {
          try {
            await setViewPreference("library.viewMode", next);
            confirmedViewMode.current = next;
          } catch (error) {
            console.error("No se pudo guardar la apariencia de Biblioteca.", error);
            if (selectionId !== viewModeSelectionId.current || !mounted.current) return;

            latestViewMode.current = confirmedViewMode.current;
            setViewMode(confirmedViewMode.current);
            showPreferenceError();
          }
        })
        .catch((error) => {
          console.error("Falló inesperadamente la cola de apariencia.", error);
        });
    },
    [preferencesReady, showPreferenceError]
  );

  const selectSort = useCallback(
    (next: LibrarySort) => {
      if (!preferencesReady || next === latestSort.current) return;
      const selectionId = ++sortSelectionId.current;
      latestSort.current = next;
      setSort(next);

      sortWriteQueue.current = sortWriteQueue.current
        .then(async () => {
          try {
            await setViewPreference("library.sort", next);
            confirmedSort.current = next;
          } catch (error) {
            console.error("No se pudo guardar el orden de Biblioteca.", error);
            if (selectionId !== sortSelectionId.current || !mounted.current) return;

            latestSort.current = confirmedSort.current;
            setSort(confirmedSort.current);
            showPreferenceError();
          }
        })
        .catch((error) => {
          console.error("Falló inesperadamente la cola de orden.", error);
        });
    },
    [preferencesReady, showPreferenceError]
  );

  const optionSections = useMemo<ViewOptionsSection[]>(
    () => [
      {
        presentation: "layout",
        id: "appearance",
        title: "Apariencia",
        selectedId: viewMode,
        onSelect: (optionId) => {
          if (optionId === "detail" || optionId === "grid") {
            void selectViewMode(optionId);
          }
        },
        options: [
          {
            id: "detail",
            title: "Detalle",
            accessibilityLabel: "Mostrar Biblioteca en detalle",
            indicator: <Ionicons color={theme.global.textSecondary} name="list-outline" size={24} />,
          },
          {
            id: "grid",
            title: "Mosaico",
            accessibilityLabel: "Mostrar Biblioteca en mosaico",
            indicator: <Ionicons color={theme.global.textSecondary} name="grid-outline" size={24} />,
          },
        ],
      },
      {
        presentation: "compact",
        id: "sort",
        title: "Ordenar",
        selectedId: sort,
        onSelect: (optionId) => {
          if (isLibrarySort(optionId)) void selectSort(optionId);
        },
        options: [
          { id: "updated-desc", title: "Actualizados recientemente" },
          { id: "title-asc", title: "Título A–Z" },
          { id: "title-desc", title: "Título Z–A" },
          { id: "rating-desc", title: "Puntuación TMDB" },
          { id: "personal-rating-desc", title: "Mi puntuación: mayor primero" },
          { id: "personal-rating-asc", title: "Mi puntuación: menor primero" },
          { id: "year-desc", title: "Año más reciente" },
        ],
      },
      {
        presentation: "compact",
        id: "status",
        title: "Estado",
        selectedId: statusFilter,
        onSelect: (optionId) => {
          if (
            optionId === "all" ||
            optionId === "planned" ||
            optionId === "watching" ||
            optionId === "done" ||
            optionId === "dropped"
          ) {
            setStatusFilter(optionId);
          }
        },
        options: [
          { id: "all", title: "Todos" },
          { id: "planned", title: "Planeados" },
          { id: "watching", title: titleStatusLabel("watching") },
          { id: "done", title: "Terminados" },
          { id: "dropped", title: "Abandonados" },
        ],
      },
      {
        presentation: "compact",
        id: "classification",
        title: "Clasificación",
        selectedId: classificationFilter,
        onSelect: (optionId) => {
          if (isLibraryClassificationFilter(optionId)) {
            setClassificationFilter(optionId);
          }
        },
        options: LIBRARY_CLASSIFICATION_FILTERS.map(({ value, label }) => ({ id: value, title: label })),
      },
    ],
    [selectSort, selectViewMode, sort, statusFilter, theme.global.textSecondary, classificationFilter, viewMode]
  );

  const libraryReadGeneration = useRef(0);
  useEffect(() => () => { libraryReadGeneration.current++; }, []);
  const refresh = useCallback(async () => {
    const generation = ++libraryReadGeneration.current;
    setLoading(true);
    setSnapshotReady(false);
    setSnapshotError(null);
    try {
      await Promise.all([...pinIntentQueues.current.values()].map((queue) => queue.whenIdle()));
      const snapshot = await getLibraryScreenSnapshot();
      if (generation !== libraryReadGeneration.current) return;
      setItems(snapshot.items);
      const loadedPinnedAtById = new Map(
        snapshot.pins.map((pin) => [pin.savedTitleId, pin.pinnedAt] as const)
      );
      latestPinnedAtById.current = new Map(loadedPinnedAtById);
      pinIntentQueues.current = new Map(
        snapshot.items.map((item) => [
          item.id,
          new ContextualPinIntentQueue(loadedPinnedAtById.get(item.id) ?? null),
        ])
      );
      setPinnedAtById(new Map(loadedPinnedAtById));
      setSnapshotReady(true);
    } catch (error) {
      if (generation !== libraryReadGeneration.current) return;
      console.error("No se pudo cargar la Biblioteca.", error);
      const message = "No se pudo cargar la Biblioteca. Podés volver a intentar.";
      setSnapshotError(message);

    } finally {
      if (generation === libraryReadGeneration.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => observeLibraryProjection(async () => {
    await Promise.all([...pinIntentQueues.current.values()].map(queue => queue.whenIdle()));
    return getLibraryScreenSnapshot();
  }, snapshot => {
    libraryReadGeneration.current++;
    setItems(snapshot.items);
    setPinnedAtById(new Map(snapshot.pins.map(pin => [pin.savedTitleId, pin.pinnedAt])));
    setSnapshotReady(true); setSnapshotError(null); setLoading(false);
  }), []);

  const visibleItems = useMemo(() => {
    return selectVisibleLibraryTitles({
      items: (mediaReady?items.filter(item=>savedContentVisible(item,preference.value.hideSensitive)):[]).map(item => presentSavedTitle(item, languages)),
      pinnedAtById,
      query: q,
      sort,
      statusFilter,
      classificationFilter,
    });
  }, [items, languages, mediaReady,preference.value.hideSensitive,pinnedAtById, q, sort, statusFilter, classificationFilter]);

  const gridGap = 12;
  const availableListWidth = Math.max(0, Math.min(windowWidth - 32, 1168));
  const gridColumns =
    viewMode === "grid"
      ? titleGridColumns(availableListWidth, gridGap, fontScale)
      : 1;
  const gridCardWidth = Math.floor(
    (availableListWidth - gridGap * (gridColumns - 1)) / gridColumns
  );
  const listLayoutKey = `${viewMode}-${gridColumns}`;

  async function remove(id: string) {
    if (Platform.OS === "web") {
      const ok = window.confirm("¿Seguro que querés borrar este ítem?");
      if (!ok) return;
      await deleteSavedTitle(id);
      latestPinnedAtById.current.delete(id);
      pinIntentQueues.current.delete(id);
      setPinnedAtById((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
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
          latestPinnedAtById.current.delete(id);
          pinIntentQueues.current.delete(id);
          setPinnedAtById((current) => {
            const next = new Map(current);
            next.delete(id);
            return next;
          });
          await refresh();
        },
      },
    ]);
  }

  async function toggleDone(item: SavedTitleWithProviderReferences) {
    const now = Date.now();
    // Rows carry a localized display title; only the original snapshot may enter storage.
    const storedItem = items.find(candidate => candidate.id === item.id);
    if (!storedItem) return;
    const nextStatus: TitleStatus = storedItem.status === "done" ? "planned" : "done";
    await upsertSavedTitle({ ...storedItem, status: nextStatus, updatedAt: now });
    await refresh();
  }

  const showPinError = useCallback(() => {
    const message = "No se pudo cambiar el pin de Biblioteca. Se restauró el último estado confirmado.";
    if (Platform.OS === "web") {
      window.alert(message);
      return;
    }
    Alert.alert("Error al fijar", message);
  }, []);

  const toggleLibraryPin = useCallback((savedTitleId: string) => {
    const intent = pinIntentQueues.current.get(savedTitleId) ??
      new ContextualPinIntentQueue(latestPinnedAtById.current.get(savedTitleId) ?? null);
    pinIntentQueues.current.set(savedTitleId, intent);
    const nextPinnedAt = intent.getLatest() === null ? Date.now() : null;
    const updateLocalState = (pinnedAt: number | null) => {
      if (!mounted.current) return;
      const next = new Map(latestPinnedAtById.current);
      if (pinnedAt !== null) next.set(savedTitleId, pinnedAt);
      else next.delete(savedTitleId);
      latestPinnedAtById.current = next;
      setPinnedAtById(new Map(next));
    };

    void intent.request(
      nextPinnedAt,
      (pinnedAt) => setTitlePinState(savedTitleId, LIBRARY_PIN_CONTEXT, pinnedAt),
      {
        onOptimistic: updateLocalState,
        onRollback: updateLocalState,
        onError: (error) => {
          console.error("No se pudo cambiar el pin de Biblioteca.", error);
          if (mounted.current) showPinError();
        },
      }
    );
  }, [showPinError]);

  const closeMobileSearch = () => {
    setQ("");
    setIsSearchActive(false);
  };

  const clearFilters = () => {
    setQ("");
    setStatusFilter("all");
    setClassificationFilter("all");
  };
  const activeFilters = [
    q.trim() && `“${q.trim()}”`,
    statusFilter !== "all" && titleStatusLabel(statusFilter),
    classificationFilter !== "all" &&
      LIBRARY_CLASSIFICATION_FILTERS.find(({ value }) => value === classificationFilter)?.label,
  ].filter(Boolean);
  const sortLabel = optionSections.find(section => section.id === "sort")
    ?.options.find(option => option.id === sort)?.title;

  const addManual = () => router.push("/manual-entry");
  const pickerAction = (iconOnly: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel="¿Qué veo hoy?" focusable
              onPress={() => router.push("/library-picker")}
              style={({ pressed }) => [{
                minHeight: controlTarget, minWidth: controlTarget, justifyContent: "center", paddingHorizontal: space.sm, borderRadius: radius.control,
                flexDirection: "row", alignItems: "center", alignSelf: "center", gap: space.xs,
                backgroundColor: theme.global.surfaceSecondary,
              }, pressed && pressedFeedback]}>
              <Ionicons name="shuffle-outline" size={18} color={theme.global.accent} />
              {!iconOnly && <Text style={[type.control, { color: theme.global.textPrimary }]}>¿Qué veo hoy?</Text>}
            </Pressable>
  );

  const manualAction = (iconOnly: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar manualmente"
      focusable
      onPress={addManual}
      style={({ pressed }) => [{
        alignItems: "center", justifyContent: "center",
        minHeight: controlTarget, minWidth: controlTarget,
        borderRadius: radius.control, paddingHorizontal: space.sm,
        backgroundColor: theme.global.surfaceSecondary,
      }, pressed && pressedFeedback]}
    >
      {iconOnly ? <Ionicons name="add" size={22} color={theme.global.textPrimary} /> :
        <Text style={[type.control, { color: theme.global.textPrimary }]}>Agregar manualmente</Text>}
    </Pressable>
  );

  const renderMobileOptionsButton = () => (
    <Pressable
      accessibilityLabel="Abrir opciones de Biblioteca"
      accessibilityRole="button"
      accessibilityState={{ disabled: !preferencesReady }}
      disabled={!preferencesReady}
      hitSlop={6}
      onPress={() => setOptionsVisible(true)}
      style={({ pressed }) => ({
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        minWidth: 44,
        opacity: !preferencesReady ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons color={theme.global.textPrimary} name="options-outline" size={23} />
    </Pressable>
  );

  return (
    <>
      {!bindings && Platform.OS !== "web" ? (
        <Tabs.Screen
          options={{
            headerLeft: isSearchActive
              ? () => (
                  <Pressable
                    accessibilityLabel="Cerrar búsqueda"
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={closeMobileSearch}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 44,
                      minWidth: 44,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons color={theme.global.textPrimary} name="arrow-back" size={24} />
                  </Pressable>
                )
              : undefined,
            headerTitle: () =>
              isSearchActive ? (
                <TextInput
                  accessibilityLabel="Buscar en Biblioteca"
                  autoFocus
                  onChangeText={setQ}
                  placeholder="Buscar por título o etiqueta…"
                  placeholderTextColor={theme.global.textMuted}
                  style={{
                    backgroundColor: theme.global.inputBackground,
                    borderColor: theme.global.borderStrong,
                    borderRadius: 10,
                    borderWidth: 1,
                    color: theme.global.textPrimary,
                    flex: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    width: "100%",
                  }}
                  value={q}
                />
              ) : (
                <Text style={{ color: theme.global.textPrimary, fontSize: 18, fontWeight: "900" }}>
                  Biblioteca
                </Text>
              ),
            headerRight: () => (
              <View style={{ flexDirection: "row", gap: 4 }}>
                {!isSearchActive ? (
                  <Pressable
                    accessibilityLabel="Buscar en Biblioteca"
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => setIsSearchActive(true)}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 44,
                      minWidth: 44,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons color={theme.global.textPrimary} name="search" size={22} />
                  </Pressable>
                ) : null}
                {renderMobileOptionsButton()}
                {!isSearchActive && pickerAction(true)}
                {!isSearchActive && manualAction(true)}
              </View>
            ),
          }}
        />
      ) : null}

      <View
        style={{
          alignSelf: "center",
          backgroundColor: theme.global.background,
          flex: 1,
          gap: space.sm,
          maxWidth: 1200,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          width: "100%",
        }}
      >
      {bindings || Platform.OS === "web" ? (
        <View style={{ gap: 10 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <TextInput
              accessibilityLabel="Buscar en Biblioteca"
              onChangeText={setQ}
              placeholder="Buscar por título o etiqueta…"
              placeholderTextColor={theme.global.textMuted}
              style={{
                backgroundColor: theme.global.inputBackground,
                borderColor: theme.global.borderStrong,
                borderRadius: 12,
                borderWidth: 1,
                color: theme.global.textPrimary,
                flex: 1,
                minHeight: 44,
                minWidth: 0,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
              value={q}
            />
            <Pressable
              accessibilityLabel="Abrir opciones de Biblioteca"
              accessibilityRole="button"
              accessibilityState={{ disabled: !preferencesReady }}
              disabled={!preferencesReady}
              focusable
              onPress={() => setOptionsVisible(true)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: preferencesReady
                  ? theme.global.surfaceSecondary
                  : theme.semantic.disabledSurface,
                borderColor: theme.global.borderStrong,
                borderRadius: 12,
                borderWidth: 1,
                flexDirection: "row",
                gap: 8,
                minHeight: 44,
                opacity: !preferencesReady ? 0.5 : pressed ? 0.78 : 1,
                paddingHorizontal: 12,
              })}
            >
              <Ionicons
                color={preferencesReady ? theme.global.textPrimary : theme.semantic.disabledText}
                name="options-outline"
                size={20}
              />
              {(windowWidth >= 420 && fontScale <= 1.3) && <Text
                style={{
                  color: preferencesReady ? theme.global.textPrimary : theme.semantic.disabledText,
                  fontWeight: "800",
                }}
              >
                Opciones
              </Text>}
            </Pressable>
            {!bindings && pickerAction(windowWidth < 850 || fontScale > 1.2)}
            {!bindings && manualAction(windowWidth < 640 || fontScale > 1.2)}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Todos" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
            <Chip label="Planeados" active={statusFilter === "planned"} onPress={() => setStatusFilter("planned")} />
            <Chip label={titleStatusLabel("watching")} active={statusFilter === "watching"} onPress={() => setStatusFilter("watching")} />
            <Chip label="Terminados" active={statusFilter === "done"} onPress={() => setStatusFilter("done")} />
            <Chip label="Abandonados" active={statusFilter === "dropped"} onPress={() => setStatusFilter("dropped")} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {LIBRARY_CLASSIFICATION_FILTERS.map(({ value, label }) => (
              <Chip key={value} label={label} active={classificationFilter === value} onPress={() => setClassificationFilter(value)} />
            ))}
          </View>

        </View>
      ) : null}

      {Platform.OS !== "web" ? (
        <View style={{ gap: 8 }}>
          <ScrollView
            contentContainerStyle={{ gap: 8 }}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            <Chip label="Todos" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
            <Chip label="Planeados" active={statusFilter === "planned"} onPress={() => setStatusFilter("planned")} />
            <Chip label={titleStatusLabel("watching")} active={statusFilter === "watching"} onPress={() => setStatusFilter("watching")} />
            <Chip label="Terminados" active={statusFilter === "done"} onPress={() => setStatusFilter("done")} />
            <Chip label="Abandonados" active={statusFilter === "dropped"} onPress={() => setStatusFilter("dropped")} />
          </ScrollView>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
        <View style={{ flexGrow: 1, flexShrink: 1, gap: space.xs }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space.md, rowGap: space.xs }}>
            {snapshotReady && mediaReady && !mediaError && (
              <Text style={[type.control, { color: theme.global.textPrimary }]}>
                {visibleItems.length} {visibleItems.length === 1 ? "resultado" : "resultados"}
              </Text>
            )}
            {preferencesReady && <Text style={[type.caption, { color: theme.global.textSecondary }]}>Orden: {sortLabel}</Text>}

          </View>
          {activeFilters.length > 0 && (
            <Text style={[type.caption, { color: theme.global.textSecondary }]}>
              Filtros: {activeFilters.join(" · ")}
            </Text>
          )}
        </View>
        {activeFilters.length > 0 && <Chip label="Limpiar filtros" active={false} onPress={clearFilters} />}
      </View>

      <SensitiveFilterStatus active={preference.value.hideSensitive} ready={mediaReady} error={mediaError} onRetry={retryMedia}/>
      {loading || (!mediaReady && !mediaError) ? (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 32 }}>
          <ActivityIndicator color={theme.global.textPrimary} />
          <Text style={{ color: theme.global.textSecondary }}>Cargando Biblioteca…</Text>
        </View>
      ) : snapshotError || !snapshotReady ? (
        <View style={{ alignItems: "flex-start", gap: 10, paddingVertical: 24 }}>
          <Text style={{ color: theme.semantic.dangerText, fontSize: 17, fontWeight: "900" }}>
            No se pudo cargar la Biblioteca
          </Text>
          <Text style={{ color: theme.global.textSecondary }}>
            {snapshotError ?? "El estado de la Biblioteca aún no está disponible."}
          </Text>
          <Pressable
            accessibilityLabel="Reintentar cargar la Biblioteca"
            accessibilityRole="button"
            focusable
            onPress={() => void refresh()}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: theme.global.surfaceSecondary,
              borderColor: theme.global.borderStrong,
              borderRadius: 12,
              borderWidth: 1,
              justifyContent: "center",
              minHeight: 44,
              opacity: pressed ? 0.78 : 1,
              paddingHorizontal: 14,
              paddingVertical: 8,
            })}
          >
            <Text style={{ color: theme.global.textPrimary, fontWeight: "900" }}>Reintentar</Text>
          </Pressable>
        </View>
      ) : mediaError ? null : (
        <FlatList
          columnWrapperStyle={
            gridColumns > 1 ? { gap: gridGap } : undefined
          }
          data={visibleItems}
          key={listLayoutKey}
          keyExtractor={(x) => gridItemKey(x.id)}
          numColumns={gridColumns}
          contentContainerStyle={{ gap: viewMode === "grid" ? gridGap : 10, paddingBottom: 24 }}
          renderItem={({ item }) => {
            if (viewMode === "grid") {
              return (
                <TitleGridCard
                  identity={item.id}
                  accessibilityLabel={savedTitleOpenAccessibilityLabel(item)}
                  isPinned={pinnedAtById.has(item.id)}
                  onPress={() =>
                    router.push({
                      pathname: "/title/[id]",
                      params: { id: item.id, pinContext: "library" },
                    })
                  }
                  posterUrl={item.posterUrl} imageProvider={savedMediaPresentation(item).imageProvider} metadata={savedMediaPresentation(item).metadata}
                  personalRating={item.personalRating}
                  style={{ width: gridCardWidth }}
                  title={item.title}
                  kindLabel={mediaClassificationLabel(item)}
                />
              );
            }

            const overview = item.overview?.trim() ?? "";
            const tagsPreview = (item.tags ?? []).slice(0, 3);

            return (
              <View
                style={{
                  padding: space.md,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: theme.global.border,
                  backgroundColor: theme.global.surface,
                  gap: space.sm,
                }}
              >
                <Pressable
                  accessible
                  accessibilityLabel={savedTitleOpenAccessibilityLabel(item, true)}
                  accessibilityRole="button"
                  focusable
                  onPress={() =>
                    router.push({
                      pathname: "/title/[id]",
                      params: { id: item.id, pinContext: "library" },
                    })
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                >
                  <View
                    accessible={false}
                    aria-hidden
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{ flexDirection: "row", gap: 12 }}
                  >
                    <MediaPoster context="list" identity={item.id} posterUrl={item.posterUrl} imageProvider={savedMediaPresentation(item).imageProvider} metadata={savedMediaPresentation(item).metadata} style={{ width: 70, height: 105, borderRadius: 12 }} />

                    <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                      <Text numberOfLines={2} ellipsizeMode="tail" style={[type.title, { color: theme.global.textPrimary }]}>
                        {item.title}
                        {item.year ? ` (${item.year})` : ""}
                      </Text>

                      <Text style={[type.caption, { color: theme.global.textSecondary }]}>{mediaClassificationLabel(item)}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.xs }}>
                        <Pill text={titleStatusLabel(item.status, item.medium)} />
                        <PersonalRatingBadge value={item.personalRating} showPersonalLabel />
                      </View>
                      <PublicRating value={savedMediaPresentation(item).rating} />

                      {!!overview && (
                        <Text style={[type.caption, { color: theme.global.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">
                          {overview}
                        </Text>
                      )}

                      {tagsPreview.length > 0 && (
                        <Text style={[type.caption, { color: theme.global.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                          Etiquetas: {tagsPreview.join(", ")}
                          {item.tags.length > 3 ? "…" : ""}
                        </Text>
                      )}
                    </View>
                  </View>
                </Pressable>

                <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap", alignItems: "center" }}>
                  <Pressable
                    accessibilityLabel={
                      item.status === "done"
                        ? `Marcar ${item.title} como planeado`
                        : `Marcar ${item.title} como terminado`
                    }
                    accessibilityRole="button"
                    focusable
                    onPress={() => toggleDone(item)}
                    style={({ pressed }) => [{
                      minHeight: controlTarget,
                      justifyContent: "center",
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      backgroundColor: theme.global.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: theme.global.borderStrong,
                    }, pressed && pressedFeedback]}
                  >
                    <Text style={{ color: theme.global.textPrimary, fontWeight: "800" }}>
                      {item.status === "done"
                        ? "Marcar como planeado"
                        : "Marcar como terminado"}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityLabel={
                      pinnedAtById.has(item.id)
                        ? "Desfijar de Biblioteca"
                        : "Fijar en Biblioteca"
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: pinnedAtById.has(item.id) }}
                    focusable
                    onPress={() => toggleLibraryPin(item.id)}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: theme.global.surfaceSecondary,
                      borderColor: theme.global.borderStrong,
                      borderRadius: 12,
                      borderWidth: 1,
                      justifyContent: "center",
                      minHeight: 44,
                      opacity: pressed ? 0.78 : 1,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    })}
                  >
                    <Text
                      style={{
                        color: theme.global.textPrimary,
                        fontWeight: "800",
                      }}
                    >
                      {pinnedAtById.has(item.id) ? "Desfijar" : "Fijar"}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityLabel={`Borrar ${item.title}`}
                    accessibilityRole="button"
                    focusable
                    onPress={() => remove(item.id)}
                    style={({ pressed }) => [{
                      alignItems: "center",
                      minHeight: controlTarget,
                      minWidth: controlTarget,
                      justifyContent: "center",
                      borderRadius: radius.control,
                      marginLeft: "auto",
                    }, pressed && pressedFeedback]}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.global.textSecondary} />
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: space.xl, gap: space.sm, alignItems: "flex-start" }}>
              <Text accessibilityRole="header" style={[type.heading, { color: theme.global.textPrimary }]}>
                {items.length === 0 ? "Tu Biblioteca está vacía" :
                  activeFilters.length ? "No hay coincidencias" : "No hay títulos visibles"}
              </Text>
              {items.length === 0 && !bindings && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  <Chip label="Buscar" active={false} onPress={() => router.push("/buscar")} />
                  {manualAction(false)}
                </View>
              )}
              {items.length > 0 && activeFilters.length > 0 &&
                <Chip label="Limpiar filtros" active={false} onPress={clearFilters} />}
            </View>
          }
        />
      )}

      <ViewOptionsPanel
        onClose={() => setOptionsVisible(false)}
        sections={optionSections}
        visible={optionsVisible}
      />
      </View>
    </>
  );
}

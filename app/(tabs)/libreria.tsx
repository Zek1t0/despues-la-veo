import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { deleteSavedTitle, listSavedTitles, upsertSavedTitle } from "../../src/storage/savedTitlesRepo";
import type { SavedTitle, TitleStatus, TitleType } from "../../src/core/savedTitle";
import { titleStatusLabel, titleTypeLabel } from "../../src/core/presentationLabels";
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
import { colors } from "../../src/theme/colors";
import {
  TitleGridCard,
  ViewOptionsPanel,
  type ViewOptionsSection,
} from "../../src/components/browsing";

type StatusFilter = "all" | TitleStatus;
type TypeFilter = "all" | TitleType;

const SPANISH_TITLE_COLLATOR = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function compareTitleThenId(a: SavedTitle, b: SavedTitle): number {
  return SPANISH_TITLE_COLLATOR.compare(a.title, b.title) || a.id.localeCompare(b.id);
}

function compareOptionalNumberDescending(
  a: number | null | undefined,
  b: number | null | undefined
): number {
  const aPresent = typeof a === "number" && Number.isFinite(a);
  const bPresent = typeof b === "number" && Number.isFinite(b);
  if (aPresent && bPresent) return b - a;
  if (aPresent) return -1;
  if (bPresent) return 1;
  return 0;
}

function compareLibraryTitles(a: SavedTitle, b: SavedTitle, sort: LibrarySort): number {
  let primary = 0;

  switch (sort) {
    case "updated-desc":
      primary = b.updatedAt - a.updatedAt;
      break;
    case "title-asc":
      primary = SPANISH_TITLE_COLLATOR.compare(a.title, b.title);
      break;
    case "title-desc":
      primary = SPANISH_TITLE_COLLATOR.compare(b.title, a.title);
      break;
    case "rating-desc":
      primary = compareOptionalNumberDescending(a.voteAverage, b.voteAverage);
      break;
    case "year-desc":
      primary = compareOptionalNumberDescending(a.year, b.year);
      break;
  }

  return primary || compareTitleThenId(a, b);
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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
  const { width: windowWidth } = useWindowDimensions();

  const [items, setItems] = useState<SavedTitle[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
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
            indicator: <Ionicons color={colors.muted} name="list-outline" size={24} />,
          },
          {
            id: "grid",
            title: "Mosaico",
            accessibilityLabel: "Mostrar Biblioteca en mosaico",
            indicator: <Ionicons color={colors.muted} name="grid-outline" size={24} />,
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
          { id: "rating-desc", title: "Mayor puntuación" },
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
          { id: "watching", title: "Viendo" },
          { id: "done", title: "Terminados" },
          { id: "dropped", title: "Abandonados" },
        ],
      },
      {
        presentation: "compact",
        id: "type",
        title: "Tipo",
        selectedId: typeFilter,
        onSelect: (optionId) => {
          if (optionId === "all" || optionId === "movie" || optionId === "tv") {
            setTypeFilter(optionId);
          }
        },
        options: [
          { id: "all", title: "Todos" },
          { id: "movie", title: "Películas" },
          { id: "tv", title: "Series" },
        ],
      },
    ],
    [selectSort, selectViewMode, sort, statusFilter, typeFilter, viewMode]
  );

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

  const visibleItems = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("es");

    const matchingItems = items.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (typeFilter !== "all" && it.type !== typeFilter) return false;

      if (!needle) return true;
      const inTitle = it.title.toLocaleLowerCase("es").includes(needle);
      const inTags = (it.tags ?? []).some((t) =>
        t.toLocaleLowerCase("es").includes(needle)
      );
      return inTitle || inTags;
    });

    return [...matchingItems].sort((a, b) => compareLibraryTitles(a, b, sort));
  }, [items, q, sort, statusFilter, typeFilter]);

  const gridGap = 12;
  const availableListWidth = Math.max(0, Math.min(windowWidth - 32, 1168));
  const gridColumns =
    viewMode === "grid"
      ? Math.max(
          1,
          Math.min(6, Math.floor((availableListWidth + gridGap) / (150 + gridGap)))
        )
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

  const closeMobileSearch = () => {
    setQ("");
    setIsSearchActive(false);
  };

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
      <Ionicons color={colors.text} name="options-outline" size={23} />
    </Pressable>
  );

  return (
    <>
      {Platform.OS !== "web" ? (
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
                    <Ionicons color={colors.text} name="arrow-back" size={24} />
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
                  placeholderTextColor={colors.subtle}
                  style={{
                    backgroundColor: colors.input,
                    borderColor: colors.border2,
                    borderRadius: 10,
                    borderWidth: 1,
                    color: colors.text,
                    flex: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    width: "100%",
                  }}
                  value={q}
                />
              ) : (
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
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
                    <Ionicons color={colors.text} name="search" size={22} />
                  </Pressable>
                ) : null}
                {renderMobileOptionsButton()}
              </View>
            ),
          }}
        />
      ) : null}

      <View
        style={{
          alignSelf: "center",
          flex: 1,
          gap: 12,
          maxWidth: 1200,
          padding: 16,
          width: "100%",
        }}
      >
      {Platform.OS === "web" ? (
        <View style={{ gap: 10 }}>
          <View style={{ alignItems: "flex-end" }}>
            <Pressable
              accessibilityLabel="Abrir opciones de Biblioteca"
              accessibilityRole="button"
              accessibilityState={{ disabled: !preferencesReady }}
              disabled={!preferencesReady}
              focusable
              onPress={() => setOptionsVisible(true)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: colors.card2,
                borderColor: colors.border2,
                borderRadius: 12,
                borderWidth: 1,
                flexDirection: "row",
                gap: 8,
                minHeight: 44,
                opacity: !preferencesReady ? 0.5 : pressed ? 0.78 : 1,
                paddingHorizontal: 12,
              })}
            >
              <Ionicons color={colors.text} name="options-outline" size={20} />
              <Text style={{ color: colors.text, fontWeight: "800" }}>Opciones</Text>
            </Pressable>
          </View>

          <TextInput
            accessibilityLabel="Buscar en Biblioteca"
            onChangeText={setQ}
            placeholder="Buscar por título o etiqueta…"
            placeholderTextColor={colors.subtle}
            style={{
              backgroundColor: colors.input,
              borderColor: colors.border2,
              borderRadius: 12,
              borderWidth: 1,
              color: colors.text,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
            value={q}
          />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Todos" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
            <Chip label="Planeados" active={statusFilter === "planned"} onPress={() => setStatusFilter("planned")} />
            <Chip label="Viendo" active={statusFilter === "watching"} onPress={() => setStatusFilter("watching")} />
            <Chip label="Terminados" active={statusFilter === "done"} onPress={() => setStatusFilter("done")} />
            <Chip label="Abandonados" active={statusFilter === "dropped"} onPress={() => setStatusFilter("dropped")} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Todos los tipos" active={typeFilter === "all"} onPress={() => setTypeFilter("all")} />
            <Chip label="Películas" active={typeFilter === "movie"} onPress={() => setTypeFilter("movie")} />
            <Chip label="Series" active={typeFilter === "tv"} onPress={() => setTypeFilter("tv")} />
          </View>

          <Text style={{ color: colors.subtle, fontWeight: "700" }}>
            Mostrando {visibleItems.length} de {items.length}
          </Text>
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
            <Chip label="Viendo" active={statusFilter === "watching"} onPress={() => setStatusFilter("watching")} />
            <Chip label="Terminados" active={statusFilter === "done"} onPress={() => setStatusFilter("done")} />
            <Chip label="Abandonados" active={statusFilter === "dropped"} onPress={() => setStatusFilter("dropped")} />
          </ScrollView>
          <Text style={{ color: colors.subtle, fontWeight: "700" }}>
            Mostrando {visibleItems.length} de {items.length}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 32 }}>
          <ActivityIndicator color={colors.text} />
          <Text style={{ color: colors.muted }}>Cargando Biblioteca…</Text>
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={
            gridColumns > 1 ? { gap: gridGap } : undefined
          }
          data={visibleItems}
          key={listLayoutKey}
          keyExtractor={(x) => x.id}
          numColumns={gridColumns}
          contentContainerStyle={{ gap: viewMode === "grid" ? gridGap : 10, paddingBottom: 24 }}
          renderItem={({ item }) => {
            if (viewMode === "grid") {
              return (
                <TitleGridCard
                  accessibilityLabel={`Abrir ${titleTypeLabel(item.type)} ${item.title}`}
                  onPress={() => router.push(`/title/${item.id}`)}
                  posterUrl={item.posterUrl}
                  style={{ width: gridCardWidth }}
                  title={item.title}
                  type={item.type}
                />
              );
            }

            const rating = typeof item.voteAverage === "number" ? item.voteAverage.toFixed(1) : null;
            const overview = item.overview?.trim() ?? "";
            const tagsPreview = (item.tags ?? []).slice(0, 3);

            return (
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
                <Pressable
                  accessibilityLabel={`Abrir ${titleTypeLabel(item.type)} ${item.title}`}
                  accessibilityRole="button"
                  focusable
                  onPress={() => router.push(`/title/${item.id}`)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
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
                        <Pill text={titleTypeLabel(item.type)} />
                        <Pill text={`Estado: ${titleStatusLabel(item.status)}`} />
                        {rating && <Pill text={`⭐ ${rating}/10`} />}
                      </View>

                      {!!overview && (
                        <Text style={{ color: colors.muted }} numberOfLines={3}>
                          {overview}
                        </Text>
                      )}

                      {tagsPreview.length > 0 && (
                        <Text style={{ color: colors.subtle }} numberOfLines={1}>
                          Etiquetas: {tagsPreview.join(", ")}
                          {item.tags.length > 3 ? "…" : ""}
                        </Text>
                      )}
                    </View>
                  </View>
                </Pressable>

                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Pressable
                    accessibilityLabel={
                      item.status === "done"
                        ? `Marcar ${item.title} como planeado`
                        : `Marcar ${item.title} como terminado`
                    }
                    accessibilityRole="button"
                    focusable
                    onPress={() => toggleDone(item)}
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      backgroundColor: colors.card2,
                      borderWidth: 1,
                      borderColor: colors.border2,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      {item.status === "done"
                        ? "Marcar como planeado"
                        : "Marcar como terminado"}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityLabel={`Borrar ${item.title}`}
                    accessibilityRole="button"
                    focusable
                    onPress={() => remove(item.id)}
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
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
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 20, gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {items.length === 0 ? "Tu Biblioteca está vacía" : "No hay resultados"}
              </Text>
              <Text style={{ color: colors.muted }}>
                {items.length === 0
                  ? "Los títulos que guardes aparecerán acá."
                  : "Probá cambiar la búsqueda o los filtros."}
              </Text>
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

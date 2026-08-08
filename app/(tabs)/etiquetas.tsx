import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Tabs, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  TagCollage,
  TitleGridCard,
  ViewOptionsPanel,
  type ViewOptionsSection,
} from "../../src/components/browsing";
import { titleStatusLabel, titleTypeLabel } from "../../src/core/presentationLabels";
import type { SavedTitle } from "../../src/core/savedTitle";
import {
  VIEW_PREFERENCE_DEFAULTS,
  type LibraryViewMode,
  type TagsSort,
  type TagsViewMode,
} from "../../src/core/viewPreferences";
import { listSavedTitles } from "../../src/storage/savedTitlesRepo";
import { getViewPreference, setViewPreference } from "../../src/storage/viewPreferencesRepo";
import { colors } from "../../src/theme/colors";

type TagInfo = { tag: string; items: SavedTitle[]; count: number };

const SPANISH_COLLATOR = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function compareExactSpanish(a: string, b: string): number {
  const localeResult =
    SPANISH_COLLATOR.compare(a, b) ||
    a.localeCompare(b, "es", { sensitivity: "variant" });
  if (localeResult !== 0) return localeResult;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareTags(a: TagInfo, b: TagInfo, sort: TagsSort): number {
  if (sort === "count-desc") {
    return b.count - a.count || compareExactSpanish(a.tag, b.tag);
  }
  return sort === "name-asc"
    ? compareExactSpanish(a.tag, b.tag)
    : compareExactSpanish(b.tag, a.tag);
}

function normalizeTagSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function compareTitlesForCollage(a: SavedTitle, b: SavedTitle): number {
  return (
    b.updatedAt - a.updatedAt ||
    compareExactSpanish(a.title, b.title) ||
    a.id.localeCompare(b.id)
  );
}

function selectCollageTitles(tagItems: readonly SavedTitle[]): SavedTitle[] {
  return [...tagItems].sort(compareTitlesForCollage).slice(0, 4);
}

function tagCountLabel(count: number): string {
  return count === 1 ? "1 título" : `${count} títulos`;
}

function tagsSummaryLabel(visibleCount: number, totalCount: number, hasQuery: boolean): string {
  const noun = totalCount === 1 ? "etiqueta" : "etiquetas";
  return hasQuery ? `${visibleCount} de ${totalCount} ${noun}` : `${totalCount} ${noun}`;
}

function TagGridCard({
  info,
  onPress,
  style,
}: {
  info: TagInfo;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const collageItems = selectCollageTitles(info.items).map((item) => ({
    id: item.id,
    posterUrl: item.posterUrl,
  }));

  return (
    <Pressable
      accessibilityLabel={`Abrir etiqueta ${info.tag}, ${tagCountLabel(info.count)}`}
      accessibilityRole="button"
      focusable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card2,
          borderColor: colors.border,
          borderRadius: 16,
          borderWidth: 1,
          opacity: pressed ? 0.82 : 1,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <TagCollage items={collageItems} />
      <View
        accessible={false}
        pointerEvents="none"
        style={{ backgroundColor: "rgba(11, 11, 11, 0.94)", gap: 3, padding: 12 }}
      >
        <Text numberOfLines={2} style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
          {info.tag}
        </Text>
        <Text style={{ color: colors.muted, fontWeight: "700" }}>
          {tagCountLabel(info.count)}
        </Text>
      </View>
    </Pressable>
  );
}

function TagListRow({ info, onPress }: { info: TagInfo; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Abrir etiqueta ${info.tag}, ${tagCountLabel(info.count)}`}
      accessibilityRole="button"
      focusable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: colors.card2,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        gap: 12,
        minHeight: 56,
        opacity: pressed ? 0.82 : 1,
        padding: 12,
      })}
    >
      <View accessible={false} pointerEvents="none" style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900" }}>
          {info.tag}
        </Text>
        <Text style={{ color: colors.muted, fontWeight: "700" }}>
          {tagCountLabel(info.count)}
        </Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={20} />
    </Pressable>
  );
}

function DetailTitleRow({ item, onPress }: { item: SavedTitle; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Abrir ${titleTypeLabel(item.type)} ${item.title}`}
      accessibilityRole="button"
      focusable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.card2,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        gap: 5,
        opacity: pressed ? 0.82 : 1,
        padding: 12,
      })}
    >
      <Text numberOfLines={2} style={{ color: colors.text, fontWeight: "900" }}>
        {item.title}{item.year ? ` (${item.year})` : ""}
      </Text>
      <Text style={{ color: colors.muted, fontWeight: "700" }}>
        {titleTypeLabel(item.type)} · {titleStatusLabel(item.status)}
      </Text>
    </Pressable>
  );
}

export default function EtiquetasScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [items, setItems] = useState<SavedTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [sort, setSort] = useState<TagsSort>(VIEW_PREFERENCE_DEFAULTS["tags.sort"]);
  const [viewMode, setViewMode] = useState<TagsViewMode>(
    VIEW_PREFERENCE_DEFAULTS["tags.viewMode"]
  );
  const [libraryViewMode, setLibraryViewMode] = useState<LibraryViewMode>(
    VIEW_PREFERENCE_DEFAULTS["library.viewMode"]
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const confirmedViewMode = useRef<TagsViewMode>(VIEW_PREFERENCE_DEFAULTS["tags.viewMode"]);
  const confirmedSort = useRef<TagsSort>(VIEW_PREFERENCE_DEFAULTS["tags.sort"]);
  const latestViewMode = useRef<TagsViewMode>(VIEW_PREFERENCE_DEFAULTS["tags.viewMode"]);
  const latestSort = useRef<TagsSort>(VIEW_PREFERENCE_DEFAULTS["tags.sort"]);
  const viewModeWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const sortWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const viewModeSelectionId = useRef(0);
  const sortSelectionId = useRef(0);
  const mounted = useRef(true);

  const showPreferenceError = useCallback((preference: "apariencia" | "orden") => {
    const message = `No se pudo guardar el ${preference}. Se restauró el último valor guardado.`;
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
        getViewPreference("tags.viewMode"),
        getViewPreference("tags.sort"),
      ]);
      if (!active) return;

      const loadedViewMode =
        viewResult.status === "fulfilled"
          ? viewResult.value
          : VIEW_PREFERENCE_DEFAULTS["tags.viewMode"];
      const loadedSort =
        sortResult.status === "fulfilled"
          ? sortResult.value
          : VIEW_PREFERENCE_DEFAULTS["tags.sort"];
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
    (next: TagsViewMode) => {
      if (!preferencesReady || next === latestViewMode.current) return;
      const selectionId = ++viewModeSelectionId.current;
      latestViewMode.current = next;
      setViewMode(next);
      viewModeWriteQueue.current = viewModeWriteQueue.current
        .then(async () => {
          try {
            await setViewPreference("tags.viewMode", next);
            confirmedViewMode.current = next;
          } catch (error) {
            console.error("No se pudo guardar la apariencia de Etiquetas.", error);
            if (selectionId !== viewModeSelectionId.current || !mounted.current) return;
            latestViewMode.current = confirmedViewMode.current;
            setViewMode(confirmedViewMode.current);
            showPreferenceError("apariencia");
          }
        })
        .catch((error) => {
          console.error("Falló inesperadamente la cola de apariencia de Etiquetas.", error);
        });
    },
    [preferencesReady, showPreferenceError]
  );

  const selectSort = useCallback(
    (next: TagsSort) => {
      if (!preferencesReady || next === latestSort.current) return;
      const selectionId = ++sortSelectionId.current;
      latestSort.current = next;
      setSort(next);
      sortWriteQueue.current = sortWriteQueue.current
        .then(async () => {
          try {
            await setViewPreference("tags.sort", next);
            confirmedSort.current = next;
          } catch (error) {
            console.error("No se pudo guardar el orden de Etiquetas.", error);
            if (selectionId !== sortSelectionId.current || !mounted.current) return;
            latestSort.current = confirmedSort.current;
            setSort(confirmedSort.current);
            showPreferenceError("orden");
          }
        })
        .catch((error) => {
          console.error("Falló inesperadamente la cola de orden de Etiquetas.", error);
        });
    },
    [preferencesReady, showPreferenceError]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function refresh() {
        setLoading(true);
        const [titlesResult, libraryViewResult] = await Promise.allSettled([
          listSavedTitles(),
          getViewPreference("library.viewMode"),
        ]);
        if (!active) return;
        if (titlesResult.status === "fulfilled") {
          setItems(titlesResult.value);
        } else {
          console.error("No se pudieron recargar las etiquetas.", titlesResult.reason);
          setItems([]);
        }
        setLibraryViewMode(
          libraryViewResult.status === "fulfilled"
            ? libraryViewResult.value
            : VIEW_PREFERENCE_DEFAULTS["library.viewMode"]
        );
        setLoading(false);
      }

      void refresh();
      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!selectedTag) return;
    let active = true;

    async function refreshInheritedViewMode() {
      try {
        const inherited = await getViewPreference("library.viewMode");
        if (active) setLibraryViewMode(inherited);
      } catch (error) {
        console.error("No se pudo leer la apariencia heredada de Biblioteca.", error);
        if (active) setLibraryViewMode(VIEW_PREFERENCE_DEFAULTS["library.viewMode"]);
      }
    }

    void refreshInheritedViewMode();
    return () => {
      active = false;
    };
  }, [selectedTag]);

  const tagMap = useMemo(() => {
    const map = new Map<string, SavedTitle[]>();
    for (const item of items) {
      const titleTags = new Set<string>();
      for (const storedTag of item.tags ?? []) {
        const tag = storedTag.trim();
        if (!tag || titleTags.has(tag)) continue;
        titleTags.add(tag);
        const tagItems = map.get(tag) ?? [];
        tagItems.push(item);
        map.set(tag, tagItems);
      }
    }
    return map;
  }, [items]);

  const allTags = useMemo<TagInfo[]>(() => {
    const result = Array.from(tagMap, ([tag, tagItems]) => ({
      tag,
      items: tagItems,
      count: tagItems.length,
    }));
    return result.sort((a, b) => compareTags(a, b, sort));
  }, [sort, tagMap]);

  const visibleTags = useMemo(() => {
    const needle = normalizeTagSearch(q.trim());
    if (!needle) return allTags;
    return allTags.filter((info) => normalizeTagSearch(info.tag).includes(needle));
  }, [allTags, q]);

  const selectedItems = useMemo(() => {
    if (!selectedTag) return [];
    return [...(tagMap.get(selectedTag) ?? [])].sort(compareTitlesForCollage);
  }, [selectedTag, tagMap]);

  const optionSections = useMemo<ViewOptionsSection[]>(
    () => [
      {
        presentation: "layout",
        id: "appearance",
        title: "Apariencia",
        selectedId: viewMode,
        onSelect: (id) => {
          if (id === "grid" || id === "list") selectViewMode(id);
        },
        options: [
          {
            id: "grid",
            title: "Mosaico",
            accessibilityLabel: "Mostrar etiquetas en mosaico",
            indicator: <Ionicons color={colors.muted} name="grid-outline" size={24} />,
          },
          {
            id: "list",
            title: "Lista",
            accessibilityLabel: "Mostrar etiquetas en lista",
            indicator: <Ionicons color={colors.muted} name="list-outline" size={24} />,
          },
        ],
      },
      {
        presentation: "compact",
        id: "sort",
        title: "Ordenar",
        selectedId: sort,
        onSelect: (id) => {
          if (id === "count-desc" || id === "name-asc" || id === "name-desc") {
            selectSort(id);
          }
        },
        options: [
          { id: "count-desc", title: "Mayor cantidad de títulos" },
          { id: "name-asc", title: "Nombre A–Z" },
          { id: "name-desc", title: "Nombre Z–A" },
        ],
      },
    ],
    [selectSort, selectViewMode, sort, viewMode]
  );

  const gap = 12;
  const availableWidth = Math.max(0, Math.min(windowWidth - 32, 1168));
  const minimumTagCardWidth = 150;
  const wideTagCardWidth = 290;
  const canFitTwoTagCards = availableWidth >= minimumTagCardWidth * 2 + gap;
  const canFitThreeWideTagCards = availableWidth >= wideTagCardWidth * 3 + gap * 2;
  const tagGridColumns = canFitThreeWideTagCards ? 3 : canFitTwoTagCards ? 2 : 1;
  const tagColumns = viewMode === "grid" ? tagGridColumns : 1;
  const tagCardWidth = Math.floor((availableWidth - gap * (tagColumns - 1)) / tagColumns);
  const tagListKey = `${viewMode}-${tagColumns}`;
  const titleGridColumns = Math.max(
    1,
    Math.min(6, Math.floor((availableWidth + gap) / (150 + gap)))
  );
  const titleColumns = libraryViewMode === "grid" ? titleGridColumns : 1;
  const titleCardWidth = Math.floor(
    (availableWidth - gap * (titleColumns - 1)) / titleColumns
  );
  const titleListKey = `${libraryViewMode}-${titleColumns}`;

  const onChangeQuery = (text: string) => {
    setQ(text);
    if (selectedTag) setSelectedTag(null);
  };

  const closeMobileSearch = () => {
    setQ("");
    setIsSearchActive(false);
  };

  const openOptionsButton = (withLabel: boolean) => selectedTag ? null : (
    <Pressable
      accessibilityLabel="Abrir opciones de Etiquetas"
      accessibilityRole="button"
      accessibilityState={{ disabled: !preferencesReady }}
      disabled={!preferencesReady}
      focusable
      hitSlop={6}
      onPress={() => setOptionsVisible(true)}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: withLabel ? colors.card2 : "transparent",
        borderColor: colors.border2,
        borderRadius: 12,
        borderWidth: withLabel ? 1 : 0,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        minHeight: 44,
        minWidth: 44,
        opacity: !preferencesReady ? 0.45 : pressed ? 0.72 : 1,
        paddingHorizontal: withLabel ? 12 : 0,
      })}
    >
      <Ionicons color={colors.text} name="options-outline" size={22} />
      {withLabel ? <Text style={{ color: colors.text, fontWeight: "800" }}>Opciones</Text> : null}
    </Pressable>
  );

  const listHeader = selectedTag ? (
    <View style={{ gap: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <Text numberOfLines={2} style={{ color: colors.text, flex: 1, flexShrink: 1, fontSize: 18, fontWeight: "900" }}>
          Títulos con: {selectedTag}
        </Text>
        <Pressable
          accessibilityLabel="Volver a la lista de etiquetas"
          accessibilityRole="button"
          focusable
          onPress={() => setSelectedTag(null)}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.card2,
            borderColor: colors.border2,
            borderRadius: 10,
            borderWidth: 1,
            minHeight: 44,
            justifyContent: "center",
            opacity: pressed ? 0.72 : 1,
            paddingHorizontal: 12,
          })}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>Volver</Text>
        </Pressable>
      </View>
    </View>
  ) : (
    <View>
      <Text style={{ color: colors.muted }}>
        {tagsSummaryLabel(visibleTags.length, allTags.length, q.trim().length > 0)}
      </Text>
    </View>
  );

  return (
    <>
      {Platform.OS !== "web" ? (
        <Tabs.Screen
          options={{
            headerLeft: isSearchActive
              ? () => (
                  <Pressable
                    accessibilityLabel="Cerrar búsqueda de etiquetas"
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
                  accessibilityLabel="Buscar etiquetas"
                  autoFocus
                  onChangeText={onChangeQuery}
                  placeholder="Buscar etiqueta…"
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
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Etiquetas</Text>
              ),
            headerRight: () => (
              <View style={{ flexDirection: "row", gap: 4 }}>
                {!isSearchActive ? (
                  <Pressable
                    accessibilityLabel="Buscar etiquetas"
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
                {openOptionsButton(false)}
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
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <TextInput
              accessibilityLabel="Buscar etiquetas"
              onChangeText={onChangeQuery}
              placeholder="Buscar etiqueta…"
              placeholderTextColor={colors.subtle}
              style={{
                backgroundColor: colors.input,
                borderColor: colors.border2,
                borderRadius: 12,
                borderWidth: 1,
                color: colors.text,
                flex: 1,
                minHeight: 44,
                paddingHorizontal: 12,
              }}
              value={q}
            />
            {openOptionsButton(true)}
          </View>
        ) : null}

        {loading ? (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 32 }}>
            <ActivityIndicator color={colors.text} />
            <Text style={{ color: colors.muted }}>Cargando etiquetas…</Text>
          </View>
        ) : selectedTag ? (
          <FlatList
            ListEmptyComponent={
              <View style={{ gap: 8, paddingVertical: 24 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                  Esta etiqueta ya no tiene títulos
                </Text>
                <Text style={{ color: colors.muted }}>
                  Volvé a la lista para elegir otra etiqueta.
                </Text>
              </View>
            }
            ListHeaderComponent={listHeader}
            columnWrapperStyle={titleColumns > 1 ? { gap } : undefined}
            contentContainerStyle={{ gap, paddingBottom: 32 }}
            data={selectedItems}
            key={titleListKey}
            keyExtractor={(item) => item.id}
            numColumns={titleColumns}
            renderItem={({ item }) =>
              libraryViewMode === "grid" ? (
                <TitleGridCard
                  accessibilityLabel={`Abrir ${titleTypeLabel(item.type)} ${item.title}`}
                  onPress={() => router.push(`/title/${item.id}`)}
                  posterUrl={item.posterUrl}
                  style={{ width: titleCardWidth }}
                  title={item.title}
                  type={item.type}
                />
              ) : (
                <DetailTitleRow item={item} onPress={() => router.push(`/title/${item.id}`)} />
              )
            }
          />
        ) : (
          <FlatList
            ListEmptyComponent={
              <View style={{ gap: 8, paddingVertical: 24 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                  {allTags.length === 0 ? "Todavía no hay etiquetas" : "No hay coincidencias"}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {allTags.length === 0
                    ? "Agregá etiquetas desde el detalle de un título de tu biblioteca."
                    : "Probá con otro nombre de etiqueta."}
                </Text>
              </View>
            }
            ListHeaderComponent={listHeader}
            columnWrapperStyle={tagColumns > 1 ? { gap } : undefined}
            contentContainerStyle={{ gap, paddingBottom: 32 }}
            data={visibleTags}
            key={tagListKey}
            keyExtractor={(info) => info.tag}
            numColumns={tagColumns}
            renderItem={({ item }) =>
              viewMode === "grid" ? (
                <TagGridCard
                  info={item}
                  onPress={() => setSelectedTag(item.tag)}
                  style={{ width: tagCardWidth }}
                />
              ) : (
                <TagListRow info={item} onPress={() => setSelectedTag(item.tag)} />
              )
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

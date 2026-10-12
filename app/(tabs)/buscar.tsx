import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View, Image, Linking, Platform, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ProviderSearchResult } from "../../src/providers/providerContracts";
import { tmdbMovieSearchCapability, tmdbTvSearchCapability } from "../../src/providers/tmdb/tmdbAdapter";
import { productionSearchCategories, resolveProductionSearchCategory, type ResolvedSearchCategory, type SearchCategory, type SearchCategoryId } from "../../src/components/search/searchCategories";
import { useCategorySearch } from "../../src/components/search/useCategorySearch";
import type { TmdbCredentialSnapshot } from "../../src/providers/tmdb/credential/tmdbCredentialTypes";
import {
  VIEW_PREFERENCE_DEFAULTS,
  type SearchViewMode,
} from "../../src/core/viewPreferences";
import {
  getViewPreference,
  setViewPreference,
} from "../../src/storage/viewPreferencesRepo";
import {
  TitleGridCard,
  ViewOptionsPanel,
  type ViewOptionsSection,
} from "../../src/components/browsing";
import { useAppTheme } from "../../src/theme/AppThemeProvider";
import { useTmdbCredential } from "../../src/providers/tmdb/credential/TmdbCredentialProvider";
import {
  presentTmdbRemoteError,
  TMDB_SETTINGS_ROUTE,
  TMDB_TOKEN_URL,
} from "../../src/providers/tmdb/credential/tmdbCredentialUi";
const tmdbSearchCapabilities = { movie: tmdbMovieSearchCapability, tv: tmdbTvSearchCapability };
const resolveProductionCategory = (id: SearchCategoryId) =>
  resolveProductionSearchCategory(id, Platform.OS, tmdbSearchCapabilities);

type TmdbSearchConfiguration = Readonly<{
  snapshot: TmdbCredentialSnapshot;
  retryInitialization: () => Promise<TmdbCredentialSnapshot>;
}>;

/** Only the production TMDB shell subscribes to its credential context. */
export default function ExploreScreen() {
  const tmdb = useTmdbCredential();
  return <SearchScreen categories={productionSearchCategories(Platform.OS)} resolveCategory={resolveProductionCategory} tmdb={tmdb} />;
}

/** Application search UI; test-only bindings need no credential provider. */
export function SearchScreen({ categories, resolveCategory, tmdb, initialCategory = "movie" }: Readonly<{
  categories: readonly SearchCategory[];
  resolveCategory: (id: SearchCategoryId) => ResolvedSearchCategory | null;
  tmdb?: TmdbSearchConfiguration;
  initialCategory?: SearchCategoryId;
}>) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const snapshot = tmdb?.snapshot;
  const [categoryId, setCategoryId] = useState<SearchCategoryId>(initialCategory);
  const selected = resolveCategory(categoryId);
  const isTmdb = selected?.category.source === "tmdb";
  const { width: windowWidth } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [searchRetry, setSearchRetry] = useState(0);
  const [viewMode, setViewMode] = useState<SearchViewMode>(
    VIEW_PREFERENCE_DEFAULTS["search.viewMode"]
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const confirmedViewMode = useRef<SearchViewMode>(
    VIEW_PREFERENCE_DEFAULTS["search.viewMode"]
  );
  const latestViewMode = useRef<SearchViewMode>(
    VIEW_PREFERENCE_DEFAULTS["search.viewMode"]
  );
  const viewModeWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const viewModeSelectionId = useRef(0);
  const mounted = useRef(true);

  const showPreferenceError = useCallback(() => {
    const message = "No se pudo guardar la apariencia. Se restauró el último valor guardado.";
    if (Platform.OS === "web") {
      window.alert(message);
      return;
    }
    Alert.alert("Error al guardar", message);
  }, []);

  useEffect(() => {
    let active = true;
    mounted.current = true;

    async function loadViewMode() {
      const result = await Promise.allSettled([
        getViewPreference("search.viewMode"),
      ]);
      if (!active) return;

      const loadedViewMode =
        result[0].status === "fulfilled"
          ? result[0].value
          : VIEW_PREFERENCE_DEFAULTS["search.viewMode"];
      confirmedViewMode.current = loadedViewMode;
      latestViewMode.current = loadedViewMode;
      setViewMode(loadedViewMode);
      setPreferencesReady(true);
    }

    void loadViewMode();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  const selectViewMode = useCallback(
    (next: SearchViewMode) => {
      if (!preferencesReady || next === latestViewMode.current) return;

      const selectionId = ++viewModeSelectionId.current;
      latestViewMode.current = next;
      setViewMode(next);

      viewModeWriteQueue.current = viewModeWriteQueue.current
        .then(async () => {
          try {
            await setViewPreference("search.viewMode", next);
            confirmedViewMode.current = next;
          } catch (error) {
            console.error("No se pudo guardar la apariencia de Buscar.", error);
            if (selectionId !== viewModeSelectionId.current || !mounted.current) return;

            latestViewMode.current = confirmedViewMode.current;
            setViewMode(confirmedViewMode.current);
            showPreferenceError();
          }
        })
        .catch((error) => {
          console.error("Falló inesperadamente la cola de apariencia de Buscar.", error);
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
            selectViewMode(optionId);
          }
        },
        options: [
          {
            id: "detail",
            title: "Detalle",
            accessibilityLabel: "Mostrar resultados de Buscar en detalle",
            indicator: <Ionicons color={theme.global.textSecondary} name="list-outline" size={24} />,
          },
          {
            id: "grid",
            title: "Mosaico",
            accessibilityLabel: "Mostrar resultados de Buscar en mosaico",
            indicator: <Ionicons color={theme.global.textSecondary} name="grid-outline" size={24} />,
          },
        ],
      },
    ],
    [selectViewMode, theme.global.textSecondary, viewMode]
  );

  const gridGap = 12;
  const availableWidth = Math.max(0, Math.min(windowWidth - 32, 1168));
  const responsiveGridColumns = Math.max(
    1,
    Math.min(6, Math.floor((availableWidth + gridGap) / (150 + gridGap)))
  );
  const listColumns = viewMode === "grid" ? responsiveGridColumns : 1;
  const gridCardWidth = Math.floor(
    (availableWidth - gridGap * (listColumns - 1)) / listColumns
  );
  const listLayoutKey = `${viewMode}-${listColumns}`;

  const search = useCategorySearch({
    query: q, selected, retry: searchRetry,
    ready: Boolean(selected && (!isTmdb || snapshot?.status === "configured")),
    tmdbGeneration: isTmdb ? snapshot?.generation : undefined,
  });
  const currentQuery = search.query;
  const debounceSettled = search.debounceSettled;
  const visibleLoading = search.loading;
  const visibleSearchError = isTmdb && search.error !== null ? presentTmdbRemoteError(search.error) : null;
  const visibleItems: readonly ProviderSearchResult[] = selected
    ? search.items.filter(item => selected.destination(item) !== null) : [];

  const openTokenPage = useCallback(async () => {
    try {
      await Linking.openURL(TMDB_TOKEN_URL);
    } catch {
      Alert.alert("No pudimos abrir TMDB", "Abrí la configuración de TMDB e intentá nuevamente.");
    }
  }, []);

  const retryCredentialAccess = useCallback(async () => {
    try {
      await tmdb?.retryInitialization();
    } catch {
      // El provider publica storage-error; Search conserva la query y permite otro intento.
    }
  }, [tmdb]);

  const credentialState = !isTmdb ? null : snapshot?.status === "initializing"
    ? { title: "Comprobando la configuración de TMDB…", message: "Tu búsqueda queda lista mientras comprobamos la credencial." }
    : snapshot?.status === "not-configured"
      ? { title: "TMDB no está configurado", message: "Configurá tu token para buscar. La Biblioteca local sigue disponible." }
      : snapshot?.status === "storage-error"
        ? { title: "No pudimos acceder a la configuración de TMDB", message: "La Biblioteca local sigue disponible. Podés reintentar el acceso." }
        : null;
  const actionButton = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
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
      })}
    >
      <Text style={{ color: theme.global.textPrimary, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );

  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: theme.global.background,
        flex: 1,
        gap: 12,
        maxWidth: 1200,
        padding: 16,
        width: "100%",
      }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {categories.map(category => (
          <Pressable
            key={category.id}
            accessible
            accessibilityRole="button"
            accessibilityLabel={category.label}
            accessibilityState={{ selected: categoryId === category.id }}
            aria-pressed={categoryId === category.id}
            focusable
            onPress={() => setCategoryId(category.id)}
            style={({ pressed }) => ({
              minHeight: 44, paddingHorizontal: 16, justifyContent: "center",
              borderWidth: 1, borderRadius: 12, opacity: pressed ? 0.78 : 1,
              borderColor: categoryId === category.id ? theme.global.borderStrong : theme.global.border,
              backgroundColor: categoryId === category.id ? theme.global.surfaceSecondary : theme.global.surface,
            })}
          >
            <Text accessible={false} aria-hidden style={{ color: theme.global.textPrimary, fontWeight: "800" }}>{category.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <TextInput
          accessibilityLabel={`Buscar en ${selected?.category.label ?? "la categoría"}`}
          value={q}
          onChangeText={setQ}
          placeholder={categoryId === "movie" ? "Buscar película…" : categoryId === "tv" ? "Buscar serie…" : "Buscar título…"}
          placeholderTextColor={theme.global.textMuted}
          style={{
            flex: 1,
            minHeight: 44,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.global.borderStrong,
            backgroundColor: theme.global.inputBackground,
            color: theme.global.textPrimary,
          }}
        />
        <Pressable
          accessibilityLabel="Abrir opciones de Buscar"
          accessibilityRole="button"
          accessibilityState={{ disabled: !preferencesReady }}
          disabled={!preferencesReady}
          focusable
          hitSlop={6}
          onPress={() => setOptionsVisible(true)}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: theme.global.surfaceSecondary,
            borderColor: theme.global.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            justifyContent: "center",
            minHeight: 44,
            minWidth: 44,
            opacity: !preferencesReady ? 0.5 : pressed ? 0.78 : 1,
          })}
        >
          <Ionicons color={preferencesReady ? theme.global.textPrimary : theme.semantic.disabledText} name="options-outline" size={22} />
        </Pressable>
      </View>

      {visibleLoading && (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={`Buscando en ${selected?.category.label ?? "la categoría"}`} accessibilityLiveRegion="polite" style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <ActivityIndicator accessible={false} color={theme.global.textPrimary} />
          <Text accessible={false} aria-hidden style={{ color: theme.global.textSecondary }}>Buscando…</Text>
        </View>
      )}

      <FlatList
        columnWrapperStyle={listColumns > 1 ? { gap: gridGap } : undefined}
        data={visibleItems}
        key={listLayoutKey}
        keyExtractor={(item) => `${item.reference.provider}/${item.reference.resourceNamespace}/${item.reference.externalId}`}
        numColumns={listColumns}
        contentContainerStyle={{
          flexGrow: visibleItems.length === 0 ? 1 : undefined,
          gap: viewMode === "grid" ? gridGap : 10,
          paddingBottom: 24,
        }}
        renderItem={({ item }) => {

          const route = selected?.destination(item);
          if (!route) return null;

          if (viewMode === "grid") {
            return (
              <TitleGridCard
                accessibilityLabel={`Abrir ${item.kindLabel} ${item.displayTitle}`}
                onPress={() => router.push(route)}
                posterUrl={item.posterUrl}
                style={{ width: gridCardWidth }}
                title={item.displayTitle}
                kindLabel={item.kindLabel}
              />
            );
          }

          return (
            <Pressable
              accessible
              accessibilityLabel={`Abrir ${item.kindLabel} ${item.displayTitle}`}
              accessibilityRole="button"
              focusable
              onPress={() => router.push(route)}
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.global.border,
                backgroundColor: theme.global.surface,
                alignItems: "flex-start",
              }}
            >
              <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: 12, flex: 1 }}>
              {item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  style={{ width: 80, height: 120, borderRadius: 10 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 120,
                    borderRadius: 10,
                    backgroundColor: theme.global.surfaceSecondary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: theme.global.border,
                  }}
                >
                  <Text style={{ color: theme.global.textSecondary, fontSize: 12 }}>Sin póster</Text>
                </View>
              )}

              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: theme.global.textPrimary }}>
                  {item.displayTitle} {item.releaseLabel ? `(${item.releaseLabel})` : ""}
                </Text>
                <Text style={{ color: theme.global.textMuted, fontWeight: "700" }}>
                  {item.kindLabel}
                </Text>
                <Text style={{ color: theme.global.textSecondary }} numberOfLines={4}>
                  {item.description || "Sin descripción."}
                </Text>
              </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          visibleLoading ? null : (
            <View style={{ gap: 8, paddingVertical: 20 }}>
              <Text accessibilityLiveRegion="polite" style={{ color: theme.global.textPrimary, fontSize: 17, fontWeight: "900" }}>
                {currentQuery.length === 0
                  ? "Buscá una película o serie"
                  : credentialState
                    ? credentialState.title
                  : visibleSearchError
                    ? visibleSearchError.title
                    : search.error !== null && !isTmdb ? "No pudimos completar la búsqueda" : "No encontré resultados"}
              </Text>
              <Text style={{ color: visibleSearchError ? theme.semantic.dangerText : theme.global.textSecondary }}>
                {currentQuery.length === 0
                  ? "Escribí un título para consultar TMDB."
                  : credentialState
                    ? credentialState.message
                    : visibleSearchError?.message ?? "Probá con otro título."}
              </Text>
              {currentQuery.length > 0 && isTmdb && snapshot?.status === "not-configured" && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {actionButton("Obtener token", () => void openTokenPage())}
                  {actionButton("Configurar TMDB", () => router.push(TMDB_SETTINGS_ROUTE))}
                </View>
              )}
              {currentQuery.length > 0 && isTmdb && snapshot?.status === "storage-error" && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {actionButton("Reintentar acceso", () => void retryCredentialAccess())}
                  {actionButton("Configurar TMDB", () => router.push(TMDB_SETTINGS_ROUTE))}
                </View>
              )}
              {debounceSettled && currentQuery.length > 0 && isTmdb && snapshot?.status === "configured" && visibleSearchError?.action === "change" &&
                actionButton("Cambiar token", () => router.push(TMDB_SETTINGS_ROUTE))}
              {!isTmdb && search.error !== null && actionButton("Reintentar búsqueda", () => setSearchRetry((value) => value + 1))}
              {debounceSettled && currentQuery.length > 0 && isTmdb && snapshot?.status === "configured" && visibleSearchError?.action === "retry" &&
                actionButton("Reintentar búsqueda", () => setSearchRetry((value) => value + 1))}
            </View>
          )
        }
      />

      <ViewOptionsPanel
        onClose={() => setOptionsVisible(false)}
        sections={optionSections}
        visible={optionsVisible}
      />
    </View>
  );
}

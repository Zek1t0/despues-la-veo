import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View, Image, Linking, Platform, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { posterUrl, searchMulti } from "../../src/providers/tmdb/tmdbApi";
import type { TmdbSearchItem } from "../../src/providers/tmdb/tmdbTypes";
import { titleTypeLabel } from "../../src/core/presentationLabels";
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
import { colors } from "../../src/theme/colors";
import { useTmdbCredential } from "../../src/providers/tmdb/credential/TmdbCredentialProvider";
import {
  presentTmdbRemoteError,
  TMDB_SETTINGS_ROUTE,
  TMDB_TOKEN_URL,
  type TmdbRemoteErrorPresentation,
} from "../../src/providers/tmdb/credential/tmdbCredentialUi";
import {
  sameTmdbRemoteRequest,
  isTmdbSearchDebounceSettled,
  isTmdbSearchObservationEqual,
  shouldRunTmdbSearch,
  type TmdbRemoteRequestIdentity,
  type TmdbSearchObservation,
} from "../../src/providers/tmdb/credential/tmdbRemoteRequestIdentity";

export default function ExploreScreen() {
  const router = useRouter();
  const { snapshot, retryInitialization } = useTmdbCredential();
  const { width: windowWidth } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<TmdbSearchItem[]>([]);
  const [itemsIdentity, setItemsIdentity] = useState<{ query: string; generation: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<TmdbRemoteErrorPresentation | null>(null);
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
  const searchSequence = useRef(0);
  const currentSearchIdentity = useRef<TmdbRemoteRequestIdentity>({ sequence: 0, resource: "", generation: 0 });
  const previousSearchObservation = useRef<TmdbSearchObservation | null>(null);

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
            indicator: <Ionicons color={colors.muted} name="list-outline" size={24} />,
          },
          {
            id: "grid",
            title: "Mosaico",
            accessibilityLabel: "Mostrar resultados de Buscar en mosaico",
            indicator: <Ionicons color={colors.muted} name="grid-outline" size={24} />,
          },
        ],
      },
    ],
    [selectViewMode, viewMode]
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

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const currentQuery = q.trim();
    const debounceSettled = isTmdbSearchDebounceSettled(currentQuery, debounced);
    const observation = {
      rawQuery: currentQuery,
      debouncedQuery: debounced,
      status: snapshot.status,
      generation: snapshot.generation,
      retry: searchRetry,
    } as const;
    const previousObservation = previousSearchObservation.current;
    if (isTmdbSearchObservationEqual(previousObservation, observation)) return;

    const shouldRun = shouldRunTmdbSearch(previousObservation, observation);
    previousSearchObservation.current = observation;
    const sequence = ++searchSequence.current;
    const identity = { sequence, resource: currentQuery, generation: snapshot.generation };
    currentSearchIdentity.current = identity;
    const isCurrent = () => mounted.current && sameTmdbRemoteRequest(identity, currentSearchIdentity.current);

    async function run() {
      if (!currentQuery) {
        setItems([]);
        setItemsIdentity(null);
        setSearchError(null);
        setLoading(false);
        return;
      }
      if (!shouldRun) {
        if (snapshot.status === "configured" && debounceSettled) return;
        setItems([]);
        setItemsIdentity(null);
        setSearchError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setSearchError(null);
      try {
        const res = await searchMulti(currentQuery, 1);
        const filtered = res.results.filter((r) => r.media_type === "movie" || r.media_type === "tv");
        if (isCurrent()) {
          setItems(filtered);
          setItemsIdentity({ query: identity.resource, generation: identity.generation });
        }
      } catch (e) {
        const presented = presentTmdbRemoteError(e);
        if (isCurrent() && presented.message !== null) {
          setItems([]);
          setItemsIdentity(null);
          setSearchError(presented);
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    void run();
  }, [q, debounced, searchRetry, snapshot.generation, snapshot.status]);

  const openTokenPage = useCallback(async () => {
    try {
      await Linking.openURL(TMDB_TOKEN_URL);
    } catch {
      Alert.alert("No pudimos abrir TMDB", "Abrí la configuración de TMDB e intentá nuevamente.");
    }
  }, []);

  const retryCredentialAccess = useCallback(async () => {
    try {
      await retryInitialization();
    } catch {
      // El provider publica storage-error; Search conserva la query y permite otro intento.
    }
  }, [retryInitialization]);

  const credentialState = snapshot.status === "initializing"
    ? { title: "Comprobando la configuración de TMDB…", message: "Tu búsqueda queda lista mientras comprobamos la credencial." }
    : snapshot.status === "not-configured"
      ? { title: "TMDB no está configurado", message: "Configurá tu token para buscar. La Biblioteca local sigue disponible." }
      : snapshot.status === "storage-error"
        ? { title: "No pudimos acceder a la configuración de TMDB", message: "La Biblioteca local sigue disponible. Podés reintentar el acceso." }
        : null;
  const currentQuery = q.trim();
  const debounceSettled = isTmdbSearchDebounceSettled(currentQuery, debounced);
  const visibleSearchError = debounceSettled ? searchError : null;
  const visibleLoading = debounceSettled && loading;
  const visibleItems = snapshot.status === "configured"
    && debounceSettled
    && itemsIdentity?.query === debounced
    && itemsIdentity.generation === snapshot.generation
      ? items
      : [];

  const actionButton = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
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
      })}
    >
      <Text style={{ color: colors.text, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );

  return (
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
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <TextInput
          accessibilityLabel="Buscar película o serie"
          value={q}
          onChangeText={setQ}
          placeholder="Buscar película o serie…"
          placeholderTextColor={colors.subtle}
          style={{
            flex: 1,
            minHeight: 44,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border2,
            backgroundColor: colors.input,
            color: colors.text,
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
            backgroundColor: colors.card2,
            borderColor: colors.border2,
            borderRadius: 12,
            borderWidth: 1,
            justifyContent: "center",
            minHeight: 44,
            minWidth: 44,
            opacity: !preferencesReady ? 0.5 : pressed ? 0.78 : 1,
          })}
        >
          <Ionicons color={colors.text} name="options-outline" size={22} />
        </Pressable>
      </View>

      {visibleLoading && (
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <ActivityIndicator color={colors.text} />
          <Text style={{ color: colors.muted }}>Buscando…</Text>
        </View>
      )}

      <FlatList
        columnWrapperStyle={listColumns > 1 ? { gap: gridGap } : undefined}
        data={visibleItems}
        key={listLayoutKey}
        keyExtractor={(x) => `${x.media_type}-${x.id}`}
        numColumns={listColumns}
        contentContainerStyle={{
          flexGrow: visibleItems.length === 0 ? 1 : undefined,
          gap: viewMode === "grid" ? gridGap : 10,
          paddingBottom: 24,
        }}
        renderItem={({ item }) => {
          const title =
            item.media_type === "movie"
              ? item.title ?? "Sin título"
              : item.name ?? "Sin nombre";

          const year =
            item.media_type === "movie"
              ? item.release_date?.slice(0, 4)
              : item.first_air_date?.slice(0, 4);

          const img = item.poster_path ? posterUrl(item.poster_path, "w185") : null;

          if (viewMode === "grid") {
            return (
              <TitleGridCard
                accessibilityLabel={`Abrir ${titleTypeLabel(item.media_type)} ${title}`}
                onPress={() => router.push(`/tmdb/${item.media_type}/${item.id}`)}
                posterUrl={img}
                style={{ width: gridCardWidth }}
                title={title}
                type={item.media_type}
              />
            );
          }

          return (
            <Pressable
              accessibilityLabel={`Abrir ${titleTypeLabel(item.media_type)} ${title}`}
              accessibilityRole="button"
              focusable
              onPress={() => router.push(`/tmdb/${item.media_type}/${item.id}`)}
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                alignItems: "flex-start",
              }}
            >
              {img ? (
                <Image
                  source={{ uri: img }}
                  style={{ width: 80, height: 120, borderRadius: 10 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 120,
                    borderRadius: 10,
                    backgroundColor: colors.card2,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Sin póster</Text>
                </View>
              )}

              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                  {title} {year ? `(${year})` : ""}
                </Text>
                <Text style={{ color: colors.subtle, fontWeight: "700" }}>
                  {titleTypeLabel(item.media_type)}
                </Text>
                <Text style={{ color: colors.muted }} numberOfLines={4}>
                  {item.overview || "Sin descripción."}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          visibleLoading ? null : (
            <View style={{ gap: 8, paddingVertical: 20 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                {currentQuery.length === 0
                  ? "Buscá una película o serie"
                  : credentialState
                    ? credentialState.title
                  : visibleSearchError
                    ? visibleSearchError.title
                    : "No encontré resultados"}
              </Text>
              <Text style={{ color: colors.muted }}>
                {currentQuery.length === 0
                  ? "Escribí un título para consultar TMDB."
                  : credentialState
                    ? credentialState.message
                    : visibleSearchError?.message ?? "Probá con otro título."}
              </Text>
              {currentQuery.length > 0 && snapshot.status === "not-configured" && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {actionButton("Obtener token", () => void openTokenPage())}
                  {actionButton("Configurar TMDB", () => router.push(TMDB_SETTINGS_ROUTE))}
                </View>
              )}
              {currentQuery.length > 0 && snapshot.status === "storage-error" && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {actionButton("Reintentar acceso", () => void retryCredentialAccess())}
                  {actionButton("Configurar TMDB", () => router.push(TMDB_SETTINGS_ROUTE))}
                </View>
              )}
              {debounceSettled && currentQuery.length > 0 && snapshot.status === "configured" && visibleSearchError?.action === "change" &&
                actionButton("Cambiar token", () => router.push(TMDB_SETTINGS_ROUTE))}
              {debounceSettled && currentQuery.length > 0 && snapshot.status === "configured" && visibleSearchError?.action === "retry" &&
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

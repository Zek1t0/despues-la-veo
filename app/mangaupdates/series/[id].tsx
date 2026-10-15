import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useAppTheme } from "../../../src/theme/AppThemeProvider";
import { PosterPlaceholder } from "../../../src/components/browsing/PosterPlaceholder";
import { mediaClassificationLabel, mediaYearLabel } from "../../../src/core/presentationLabels";
import { canonicalSeriesId } from "../../../src/providers/mangaupdates/identity";
import { mangaUpdatesAvailability } from "../../../src/providers/mangaupdates/availability";
import { loadMangaUpdatesProductDetail } from "../../../src/providers/mangaupdates/product";
import { mangaUpdatesMaterializationInput } from "../../../src/providers/mangaupdates/mapping";
import { mangaUpdatesProvenance } from "../../../src/providers/mangaupdates/attribution";
import { presentMangaUpdatesError } from "../../../src/providers/mangaupdates/errorPresentation";
import type { MangaUpdatesSeries } from "../../../src/providers/mangaupdates/validation";
import { getByProviderReference, saveProviderTitle } from "../../../src/storage/savedTitlesRepo";

function localId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

export default function MangaUpdatesDetailScreen() {
  const { id: parameter } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { theme } = useAppTheme();
  let id: string | null = null;
  try { id = canonicalSeriesId(parameter); } catch { /* Invalid route never performs HTTP. */ }
  const available = mangaUpdatesAvailability(Platform.OS).productionEnabled;
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ id: string; record: MangaUpdatesSeries | null; savedId: string | null; error: unknown } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const generation = useRef(0);
  const saveInFlight = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setState(null); setSaveError(null); setLinkError(null); setSaving(false);
    if (!id || !available) return;
    const controller = new AbortController();
    const routeId = id;
    void (async () => {
      try {
        const record = await loadMangaUpdatesProductDetail(routeId, Platform.OS, undefined, controller.signal);
        const input = mangaUpdatesMaterializationInput(record); // Default omit policy is mandatory here.
        const saved = await getByProviderReference(input.reference);
        if (current === generation.current && !controller.signal.aborted) {
          setState({ id: routeId, record, savedId: saved?.id ?? null, error: null });
        }
      } catch (error) {
        if (current === generation.current && !controller.signal.aborted) setState({ id: routeId, record: null, savedId: null, error });
      }
    })();
    return () => { controller.abort(); generation.current++; };
  }, [id, available, retry]);

  const visible = state?.id === id && available ? state : null;
  const record = visible?.record;
  const input = record ? mangaUpdatesMaterializationInput(record) : null;
  const snapshot = input?.snapshot;
  const provenance = input ? mangaUpdatesProvenance(input.reference) : null;
  const error = visible?.error ? presentMangaUpdatesError(visible.error) : null;
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress} style={({ pressed }) => ({
        minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1,
        borderColor: theme.global.borderStrong, backgroundColor: theme.global.surfaceSecondary,
        opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
      })}><Text style={{ color: theme.global.textPrimary, fontWeight: "800" }}>{label}</Text></Pressable>
  );

  async function save() {
    if (!input || !available || saveInFlight.current) return;
    const current = generation.current;
    saveInFlight.current = true; setSaving(true); setSaveError(null);
    try {
      const savedId = await saveProviderTitle(input, localId);
      if (current !== generation.current) return;
      setState(previous => previous?.id === id ? { ...previous, savedId } : previous);
      Alert.alert("Listo", "Guardado en tu biblioteca.");
      if (!visible?.savedId) router.push(`/title/${savedId}`);
    } catch {
      if (current === generation.current) setSaveError("No se pudo guardar o actualizar la obra. Tu biblioteca conserva sus datos anteriores.");
    } finally {
      saveInFlight.current = false;
      if (current === generation.current) setSaving(false);
    }
  }

  return <>
    <Stack.Screen options={{ title: snapshot?.title ?? "MangaUpdates" }} />
    <ScrollView style={{ backgroundColor: theme.global.background }} contentContainerStyle={{
      alignSelf: "center", maxWidth: 800, width: "100%", padding: 16, gap: 16, paddingBottom: 32,
    }}>
      {!id ? <Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>El identificador de MangaUpdates no es válido.</Text>
        : !available ? <Text style={{ color: theme.global.textPrimary }}>MangaUpdates no está habilitado en esta plataforma. Tu biblioteca local sigue disponible.</Text>
        : !visible ? <View accessible accessibilityRole="progressbar" accessibilityLabel="Cargando MangaUpdates">
          <ActivityIndicator accessible={false} color={theme.global.textPrimary} />
        </View> : error ? <View style={{ gap: 12 }}>
          <Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>{error.message}</Text>
          {error.retryable && button("Reintentar MangaUpdates", () => setRetry(value => value + 1))}
        </View> : snapshot && provenance ? <>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <PosterPlaceholder style={{ width: 96, height: 144, borderRadius: 12 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: theme.global.textPrimary, fontSize: 24, fontWeight: "900" }}>{snapshot.title}</Text>
              <Text style={{ color: theme.global.textSecondary }}>{mediaClassificationLabel(snapshot)}</Text>
              <Text style={{ color: theme.global.textSecondary }}>{mediaYearLabel(snapshot.medium)}: {snapshot.year ?? "Sin año"}</Text>
            </View>
          </View>
          <Text style={{ color: theme.global.textSecondary, lineHeight: 22 }}>{snapshot.overview ?? "Sin descripción."}</Text>
          <Text style={{ color: theme.global.textSecondary }}>{snapshot.genres.join(" · ") || "Sin géneros."}</Text>
          <Pressable accessibilityRole="link" accessibilityLabel={`${provenance.label}, abrir fuente`} onPress={() => {
            setLinkError(null);
            void Linking.openURL(provenance.sourceUrl).catch(() => setLinkError("No pudimos abrir la fuente MangaUpdates."));
          }} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: theme.global.textPrimary }}>{provenance.label}</Text>
          </Pressable>
          {button(saving ? "Guardando…" : visible?.savedId ? "Actualizar guardado" : "Guardar en Biblioteca", () => void save(), saving)}
          {visible?.savedId && button("Abrir en Biblioteca", () => router.push(`/title/${visible.savedId}`))}
        </> : null}
      {(saveError || linkError) && <Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>{saveError ?? linkError}</Text>}
    </ScrollView>
  </>;
}

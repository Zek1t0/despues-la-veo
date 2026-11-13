import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { PosterPlaceholder } from "../../components/browsing/PosterPlaceholder";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { mediaClassificationLabel } from "../../core/presentationLabels";
import type { ProviderMaterializationInput } from "../providerContracts";
import type { KitsuAnime } from "./validation";
import { KITSU_API_BASE, canonicalAnimeId } from "./identity";
import { kitsuMaterializationInput } from "./mapping";
import { presentKitsuError } from "./errors";

export type AnimeDetailServices = {
  available: boolean;
  load(id: string, signal: AbortSignal): Promise<KitsuAnime>;
  saved(input: ProviderMaterializationInput): Promise<string | null>;
  save(input: ProviderMaterializationInput): Promise<string>;
  open(id: string): void;
  source(url: string): Promise<unknown>;
};
/** Same component for production route and explicitly injected disposable review. */
export function KitsuAnimeDetail({ id: parameter, services }: { id: unknown; services: AnimeDetailServices }) {
  const { theme } = useAppTheme();
  let id: string | null = null;
  try { id = canonicalAnimeId(parameter); } catch { /* No load for malformed routes. */ }
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ id: string; retry: number; record?: KitsuAnime; savedId: string | null; error?: unknown } | null>(null);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const generation = useRef(0), writeLock = useRef(false);
  useEffect(() => {
    const current = ++generation.current;
    setState(null); setWriteError(null); setSaving(false);
    if (!id || !services.available) return;
    const controller = new AbortController(), routeId = id;
    void (async () => {
      try {
        const record = await services.load(routeId, controller.signal);
        // Injection cannot accidentally present a different requested identity.
        if (record.id !== routeId) throw new Error("Kitsu devolvió otro identificador.");
        const savedId = await services.saved(kitsuMaterializationInput(record));
        if (current === generation.current && !controller.signal.aborted) setState({ id: routeId, retry, record, savedId });
      } catch (error) {
        if (current === generation.current && !controller.signal.aborted) setState({ id: routeId, retry, savedId: null, error });
      }
    })();
    return () => { controller.abort(); generation.current++; };
    // Route bindings are mount-stable; never refetch because a parent rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, services.available, retry]);
  const visible = state?.id === id && state.retry === retry && services.available ? state : null;
  const input = visible?.record ? kitsuMaterializationInput(visible.record) : null;
  const snapshot = input?.snapshot;
  const error = visible?.error ? presentKitsuError(visible.error) : null;
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: saving }} disabled={saving} onPress={action}
    style={{ minHeight: 44, padding: 12, borderWidth: 1, borderRadius: 12, borderColor: theme.global.borderStrong, backgroundColor: theme.global.surfaceSecondary }}>
    <Text style={{ color: theme.global.textPrimary }}>{label}</Text>
  </Pressable>;
  async function save() {
    if (!input || !services.available || writeLock.current) return;
    writeLock.current = true; setSaving(true); setWriteError(null);
    const current = generation.current;
    try {
      const savedId = await services.save(input);
      if (current !== generation.current) return;
      setState(value => value?.id === id ? { ...value, savedId } : value);
      if (!visible?.savedId) services.open(savedId);
    } catch { if (current === generation.current) setWriteError("No se pudo guardar. Tu biblioteca conserva sus datos anteriores."); }
    finally { writeLock.current = false; if (current === generation.current) setSaving(false); }
  }
  return <ScrollView style={{ backgroundColor: theme.global.background }} contentContainerStyle={{ width: "100%", maxWidth: 800, alignSelf: "center", padding: 16, gap: 16, paddingBottom: 32 }}>
    {!id ? <Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>El identificador de Kitsu no es válido.</Text>
      : !services.available ? <Text style={{ color: theme.global.textPrimary }}>Kitsu aún no está habilitado. Tu biblioteca local sigue disponible.</Text>
      : !visible ? <ActivityIndicator accessibilityLabel="Cargando anime de Kitsu" />
      : error ? <View style={{ gap: 12 }}><Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>{error.message}</Text>
        {error.retryable && button("Reintentar Kitsu", () => setRetry(value => value + 1))}</View>
      : snapshot ? <>
        <View style={{ flexDirection: "row", gap: 12 }}><PosterPlaceholder style={{ width: 96, height: 144, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 8 }}><Text accessibilityRole="header" style={{ color: theme.global.textPrimary, fontSize: 24, fontWeight: "900" }}>{snapshot.title}</Text>
            <Text style={{ color: theme.global.textSecondary }}>{mediaClassificationLabel(snapshot)} · {snapshot.year ?? "Sin año"}</Text></View></View>
        <Text style={{ color: theme.global.textSecondary }}>{snapshot.overview ?? "Sin descripción."}</Text>
        {button("Datos: Kitsu · abrir fuente", () => { void services.source(`${KITSU_API_BASE}/anime/${id}`).catch(() => setWriteError("No pudimos abrir la fuente Kitsu.")); })}
        {button(saving ? "Guardando…" : visible.savedId ? "Actualizar guardado" : "Guardar en Biblioteca", () => { void save(); })}
        {visible.savedId && button("Abrir en Biblioteca", () => services.open(visible.savedId!))}
      </> : null}
    {writeError && <Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>{writeError}</Text>}
  </ScrollView>;
}

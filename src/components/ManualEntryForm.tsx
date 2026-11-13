import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { manualDuplicateCandidates, validateManualContent, type ManualContentInput } from "../core/manualContentEntry";
import { isMediaClassification, type MediaContentFamily, type MediaMedium, type MediaPrimaryFormat } from "../core/mediaClassification";
import type { SavedTitleWithProviderReferences } from "../core/savedTitle";
import { useAppTheme } from "../theme/AppThemeProvider";

type Services = {
  get(id: string): Promise<SavedTitleWithProviderReferences | null>;
  eligible(id: string): Promise<boolean>;
  list(): Promise<SavedTitleWithProviderReferences[]>;
  save(input: ManualContentInput, id?: string): Promise<string>;
  inspect(id: string): void; done(id: string): void; cancel(): void;
};
const media: [MediaMedium, string][] = [["audiovisual", "Película, serie o video"], ["comic", "Cómic"], ["literature", "Literatura"]];
const families: [MediaContentFamily, string][] = [[null, "Sin especificar"], ["anime", "Anime"], ["manga", "Manga"], ["manhwa", "Manhwa"], ["manhua", "Manhua"]];
const formats: [MediaPrimaryFormat, string][] = [[null, "Sin especificar"], ["movie", "Película"], ["tv", "Serie"], ["ova", "OVA"], ["ona", "ONA"], ["special", "Especial"], ["music", "Video musical"], ["webtoon", "Webtoon"], ["one-shot", "One-shot"], ["novel", "Novela"], ["light-novel", "Novela ligera"]];

export function ManualEntryForm({ id, services }: { id?: string; services: Services }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState<MediaMedium | null>(null);
  const [contentFamily, setFamily] = useState<MediaContentFamily>(null);
  const [primaryFormat, setFormat] = useState<MediaPrimaryFormat>(null);
  const [year, setYear] = useState("");
  const [overview, setOverview] = useState("");
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [candidates, setCandidates] = useState<SavedTitleWithProviderReferences[] | null>(null);
  const lock = useRef(false);
  const confirmedId = useRef<string | null>(null);
  // The screen stays mounted while a candidate detail is pushed, retaining the draft.
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true); setLoadError(false); setError(null);
    void (async () => {
      try {
        const item = await services.get(id);
        if (!item || !await services.eligible(id)) throw new Error("Este título no permite edición manual.");
        if (!active) return;
        setTitle(item.title); setMedium(item.medium); setFamily(item.contentFamily); setFormat(item.primaryFormat);
        setYear(item.year == null ? "" : String(item.year)); setOverview(item.overview ?? "");
      } catch (e) {
        if (active) { setError(e instanceof Error ? e.message : "No se pudo cargar el título."); setLoadError(true); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
    // Services are bound by the route; a render must never reload over a draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retry]);

  const changed = () => { setCandidates(null); setError(null); };
  const save = async (separate = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (confirmedId.current) { services.done(confirmedId.current); return; }
      if (!medium) throw new Error("Elegí qué tipo de contenido vas a agregar.");
      if (year.trim() && !/^\d+$/.test(year.trim())) throw new Error("El año debe ser un entero entre 1 y 9999.");
      const input = validateManualContent({ title, medium, contentFamily, primaryFormat,
        year: year.trim() ? Number(year.trim()) : null, overview: overview.trim() ? overview : null });
      if (!separate) {
        const matches = manualDuplicateCandidates(await services.list(), input.title, input.year, id);
        if (matches.length) { setCandidates(matches); return; }
      }
      const savedId = await services.save(input, id);
      confirmedId.current = savedId;
      services.done(savedId);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar. Tu borrador sigue acá."); }
    finally { lock.current = false; setBusy(false); }
  };
  const button = (label: string, action: () => void, selected = false, key = label) => <Pressable key={key}
    accessibilityRole="button" accessibilityState={{ disabled: busy, selected }} disabled={busy} onPress={action}
    style={{ minHeight: 44, justifyContent: "center", padding: 12, borderRadius: 12, borderWidth: 1,
      borderColor: selected ? theme.global.selectedBorder : theme.global.borderStrong,
      backgroundColor: selected ? theme.global.selectedSurface : theme.global.surfaceSecondary, opacity: busy ? 0.6 : 1 }}>
    <Text style={{ color: selected ? theme.global.selectedForeground : theme.global.textPrimary }}>{label}</Text>
  </Pressable>;
  const inputStyle = { minHeight: 48, borderWidth: 1, borderColor: theme.global.borderStrong, borderRadius: 12,
    padding: 12, color: theme.global.textPrimary, backgroundColor: theme.global.surface };
  const text = { color: theme.global.textPrimary };
  const incompatible = medium !== null && !isMediaClassification({ medium, contentFamily, primaryFormat });
  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: theme.global.background }}
    contentContainerStyle={{ width: "100%", maxWidth: 640, alignSelf: "center", padding: 16, paddingBottom: 24 + insets.bottom, gap: 12 }}>
    {loading ? <ActivityIndicator accessibilityLabel="Cargando título" /> : !loadError && <>
      <Text style={text}>Título *</Text>
      <TextInput accessibilityLabel="Título obligatorio" editable={!busy} style={inputStyle} value={title} onChangeText={v => { changed(); setTitle(v); }} />
      <Text style={text}>Tipo de contenido *</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{media.map(([value, label]) => button(label, () => { changed(); setMedium(value); }, value === medium))}</View>
      {medium && <>
        <Text style={text}>Estilo (opcional)</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{families.filter(([value]) => value === contentFamily || isMediaClassification({ medium, contentFamily: value, primaryFormat: null })).map(([value, label]) => button(label, () => { changed(); setFamily(value); }, value === contentFamily))}</View>
        <Text style={text}>Formato (opcional)</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{formats.filter(([value]) => value === primaryFormat || isMediaClassification({ medium, contentFamily: null, primaryFormat: value })).map(([value, label]) => button(label, () => { changed(); setFormat(value); }, value === primaryFormat))}</View>
        {incompatible && <Text accessibilityRole="alert" style={text}>El tipo elegido no es compatible con el estilo o formato anterior. Revisá ambos; podés elegir «Sin especificar».</Text>}
      </>}
      <Text style={text}>Año (opcional)</Text>
      <TextInput accessibilityLabel="Año opcional" keyboardType="number-pad" editable={!busy} style={inputStyle} value={year} onChangeText={v => { changed(); setYear(v); }} />
      <Text style={text}>Resumen (opcional)</Text>
      <TextInput accessibilityLabel="Resumen opcional" multiline editable={!busy} style={[inputStyle, { minHeight: 100, textAlignVertical: "top" }]} value={overview} onChangeText={v => { changed(); setOverview(v); }} />
      {candidates && <View style={{ gap: 8 }}>
        <Text accessibilityRole="alert" style={text}>Ya hay títulos parecidos en tu biblioteca. Podés revisarlos y volver con este borrador, o guardar por separado.</Text>
        {candidates.map(item => button(`Ver ${item.title}${item.year == null ? "" : ` (${item.year})`}`, () => services.inspect(item.id), false, item.id))}
        {button(id ? "Guardar cambios igualmente" : "Crear por separado", () => { void save(true); })}
      </View>}
      {button(busy ? "Guardando…" : confirmedId.current ? "Abrir título guardado" : "Guardar", () => { void save(); })}
    </>}
    {error && <Text accessibilityRole="alert" style={text}>{error}</Text>}
    {loadError && button("Reintentar carga", () => setRetry(v => v + 1))}
    {button("Cancelar", () => setCanceling(true))}
    {canceling && <View style={{ gap: 8 }}><Text style={text}>¿Descartar el borrador y salir?</Text>
      {button("Seguir editando", () => setCanceling(false))}{button("Descartar y salir", services.cancel)}</View>}
  </ScrollView>;
}

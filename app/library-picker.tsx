import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter, Stack } from "expo-router";
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { admittedImageUrl } from "../src/core/mediaImagePresentation";
import { imagePolicy } from "../src/components/browsing/imageRuntime";
import { MediaPoster } from "../src/components/browsing/MediaPoster";
import { SensitiveFilterStatus } from "../src/components/browsing/SensitiveContentNotice";
import { useMediaLanguages } from "../src/components/browsing/useMediaLanguages";
import { ViewOptionsPanel, type CompactViewOptionDescriptor, type ViewOptionsSection } from "../src/components/browsing/ViewOptionsPanel";
import {
  localPickerDay, pickerGenreKey, selectLibraryCandidates, surpriseCandidate, visiblePickerTitles,
  type PickerCandidate, type PickerCriteria,
} from "../src/core/libraryPicker";
import { savedMediaPresentation } from "../src/core/mediaPresentation";
import { mediaClassificationLabel, titleStatusLabel } from "../src/core/presentationLabels";
import type { SavedTitleWithProviderReferences, TitleStatus } from "../src/core/savedTitle";
import { subscribeLibraryInvalidation } from "../src/storage/libraryInvalidation";
import { getLibraryScreenSnapshot } from "../src/storage/libraryScreenSnapshot";
import { useAppTheme } from "../src/theme/AppThemeProvider";
import { controlTarget, pressedFeedback, radius, space, type } from "../src/theme/presentation";

const initialCriteria: PickerCriteria = { status: "planned" };
const statuses: readonly TitleStatus[] = ["planned", "watching", "done", "dropped"];
const familyLabels = { anime: "Anime", manga: "Manga", manhwa: "Manhwa", manhua: "Manhua" };
const showablePoster = (candidate: PickerCandidate) => {
  const { item } = candidate;
  const { imageProvider, metadata } = savedMediaPresentation(item);
  const policy = imagePolicy(imageProvider);
  const fields = metadata?.fields;
  const images = fields?.posterImages;
  return !!(images?.some(image => admittedImageUrl(image.url, policy)) ||
    ((!fields || !Object.prototype.hasOwnProperty.call(fields, "posterImages") ||
      (!!images?.length && imageProvider === "tmdb")) && admittedImageUrl(item.posterUrl, policy)));
};

const any = { id: "", title: "Cualquiera" };

function choices<T extends string>(values: readonly (T | null | undefined)[], label: (value: T) => string = value => value) {
  const options = new Map<string, CompactViewOptionDescriptor>();
  for (const value of values) if (value && !options.has(value)) options.set(value, { id: value, title: label(value) });
  return [any, ...[...options.values()].sort((a, b) => a.title.localeCompare(b.title, "es"))];
}

function PickerAction({ label, onPress, primary = false, icon, accessibilityLabel }: {
  label: string; onPress(): void; primary?: boolean; icon?: React.ComponentProps<typeof Ionicons>["name"];
  accessibilityLabel?: string;
}) {
  const { theme } = useAppTheme();
  const color = primary ? theme.global.onAccent : theme.global.textPrimary;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} focusable onPress={onPress}
    style={({ pressed }) => [{
      minHeight: controlTarget, minWidth: controlTarget, paddingHorizontal: space.md, paddingVertical: space.sm,
      flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1,
      justifyContent: "center", alignSelf: primary ? "stretch" : "flex-start", borderRadius: radius.control, borderWidth: 1,
      backgroundColor: primary ? theme.global.accent : theme.global.surfaceSecondary,
      borderColor: primary ? theme.global.accent : theme.global.borderStrong,
    }, pressed && pressedFeedback]}>
    {icon && <Ionicons name={icon} size={18} color={color} />}
    {label && <Text style={[type.control, { color, flexShrink: 1 }]}>{label}</Text>}
  </Pressable>;
}

function CandidateCard({ candidate, featured, wide, stacked, explanation, onlineArt, onPress }: {
  candidate: PickerCandidate; featured: boolean; wide: boolean; stacked?: boolean; explanation?: string;
  onlineArt: boolean; onPress(): void;
}) {
  const { theme } = useAppTheme();
  const { item, reasons } = candidate;
  const art = savedMediaPresentation(item);
  const classification = mediaClassificationLabel(item);
  const posterWidth = featured ? (wide ? 160 : 104) : 56;
  const status = titleStatusLabel(item.status, item.medium);
  const matches = reasons.filter(reason => reason.startsWith("Género: ") || reason.startsWith("Etiqueta: "));
  return <Pressable accessibilityRole="button" focusable onPress={onPress}
    accessibilityLabel={[`${featured ? "Abrir ficha de" : "Destacar"} ${item.title}`, classification, ...reasons].join(". ")}
    style={({ pressed }) => [{
      flex: featured ? undefined : 1,
      flexDirection: stacked ? "column" : "row", alignItems: stacked ? "stretch" : "center",
      gap: featured ? space.lg : space.md, padding: featured ? (wide ? space.xl : space.lg) : space.sm,
      backgroundColor: theme.global.surface, borderColor: theme.global.borderStrong, borderWidth: 1, borderRadius: radius.card,
    }, pressed && pressedFeedback]}>
    <MediaPoster identity={item.id} imageProvider={art.imageProvider} metadata={art.metadata}
      posterUrl={item.posterUrl} context="list" cacheOnly={!onlineArt}
      style={{ width: posterWidth, height: posterWidth * 1.5, borderRadius: radius.control }} />
    <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: space.xs }}>
      <Text
        style={[featured ? type.heading : type.title, { color: theme.global.textPrimary }]}>{item.title}</Text>
      <Text style={[type.caption, { color: theme.global.textSecondary }]}>{classification}{item.year ? ` · ${item.year}` : ""}</Text>
      <Text style={[type.caption, { color: theme.global.textSecondary }]}>
        {[featured ? status : null, candidate.duration &&
          `${candidate.duration.minutes} min${candidate.duration.unit === "episodio" ? " por episodio" : ""}`].filter(Boolean).join(" · ") || status}
      </Text>
      {featured && <Text style={[type.control, { color: theme.global.textSecondary, marginTop: space.xs }]}>
        {[explanation, ...matches].filter(Boolean).join(" · ")}
      </Text>}
      {featured ? <View style={{ alignSelf: "flex-start", marginTop: space.sm, paddingHorizontal: space.md,
        paddingVertical: space.sm, borderWidth: 1, borderColor: theme.global.borderStrong, borderRadius: radius.control }}>
        <Text style={[type.control, { color: theme.global.textPrimary }]}>Ver ficha ↗</Text>
      </View> : <Text style={[type.caption, { color: theme.global.accent }]}>Destacar propuesta</Text>}
    </View>
  </Pressable>;
}

export default function LibraryPickerScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale = 1 } = useWindowDimensions();
  const { languages, preference, ready, error: preferenceError, retry: retryPreferences } = useMediaLanguages();
  const [criteria, setCriteria] = useState<PickerCriteria>(initialCriteria);
  const [minutesText, setMinutesText] = useState("");
  const [onlineArt, setOnlineArt] = useState(false);
  const [filterPanel, setFilterPanel] = useState<"all" | "status" | null>(null);
  const [day, setDay] = useState(() => localPickerDay(new Date()));
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<readonly SavedTitleWithProviderReferences[] | null>(null);
  const [readError, setReadError] = useState(false);
  const [surprise, setSurprise] = useState<{ candidates: readonly PickerCandidate[]; candidate: PickerCandidate }>();
  const [promotion, setPromotion] = useState<{ daily: readonly PickerCandidate[]; candidate: PickerCandidate }>();

  useFocusEffect(useCallback(() => {
    let active = true;
    let generation = 0;
    let midnight: ReturnType<typeof setTimeout>;
    const updateDay = () => {
      clearTimeout(midnight);
      const now = new Date();
      setDay(localPickerDay(now));
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnight = setTimeout(updateDay, Math.max(1, nextDay.getTime() - now.getTime()));
    };
    const read = async () => {
      const current = ++generation;
      setSnapshot(null);
      setReadError(false);
      setSurprise(undefined);
      try {
        const result = await getLibraryScreenSnapshot();
        if (active && generation === current) setSnapshot(result.items);
      } catch {
        if (active && generation === current) setReadError(true);
      }
    };
    const unsubscribe = subscribeLibraryInvalidation(() => { void read(); });
    const appState = AppState.addEventListener("change", state => { if (state === "active") updateDay(); });
    updateDay();
    void read();
    return () => {
      active = false;
      clearTimeout(midnight);
      appState.remove();
      unsubscribe();
      setSnapshot(null);
    };
  }, [retry]));

  const minutes = minutesText.trim() ? Number(minutesText.trim()) : undefined;
  const invalidTime = minutes !== undefined && (!/^\d+$/.test(minutesText.trim()) || !Number.isSafeInteger(minutes) || minutes <= 0);
  const visible = useMemo(() => ready && !preferenceError && snapshot
    ? visiblePickerTitles(snapshot, preference.value.hideSensitive, languages) : null,
  [ready, preferenceError, snapshot, preference.value.hideSensitive, languages]);
  const result = useMemo(() => visible && !invalidTime
    ? selectLibraryCandidates(visible, { ...criteria, minutes }, day) : null,
  [visible, criteria, minutes, invalidTime, day]);

  function select<K extends keyof PickerCriteria>(key: K, value: PickerCriteria[K]) {
    setSurprise(undefined);
    setCriteria(previous => ({ ...previous, [key]: value }));
  }
  function section<K extends Exclude<keyof PickerCriteria, "minutes" | "shortest">>(
    key: K, title: string, options: readonly CompactViewOptionDescriptor[],
  ): ViewOptionsSection {
    return { id: key, title, presentation: "compact", options, selectedId: criteria[key] ?? "",
      onSelect: id => select(key, (id || undefined) as PickerCriteria[K]) };
  }
  const sections = visible ? [
    section("status", "Estado", [any, ...statuses.map(id => ({ id, title: titleStatusLabel(id) }))]),
    section("medium", "Medio", choices(visible.map(item => item.medium), medium =>
      mediaClassificationLabel({ medium, contentFamily: null, primaryFormat: null }))),
    section("contentFamily", "Familia", choices(visible.map(item => item.contentFamily), family => familyLabels[family])),
    section("primaryFormat", "Formato", choices(visible.map(item => item.primaryFormat), format => {
      const medium = visible.find(item => item.primaryFormat === format)!.medium;
      return mediaClassificationLabel({ medium, contentFamily: null, primaryFormat: format });
    })),
    section("genre", "Género", [...new Map(choices(visible.flatMap(item => item.genres ?? []))
      .map(option => [pickerGenreKey(option.id), { ...option, id: pickerGenreKey(option.id) }])).values()]),
    section("tag", "Etiqueta", choices(visible.flatMap(item => item.tags))),
    { id: "order", title: "Selección", presentation: "compact" as const, selectedId: criteria.shortest ? "shortest" : "daily",
      options: [{ id: "daily", title: "Selección del día" }, { id: "shortest", title: "Más cortos primero" }],
      onSelect: (id: string) => select("shortest", id === "shortest") },
  ].filter(group => group.options.length > 1 || group.selectedId) : [];
  const activeLabels = sections.filter(group => group.id !== "status" && group.selectedId &&
    (group.id !== "order" || criteria.shortest))
    .map(group => group.options.find(option => option.id === group.selectedId)?.title ?? `${group.title} no disponible`);
  const surpriseCurrent = surprise && result?.eligible === surprise.candidates ? surprise.candidate : undefined;
  const displayed = surpriseCurrent ? [surpriseCurrent] : result?.daily ?? [];
  const highlighted = surpriseCurrent ?? (promotion && promotion.daily === result?.daily ? promotion.candidate : result?.daily[0]);
  const alternatives = surpriseCurrent ? [] : displayed.filter(candidate => candidate !== highlighted);
  const scaledWidth = (width - insets.left - insets.right) / Math.max(1, fontScale);
  const wide = Platform.OS === "web" && scaledWidth >= 760;
  const stacked = scaledWidth < 320;
  const reset = () => {
    setCriteria({});
    setMinutesText("");
    setSurprise(undefined);
  };
  const open = (candidate: PickerCandidate) => {
    router.push({ pathname: "/title/[id]", params: { id: candidate.item.id, pinContext: "library" } });
  };
  const muted = { color: theme.global.textSecondary };
  const heading = [type.title, { color: theme.global.textPrimary }];
  const explanation = surpriseCurrent ? "Elegida al azar entre todos los títulos que cumplen tus filtros." :
    criteria.shortest ? "Priorizada por duración informada, con las duraciones desconocidas al final." :
    "Una de tus propuestas del día entre los títulos guardados que cumplen tus filtros.";

  return <>
    <Stack.Screen options={{ title: "¿Qué veo hoy?", headerShown: false }} />
    <ScrollView style={{ backgroundColor: theme.global.background }} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ alignSelf: "center", width: "100%", maxWidth: 1040, padding: space.lg,
        paddingTop: space.lg + insets.top,
        paddingLeft: space.lg + insets.left, paddingRight: space.lg + insets.right,
        paddingBottom: space.xl + insets.bottom, gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <PickerAction label="" accessibilityLabel="Volver" icon="arrow-back" onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/libreria");
        }} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text accessibilityRole="header" style={[type.heading, { color: theme.global.textPrimary }]}>¿Qué veo hoy?</Text>
          <Text style={[type.control, muted]}>Elegí tu próxima historia</Text>
        </View>
      </View>
      <SensitiveFilterStatus active={preference.value.hideSensitive} ready={ready} error={preferenceError} onRetry={retryPreferences} />
      {readError && <>
        <Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>No se pudo leer la Biblioteca.</Text>
        <PickerAction label="Reintentar Biblioteca" onPress={() => setRetry(value => value + 1)} />
      </>}
      {!visible && !readError && !preferenceError && <ActivityIndicator accessibilityLabel="Cargando Biblioteca" color={theme.global.accent} />}
      {visible && <>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
          <PickerAction label={criteria.status ? titleStatusLabel(criteria.status) : "Todos los estados"}
            accessibilityLabel={`Estado: ${criteria.status ? titleStatusLabel(criteria.status) : "Todos los estados"}`}
            onPress={() => setFilterPanel("status")} />
          <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1, gap: space.xs,
            paddingHorizontal: space.sm, borderRadius: radius.control, borderWidth: 1,
            borderColor: theme.global.borderStrong, backgroundColor: theme.global.inputBackground }}>
            <Ionicons name="time-outline" size={18} color={theme.global.textSecondary} />
            <TextInput value={minutesText} onChangeText={value => { setMinutesText(value); setSurprise(undefined); }}
              accessibilityLabel="Tiempo disponible en minutos" inputMode="numeric" placeholder="Sin límite"
              placeholderTextColor={theme.global.textMuted}
              style={[type.control, { minHeight: controlTarget, width: 70 * Math.max(1, fontScale),
                flexShrink: 1, color: theme.global.textPrimary }]} />
            {!!minutesText && <Text style={[type.caption, muted]}>min</Text>}
          </View>
          <PickerAction label="Filtros" accessibilityLabel="Filtros y orden" icon="options-outline" onPress={() => setFilterPanel("all")} />
        </View>
        {activeLabels.length > 0 && <Text style={[type.caption, muted]}>{activeLabels.join(" · ")}</Text>}
        {invalidTime && <Text accessibilityRole="alert" style={{ color: theme.semantic.dangerText }}>Ingresá minutos enteros positivos o dejá el campo vacío.</Text>}
        {result && (result.missingDuration > 0 || result.overTime > 0) && <>
          <Text style={[type.caption, muted]}>El límite excluye títulos sin duración informada o que superan el tiempo disponible.</Text>
          <PickerAction label="Quitar límite de tiempo" onPress={() => { setMinutesText(""); setSurprise(undefined); }} />
        </>}
        {result && (result.eligible.length === 0 ? <>
          <Text accessibilityLiveRegion="polite" style={muted}>
            {visible.length ? "Ningún título cumple todos los filtros activos. Podés ajustar el estado, los demás filtros o el tiempo." :
              "No hay títulos visibles en tu Biblioteca."}
          </Text>
          {visible.length > 0 && <PickerAction label="Limpiar filtros" onPress={reset} />}
        </> : <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={heading}>
              {surpriseCurrent ? "Tu sorpresa" : "Tu propuesta destacada"}
            </Text>
            {!surpriseCurrent && highlighted && displayed.length > 1 &&
              <Text style={[type.caption, muted]}>{displayed.indexOf(highlighted) + 1} de {displayed.length}</Text>}
          </View>
          {highlighted && <CandidateCard candidate={highlighted} featured wide={wide} stacked={stacked}
            explanation={explanation} onlineArt={onlineArt} onPress={() => open(highlighted)} />}
          {alternatives.length > 0 && <View style={{ gap: space.sm }}>
            <Text accessibilityRole="header" style={heading}>Otras propuestas</Text>
            <View style={{ flexDirection: wide ? "row" : "column", gap: space.sm }}>
              {alternatives.map(candidate => <View key={candidate.item.id} style={wide ? { flex: 1, minWidth: 0 } : undefined}>
                <CandidateCard candidate={candidate} featured={false} wide={wide} onlineArt={onlineArt}
                  onPress={() => setPromotion({ daily: result.daily, candidate })} />
              </View>)}
            </View>
          </View>}
          {Platform.OS === "web" && !onlineArt && displayed.some(showablePoster) &&
            <PickerAction label="Cargar portadas con conexión" onPress={() => setOnlineArt(true)} />}
          <View style={{ gap: space.sm }}>
            <PickerAction label={surpriseCurrent ? "Repetir sorpresa" : "Sorpréndeme"} icon="shuffle" primary onPress={() => {
              const candidate = surpriseCandidate(result.eligible);
              if (candidate) setSurprise({ candidates: result.eligible, candidate });
            }} />
            {surpriseCurrent && <PickerAction label="Volver a las propuestas" onPress={() => setSurprise(undefined)} />}
          </View>
        </>)}
      </>}
    </ScrollView>
    <ViewOptionsPanel visible={filterPanel !== null && !!visible} title="Filtros y orden" sections={sections}
      collapsible initialExpandedSection={filterPanel === "status" ? "status" : undefined} onReset={reset}
      onClose={() => setFilterPanel(null)} />
  </>;
}

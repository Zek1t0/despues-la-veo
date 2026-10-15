import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import LibraryScreen, { type LibraryScreenServices } from "../../../app/(tabs)/libreria";
import TitleDetailScreen, { type TitleDetailServices } from "../../../app/title/[id]";
import { TitleGridCard } from "../../components/browsing/TitleGridCard";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { mediaClassificationLabel } from "../../core/presentationLabels";
import { fixtureDetails, fixtureSearch, reviewFixtures, reviewRefreshPairs, type ReviewFixture } from "./fixtures";
import type { ReviewSession } from "./session";

function useReviewFocusEffect(effect: () => void | (() => void)) { useEffect(effect, [effect]); }

export function MediaReview({ session, onReset }: { session: ReviewSession; onReset(): Promise<void> }) {
  const { theme } = useAppTheme();
  const [page, setPage] = useState<"discover" | "remote" | "library" | "local">("discover");
  const [target, setTarget] = useState<"primary" | "restore">("primary");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReviewFixture>(reviewFixtures[0]);
  const [localId, setLocalId] = useState("");
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("Corpus original TEST; no es un proveedor productivo.");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [json, setJson] = useState<string | null>(null);
  const repository = target === "primary" ? session.source : session.restored;
  const navigation = useMemo(() => ({
    back: () => setPage("library"),
  }), []);
  const router = useMemo(() => ({
    back: navigation.back,
    push: (route: Parameters<ReturnType<LibraryScreenServices["useRouter"]>["push"]>[0]) => {
      if (typeof route !== "object" || !("params" in route) || typeof route.params?.id !== "string") {
        throw new Error("La revisión no navega a rutas productivas.");
      }
      setLocalId(route.params.id); setPage("local");
    },
  }), [navigation]);
  const libraryBindings: LibraryScreenServices = useMemo(() => ({ ...repository,
    useRouter: () => router, useFocusEffect: useReviewFocusEffect,
  }), [repository, router]);
  const detailBindings: TitleDetailServices = useMemo(() => ({ ...repository,
    useRouter: () => router, useFocusEffect: useReviewFocusEffect,
    useParams: () => ({ id: localId, pinContext: "library" }),
  }), [repository, router, localId]);
  const action = async (operation: () => Promise<string | void>) => {
    setBusy(true);
    try { const result = await operation(); if (result) setMessage(result); setRevision(value => value + 1); }
    catch (error) { setMessage(`TEST: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setBusy(false); }
  };
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable
    key={label} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy}
    onPress={onPress} style={{ minHeight: 44, justifyContent: "center", padding: 10, borderWidth: 1,
      borderColor: theme.global.borderStrong, borderRadius: 10, opacity: disabled || busy ? 0.45 : 1 }}>
    <Text style={{ color: theme.global.textPrimary }}>{label}</Text>
  </Pressable>;
  const details = fixtureDetails(selected);
  const saveSelected = () => void action(async () => {
    const id = await session.save(selected); setLocalId(id); setTarget("primary");
    return `Guardado en biblioteca de prueba: ${id}`;
  });
  const download = async () => {
    const value = await session.exportTest(); setJson(value);
    const name = `TEST-media-review-v6-${session.identity}.json`;
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
    } else {
      const files = await import("expo-file-system/legacy"), sharing = await import("expo-sharing");
      if (!files.cacheDirectory) throw new Error("No hay directorio temporal para export TEST.");
      const path = files.cacheDirectory + name;
      await files.writeAsStringAsync(path, value);
      if (await sharing.isAvailableAsync()) await sharing.shareAsync(path, { mimeType: "application/json" });
    }
    return `Export TEST v6 listo: ${name}`;
  };
  return <View style={{ flex: 1, backgroundColor: theme.global.background }}>
    <View style={{ padding: 12, gap: 4, borderBottomWidth: 2, borderColor: theme.global.accent }}>
      <Text accessibilityRole="header" style={{ color: theme.global.textPrimary, fontWeight: "900", fontSize: 18 }}>TEST · revisión de medios · DBs aisladas</Text>
    </View>
    <ScrollView style={{ maxHeight: 240, flexGrow: 0 }} contentContainerStyle={{ padding: 12, gap: 4 }}>
      <Text selectable style={{ color: theme.global.textSecondary }}>Origen: {session.names.primary}</Text>
      <Text selectable style={{ color: theme.global.textSecondary }}>Restore: {session.names.restore}</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.global.textPrimary }}>{message}</Text>
      <Text style={{ color: theme.global.textSecondary }}>Base activa: {target}. Fuente sintética: {offline ? "desconectada" : "disponible"}. La DB personal no participa.</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 8 }}>
      {button("Fixtures", () => setPage("discover"))}
      {button("Biblioteca de prueba", () => { setTarget("primary"); setPage("library"); })}
      {button("Biblioteca restaurada", () => { setTarget("restore"); setPage("library"); })}
      {button("Sembrar / resembrar corpus", () => void action(async () => { await session.seed(); return "20 fixtures guardadas por el pipeline real."; }), offline)}
      {button(offline ? "Reconectar fuente sintética" : "Simular sin red", () => setOffline(value => !value))}
      {button("Exportar TEST v6", () => void action(download))}
      {button("Restaurar TEST en segunda DB", () => void action(async () => {
        if (!json) throw new Error("Exportá TEST primero.");
        const result = await session.importTest(json); setTarget("restore"); setPage("library");
        return `Restore real: ${result.inserted} insertados, ${result.updated} actualizados; ${result.pins.inserted} pins.`;
      }), !json)}
      {button("Reset SOLO estas DBs de revisión", () => void action(onReset))}
    </View>
    </ScrollView>
    {page === "discover" && <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
      <TextInput accessibilityLabel="Buscar fixtures originales" value={query} onChangeText={setQuery} placeholder="Buscar corpus TEST…"
        style={{ color: theme.global.textPrimary, borderColor: theme.global.border, borderWidth: 1, padding: 12 }} />
      {fixtureSearch(query).map(result => {
        const fixture = reviewFixtures.find(value => value.reference.provider === result.reference.provider && value.reference.resourceNamespace === result.reference.resourceNamespace && value.reference.externalId === result.reference.externalId)!;
        return <TitleGridCard key={fixture.key} title={result.displayTitle} kindLabel={mediaClassificationLabel(fixture.snapshot)} posterUrl={result.posterUrl}
          accessibilityLabel={`Abrir fixture ${result.displayTitle}`} onPress={() => {
            if (offline) { setMessage("Fuente sintética desconectada; Biblioteca local sigue usable."); return; }
            setSelected(fixture); setLocalId(""); setPage("remote");
          }} />;
      })}
    </ScrollView>}
    {page === "remote" && <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: theme.global.textPrimary, fontSize: 22 }}>{details.snapshot.title}</Text>
      <Text style={{ color: theme.global.textSecondary }}>{mediaClassificationLabel(details.snapshot)} · {details.snapshot.year ?? "Sin fecha"}</Text>
      <Text style={{ color: theme.global.textPrimary }}>{details.snapshot.overview ?? "Sin descripción."}</Text>
      <Text selectable style={{ color: theme.global.textSecondary }}>{JSON.stringify(details.reference)}</Text>
      {button("Guardar en biblioteca de prueba", saveSelected, offline)}
      {button("Abrir detalle local guardado", () => { setTarget("primary"); setPage("local"); }, !localId)}
      {button("Guardar con portada rota de prueba", () => void action(async () => {
        const id = await session.save(selected, { posterUrl: "http://127.0.0.1:1/review-missing.png" });
        setLocalId(id); setTarget("primary"); setPage("local"); return "URL de fallo local; sin portada de catálogo.";
      }), offline)}
      <Text style={{ color: theme.global.textPrimary }}>Pares explícitos de refresh (sembrar corpus primero)</Text>
      {reviewRefreshPairs.map(pair => button(`Refresh ${pair.key}`, () => void action(async () => {
        const fixture = reviewFixtures.find(value => value.key === pair.fixture)!;
        let id: string;
        try {
          id = await session.save(fixture, { ...pair.patch, title: `${fixture.snapshot.title} · refresh`, genres: ["Género externo TEST"] } as Parameters<typeof session.save>[1], pair.reference ?? fixture.reference);
        } catch (error) {
          if (!("reject" in pair && pair.reject)) throw error;
          return `Rechazo esperado ${pair.key}: ${String(error)}`;
        }
        if ("reject" in pair && pair.reject) throw new Error("El caso inválido fue aceptado.");
        setLocalId(id); setTarget("primary"); return `Refresh real ${pair.key}: ${id}. Revisar clasificación y datos personales.`;
      }), offline))}
    </ScrollView>}
    {page === "library" && <LibraryScreen key={`${target}-${revision}`} bindings={libraryBindings} />}
    {page === "local" && <TitleDetailScreen key={`${target}-${localId}-${revision}`} bindings={detailBindings} />}
  </View>;
}

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  Linking,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import {
  getMovieCredits,
  getMovieDetails,
  getTvCredits,
  getTvDetails,
  getWatchProviders,
  posterUrl,
  profileUrl,
  providerLogoUrl,
} from "../../../src/providers/tmdb/tmdbApi";

import type { SavedTitle } from "../../../src/core/savedTitle";
import type {
  TmdbCreditsResponse,
  TmdbWatchProvidersCountry,
} from "../../../src/providers/tmdb/tmdbTypes";

import { getByProviderExternal, upsertSavedTitle } from "../../../src/storage/savedTitlesRepo";
import { colors } from "../../../src/theme/colors";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function yearFromDate(date?: string) {
  if (!date) return null;
  const y = String(date).slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

function minutesToH(min?: number | null) {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 14,
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

function uniqByName(arr: { provider_name: string }[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const p of arr) {
    const k = String(p.provider_name || "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

export default function TmdbDetailScreen() {
  const router = useRouter();
  const { type, id } = useLocalSearchParams<{ type: "movie" | "tv"; id: string }>();

  const [data, setData] = useState<any>(null);
  const [credits, setCredits] = useState<TmdbCreditsResponse | null>(null);
  const [watch, setWatch] = useState<TmdbWatchProvidersCountry | null>(null);

  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!type || !id) return;
      setLoading(true);

      try {
        const numId = Number(id);
        const externalId = String(id);

        const existing = await getByProviderExternal("tmdb", externalId);
        if (!cancelled) setSavedId(existing?.id ?? null);

        const [d, c, w] = await Promise.all([
          type === "movie" ? getMovieDetails(numId) : getTvDetails(numId),
          type === "movie" ? getMovieCredits(numId) : getTvCredits(numId),
          getWatchProviders(type, numId),
        ]);

        const country = w?.results?.AR ?? w?.results?.US ?? null;

        if (!cancelled) {
          setData(d);
          setCredits(c);
          setWatch(country);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setData(null);
          setCredits(null);
          setWatch(null);
          Alert.alert("Error", e?.message ?? "No se pudo cargar.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  const title = useMemo(() => {
    if (!data) return "";
    return type === "movie" ? data.title : data.name;
  }, [data, type]);

  const headerTitle = useMemo(() => {
    const t = title || (type === "movie" ? "Película" : "Serie");
    return t.length > 28 ? t.slice(0, 28) + "…" : t;
  }, [title, type]);

  const year = useMemo(() => {
    if (!data) return null;
    const date = type === "movie" ? data.release_date : data.first_air_date;
    return yearFromDate(date);
  }, [data, type]);

  const rating = useMemo(() => {
    const v = data?.vote_average;
    if (typeof v !== "number") return "—";
    return `${v.toFixed(1)}/10`;
  }, [data]);

  const runtimeText = useMemo(() => {
    if (!data) return null;
    if (type === "movie") return minutesToH(data.runtime ?? null);
    const rt = Array.isArray(data.episode_run_time) ? data.episode_run_time[0] : null;
    return minutesToH(rt ?? null);
  }, [data, type]);

  const genres: { id: number; name: string }[] = useMemo(() => {
    if (!data?.genres || !Array.isArray(data.genres)) return [];
    return data.genres;
  }, [data]);

  const poster = useMemo(() => posterUrl(data?.poster_path), [data]);

  const director = useMemo(() => {
    if (type !== "movie") return null;
    const crew = credits?.crew ?? [];
    return crew.find((p) => p.job === "Director")?.name ?? null;
  }, [credits, type]);

  const topCast = useMemo(() => (credits?.cast ?? []).slice(0, 10), [credits]);

  const streaming = watch?.flatrate ?? [];
  const rent = watch?.rent ?? [];
  const buy = watch?.buy ?? [];
  const watchLink = watch?.link ?? null;

  const topStreaming = uniqByName(streaming).slice(0, 6);
  const topRent = uniqByName(rent).slice(0, 6);
  const topBuy = uniqByName(buy).slice(0, 6);

  async function openWatchLink() {
    if (!watchLink) return;
    try {
      await Linking.openURL(watchLink);
    } catch {}
  }

  async function saveToLibrary() {
    if (!data || !type || !id) return;

    if (savedId) {
      router.push(`/title/${savedId}`);
      return;
    }

    const now = Date.now();
    const externalId = String(id);

    const date = type === "movie" ? data.release_date : data.first_air_date;
    const yearNum = date ? Number(String(date).slice(0, 4)) : null;

    const genreNames: string[] = Array.isArray(data?.genres)
      ? data.genres.map((g: any) => String(g.name)).filter(Boolean)
      : [];

    const voteAvg: number | null =
      typeof data?.vote_average === "number" ? data.vote_average : null;

    const overview: string | null =
      typeof data?.overview === "string" && data.overview.trim().length > 0
        ? data.overview
        : null;

    const existing = await getByProviderExternal("tmdb", externalId);

    try {
      setSaving(true);

      const item: SavedTitle = {
        id: existing?.id ?? uuid(),
        provider: "tmdb",
        externalId,
        type,
        title: title ?? "Sin título",
        year: yearNum,
        posterUrl: poster ?? null,

        overview,
        voteAverage: voteAvg,
        genres: genreNames,

        status: "planned",
        tags: genreNames,

        notes: null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const newSavedId = await upsertSavedTitle(item);
      setSavedId(newSavedId);

      if (Platform.OS === "web") alert("Guardado ✅");
      else Alert.alert("Listo", "Guardado en tu biblioteca ✅");

      router.push(`/title/${newSavedId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ gap: 10, alignItems: "center", paddingTop: 30 }}>
            <ActivityIndicator />
            <Text style={{ color: colors.muted, fontWeight: "700" }}>Cargando…</Text>
          </View>
        ) : !data ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
              No se pudo cargar
            </Text>
            <Text style={{ color: colors.muted }}>Probá volver y entrar de nuevo.</Text>
          </View>
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {poster ? (
                  <Image
                    source={{ uri: poster }}
                    style={{
                      width: 120,
                      height: 180,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 120,
                      height: 180,
                      borderRadius: 14,
                      backgroundColor: colors.card2,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.muted }}>Sin póster</Text>
                  </View>
                )}

                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>
                    {title} {year ? `(${year})` : ""}
                  </Text>

                  <Text style={{ color: colors.muted, fontWeight: "700" }}>
                    {type.toUpperCase()}
                    {runtimeText ? ` • ${runtimeText}` : ""}
                    {type === "tv" && data.number_of_seasons ? ` • ${data.number_of_seasons} temp` : ""}
                  </Text>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Pill text={`⭐ ${rating}`} />
                    {genres.slice(0, 4).map((g) => (
                      <Pill key={g.id} text={g.name} />
                    ))}
                  </View>

                  {!!director && (
                    <Text style={{ color: colors.subtle, fontWeight: "800" }}>
                      Director: <Text style={{ color: colors.text }}>{director}</Text>
                    </Text>
                  )}

                  {typeof data.overview === "string" && data.overview.trim().length > 0 ? (
                    <View style={{ gap: 6 }}>
                      <Text style={{ color: colors.muted, lineHeight: 20 }}>
                        {overviewExpanded
                          ? data.overview
                          : String(data.overview).slice(0, 220) +
                            (data.overview.length > 220 ? "…" : "")}
                      </Text>

                      {String(data.overview).length > 220 && (
                        <Pressable onPress={() => setOverviewExpanded((v) => !v)}>
                          <Text style={{ color: colors.text, fontWeight: "900" }}>
                            {overviewExpanded ? "Ver menos" : "Ver más"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            </Card>

            <Pressable
              onPress={saveToLibrary}
              disabled={saving}
              style={{
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: saving ? "#3b3b3b" : colors.primary,
                alignItems: "center",
              }}
            >
              <Text style={{ color: saving ? colors.text : colors.bg, fontWeight: "900" }}>
                {saving ? "Guardando…" : savedId ? "Ir a Biblioteca" : "Guardar en Biblioteca"}
              </Text>
            </Pressable>

            <Card>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                Reparto principal
              </Text>

              {topCast.length === 0 ? (
                <Text style={{ color: colors.muted }}>Sin datos de reparto.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {topCast.map((p) => {
                    const avatar = profileUrl(p.profile_path, "w185");
                    return (
                      <View
                        key={p.id}
                        style={{
                          width: 120,
                          borderRadius: 14,
                          backgroundColor: colors.card2,
                          borderWidth: 1,
                          borderColor: colors.border2,
                          padding: 10,
                          gap: 8,
                        }}
                      >
                        {avatar ? (
                          <Image
                            source={{ uri: avatar }}
                            style={{ width: "100%", height: 120, borderRadius: 12 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: "100%",
                              height: 120,
                              borderRadius: 12,
                              backgroundColor: colors.card,
                              borderWidth: 1,
                              borderColor: colors.border,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: colors.muted, fontSize: 12 }}>Sin foto</Text>
                          </View>
                        )}

                        <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={{ color: colors.muted }} numberOfLines={2}>
                          {p.character ? p.character : ""}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </Card>

            <Card>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                Dónde ver
              </Text>

              {topStreaming.length === 0 && topRent.length === 0 && topBuy.length === 0 ? (
                <Text style={{ color: colors.muted }}>
                  No hay datos de plataformas para tu región.
                </Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {topStreaming.length > 0 && (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: colors.subtle, fontWeight: "800" }}>Streaming</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {topStreaming.map((p: any) => {
                          const logo = providerLogoUrl(p.logo_path, "w92");
                          return (
                            <View
                              key={p.provider_id}
                              style={{
                                width: 86,
                                padding: 10,
                                borderRadius: 14,
                                backgroundColor: colors.card2,
                                borderWidth: 1,
                                borderColor: colors.border2,
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              {logo ? (
                                <Image source={{ uri: logo }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                              ) : (
                                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.card }} />
                              )}
                              <Text style={{ color: colors.text, fontWeight: "800" }} numberOfLines={2}>
                                {p.provider_name}
                              </Text>
                            </View>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {topRent.length > 0 && (
                    <Text style={{ color: colors.muted }}>
                      Alquiler: {topRent.map((x: any) => x.provider_name).join(", ")}
                    </Text>
                  )}

                  {topBuy.length > 0 && (
                    <Text style={{ color: colors.muted }}>
                      Compra: {topBuy.map((x: any) => x.provider_name).join(", ")}
                    </Text>
                  )}
                </View>
              )}

              {watchLink && (
                <Pressable
                  onPress={openWatchLink}
                  style={{
                    marginTop: 8,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.bg, fontWeight: "900" }}>
                    Ver enlaces de plataformas
                  </Text>
                </Pressable>
              )}
            </Card>

            <Text style={{ color: colors.subtle }}>
              Tip: al guardarlo, después editás status/tags/notas en tu Biblioteca.
            </Text>
          </>
        )}
      </ScrollView>
    </>
  );
}
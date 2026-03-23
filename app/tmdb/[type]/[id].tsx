import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getMovieDetails, getTvDetails, posterUrl } from "../../../src/providers/tmdb/tmdbApi";
import type { SavedTitle } from "../../../src/core/savedTitle";
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

export default function TmdbDetailScreen() {
  const router = useRouter();
  const { type, id } = useLocalSearchParams<{ type: "movie" | "tv"; id: string }>();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!type || !id) return;
      setLoading(true);

      try {
        const externalId = String(id);

        // 1) chequear si ya está guardado
        const existing = await getByProviderExternal("tmdb", externalId);
        if (!cancelled) setSavedId(existing?.id ?? null);

        // 2) pedir detalle
        const numId = Number(id);
        const d = type === "movie" ? await getMovieDetails(numId) : await getTvDetails(numId);
        if (!cancelled) setData(d);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setData(null);
          setSavedId(null);
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

    // TV a veces trae episode_run_time: number[]
    const rt = Array.isArray(data.episode_run_time) ? data.episode_run_time[0] : null;
    return minutesToH(rt ?? null);
  }, [data, type]);

  const genres: { id: number; name: string }[] = useMemo(() => {
    if (!data?.genres || !Array.isArray(data.genres)) return [];
    return data.genres;
  }, [data]);

  const poster = useMemo(() => {
    if (!data?.poster_path) return null;
    return posterUrl(data.poster_path);
  }, [data]);

  async function saveToLibrary() {
    if (!data || !type || !id) return;

    // si ya está guardado, ir directo
    if (savedId) {
      router.push(`/title/${savedId}`);
      return;
    }

    try {
      setSaving(true);

      const now = Date.now();
      const externalId = String(id);
      const date = type === "movie" ? data.release_date : data.first_air_date;
      const y = date ? Number(String(date).slice(0, 4)) : null;

      const item: SavedTitle = {
        id: uuid(),
        provider: "tmdb",
        externalId,
        type,
        title: title ?? "Sin título",
        year: y,
        posterUrl: poster ?? null,
        status: "planned",
        tags: [],
        notes: null,
        createdAt: now,
        updatedAt: now,
      };

      const newSavedId = await upsertSavedTitle(item);
      setSavedId(newSavedId);
      router.push(`/title/${newSavedId}`);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
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
          <Text style={{ color: colors.muted }}>
            Probá volver y entrar de nuevo.
          </Text>
        </View>
      ) : (
        <>
          {/* HERO */}
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

                {!!data.tagline && (
                  <Text style={{ color: colors.text, fontStyle: "italic", fontWeight: "700" }}>
                    “{data.tagline}”
                  </Text>
                )}
              </View>
            </View>
          </Card>

          {/* SAVE BUTTON */}
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

          {/* OVERVIEW */}
          <Card>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              Resumen
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              {data.overview?.trim() ? data.overview : "Sin descripción."}
            </Text>
          </Card>

          {/* EXTRA INFO */}
          <Card>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              Info
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted }}>
                TMDB • {type.toUpperCase()} • id {id}
              </Text>

              {type === "tv" && (
                <Text style={{ color: colors.muted }}>
                  {data.number_of_seasons ? `Temporadas: ${data.number_of_seasons}` : ""}
                  {data.number_of_episodes ? ` • Episodios: ${data.number_of_episodes}` : ""}
                </Text>
              )}

              {!!data.status && <Text style={{ color: colors.muted }}>Estado: {data.status}</Text>}
            </View>
          </Card>

          <Text style={{ color: colors.subtle }}>
            Tip: al guardarlo, después editás status/tags/notas en tu Biblioteca.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
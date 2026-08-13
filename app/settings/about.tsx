import React, { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { colors } from "../../src/theme/colors";

const TMDB_URL = "https://www.themoviedb.org";
const JUSTWATCH_URL = "https://www.justwatch.com/";
const TMDB_NOTICE = "This product uses the TMDB API but is not endorsed or certified by TMDB.";

export default function AboutScreen() {
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkOpeningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const openExternalLink = async (url: string, failureMessage: string) => {
    if (linkOpeningRef.current) return;
    linkOpeningRef.current = true;
    if (mountedRef.current) setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      if (mountedRef.current) {
        setLinkError(failureMessage);
      }
    } finally {
      linkOpeningRef.current = false;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Acerca de / Créditos" }} />
      <ScrollView
        contentContainerStyle={{
          alignSelf: "center",
          gap: 18,
          maxWidth: 720,
          padding: 20,
          paddingBottom: 40,
          width: "100%",
        }}
      >
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900" }}>
            Después la veo
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Una aplicación local-first para encontrar películas y series y organizar tu biblioteca personal.
          </Text>
        </View>

        <View
          accessibilityLabel="Créditos de The Movie Database"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 14,
            padding: 18,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>Créditos</Text>
          <View style={{ alignSelf: "center", maxWidth: 120, width: "100%" }}>
            <Image
              accessible={false}
              resizeMode="contain"
              source={require("../../assets/tmdb-primary-full-blue.png")}
              style={{ aspectRatio: 185.04 / 133.4, width: "100%" }}
            />
          </View>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Los datos remotos de películas y series son provistos por TMDB, un servicio externo.
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Los datos de disponibilidad en streaming, alquiler y compra son provistos por JustWatch a través de TMDB.
          </Text>
          <Text style={{ color: colors.text, lineHeight: 21 }}>{TMDB_NOTICE}</Text>

          <Pressable
            accessibilityLabel="Abrir el sitio oficial de TMDB"
            accessibilityRole="link"
            onPress={() =>
              void openExternalLink(
                TMDB_URL,
                "No pudimos abrir TMDB. Intentá nuevamente desde tu navegador."
              )
            }
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: colors.card2,
              borderColor: colors.border2,
              borderRadius: 14,
              borderWidth: 1,
              justifyContent: "center",
              minHeight: 44,
              opacity: pressed ? 0.78 : 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
            })}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>Visitar TMDB</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Abrir el sitio oficial de JustWatch"
            accessibilityRole="link"
            onPress={() =>
              void openExternalLink(
                JUSTWATCH_URL,
                "No pudimos abrir JustWatch. Intentá nuevamente desde tu navegador."
              )
            }
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: colors.card2,
              borderColor: colors.border2,
              borderRadius: 14,
              borderWidth: 1,
              justifyContent: "center",
              minHeight: 44,
              opacity: pressed ? 0.78 : 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
            })}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>Visitar JustWatch</Text>
          </Pressable>

          {linkError !== null && (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, lineHeight: 21 }}>
              {linkError}
            </Text>
          )}
        </View>
      </ScrollView>
    </>
  );
}

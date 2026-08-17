import React, { useMemo } from "react";
import { Stack } from "expo-router";
import { ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { TmdbCredentialProvider } from "../src/providers/tmdb/credential/TmdbCredentialProvider";
import { AppThemeProvider, useAppTheme } from "../src/theme/AppThemeProvider";
import { createNavigationTheme } from "../src/theme/navigationTheme";
import { WebThemeSynchronizer } from "../src/theme/WebThemeSynchronizer";
import "../global.css";

function ThemeBootstrapFallback() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0b0b0b" }}>
      <StatusBar style="light" />
    </View>
  );
}

function ThemedRootLayout() {
  const { theme, effectiveScheme } = useAppTheme();
  const navigationTheme = useMemo(() => createNavigationTheme(theme), [theme]);

  return (
    <ThemeProvider value={navigationTheme}>
      <WebThemeSynchronizer theme={theme} />
      <StatusBar style={effectiveScheme === "dark" ? "light" : "dark"} />
      <TmdbCredentialProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.global.background },
            headerTintColor: theme.global.textPrimary,
            contentStyle: { backgroundColor: theme.global.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings/appearance" options={{ title: "Apariencia" }} />
          <Stack.Screen name="settings/tmdb" options={{ title: "Configurar TMDB" }} />
          <Stack.Screen name="settings/about" options={{ title: "Acerca de / Créditos" }} />
        </Stack>
      </TmdbCredentialProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider fallback={<ThemeBootstrapFallback />}>
      <ThemedRootLayout />
    </AppThemeProvider>
  );
}

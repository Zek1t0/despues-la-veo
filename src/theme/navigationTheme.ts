import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

import type { ThemeDefinition } from "./types";

export function createNavigationTheme(theme: ThemeDefinition): Theme {
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.isDark,
    colors: {
      ...base.colors,
      primary: theme.global.accent,
      background: theme.global.background,
      card: theme.global.surface,
      text: theme.global.textPrimary,
      border: theme.global.border,
      notification: theme.semantic.dangerText,
    },
  };
}

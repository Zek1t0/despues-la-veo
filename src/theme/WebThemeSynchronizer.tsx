import { useEffect } from "react";

import { deriveBrowserChromeTheme } from "./browserChromeTheme";
import type { ThemeDefinition } from "./types";

export function WebThemeSynchronizer({ theme }: Readonly<{ theme: ThemeDefinition }>) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const browserChrome = deriveBrowserChromeTheme(theme);
    const variables = {
      "--app-background": browserChrome.background,
      "--app-foreground": browserChrome.foreground,
      "--app-surface": browserChrome.surface,
      "--app-border": browserChrome.border,
      "--app-accent": browserChrome.accent,
      "--app-scrollbar-track": browserChrome.scrollbarTrack,
      "--app-scrollbar-thumb": browserChrome.scrollbarThumb,
      "--app-scrollbar-thumb-hover": browserChrome.scrollbarThumbHover,
    } as const;

    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value);
    }
    root.style.colorScheme = theme.effectiveScheme;
    root.dataset.appScheme = theme.effectiveScheme;

    return () => {
      for (const name of Object.keys(variables)) root.style.removeProperty(name);
      root.style.removeProperty("color-scheme");
      delete root.dataset.appScheme;
    };
  }, [theme]);

  return null;
}

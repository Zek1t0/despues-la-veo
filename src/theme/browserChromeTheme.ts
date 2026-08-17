import type { ThemeDefinition } from "./types";

export type BrowserChromeTheme = Readonly<{
  background: string;
  foreground: string;
  surface: string;
  border: string;
  accent: string;
  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
}>;

function parseHex(color: string): readonly [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error(`Browser chrome requires a #RRGGBB color: ${color}`);
  }
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)) as
    unknown as readonly [number, number, number];
}

function mixHex(first: string, second: string, secondWeight: number): string {
  const firstChannels = parseHex(first);
  const secondChannels = parseHex(second);
  const channels = firstChannels.map((channel, index) =>
    Math.round(channel * (1 - secondWeight) + secondChannels[index] * secondWeight)
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function deriveBrowserChromeTheme(theme: ThemeDefinition): BrowserChromeTheme {
  const scrollbarThumb = mixHex(theme.global.border, theme.global.borderStrong, 0.875);
  return Object.freeze({
    background: theme.global.background,
    foreground: theme.global.textPrimary,
    surface: theme.global.surface,
    border: theme.global.border,
    accent: theme.global.accent,
    scrollbarTrack: theme.global.inputBackground,
    scrollbarThumb,
    scrollbarThumbHover: mixHex(scrollbarThumb, theme.global.textMuted, 0.135),
  });
}

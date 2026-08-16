import {
  DarkBase,
  DARK_SEMANTIC_TOKENS,
  DARK_STRUCTURAL_TOKENS,
  LightBase,
  LIGHT_SEMANTIC_TOKENS,
  LIGHT_STRUCTURAL_TOKENS,
} from "./bases";
import { APPEARANCE_PALETTES, isAppearancePaletteId } from "./palettes";
import type {
  AppearancePaletteId,
  AppearancePreference,
  AppearanceScheme,
  EffectiveScheme,
  ThemeDefinition,
} from "./types";

type LightInvariantTokens = Pick<
  ThemeDefinition["global"],
  "background" | "surface" | "surfaceSecondary" | "inputBackground" | "textPrimary"
>;

function parseHexChannel(value: string, offset: number): number {
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Relative luminance requires a #RRGGBB color: ${value}`);
  }
  return Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
}

function linearizeSrgb(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  const red = linearizeSrgb(parseHexChannel(color, 1));
  const green = linearizeSrgb(parseHexChannel(color, 3));
  const blue = linearizeSrgb(parseHexChannel(color, 5));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(firstColor: string, secondColor: string): number {
  const first = relativeLuminance(firstColor);
  const second = relativeLuminance(secondColor);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function assertLightThemeInvariant(tokens: LightInvariantTokens): void {
  for (const surfaceToken of [
    "background",
    "surface",
    "surfaceSecondary",
    "inputBackground",
  ] as const) {
    const luminance = relativeLuminance(tokens[surfaceToken]);
    if (luminance < 0.5) {
      throw new Error(`Light theme ${surfaceToken} luminance must be >= 0.50`);
    }
  }

  if (relativeLuminance(tokens.textPrimary) >= relativeLuminance(tokens.background)) {
    throw new Error("Light theme textPrimary must be darker than background");
  }
  if (contrastRatio(tokens.textPrimary, tokens.background) < 4.5) {
    throw new Error("Light theme textPrimary/background contrast must be >= 4.5:1");
  }
}

export function resolveEffectiveScheme(
  persistedScheme: AppearanceScheme,
  runtimeSystemScheme: EffectiveScheme
): EffectiveScheme {
  return persistedScheme === "system" ? runtimeSystemScheme : persistedScheme;
}

export function resolveTheme(
  effectiveScheme: EffectiveScheme,
  paletteId: AppearancePaletteId
): ThemeDefinition {
  if (!isAppearancePaletteId(paletteId)) {
    throw new Error(`Unknown appearance palette: ${String(paletteId)}`);
  }
  const palette = APPEARANCE_PALETTES[paletteId];
  const base = effectiveScheme === "dark" ? DarkBase : LightBase;
  const semantic = effectiveScheme === "dark" ? DARK_SEMANTIC_TOKENS : LIGHT_SEMANTIC_TOKENS;
  const structural = effectiveScheme === "dark" ? DARK_STRUCTURAL_TOKENS : LIGHT_STRUCTURAL_TOKENS;

  const global = Object.freeze({ ...base, ...palette.overrides[effectiveScheme] });

  return Object.freeze({
    effectiveScheme,
    paletteId,
    isDark: effectiveScheme === "dark",
    global,
    semantic,
    structural,
  });
}

export function resolveAppearanceTheme(
  preference: AppearancePreference,
  runtimeSystemScheme: EffectiveScheme
): ThemeDefinition {
  return resolveTheme(
    resolveEffectiveScheme(preference.scheme, runtimeSystemScheme),
    preference.palette
  );
}

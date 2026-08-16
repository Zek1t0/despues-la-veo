export const APPEARANCE_SCHEMES = ["system", "light", "dark"] as const;
export type AppearanceScheme = (typeof APPEARANCE_SCHEMES)[number];

export const EFFECTIVE_SCHEMES = ["light", "dark"] as const;
export type EffectiveScheme = (typeof EFFECTIVE_SCHEMES)[number];

export const APPEARANCE_PALETTE_IDS = [
  "original",
  "green-apple",
  "tide",
  "midnight-twilight",
  "lavender",
  "obsidian",
] as const;
export type AppearancePaletteId = (typeof APPEARANCE_PALETTE_IDS)[number];

export const APPEARANCE_PREFERENCE_VERSION = 1 as const;

export type AppearancePreference = Readonly<{
  version: typeof APPEARANCE_PREFERENCE_VERSION;
  scheme: AppearanceScheme;
  palette: AppearancePaletteId;
}>;

export type GlobalThemeTokens = Readonly<{
  background: string;
  surface: string;
  surfaceSecondary: string;
  inputBackground: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  onAccent: string;
  selectedSurface: string;
  selectedForeground: string;
  selectedBorder: string;
}>;

export type SemanticThemeTokens = Readonly<{
  dangerSurface: string;
  dangerBorder: string;
  dangerText: string;
  disabledSurface: string;
  disabledText: string;
  personalRatingLowBackground: string;
  personalRatingLowForeground: string;
  personalRatingMediumBackground: string;
  personalRatingMediumForeground: string;
  personalRatingHighBackground: string;
  personalRatingHighForeground: string;
}>;

export type StructuralThemeTokens = Readonly<{
  imageOverlay: string;
  imageOverlayStrong: string;
  onImageOverlay: string;
  imageOverlayBorder: string;
  modalBackdrop: string;
}>;

export type ThemeDefinition = Readonly<{
  effectiveScheme: EffectiveScheme;
  paletteId: AppearancePaletteId;
  isDark: boolean;
  global: GlobalThemeTokens;
  semantic: SemanticThemeTokens;
  structural: StructuralThemeTokens;
}>;

export type PaletteGlobalOverrides = Readonly<Partial<GlobalThemeTokens>>;

export type AppearancePaletteDefinition = Readonly<{
  id: AppearancePaletteId;
  displayName: string;
  overrides: Readonly<{
    light: PaletteGlobalOverrides;
    dark: PaletteGlobalOverrides;
  }>;
}>;

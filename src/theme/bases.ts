import type { GlobalThemeTokens, SemanticThemeTokens, StructuralThemeTokens } from "./types";

export const DarkBase: GlobalThemeTokens = Object.freeze({
  background: "#0b0b0b",
  surface: "#101010",
  surfaceSecondary: "#141414",
  inputBackground: "#0f0f0f",
  textPrimary: "#f2f2f2",
  textSecondary: "#bdbdbd",
  textMuted: "#9a9a9a",
  border: "#242424",
  borderStrong: "#2c2c2c",
  accent: "#ffffff",
  onAccent: "#0b0b0b",
  selectedSurface: "#ffffff",
  selectedForeground: "#0b0b0b",
  selectedBorder: "#ffffff",
});

export const LightBase: GlobalThemeTokens = Object.freeze({
  background: "#f6f6f6",
  surface: "#ffffff",
  surfaceSecondary: "#eeeeee",
  inputBackground: "#ffffff",
  textPrimary: "#171717",
  textSecondary: "#4f4f4f",
  textMuted: "#707070",
  border: "#d5d5d5",
  borderStrong: "#bdbdbd",
  accent: "#171717",
  onAccent: "#ffffff",
  selectedSurface: "#e4e4e4",
  selectedForeground: "#171717",
  selectedBorder: "#171717",
});

export const DARK_SEMANTIC_TOKENS: SemanticThemeTokens = Object.freeze({
  dangerSurface: "#4a1f1f",
  dangerBorder: "#5a2a2a",
  dangerText: "#f4b8b8",
  onDangerSurface: "#f2f2f2",
  personalRatingErrorText: "#5a2a2a",
  disabledSurface: "#3b3b3b",
  disabledText: "#f2f2f2",
  personalRatingLowBackground: "#f4b8b8",
  personalRatingLowForeground: "#4a1111",
  personalRatingMediumBackground: "#f3d88a",
  personalRatingMediumForeground: "#3f2c00",
  personalRatingHighBackground: "#a9ddb9",
  personalRatingHighForeground: "#123a20",
});

export const LIGHT_SEMANTIC_TOKENS: SemanticThemeTokens = Object.freeze({
  dangerSurface: "#fbe8e8",
  dangerBorder: "#b54848",
  dangerText: "#7d2020",
  onDangerSurface: "#7d2020",
  personalRatingErrorText: "#7d2020",
  disabledSurface: "#e1e1e1",
  disabledText: "#737373",
  personalRatingLowBackground: "#f4b8b8",
  personalRatingLowForeground: "#4a1111",
  personalRatingMediumBackground: "#f3d88a",
  personalRatingMediumForeground: "#3f2c00",
  personalRatingHighBackground: "#a9ddb9",
  personalRatingHighForeground: "#123a20",
});

const POSTER_STRUCTURAL_TOKENS: StructuralThemeTokens = Object.freeze({
  imageOverlay: "rgba(11, 11, 11, 0.78)",
  imageOverlayMedium: "rgba(11, 11, 11, 0.82)",
  imageOverlayStrong: "rgba(11, 11, 11, 0.9)",
  imageOverlayLabel: "rgba(11, 11, 11, 0.94)",
  onImageOverlay: "#f2f2f2",
  onImageOverlaySecondary: "#bdbdbd",
  imageOverlayBorder: "rgba(255, 255, 255, 0.22)",
  modalBackdrop: "rgba(0, 0, 0, 0.68)",
});

export const DARK_STRUCTURAL_TOKENS = POSTER_STRUCTURAL_TOKENS;
export const LIGHT_STRUCTURAL_TOKENS = POSTER_STRUCTURAL_TOKENS;

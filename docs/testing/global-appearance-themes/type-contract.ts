import type { ThemeDefinition } from "../../../src/theme/types";

// This compile-only fixture proves that consumers cannot construct an incomplete theme.
// @ts-expect-error ThemeDefinition requires metadata plus complete global, semantic and structural groups.
const incompleteTheme: ThemeDefinition = { effectiveScheme: "dark" };

const completeExceptSelectionForeground = {
  effectiveScheme: "dark",
  paletteId: "original",
  isDark: true,
  global: {
    background: "#000000",
    surface: "#000000",
    surfaceSecondary: "#000000",
    inputBackground: "#000000",
    textPrimary: "#ffffff",
    textSecondary: "#ffffff",
    textMuted: "#ffffff",
    border: "#ffffff",
    borderStrong: "#ffffff",
    accent: "#ffffff",
    onAccent: "#000000",
    selectedSurface: "#ffffff",
    selectedBorder: "#ffffff",
  },
  semantic: {
    dangerSurface: "#000000",
    dangerBorder: "#000000",
    dangerText: "#ffffff",
    disabledSurface: "#000000",
    disabledText: "#ffffff",
    personalRatingLowBackground: "#000000",
    personalRatingLowForeground: "#ffffff",
    personalRatingMediumBackground: "#000000",
    personalRatingMediumForeground: "#ffffff",
    personalRatingHighBackground: "#000000",
    personalRatingHighForeground: "#ffffff",
  },
  structural: {
    imageOverlay: "#000000",
    imageOverlayStrong: "#000000",
    onImageOverlay: "#ffffff",
    imageOverlayBorder: "#ffffff",
    modalBackdrop: "#000000",
  },
} as const;

// @ts-expect-error selectedForeground is a required global token of every complete theme.
const missingSelectedForeground: ThemeDefinition = completeExceptSelectionForeground;

void incompleteTheme;
void missingSelectedForeground;

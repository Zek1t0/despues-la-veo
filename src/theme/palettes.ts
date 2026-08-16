import { APPEARANCE_PALETTE_IDS, type AppearancePaletteDefinition, type AppearancePaletteId } from "./types";

const definePalette = (definition: AppearancePaletteDefinition): AppearancePaletteDefinition =>
  Object.freeze({
    ...definition,
    overrides: Object.freeze({
      light: Object.freeze({ ...definition.overrides.light }),
      dark: Object.freeze({ ...definition.overrides.dark }),
    }),
  });

export const APPEARANCE_PALETTES: Readonly<Record<AppearancePaletteId, AppearancePaletteDefinition>> =
  Object.freeze({
    original: definePalette({
      id: "original",
      displayName: "Original",
      overrides: { light: {}, dark: {} },
    }),
    "green-apple": definePalette({
      id: "green-apple",
      displayName: "Manzana verde",
      overrides: {
        light: {
          accent: "#397a22",
          onAccent: "#ffffff",
          selectedSurface: "#e1f2d9",
          selectedBorder: "#397a22",
        },
        dark: {
          accent: "#9be56f",
          onAccent: "#102108",
          selectedSurface: "#21351a",
          selectedForeground: "#f2f2f2",
          selectedBorder: "#78bd52",
        },
      },
    }),
    tide: definePalette({
      id: "tide",
      displayName: "Marea",
      overrides: {
        light: {
          background: "#f1f8f8",
          surface: "#fbffff",
          surfaceSecondary: "#e2f0f0",
          border: "#c4dddd",
          borderStrong: "#94bcbc",
          accent: "#087b83",
          onAccent: "#ffffff",
          selectedSurface: "#d2ecee",
          selectedBorder: "#087b83",
        },
        dark: {
          background: "#081113",
          surface: "#0c181b",
          surfaceSecondary: "#112125",
          inputBackground: "#0a1618",
          border: "#20383d",
          borderStrong: "#2d5056",
          accent: "#62d3d5",
          onAccent: "#062426",
          selectedSurface: "#15383c",
          selectedForeground: "#f2f2f2",
          selectedBorder: "#4bbabd",
        },
      },
    }),
    "midnight-twilight": definePalette({
      id: "midnight-twilight",
      displayName: "Crepúsculo de medianoche",
      overrides: {
        light: {
          background: "#f4f3fa",
          surface: "#fdfcff",
          surfaceSecondary: "#e9e6f5",
          inputBackground: "#fdfcff",
          border: "#d2cce7",
          borderStrong: "#aaa0cd",
          accent: "#5546a6",
          onAccent: "#ffffff",
          selectedSurface: "#e2ddf4",
          selectedBorder: "#5546a6",
        },
        dark: {
          background: "#090a18",
          surface: "#101226",
          surfaceSecondary: "#171a33",
          inputBackground: "#0d0f21",
          border: "#282b4b",
          borderStrong: "#3b3f68",
          accent: "#aaa0ff",
          onAccent: "#171331",
          selectedSurface: "#292552",
          selectedForeground: "#f2f2f2",
          selectedBorder: "#8e83ed",
        },
      },
    }),
    lavender: definePalette({
      id: "lavender",
      displayName: "Lavanda",
      overrides: {
        light: {
          background: "#f8f5fb",
          surfaceSecondary: "#eee7f5",
          border: "#ddd1e8",
          borderStrong: "#bda9cf",
          accent: "#75509b",
          onAccent: "#ffffff",
          selectedSurface: "#ebdef4",
          selectedBorder: "#75509b",
        },
        dark: {
          background: "#100d13",
          surface: "#17121b",
          surfaceSecondary: "#1e1724",
          border: "#34283d",
          borderStrong: "#4a3857",
          accent: "#d2a8ef",
          onAccent: "#2b1737",
          selectedSurface: "#382743",
          selectedForeground: "#f2f2f2",
          selectedBorder: "#b88bd7",
        },
      },
    }),
    obsidian: definePalette({
      id: "obsidian",
      displayName: "Obsidiana",
      overrides: {
        light: {
          background: "#fafafa",
          surfaceSecondary: "#ededed",
          textPrimary: "#111111",
          textSecondary: "#454545",
          textMuted: "#686868",
          border: "#d0d0d0",
          borderStrong: "#a8a8a8",
          accent: "#292929",
          onAccent: "#ffffff",
          selectedSurface: "#dedede",
          selectedBorder: "#292929",
        },
        dark: {
          background: "#000000",
          surface: "#090909",
          surfaceSecondary: "#121212",
          inputBackground: "#080808",
          textPrimary: "#f5f5f5",
          textSecondary: "#c1c1c1",
          textMuted: "#929292",
          borderStrong: "#353535",
          accent: "#e7e7e7",
          onAccent: "#111111",
          selectedSurface: "#2b2b2b",
          selectedForeground: "#f5f5f5",
          selectedBorder: "#d0d0d0",
        },
      },
    }),
  });

export const APPEARANCE_PALETTE_CATALOG = Object.freeze(
  Object.values(APPEARANCE_PALETTES)
);

export function isAppearancePaletteId(value: unknown): value is AppearancePaletteId {
  return typeof value === "string" && APPEARANCE_PALETTE_IDS.some((id) => id === value);
}

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
          background: "#f4f5f4",
          surface: "#f6f9f6",
          surfaceSecondary: "#f2f8f2",
          inputBackground: "#f6f9f6",
          border: "#c7d8c7",
          borderStrong: "#5a7b5a",
        },
        dark: {
          accent: "#9be56f",
          onAccent: "#102108",
          selectedSurface: "#21351a",
          selectedForeground: "#f2f2f2",
          selectedBorder: "#78bd52",
          background: "#070a05",
          surface: "#0b0f09",
          surfaceSecondary: "#0f160f",
          inputBackground: "#0a0f08",
          border: "#1d271d",
          borderStrong: "#646464",
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
          borderStrong: "#769595",
          accent: "#087b83",
          onAccent: "#ffffff",
          selectedSurface: "#d2ecee",
          selectedBorder: "#087b83",
          inputBackground: "#fbffff",
        },
        dark: {
          background: "#081113",
          surface: "#0b1518",
          surfaceSecondary: "#112125",
          inputBackground: "#0a1618",
          border: "#21383d",
          borderStrong: "#4f6c72",
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
          background: "#f5f4fd",
          surface: "#fcfbff",
          surfaceSecondary: "#f8f5ff",
          inputBackground: "#fcfbff",
          textMuted: "#6e6e6e",
          border: "#d2cce7",
          borderStrong: "#9289af",
          accent: "#5546a6",
          onAccent: "#ffffff",
          selectedSurface: "#e2ddf4",
          selectedBorder: "#5546a6",
        },
        dark: {
          background: "#090a18",
          surface: "#0e0f20",
          surfaceSecondary: "#161933",
          inputBackground: "#0d0f21",
          border: "#282b4b",
          borderStrong: "#606485",
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
          borderStrong: "#9a89a8",
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
          borderStrong: "#6f6179",
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
          borderStrong: "#8f8f8f",
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
          borderStrong: "#616161",
          accent: "#e7e7e7",
          onAccent: "#111111",
          selectedSurface: "#2b2b2b",
          selectedForeground: "#f5f5f5",
          selectedBorder: "#d0d0d0",
        },
      },
    }),
    "pinky-clouds": definePalette({
      id: "pinky-clouds",
      displayName: "Pinky Clouds",
      overrides: {
        light: {
          background: "#FFF3F9",
          surface: "#FFE4F1",
          surfaceSecondary: "#FFCEE7",
          inputBackground: "#FFF7FB",
          textMuted: "#6B4F5D",
          border: "#FDA6D2",
          borderStrong: "#B24A7D",
          accent: "#AA4275",
          onAccent: "#FFFFFF",
          selectedSurface: "#FDA6D2",
          selectedForeground: "#5A1838",
          selectedBorder: "#DB5A7B",
        },
        dark: {
          background: "#160B12",
          surface: "#211019",
          surfaceSecondary: "#321624",
          inputBackground: "#28111D",
          border: "#55263D",
          borderStrong: "#8D5A70",
          accent: "#FD7690",
          onAccent: "#211019",
          selectedSurface: "#5C2440",
          selectedForeground: "#F2F2F2",
          selectedBorder: "#DB5A7B",
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

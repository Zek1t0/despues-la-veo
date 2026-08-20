export type BaselineColorCategory =
  | "global-theme"
  | "semantic"
  | "structural-image-overlay"
  | "bootstrap-only"
  | "external-branding";

export type BaselineColorEntry = Readonly<{
  value: string;
  category: BaselineColorCategory;
  sources: readonly string[];
  resolvedToken?: string;
  note?: string;
  sourceNeedle?: string;
  finalAccessibleValue?: string;
}>;

const entry = (
  value: string,
  category: BaselineColorCategory,
  sources: readonly string[],
  resolvedToken?: string,
  note?: string,
  sourceNeedle?: string,
  finalAccessibleValue?: string
): BaselineColorEntry => Object.freeze({
  value,
  category,
  sources,
  resolvedToken,
  note,
  sourceNeedle,
  finalAccessibleValue,
});

export const DARK_ORIGINAL_BASELINE = Object.freeze({
  shared: Object.freeze({
    bg: entry("#0b0b0b", "global-theme", ["src/theme/colors.ts"], "global.background"),
    card: entry("#101010", "global-theme", ["src/theme/colors.ts"], "global.surface"),
    card2: entry("#141414", "global-theme", ["src/theme/colors.ts"], "global.surfaceSecondary"),
    input: entry("#0f0f0f", "global-theme", ["src/theme/colors.ts"], "global.inputBackground"),
    text: entry("#f2f2f2", "global-theme", ["src/theme/colors.ts"], "global.textPrimary"),
    muted: entry("#bdbdbd", "global-theme", ["src/theme/colors.ts"], "global.textSecondary"),
    subtle: entry("#9a9a9a", "global-theme", ["src/theme/colors.ts"], "global.textMuted"),
    border: entry("#242424", "global-theme", ["src/theme/colors.ts"], "global.border"),
    border2: entry(
      "#2c2c2c",
      "global-theme",
      ["src/theme/colors.ts"],
      "global.borderStrong",
      "Historical strong border retained as migration evidence; Section 12 deliberately resolves the accessible Dark final value.",
      undefined,
      "#646464"
    ),
    primary: entry("#ffffff", "global-theme", ["src/theme/colors.ts"], "global.accent"),
    danger: entry("#4a1f1f", "semantic", ["src/theme/colors.ts"], "semantic.dangerSurface"),
    dangerBorder: entry("#5a2a2a", "semantic", ["src/theme/colors.ts"], "semantic.dangerBorder"),
    personalRatingLowBackground: entry("#f4b8b8", "semantic", ["src/theme/colors.ts"], "semantic.personalRatingLowBackground"),
    personalRatingLowText: entry("#4a1111", "semantic", ["src/theme/colors.ts"], "semantic.personalRatingLowForeground"),
    personalRatingMediumBackground: entry("#f3d88a", "semantic", ["src/theme/colors.ts"], "semantic.personalRatingMediumBackground"),
    personalRatingMediumText: entry("#3f2c00", "semantic", ["src/theme/colors.ts"], "semantic.personalRatingMediumForeground"),
    personalRatingHighBackground: entry("#a9ddb9", "semantic", ["src/theme/colors.ts"], "semantic.personalRatingHighBackground"),
    personalRatingHighText: entry("#123a20", "semantic", ["src/theme/colors.ts"], "semantic.personalRatingHighForeground"),
  }),
  navigation: Object.freeze({
    background: entry("#0b0b0b", "global-theme", ["src/theme/navigationTheme.ts"], "global.background", undefined, "theme.global.background"),
    card: entry("#101010", "global-theme", ["src/theme/navigationTheme.ts"], "global.surface", undefined, "theme.global.surface"),
    text: entry("#f2f2f2", "global-theme", ["src/theme/navigationTheme.ts"], "global.textPrimary", undefined, "theme.global.textPrimary"),
    border: entry("#242424", "global-theme", ["src/theme/navigationTheme.ts"], "global.border", undefined, "theme.global.border"),
    primary: entry("#ffffff", "global-theme", ["src/theme/navigationTheme.ts"], "global.accent", undefined, "theme.global.accent"),
  }),
  disabled: Object.freeze({
    surface: entry("#3b3b3b", "semantic", ["app/(tabs)/ajustes.tsx", "app/title/[id].tsx", "app/tmdb/[type]/[id].tsx"], "semantic.disabledSurface"),
    compactSurface: entry("#303030", "semantic", ["app/settings/tmdb.tsx"], "semantic.disabledSurface", "Historical compact disabled variant remains inventoried; the approved minimal contract canonicalizes migrated disabled surfaces."),
  }),
  semanticForegroundConsumers: Object.freeze({
    tmdbFeedbackError: entry(
      "#f4b8b8",
      "semantic",
      ["app/settings/tmdb.tsx"],
      "semantic.dangerText",
      "Standalone danger/error consumer; its value is independently anchored and is not inferred from PersonalRating low background."
    ),
    titleDetailRatingError: entry(
      "#5a2a2a",
      "semantic",
      ["app/title/[id].tsx"],
      "semantic.personalRatingErrorText",
      "Historical PersonalRating persistence feedback retained as migration evidence; Section 12 deliberately resolves the semantic Dark token to the accessible final value.",
      "colors.dangerBorder",
      "#9b7b7b"
    ),
    compactDisabledForeground: entry(
      "#f2f2f2",
      "semantic",
      ["app/settings/tmdb.tsx"],
      "semantic.disabledText",
      "Current foreground paired with disabled surface #303030.",
      "colors.text"
    ),
    disabledForeground: entry(
      "#f2f2f2",
      "semantic",
      ["app/(tabs)/ajustes.tsx", "app/title/[id].tsx", "app/tmdb/[type]/[id].tsx"],
      "semantic.disabledText",
      "Current foreground paired with disabled surface #3b3b3b.",
      "colors.text"
    ),
    dangerSurfaceForeground: entry(
      "#f2f2f2",
      "semantic",
      ["app/settings/tmdb.tsx", "app/title/[id].tsx", "app/(tabs)/libreria.tsx"],
      "semantic.onDangerSurface",
      "Foreground paired with danger surface #4a1f1f; distinct from standalone danger/error feedback.",
      "colors.text"
    ),
  }),
  structural: Object.freeze({
    imageOverlay: entry("rgba(11, 11, 11, 0.78)", "structural-image-overlay", ["src/components/browsing/TitleGridCard.tsx"], "structural.imageOverlay"),
    badgeOverlay: entry("rgba(11, 11, 11, 0.82)", "structural-image-overlay", ["src/components/browsing/TitleGridCard.tsx"], "structural.imageOverlayMedium", "Consumer-proven intermediate scrim for the TitleGridCard type badge."),
    imageOverlayStrong: entry("rgba(11, 11, 11, 0.9)", "structural-image-overlay", ["src/components/browsing/TitleGridCard.tsx"], "structural.imageOverlayStrong"),
    tagLabelOverlay: entry("rgba(11, 11, 11, 0.94)", "structural-image-overlay", ["app/(tabs)/etiquetas.tsx"], "structural.imageOverlayLabel", "Consumer-proven scrim for the TagGridCard label and count over TagCollage."),
    tagGridCountForeground: entry("#bdbdbd", "structural-image-overlay", ["app/(tabs)/etiquetas.tsx"], "structural.onImageOverlaySecondary", "Consumer-proven secondary foreground for the TagGridCard count over imageOverlayLabel.", "colors.muted"),
    imageOverlayBorder: entry("rgba(255, 255, 255, 0.22)", "structural-image-overlay", ["src/components/browsing/TitleGridCard.tsx"], "structural.imageOverlayBorder"),
    modalBackdrop: entry("rgba(0, 0, 0, 0.68)", "structural-image-overlay", ["src/components/browsing/ViewOptionsPanel.tsx"], "structural.modalBackdrop"),
  }),
  bootstrap: Object.freeze({
    rootBackground: entry("#0b0b0b", "bootstrap-only", ["global.css"]),
    rootText: entry("#f2f2f2", "bootstrap-only", ["global.css"]),
    scrollbarTrack: entry("#0f0f0f", "bootstrap-only", ["global.css"]),
    scrollbarThumb: entry(
      "#2b2b2b",
      "bootstrap-only",
      ["global.css"],
      undefined,
      "Historical pre-Section-12 bootstrap value; the accessible borderStrong derivation requires bootstrap/runtime synchronization.",
      undefined,
      "#5c5c5c"
    ),
    scrollbarThumbHover: entry(
      "#3a3a3a",
      "bootstrap-only",
      ["global.css"],
      undefined,
      "Historical pre-Section-12 bootstrap value; final bootstrap matches the Dark + Original hydrated runtime.",
      undefined,
      "#646464"
    ),
  }),
  externalBranding: Object.freeze({
    tmdbLogo: entry("assets/tmdb-primary-full-blue.png", "external-branding", ["app/settings/about.tsx"], undefined, "Official asset; deliberately not a theme token and never tinted."),
  }),
});

export const KNOWN_STATIC_THEME_CAPTURE_MODULES = Object.freeze([
  "src/components/browsing/LayoutOption.tsx",
  "src/components/browsing/PosterPlaceholder.tsx",
  "src/components/browsing/TagCollage.tsx",
  "src/components/browsing/TitleGridCard.tsx",
  "src/components/browsing/ViewOptionsPanel.tsx",
] as const);

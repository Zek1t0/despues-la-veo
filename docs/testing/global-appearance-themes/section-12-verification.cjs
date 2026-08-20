const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { APPEARANCE_PALETTE_IDS } = require("../../../src/theme/types.ts");
const { resolveTheme, contrastRatio } = require("../../../src/theme/resolver.ts");
const { LightBase, DarkBase } = require("../../../src/theme/bases.ts");

const TEXT_THRESHOLD = 4.5;
const NON_TEXT_THRESHOLD = 3;
const failures = [];
const results = [];
const expectedBorderStrong = {
  light: {
    original: ["#8f8f8f", "#ffffff"],
    "green-apple": ["#5a7b5a", "#f6f9f6"],
    tide: ["#769595", "#fbffff"],
    "midnight-twilight": ["#9289af", "#fcfbff"],
    lavender: ["#9a89a8", "#ffffff"],
    obsidian: ["#8f8f8f", "#ffffff"],
    "pinky-clouds": ["#B24A7D", "#FFE4F1"],
  },
  dark: {
    original: ["#646464", "#101010"],
    "green-apple": ["#646464", "#0b0f09"],
    tide: ["#4f6c72", "#0b1518"],
    "midnight-twilight": ["#606485", "#0e0f20"],
    lavender: ["#6f6179", "#17121b"],
    obsidian: ["#616161", "#090909"],
    "pinky-clouds": ["#8D5A70", "#211019"],
  },
};
const expectedInputBackground = {
  light: { original: "#ffffff", "green-apple": "#f6f9f6", tide: "#fbffff",
    "midnight-twilight": "#fcfbff", lavender: "#ffffff", obsidian: "#ffffff",
    "pinky-clouds": "#FFF7FB" },
  dark: { original: "#0f0f0f", "green-apple": "#0a0f08", tide: "#0a1618",
    "midnight-twilight": "#0d0f21", lavender: "#0f0f0f", obsidian: "#080808",
    "pinky-clouds": "#28111D" },
};
const expectedTextMuted = {
  light: { original: "#707070", "green-apple": "#707070", tide: "#707070",
    "midnight-twilight": "#6e6e6e", lavender: "#707070", obsidian: "#686868",
    "pinky-clouds": "#6B4F5D" },
  dark: { original: "#9a9a9a", "green-apple": "#9a9a9a", tide: "#9a9a9a",
    "midnight-twilight": "#9a9a9a", lavender: "#9a9a9a", obsidian: "#929292",
    "pinky-clouds": "#9a9a9a" },
};
const expectedAdjustedOverrides = {
  light: {
    "green-apple": {
      background: "#f4f5f4", surface: "#f6f9f6", surfaceSecondary: "#f2f8f2",
      inputBackground: "#f6f9f6", border: "#c7d8c7", borderStrong: "#5a7b5a",
    },
    tide: {
      background: "#f1f8f8", surface: "#fbffff", surfaceSecondary: "#e2f0f0",
      inputBackground: "#fbffff", border: "#c4dddd", borderStrong: "#769595",
    },
    "midnight-twilight": {
      background: "#f5f4fd", surface: "#fcfbff", surfaceSecondary: "#f8f5ff",
      inputBackground: "#fcfbff", textMuted: "#6e6e6e", border: "#d2cce7",
      borderStrong: "#9289af",
    },
  },
  dark: {
    "green-apple": {
      background: "#070a05", surface: "#0b0f09", surfaceSecondary: "#0f160f",
      inputBackground: "#0a0f08", border: "#1d271d", borderStrong: "#646464",
    },
    tide: {
      background: "#081113", surface: "#0b1518", surfaceSecondary: "#112125",
      inputBackground: "#0a1618", border: "#21383d", borderStrong: "#4f6c72",
    },
    "midnight-twilight": {
      background: "#090a18", surface: "#0e0f20", surfaceSecondary: "#161933",
      inputBackground: "#0d0f21", border: "#282b4b", borderStrong: "#606485",
    },
  },
};

function record(theme, responsibility, foreground, background, threshold, kind = "text") {
  const ratio = contrastRatio(foreground, background);
  const result = {
    scheme: theme.effectiveScheme,
    palette: theme.paletteId,
    responsibility,
    foreground,
    background,
    ratio,
    threshold,
    kind,
  };
  results.push(result);
  if (ratio + Number.EPSILON < threshold) failures.push(result);
}

function parseRgba(value) {
  const match = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
  assert.ok(match, `Expected rgba structural token, received ${value}`);
  return { rgb: match.slice(1, 4).map(Number), alpha: Number(match[4]) };
}

function compositeOnWhite(value) {
  const { rgb, alpha } = parseRgba(value);
  const channels = rgb.map((channel) => Math.round(channel * alpha + 255 * (1 - alpha)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

const semanticByScheme = new Map();
const structuralByScheme = new Map();

for (const scheme of ["light", "dark"]) {
  for (const palette of APPEARANCE_PALETTE_IDS) {
    const theme = resolveTheme(scheme, palette);
    const g = theme.global;
    const s = theme.semantic;
    const st = theme.structural;

    for (const surface of ["background", "surface", "surfaceSecondary"]) {
      record(theme, `textPrimary/${surface}`, g.textPrimary, g[surface], TEXT_THRESHOLD);
      record(theme, `textSecondary/${surface}`, g.textSecondary, g[surface], TEXT_THRESHOLD);
    }
    // Consumer mapping: muted prose/metadata occurs on screen background or Card surface;
    // nearby surfaceSecondary usages belong to sibling chips/poster placeholders, not muted text.
    for (const surface of ["background", "surface"]) {
      record(theme, `textMuted/${surface}`, g.textMuted, g[surface], TEXT_THRESHOLD);
    }
    record(theme, "input foreground", g.textPrimary, g.inputBackground, TEXT_THRESHOLD);
    record(theme, "input placeholder", g.textMuted, g.inputBackground, TEXT_THRESHOLD);
    record(theme, "onAccent/accent", g.onAccent, g.accent, TEXT_THRESHOLD);
    record(theme, "selectedForeground/selectedSurface",
      g.selectedForeground, g.selectedSurface, TEXT_THRESHOLD);
    record(theme, "link accent/surface", g.accent, g.surface, TEXT_THRESHOLD);
    record(theme, "focus indicator/background", g.accent, g.background, NON_TEXT_THRESHOLD, "non-text");
    record(theme, "focus indicator/surface", g.accent, g.surface, NON_TEXT_THRESHOLD, "non-text");
    record(theme, "selectedBorder/surface", g.selectedBorder, g.surface,
      NON_TEXT_THRESHOLD, "non-text");
    const [approvedBorderStrong, relevantSurface] = expectedBorderStrong[scheme][palette];
    assert.equal(g.borderStrong, approvedBorderStrong,
      `${scheme}/${palette} borderStrong differs from the approved Section 12 value`);
    assert.notEqual(g.border, g.borderStrong, `${scheme}/${palette} collapsed border responsibilities`);
    assert.equal(g.inputBackground, expectedInputBackground[scheme][palette],
      `${scheme}/${palette} inputBackground changed during borderStrong correction`);
    assert.equal(g.textMuted, expectedTextMuted[scheme][palette],
      `${scheme}/${palette} textMuted differs from the approved catalog`);
    const adjustedOverrides = expectedAdjustedOverrides[scheme][palette];
    if (adjustedOverrides) {
      for (const [token, expected] of Object.entries(adjustedOverrides)) {
        assert.equal(g[token], expected,
          `${scheme}/${palette} ${token} differs from the final manual palette contract`);
      }
    }
    record(theme, "functional borderStrong/control surface", g.borderStrong, relevantSurface,
      NON_TEXT_THRESHOLD, "non-text");

    for (const surface of ["background", "surface"]) {
      record(theme, `dangerText/${surface}`, s.dangerText, g[surface], TEXT_THRESHOLD);
    }
    record(theme, "onDangerSurface/dangerSurface",
      s.onDangerSurface, s.dangerSurface, TEXT_THRESHOLD);
    // The sole consumer is ratingError inside Card, whose actual background is global.surface.
    record(theme, "personalRatingErrorText/Card surface",
      s.personalRatingErrorText, g.surface, TEXT_THRESHOLD);
    // Disabled controls are explicitly exempt from WCAG 1.4.3; still measure and require
    // a documented 3:1 internal signal so regressions remain visible.
    record(theme, "disabledText/disabledSurface",
      s.disabledText, s.disabledSurface, NON_TEXT_THRESHOLD, "disabled-exemption");
    for (const tone of ["Low", "Medium", "High"]) {
      record(theme, `personalRating${tone}`,
        s[`personalRating${tone}Foreground`], s[`personalRating${tone}Background`],
        TEXT_THRESHOLD);
    }

    const overlayPairs = [
      ["imageOverlay", "onImageOverlay"],
      ["imageOverlayMedium", "onImageOverlay"],
      ["imageOverlayStrong", "onImageOverlay"],
      ["imageOverlayLabel", "onImageOverlay"],
      ["imageOverlayLabel", "onImageOverlaySecondary"],
    ];
    for (const [overlay, foreground] of overlayPairs) {
      record(theme, `${foreground}/${overlay} over white image`,
        st[foreground], compositeOnWhite(st[overlay]), TEXT_THRESHOLD);
    }

    const semanticJson = JSON.stringify(s);
    const structuralJson = JSON.stringify(st);
    if (!semanticByScheme.has(scheme)) semanticByScheme.set(scheme, semanticJson);
    if (!structuralByScheme.has(scheme)) structuralByScheme.set(scheme, structuralJson);
    assert.equal(semanticJson, semanticByScheme.get(scheme),
      `${scheme}/${palette} changed palette-independent semantic tokens`);
    assert.equal(structuralJson, structuralByScheme.get(scheme),
      `${scheme}/${palette} changed palette-independent structural tokens`);
  }
}

const darkOriginal = resolveTheme("dark", "original");
assert.equal(LightBase.textMuted, "#707070", "LightBase textMuted must remain unchanged");
assert.equal(DarkBase.textMuted, "#9a9a9a", "DarkBase textMuted must remain unchanged");
assert.equal(darkOriginal.semantic.personalRatingErrorText, "#9b7b7b");
assert.equal(resolveTheme("light", "original").semantic.personalRatingErrorText, "#7d2020");
for (const palette of APPEARANCE_PALETTE_IDS) {
  assert.equal(resolveTheme("dark", palette).semantic.personalRatingErrorText, "#9b7b7b");
  assert.equal(resolveTheme("light", palette).semantic.personalRatingErrorText, "#7d2020");
}
record(darkOriginal, "personalRatingErrorText/Dark Original background guard",
  darkOriginal.semantic.personalRatingErrorText, darkOriginal.global.background, TEXT_THRESHOLD);
record(darkOriginal, "personalRatingErrorText/Dark Original surfaceSecondary guard",
  darkOriginal.semantic.personalRatingErrorText, darkOriginal.global.surfaceSecondary, TEXT_THRESHOLD);

const lightMidnight = resolveTheme("light", "midnight-twilight");
assert.equal(lightMidnight.global.textMuted, "#6e6e6e");
for (const surface of ["background", "surface", "inputBackground"]) {
  record(lightMidnight, `Light Midnight real textMuted/${surface}`,
    lightMidnight.global.textMuted, lightMidnight.global[surface], TEXT_THRESHOLD);
}

const finalBoundaryRatios = [
  ["light", "green-apple", "surface", "4.4841"],
  ["light", "green-apple", "inputBackground", "4.4841"],
  ["light", "tide", "surface", "3.2061"],
  ["light", "tide", "inputBackground", "3.2061"],
  ["light", "midnight-twilight", "surface", "3.1750"],
  ["light", "midnight-twilight", "inputBackground", "3.1750"],
  ["dark", "green-apple", "surface", "3.2662"],
  ["dark", "green-apple", "inputBackground", "3.2715"],
  ["dark", "tide", "surface", "3.2788"],
  ["dark", "tide", "inputBackground", "3.2611"],
  ["dark", "midnight-twilight", "surface", "3.3027"],
  ["dark", "midnight-twilight", "inputBackground", "3.3041"],
];
for (const [scheme, palette, surface, expected] of finalBoundaryRatios) {
  const theme = resolveTheme(scheme, palette);
  assert.equal(contrastRatio(theme.global.borderStrong, theme.global[surface]).toFixed(4), expected);
}
assert.equal(contrastRatio(lightMidnight.global.textMuted,
  lightMidnight.global.background).toFixed(4), "4.6718");
assert.equal(contrastRatio(lightMidnight.global.textMuted,
  lightMidnight.global.surface).toFixed(4), "4.9488");
assert.equal(contrastRatio(lightMidnight.global.textMuted,
  lightMidnight.global.inputBackground).toFixed(4), "4.9488");

const lightPinky = resolveTheme("light", "pinky-clouds");
assert.equal(lightPinky.global.accent, "#AA4275");
assert.equal(contrastRatio(lightPinky.global.accent, lightPinky.global.surface).toFixed(4), "4.7044");
assert.equal(contrastRatio(lightPinky.global.onAccent, lightPinky.global.accent).toFixed(4), "5.6069");
assert.equal(contrastRatio(lightPinky.global.selectedForeground,
  lightPinky.global.selectedSurface).toFixed(4), "7.1259");
assert.equal(contrastRatio(lightPinky.global.borderStrong,
  lightPinky.global.surface).toFixed(4), "4.2267");
assert.equal(contrastRatio(lightPinky.global.accent,
  lightPinky.global.surfaceSecondary).toFixed(4), "4.0675");

const darkPinky = resolveTheme("dark", "pinky-clouds");
assert.equal(contrastRatio(darkPinky.global.accent, darkPinky.global.surface).toFixed(4), "7.0875");
assert.equal(contrastRatio(darkPinky.global.onAccent, darkPinky.global.accent).toFixed(4), "7.0875");
assert.equal(contrastRatio(darkPinky.global.selectedForeground,
  darkPinky.global.selectedSurface).toFixed(4), "10.5299");
assert.equal(contrastRatio(darkPinky.global.borderStrong,
  darkPinky.global.surface).toFixed(4), "3.3214");

function sourceFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}
const repoRoot = path.resolve(__dirname, "../../..");
for (const root of [path.join(repoRoot, "app"), path.join(repoRoot, "src/components")]) {
  for (const filename of sourceFiles(root)) {
    const source = fs.readFileSync(filename, "utf8");
    assert.doesNotMatch(source,
      /(?:palette|paletteId)\s*(?:===|!==|==|!=)\s*["'](?:original|green-apple|tide|midnight-twilight|lavender|obsidian|pinky-clouds)["']/,
      `${path.relative(repoRoot, filename)} contains a palette-specific consumer branch`);
  }
}

const summary = [...new Set(results.map((result) => `${result.scheme}/${result.palette}`))]
  .map((combination) => {
    const entries = results.filter((result) => `${result.scheme}/${result.palette}` === combination);
    return { combination, pairs: entries.length, minimumRatio: Math.min(...entries.map((x) => x.ratio)) };
  });
assert.equal(summary.length, 14, "Section 12 final catalog must audit 14 ThemeDefinitions");
console.log(JSON.stringify({ combinations: summary, failures }, null, 2));
assert.equal(failures.length, 0,
  `Section 12 contrast audit found ${failures.length} contractual failure(s)`);
console.log("Section 12 historical 2x6 evidence plus final 2x7 accessibility verification passed.");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const repoRoot = path.resolve(__dirname, "../../..");
const {
  APPEARANCE_PALETTE_CATALOG,
  APPEARANCE_PALETTE_IDS,
  DARK_ORIGINAL_BASELINE,
  DARK_SEMANTIC_TOKENS,
  DARK_STRUCTURAL_TOKENS,
  KNOWN_STATIC_THEME_CAPTURE_MODULES,
  LIGHT_SEMANTIC_TOKENS,
  LIGHT_STRUCTURAL_TOKENS,
  assertLightThemeInvariant,
  contrastRatio,
  isAppearancePaletteId,
  relativeLuminance,
  resolveAppearanceTheme,
  resolveEffectiveScheme,
  resolveTheme,
} = require("../../../src/theme/index.ts");

const globalKeys = [
  "background", "surface", "surfaceSecondary", "inputBackground", "textPrimary",
  "textSecondary", "textMuted", "border", "borderStrong", "accent", "onAccent",
  "selectedSurface", "selectedForeground", "selectedBorder",
];
const semanticKeys = [
  "dangerSurface", "dangerBorder", "dangerText", "onDangerSurface",
  "disabledSurface", "disabledText",
  "personalRatingLowBackground", "personalRatingLowForeground",
  "personalRatingMediumBackground", "personalRatingMediumForeground",
  "personalRatingHighBackground", "personalRatingHighForeground",
];
const structuralKeys = [
  "imageOverlay", "imageOverlayMedium", "imageOverlayStrong", "onImageOverlay",
  "imageOverlayBorder", "modalBackdrop",
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertBaselineSource(relativePath, item) {
  const source = read(relativePath);
  const historicalNeedle = item.sourceNeedle ?? item.value;
  if (source.includes(historicalNeedle)) return;
  assert.notEqual(
    item.resolvedToken,
    undefined,
    `${relativePath} removed unresolved historical value ${historicalNeedle}`,
  );
  assert.equal(
    source.includes(`theme.${item.resolvedToken}`),
    true,
    `${relativePath} must migrate ${historicalNeedle} to theme.${item.resolvedToken}`,
  );
}

function assertCompleteTheme(theme, scheme, paletteId) {
  assert.deepEqual(Object.keys(theme).sort(), ["effectiveScheme", "global", "isDark", "paletteId", "semantic", "structural"]);
  assert.deepEqual(Object.keys(theme.global).sort(), [...globalKeys].sort());
  assert.deepEqual(Object.keys(theme.semantic).sort(), [...semanticKeys].sort());
  assert.deepEqual(Object.keys(theme.structural).sort(), [...structuralKeys].sort());
  for (const group of [theme.global, theme.semantic, theme.structural]) {
    for (const value of Object.values(group)) {
      assert.equal(typeof value, "string");
      assert.notEqual(value.length, 0);
    }
    assert.equal(Object.isFrozen(group), true);
  }
  assert.equal(theme.effectiveScheme, scheme);
  assert.equal(theme.paletteId, paletteId);
  assert.equal(theme.isDark, scheme === "dark");
  assert.equal(Object.isFrozen(theme), true);
  assert.equal(typeof theme.global.onAccent, "string");
  assert.equal(typeof theme.global.selectedForeground, "string");
  assert.notEqual(theme.global.selectedForeground.length, 0);
}

function testInventoryStillMatchesRepo() {
  for (const group of Object.values(DARK_ORIGINAL_BASELINE)) {
    for (const item of Object.values(group)) {
      for (const source of item.sources) {
        assertBaselineSource(source, item);
      }
    }
  }
  assert.equal(KNOWN_STATIC_THEME_CAPTURE_MODULES.length, 5);
  for (const modulePath of KNOWN_STATIC_THEME_CAPTURE_MODULES) {
    assert.equal(fs.existsSync(path.join(repoRoot, modulePath)), true, modulePath);
    assert.match(read(modulePath), /StyleSheet\.create/);
  }
}

function testEffectiveSchemeResolution() {
  assert.equal(resolveEffectiveScheme("light", "dark"), "light");
  assert.equal(resolveEffectiveScheme("dark", "light"), "dark");
  assert.equal(resolveEffectiveScheme("system", "light"), "light");
  assert.equal(resolveEffectiveScheme("system", "dark"), "dark");

  const preference = Object.freeze({ version: 1, scheme: "system", palette: "tide" });
  assert.equal(resolveAppearanceTheme(preference, "light").paletteId, "tide");
  assert.equal(resolveAppearanceTheme(preference, "dark").paletteId, "tide");
  assert.deepEqual(preference, { version: 1, scheme: "system", palette: "tide" });
}

function testCatalogAndAllCombinations() {
  assert.deepEqual(APPEARANCE_PALETTE_CATALOG.map((palette) => palette.id), APPEARANCE_PALETTE_IDS);
  assert.equal(APPEARANCE_PALETTE_CATALOG.length, 6);
  assert.equal(isAppearancePaletteId("lavender"), true);
  assert.equal(isAppearancePaletteId("unknown"), false);
  assert.throws(() => resolveTheme("dark", "unknown"), /Unknown appearance palette/);

  for (const palette of APPEARANCE_PALETTE_CATALOG) {
    assert.equal(Object.keys(palette).includes("semantic"), false);
    assert.equal(Object.keys(palette).includes("structural"), false);
    for (const overrides of [palette.overrides.light, palette.overrides.dark]) {
      for (const token of Object.keys(overrides)) {
        assert.equal(globalKeys.includes(token), true, `${palette.id} may not override ${token}`);
      }
    }
    assert.equal(Object.keys(palette.overrides.light).length < globalKeys.length, true);
    assert.equal(Object.keys(palette.overrides.dark).length < globalKeys.length, true);

    for (const scheme of ["light", "dark"]) {
      const theme = resolveTheme(scheme, palette.id);
      assertCompleteTheme(theme, scheme, palette.id);
      assert.equal(
        contrastRatio(theme.global.selectedForeground, theme.global.selectedSurface) >= 3,
        true,
        `${scheme} + ${palette.id} selection must not be obviously incoherent`
      );
      assert.strictEqual(theme.semantic, scheme === "dark" ? DARK_SEMANTIC_TOKENS : LIGHT_SEMANTIC_TOKENS);
      assert.strictEqual(theme.structural, scheme === "dark" ? DARK_STRUCTURAL_TOKENS : LIGHT_STRUCTURAL_TOKENS);
      if (scheme === "light") {
        assert.equal(theme.isDark, false);
        assert.doesNotThrow(() => assertLightThemeInvariant(theme.global));
      }
    }
  }

  const original = APPEARANCE_PALETTE_CATALOG.find((palette) => palette.id === "original");
  assert.deepEqual(original.overrides, { light: {}, dark: {} });
}

function testLightInvariant() {
  assert.equal(relativeLuminance("#000000"), 0);
  assert.equal(relativeLuminance("#ffffff"), 1);
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.throws(
    () => assertLightThemeInvariant({
      background: "#111111",
      surface: "#111111",
      surfaceSecondary: "#111111",
      inputBackground: "#111111",
      textPrimary: "#eeeeee",
    }),
    /background luminance must be >= 0\.50/
  );
}

function testDarkOriginalParity() {
  const theme = resolveTheme("dark", "original");
  const shared = DARK_ORIGINAL_BASELINE.shared;
  assert.deepEqual(theme.global, {
    background: shared.bg.value,
    surface: shared.card.value,
    surfaceSecondary: shared.card2.value,
    inputBackground: shared.input.value,
    textPrimary: shared.text.value,
    textSecondary: shared.muted.value,
    textMuted: shared.subtle.value,
    border: shared.border.value,
    borderStrong: shared.border2.value,
    accent: shared.primary.value,
    onAccent: shared.bg.value,
    selectedSurface: shared.primary.value,
    selectedForeground: shared.bg.value,
    selectedBorder: shared.primary.value,
  });
  assert.equal(theme.semantic.dangerSurface, shared.danger.value);
  assert.equal(theme.semantic.dangerBorder, shared.dangerBorder.value);

  assert.equal(
    theme.semantic.dangerText,
    DARK_ORIGINAL_BASELINE.semanticForegroundConsumers.tmdbFeedbackError.value
  );
  assert.equal(
    theme.semantic.onDangerSurface,
    DARK_ORIGINAL_BASELINE.semanticForegroundConsumers.dangerSurfaceForeground.value
  );

  assert.equal(
    theme.semantic.disabledSurface,
    DARK_ORIGINAL_BASELINE.disabled.surface.value
  );

  assert.equal(
    theme.semantic.disabledText,
    DARK_ORIGINAL_BASELINE.semanticForegroundConsumers.disabledForeground.value
  );
  assert.equal(theme.semantic.personalRatingLowBackground, shared.personalRatingLowBackground.value);
  assert.equal(theme.semantic.personalRatingLowForeground, shared.personalRatingLowText.value);
  assert.equal(theme.semantic.personalRatingMediumBackground, shared.personalRatingMediumBackground.value);
  assert.equal(theme.semantic.personalRatingMediumForeground, shared.personalRatingMediumText.value);
  assert.equal(theme.semantic.personalRatingHighBackground, shared.personalRatingHighBackground.value);
  assert.equal(theme.semantic.personalRatingHighForeground, shared.personalRatingHighText.value);
  assert.equal(theme.structural.imageOverlay, DARK_ORIGINAL_BASELINE.structural.imageOverlay.value);
  assert.equal(theme.structural.imageOverlayMedium, DARK_ORIGINAL_BASELINE.structural.badgeOverlay.value);
  assert.equal(theme.structural.imageOverlayStrong, DARK_ORIGINAL_BASELINE.structural.imageOverlayStrong.value);
  assert.equal(theme.structural.onImageOverlay, shared.text.value);
  assert.equal(theme.structural.imageOverlayBorder, DARK_ORIGINAL_BASELINE.structural.imageOverlayBorder.value);
  assert.equal(theme.structural.modalBackdrop, DARK_ORIGINAL_BASELINE.structural.modalBackdrop.value);

  for (const navigationEntry of Object.values(DARK_ORIGINAL_BASELINE.navigation)) {
    assert.equal(Object.values(theme.global).includes(navigationEntry.value), true);
  }
  assert.equal(DARK_ORIGINAL_BASELINE.disabled.compactSurface.value, "#303030");
  assert.equal(DARK_ORIGINAL_BASELINE.structural.badgeOverlay.value, "rgba(11, 11, 11, 0.82)");
  assert.equal(DARK_ORIGINAL_BASELINE.structural.tagLabelOverlay.value, "rgba(11, 11, 11, 0.94)");
}

function testSemanticForegroundInventory() {
  const consumers = DARK_ORIGINAL_BASELINE.semanticForegroundConsumers;
  assert.equal(consumers.tmdbFeedbackError.value, "#f4b8b8");
  assert.equal(consumers.tmdbFeedbackError.resolvedToken, "semantic.dangerText");
  assert.notStrictEqual(consumers.tmdbFeedbackError, DARK_ORIGINAL_BASELINE.shared.personalRatingLowBackground);

  assert.equal(consumers.titleDetailRatingError.value, "#5a2a2a");
  assert.equal(consumers.titleDetailRatingError.resolvedToken, undefined);
  assert.match(consumers.titleDetailRatingError.note, /accessibility decision/);

  assert.equal(DARK_ORIGINAL_BASELINE.disabled.compactSurface.value, "#303030");
  assert.equal(consumers.compactDisabledForeground.value, "#f2f2f2");
  assert.match(consumers.compactDisabledForeground.note, /#303030/);
  assert.equal(DARK_ORIGINAL_BASELINE.disabled.surface.value, "#3b3b3b");
  assert.equal(consumers.disabledForeground.value, "#f2f2f2");
  assert.match(consumers.disabledForeground.note, /#3b3b3b/);

  assert.equal(DARK_ORIGINAL_BASELINE.shared.danger.value, "#4a1f1f");
  assert.equal(consumers.dangerSurfaceForeground.value, "#f2f2f2");
  assert.equal(consumers.dangerSurfaceForeground.resolvedToken, "semantic.onDangerSurface");
  assert.match(consumers.dangerSurfaceForeground.note, /#4a1f1f/);
  for (const source of consumers.dangerSurfaceForeground.sources) {
    assertBaselineSource(source, {
      ...DARK_ORIGINAL_BASELINE.shared.danger,
      sourceNeedle: "colors.danger",
    });
    assertBaselineSource(source, consumers.dangerSurfaceForeground);
  }

  assert.equal(
    contrastRatio(LIGHT_SEMANTIC_TOKENS.onDangerSurface, LIGHT_SEMANTIC_TOKENS.dangerSurface) >= 4.5,
    true,
    "Light onDangerSurface must contrast with dangerSurface",
  );
}

testInventoryStillMatchesRepo();
testEffectiveSchemeResolution();
testCatalogAndAllCombinations();
testLightInvariant();
testDarkOriginalParity();
testSemanticForegroundInventory();
console.log("Section 1 theme domain, 12 combinations, selectedForeground, semantic foreground inventory, Light luminance and Dark + Original parity verification passed.");

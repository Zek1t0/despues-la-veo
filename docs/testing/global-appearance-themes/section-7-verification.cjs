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

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const search = read("app/(tabs)/buscar.tsx");
const preferences = read("src/core/viewPreferences.ts");
const titleGridCard = read("src/components/browsing/TitleGridCard.tsx");
const ratingBadge = read("src/components/browsing/PersonalRatingBadge.tsx");
const { resolveTheme } = require("../../../src/theme/resolver.ts");

function testRuntimeThemeCoverage() {
  assert.match(search, /useAppTheme\(\)/);
  assert.doesNotMatch(search, /theme\/colors|\bcolors\.|paletteId\s*===|switch\s*\(.*paletteId/);
  for (const token of [
    "background", "surface", "surfaceSecondary", "inputBackground", "textPrimary",
    "textSecondary", "textMuted", "border", "borderStrong",
  ]) {
    assert.match(search, new RegExp(`theme\\.global\\.${token}`), `Buscar missing ${token}`);
  }
  assert.match(search, /theme\.semantic\.disabledText/);
  assert.match(search, /theme\.semantic\.dangerText/);
  assert.doesNotMatch(search, /rgba\(|#[0-9a-fA-F]{3,8}/);
}

function testOptionsDisabledParity() {
  const start = search.indexOf('accessibilityLabel="Abrir opciones de Buscar"');
  const end = search.indexOf("</Pressable>", start);
  const optionsButton = search.slice(start, end);
  assert.match(optionsButton, /accessibilityState=\{\{ disabled: !preferencesReady \}\}/);
  assert.match(optionsButton, /disabled=\{!preferencesReady\}/);
  assert.match(optionsButton, /backgroundColor: theme\.global\.surfaceSecondary/);
  assert.match(optionsButton, /theme\.semantic\.disabledText/);
  assert.match(optionsButton, /opacity: !preferencesReady \? 0\.5/);
  assert.doesNotMatch(optionsButton, /disabledSurface|selectedSurface|selectedForeground|selectedBorder/);
}

function testSearchBehaviorAndPreferences() {
  assert.match(search, /searchMulti\(currentQuery, 1\)/);
  assert.match(search, /setTimeout\(\(\) => setDebounced\(q\.trim\(\)\), 350\)/);
  assert.match(search, /sameTmdbRemoteRequest/);
  assert.match(search, /res\.results\.filter\(\(r\) => r\.media_type === "movie" \|\| r\.media_type === "tv"\)/);
  assert.match(search, /getViewPreference\("search\.viewMode"\)/);
  assert.match(search, /setViewPreference\("search\.viewMode", next\)/);
  assert.match(preferences, /"search\.viewMode": "detail"/);
  assert.doesNotMatch(search, /library\.viewMode|library\.sort|tags\.viewMode|tags\.sort/);
  assert.match(search, /viewMode === "grid"/);
  assert.match(search, /<TitleGridCard/);
}

function testNoSearchPinContext() {
  assert.doesNotMatch(search, /LIBRARY_PIN_CONTEXT|createTagPinContext|ContextualPinIntentQueue|setTitlePinState|pinContext|onTogglePin|isPinned/);
  const cardUsage = search.slice(search.indexOf("<TitleGridCard"), search.indexOf("/>", search.indexOf("<TitleGridCard")) + 2);
  assert.doesNotMatch(cardUsage, /isPinned|onTogglePin|pinContext/);
  assert.match(titleGridCard, /theme\.structural\.imageOverlay/);
  assert.match(titleGridCard, /<PersonalRatingBadge value=\{personalRating\}/);
  assert.match(ratingBadge, /theme\.semantic\.personalRatingLowBackground/);
  assert.doesNotMatch(ratingBadge, /theme\.global\.accent|paletteId/);
}

function testThemeChangesAreChromaticOnly() {
  const darkOriginal = resolveTheme("dark", "original");
  const lightOriginal = resolveTheme("light", "original");
  const lightLavender = resolveTheme("light", "lavender");
  assert.equal(darkOriginal.global.background, "#0b0b0b");
  assert.equal(darkOriginal.global.inputBackground, "#0f0f0f");
  assert.equal(darkOriginal.global.surface, "#101010");
  assert.notEqual(darkOriginal.global.background, lightOriginal.global.background);
  assert.notEqual(lightOriginal.global.accent, lightLavender.global.accent);
  assert.strictEqual(lightOriginal.semantic, lightLavender.semantic);
  assert.strictEqual(lightOriginal.structural, lightLavender.structural);
}

testRuntimeThemeCoverage();
testOptionsDisabledParity();
testSearchBehaviorAndPreferences();
testNoSearchPinContext();
testThemeChangesAreChromaticOnly();
console.log("Section 7 Buscar runtime theme and unchanged search, preference, result and no-pin contracts verification passed.");

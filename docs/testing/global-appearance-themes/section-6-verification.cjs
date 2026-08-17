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
const library = read("app/(tabs)/libreria.tsx");
const libraryView = read("src/core/libraryView.ts");
const viewPreferences = read("src/core/viewPreferences.ts");
const personalRating = read("src/core/personalRating.ts");
const { resolveTheme } = require("../../../src/theme/resolver.ts");

function testLibraryThemeCoverage() {
  assert.match(library, /useAppTheme\(\)/);
  assert.doesNotMatch(library, /theme\/colors|\bcolors\.|paletteId\s*===/);
  for (const token of [
    "background", "surface", "surfaceSecondary", "inputBackground", "textPrimary",
    "textSecondary", "textMuted", "border", "borderStrong", "selectedSurface",
    "selectedForeground", "selectedBorder",
  ]) {
    assert.match(library, new RegExp(`theme\\.global\\.${token}`), `missing ${token}`);
  }
  assert.match(library, /theme\.semantic\.disabledSurface/);
  assert.match(library, /theme\.semantic\.disabledText/);
  assert.match(library, /theme\.semantic\.dangerSurface/);
  assert.match(library, /theme\.semantic\.dangerBorder/);
  assert.match(library, /theme\.semantic\.dangerText/);
  assert.match(library, /theme\.semantic\.onDangerSurface/);

  const dangerButton = library.slice(
    library.indexOf('accessibilityLabel={`Borrar'),
    library.indexOf("</Pressable>", library.indexOf('accessibilityLabel={`Borrar')),
  );
  assert.match(dangerButton, /backgroundColor: theme\.semantic\.dangerSurface/);
  assert.match(dangerButton, /color: theme\.semantic\.onDangerSurface/);
  assert.doesNotMatch(dangerButton, /color: theme\.semantic\.dangerText/);
  assert.match(library, /color: theme\.semantic\.dangerText[\s\S]*No se pudo cargar la Biblioteca/);
}

function testBrowsingContractsRemainPresent() {
  assert.match(library, /viewMode === "grid"/);
  assert.match(library, /TitleGridCard/);
  assert.match(library, /library\.viewMode/);
  assert.match(library, /library\.sort/);
  assert.match(library, /getViewPreference\("library\.viewMode"\)/);
  assert.match(library, /setViewPreference\("library\.viewMode", next\)/);
  assert.match(library, /setViewPreference\("library\.sort", next\)/);
  assert.match(viewPreferences, /"library\.viewMode": "detail"/);
  assert.match(viewPreferences, /"library\.sort": "updated-desc"/);

  assert.match(libraryView, /case "rating-desc":[\s\S]*voteAverage/);
  assert.match(libraryView, /case "personal-rating-desc"/);
  assert.match(libraryView, /case "personal-rating-asc"/);
  assert.match(libraryView, /if \(a\.personalRating === null\) return 1/);
  assert.match(libraryView, /return \[\.\.\.pinned, \.\.\.unpinned\]/);
}

function testPinsRatingsAndBehaviorStayIndependent() {
  assert.match(library, /LIBRARY_PIN_CONTEXT/);
  assert.match(library, /ContextualPinIntentQueue/);
  assert.match(library, /setTitlePinState\(savedTitleId, LIBRARY_PIN_CONTEXT, pinnedAt\)/);
  assert.match(library, /accessibilityState=\{\{ selected: pinnedAtById\.has\(item\.id\) \}\}/);
  const pinLabelIndex = library.indexOf('"Desfijar de Biblioteca"');
  const pinButton = library.slice(
    library.lastIndexOf("<Pressable", pinLabelIndex),
    library.indexOf("</Pressable>", pinLabelIndex),
  );
  assert.match(pinButton, /backgroundColor: theme\.global\.surfaceSecondary/);
  assert.match(pinButton, /borderColor: theme\.global\.borderStrong/);
  assert.match(pinButton, /color: theme\.global\.textPrimary/);
  assert.doesNotMatch(pinButton, /selectedSurface|selectedForeground|selectedBorder/);
  assert.match(personalRating, /PERSONAL_RATING_MIN = 10/);
  assert.match(personalRating, /PERSONAL_RATING_MAX = 100/);
  assert.match(personalRating, /PersonalRating = number \| null/);
  assert.doesNotMatch(library, /setScheme|setPalette|AppearancePreference/);
}

function testThemeReactivityDoesNotChangeDataContracts() {
  const dark = resolveTheme("dark", "original");
  const light = resolveTheme("light", "lavender");
  assert.notEqual(dark.global.background, light.global.background);
  assert.notEqual(dark.global.textPrimary, light.global.textPrimary);
  assert.deepEqual(dark.semantic.personalRatingHighBackground,
    light.semantic.personalRatingHighBackground);
  assert.equal(dark.structural.imageOverlay, light.structural.imageOverlay);
  assert.equal(dark.global.surface, "#101010");
  assert.equal(dark.global.surfaceSecondary, "#141414");
  assert.equal(dark.global.inputBackground, "#0f0f0f");
  assert.equal(dark.global.border, "#242424");
  assert.equal(dark.global.borderStrong, "#2c2c2c");
}

testLibraryThemeCoverage();
testBrowsingContractsRemainPresent();
testPinsRatingsAndBehaviorStayIndependent();
testThemeReactivityDoesNotChangeDataContracts();
console.log("Section 6 Biblioteca runtime theme and unchanged browsing, sorting, pin and rating contracts verification passed.");

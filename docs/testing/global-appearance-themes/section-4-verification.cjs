const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const { APPEARANCE_PALETTE_CATALOG } = require("../../../src/theme/palettes.ts");
const { resolveTheme } = require("../../../src/theme/resolver.ts");

function testRouteAndSettingsEntry() {
  const root = read("app/_layout.tsx");
  const settings = read("app/(tabs)/ajustes.tsx");
  assert.equal(fs.existsSync(path.join(repoRoot, "app/settings/appearance.tsx")), true);
  assert.match(root, /name="settings\/appearance" options=\{\{ title: "Apariencia" \}\}/);
  assert.match(settings, /label="Apariencia"[\s\S]*router\.push\("\/settings\/appearance"\)/);
  assert.match(settings, /TMDB_SETTINGS_ROUTE/);
  assert.match(settings, /\/settings\/about/);
}

function testCatalogAndRealPreviews() {
  const screen = read("app/settings/appearance.tsx");
  assert.equal(APPEARANCE_PALETTE_CATALOG.length, 6);
  assert.deepEqual(APPEARANCE_PALETTE_CATALOG.map((palette) => palette.displayName), [
    "Original", "Manzana verde", "Marea", "Crepúsculo de medianoche", "Lavanda", "Obsidiana",
  ]);
  assert.match(screen, /APPEARANCE_PALETTE_CATALOG\.map/);
  assert.match(screen, /resolveTheme\(effectiveScheme, palette\.id\)/);
  assert.doesNotMatch(screen, /"green-apple"|"tide"|"midnight-twilight"|"lavender"|"obsidian"/);
  for (const scheme of ["light", "dark"]) {
    for (const palette of APPEARANCE_PALETTE_CATALOG) {
      const preview = resolveTheme(scheme, palette.id);
      assert.equal(preview.effectiveScheme, scheme);
      assert.equal(preview.paletteId, palette.id);
      for (const token of ["background", "surface", "surfaceSecondary", "textPrimary",
        "textMuted", "accent", "selectedSurface", "selectedBorder", "selectedForeground"]) {
        assert.equal(typeof preview.global[token], "string");
      }
    }
  }
}

function testSelectorsAccessibilityAndResponsiveLayout() {
  const screen = read("app/settings/appearance.tsx");
  for (const label of ["Del sistema", "Claro", "Oscuro"]) assert.match(screen, new RegExp(label));
  assert.match(screen, /accessibilityRole="radiogroup"/);
  assert.match(screen, /accessibilityRole="radio"/);
  assert.match(screen, /accessibilityState=\{\{ selected \}\}/);
  assert.match(screen, />\s*✓\s*</);
  assert.match(screen, /onLayout=\{onPaletteLayout\}/);
  assert.match(screen, /Math\.floor\(\(availableWidth \+ PREVIEW_GAP\)/);
  assert.match(screen, /horizontal[\s\S]*showsHorizontalScrollIndicator=\{false\}/);
  assert.match(screen, /flexWrap: "wrap"/);
}

function testAsyncActionsAndRecovery() {
  const screen = read("app/settings/appearance.tsx");
  assert.match(screen, /void action\.catch/);
  assert.match(screen, /invokeAppearanceAction\(setScheme\(option\.id\)\)/);
  assert.match(screen, /invokeAppearanceAction\(setPalette\(palette\.id\)\)/);
  assert.match(screen, /invokeAppearanceAction\(retryHydration\(\)\)/);
  assert.match(screen, /invokeAppearanceAction\(retryPersistence\(\)\)/);
  assert.match(screen, /storageError\?\.operation === "read"/);
  assert.match(screen, /storageError\?\.operation === "write"/);
  assert.doesNotMatch(screen, /rollback|setConfirmedPersisted/);
  assert.doesNotMatch(screen, /bot[oó]n aplicar|>\s*Aplicar\s*</i);
  assert.match(screen, /hydrationStatus === "error"/);
  assert.match(screen, /hydrationStatus === "invalid"/);
  assert.match(screen, /!writeProblem/);
}

function testDependenciesRemainScoped() {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.dependencies["@expo/vector-icons"], "^15.0.3");
}

testRouteAndSettingsEntry();
testCatalogAndRealPreviews();
testSelectorsAccessibilityAndResponsiveLayout();
testAsyncActionsAndRecovery();
testDependenciesRemainScoped();
console.log("Section 4 Appearance route, selectors, real previews, accessibility and recovery verification passed.");

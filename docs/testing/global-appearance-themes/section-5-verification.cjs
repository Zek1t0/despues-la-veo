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
const { contrastRatio, resolveTheme } = require("../../../src/theme/resolver.ts");

const sharedFiles = [
  "src/components/browsing/LayoutOption.tsx",
  "src/components/browsing/PosterPlaceholder.tsx",
  "src/components/browsing/TagCollage.tsx",
  "src/components/browsing/TitleGridCard.tsx",
  "src/components/browsing/ViewOptionsPanel.tsx",
];

function testRuntimeThemeWithoutStaticColorCapture() {
  for (const file of sharedFiles) {
    const source = read(file);
    assert.match(source, /useAppTheme\(\)/, `${file} must consume the runtime theme`);
    assert.doesNotMatch(source, /theme\/colors|\bcolors\./, `${file} must not capture legacy colors`);
    assert.doesNotMatch(source, /paletteId\s*===|switch\s*\(.*paletteId/,
      `${file} must not branch by palette`);
    assert.match(source, /StyleSheet\.create\(/, `${file} must retain static layout styles`);
  }
}

function testSelectionAndStructuralTokens() {
  const layout = read(sharedFiles[0]);
  const card = read(sharedFiles[3]);
  const panel = read(sharedFiles[4]);
  for (const token of ["selectedSurface", "selectedForeground", "selectedBorder"]) {
    assert.match(layout, new RegExp(`theme\\.global\\.${token}`));
    assert.match(panel, new RegExp(`theme\\.global\\.${token}`));
  }
  for (const token of [
    "imageOverlay", "imageOverlayMedium", "imageOverlayStrong", "onImageOverlay",
    "imageOverlayBorder",
  ]) {
    assert.match(card, new RegExp(`theme\\.structural\\.${token}`));
  }
  assert.match(card, /styles\.badge, \{ backgroundColor: theme\.structural\.imageOverlayMedium \}/);
  assert.match(card, /styles\.pinBadge,[\s\S]*backgroundColor: theme\.structural\.imageOverlayStrong/);
  assert.match(card, /styles\.titleOverlay,[\s\S]*backgroundColor: theme\.structural\.imageOverlay/);
  assert.match(panel, /theme\.structural\.modalBackdrop/);
  assert.doesNotMatch(card, /rgba\(|#[0-9a-fA-F]{3,8}/);
  assert.equal((card.match(/<Pressable/g) ?? []).length, 1, "the card keeps one press target");
  assert.match(card, /pointerEvents="none"[\s\S]*diamond-outline/);
}

function testRatingSemanticsAndParity() {
  const badge = read("src/components/browsing/PersonalRatingBadge.tsx");
  const presentation = read("src/components/browsing/personalRatingPresentation.ts");
  assert.match(badge, /theme\.semantic\.personalRatingLowBackground/);
  assert.match(badge, /theme\.semantic\.personalRatingMediumBackground/);
  assert.match(badge, /theme\.semantic\.personalRatingHighBackground/);
  assert.doesNotMatch(badge, /theme\.global\.accent|paletteId/);
  assert.match(presentation, /value <= 74/);
  assert.match(presentation, /value <= 84/);

  const darkOriginal = resolveTheme("dark", "original");
  assert.deepEqual(darkOriginal.global.selectedSurface, "#ffffff");
  assert.deepEqual(darkOriginal.global.selectedForeground, "#0b0b0b");
  assert.deepEqual(darkOriginal.global.selectedBorder, "#ffffff");
  assert.deepEqual(darkOriginal.structural, {
    imageOverlay: "rgba(11, 11, 11, 0.78)",
    imageOverlayMedium: "rgba(11, 11, 11, 0.82)",
    imageOverlayStrong: "rgba(11, 11, 11, 0.9)",
    onImageOverlay: "#f2f2f2",
    imageOverlayBorder: "rgba(255, 255, 255, 0.22)",
    modalBackdrop: "rgba(0, 0, 0, 0.68)",
  });
  assert.deepEqual(resolveTheme("light", "lavender").semantic,
    resolveTheme("light", "original").semantic,
    "palettes must not remap rating or danger semantics");
  assert.deepEqual(resolveTheme("light", "lavender").structural,
    resolveTheme("light", "original").structural,
    "palettes must not remap structural overlays");
  assert.equal(resolveTheme("light", "lavender").structural.imageOverlayMedium,
    "rgba(11, 11, 11, 0.82)");
  assert.equal(
    contrastRatio(
      resolveTheme("light", "original").semantic.onDangerSurface,
      resolveTheme("light", "original").semantic.dangerSurface,
    ) >= 4.5,
    true,
  );
  assert.doesNotMatch(read("src/theme/palettes.ts"), /imageOverlayMedium|onDangerSurface/);
}

function testScope() {
  for (const file of [
    "app/(tabs)/buscar.tsx",
    "app/(tabs)/etiquetas.tsx",
    "app/settings/tmdb.tsx",
    "app/settings/about.tsx",
  ]) {
    assert.doesNotMatch(read(file), /useAppTheme/, `${file} belongs to a later section`);
  }
}

testRuntimeThemeWithoutStaticColorCapture();
testSelectionAndStructuralTokens();
testRatingSemanticsAndParity();
testScope();
console.log("Section 5 shared runtime themes, structural overlays, semantic ratings and static-layout verification passed.");

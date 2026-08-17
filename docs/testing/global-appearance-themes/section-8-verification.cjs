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
const tags = read("app/(tabs)/etiquetas.tsx");
const collage = read("src/components/browsing/TagCollage.tsx");
const tagView = read("src/core/tagView.ts");
const preferences = read("src/core/viewPreferences.ts");
const palettes = read("src/theme/palettes.ts");
const { resolveTheme } = require("../../../src/theme/resolver.ts");

function testRuntimeThemeCoverage() {
  assert.match(tags, /useAppTheme\(\)/);
  assert.doesNotMatch(tags, /theme\/colors|\bcolors\.|paletteId\s*===|switch\s*\(.*paletteId/);
  for (const token of [
    "background", "surface", "surfaceSecondary", "inputBackground", "textPrimary",
    "textSecondary", "textMuted", "border", "borderStrong",
  ]) {
    assert.match(tags, new RegExp(`theme\\.global\\.${token}`), `Etiquetas missing ${token}`);
  }
  assert.match(tags, /theme\.semantic\.disabledText/);
  assert.match(tags, /theme\.semantic\.dangerText/);
  assert.doesNotMatch(tags, /rgba\(|#[0-9a-fA-F]{3,8}/);
}

function testTagGridLabelContract() {
  const start = tags.indexOf("function TagGridCard");
  const end = tags.indexOf("function TagListRow", start);
  const card = tags.slice(start, end);
  assert.match(card, /backgroundColor: theme\.structural\.imageOverlayLabel/);
  assert.match(card, /color: theme\.structural\.onImageOverlay,/);
  assert.match(card, /color: theme\.structural\.onImageOverlaySecondary,/);
  assert.doesNotMatch(card, /imageOverlayStrong/);

  const dark = resolveTheme("dark", "original");
  const light = resolveTheme("light", "original");
  const lavender = resolveTheme("light", "lavender");
  assert.equal(dark.structural.imageOverlayLabel, "rgba(11, 11, 11, 0.94)");
  assert.equal(light.structural.imageOverlayLabel, "rgba(11, 11, 11, 0.94)");
  assert.equal(dark.structural.onImageOverlay, "#f2f2f2");
  assert.equal(light.structural.onImageOverlay, "#f2f2f2");
  assert.equal(dark.structural.onImageOverlaySecondary, "#bdbdbd");
  assert.equal(light.structural.onImageOverlaySecondary, "#bdbdbd");
  assert.strictEqual(light.structural, lavender.structural);
  assert.doesNotMatch(palettes, /imageOverlayLabel|onImageOverlaySecondary/);
  assert.doesNotMatch(read("src/theme/types.ts"), /onImageOverlayTertiary|onImageOverlayMetadata/);
}

function testCollageAndExactTagPins() {
  assert.doesNotMatch(collage, /pin|isPinned|pinnedAt|setTitlePinState/i);
  assert.match(tags, /createTagPinContext\(visibleTag\)/);
  assert.match(tags, /tagPinIntentQueues\.current\.get\(context\.contextKey\)/);
  assert.match(tags, /setTitlePinState\(savedTitleId, context, pinnedAt\)/);
  assert.match(tags, /selectedTagRef\.current !== context\.contextKey/);
  assert.match(tags, /accessibilityState=\{\{ selected: pinned \}\}/);
  assert.match(tags, /selectVisibleTagTitles\(tagMap\.get\(selectedTag\) \?\? \[\], tagPinnedAtById\)/);
  assert.match(tagView, /return \[\.\.\.pinned, \.\.\.unpinned\]/);
}

function testPreferencesSortingAndRatings() {
  assert.match(tags, /getViewPreference\("tags\.viewMode"\)/);
  assert.match(tags, /getViewPreference\("tags\.sort"\)/);
  assert.match(tags, /setViewPreference\("tags\.viewMode", next\)/);
  assert.match(tags, /setViewPreference\("tags\.sort", next\)/);
  assert.match(tags, /getViewPreference\("library\.viewMode"\)/);
  assert.match(preferences, /"tags\.viewMode": "grid"/);
  assert.match(preferences, /"tags\.sort": "count-desc"/);
  assert.match(tags, /compareTags\(a, b, sort\)/);
  assert.match(tags, /<PersonalRatingBadge value=\{item\.personalRating\}/);
  assert.match(tags, /personalRating=\{item\.personalRating\}/);
  assert.doesNotMatch(tags, /setScheme|setPalette|AppearancePreference/);
}

testRuntimeThemeCoverage();
testTagGridLabelContract();
testCollageAndExactTagPins();
testPreferencesSortingAndRatings();
console.log("Section 8 Etiquetas runtime theme, exact tag pin/sort contracts and imageOverlayLabel parity verification passed.");

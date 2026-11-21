const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const grid = read("src/components/browsing/TitleGridCard.tsx");
const badge = read("src/components/browsing/PersonalRatingBadge.tsx");
const presentation = read("src/components/browsing/personalRatingPresentation.ts");
const library = read("app/(tabs)/libreria.tsx");
const tags = read("app/(tabs)/etiquetas.tsx");
const search = read("app/(tabs)/buscar.tsx");
const collage = read("src/components/browsing/TagCollage.tsx");
const accessibility = read("src/components/browsing/savedTitleAccessibility.ts");
const poster = read("src/components/browsing/MediaPoster.tsx");
const detailPoster = read("src/components/browsing/DetailPoster.tsx");

assert.equal((grid.match(/<Pressable\b/g) ?? []).length, 1);
assert.equal((grid.match(/<\/Pressable>/g) ?? []).length, 1);
assert.match(grid, /personalRating\?: PersonalRating/);
assert.match(grid, /personalRating = null/);
assert.match(grid, /getPersonalRatingPresentation\(personalRating\)/);
assert.match(grid, /const ratingLabel = getPersonalRatingPresentation\(personalRating\)\?\.accessibilityLabel/);
assert.match(grid, /const label = \[accessibilityLabel,[\s\S]*?ratingLabel/);
assert.match(grid, /accessibilityLabel=\{label\}/);
assert.match(grid, /isPinned \? "fijado" : null/);
assert.match(grid, /<PersonalRatingBadge[\s\S]*?value=\{personalRating\}[\s\S]*?style=\{styles\.rating\}[\s\S]*?\/>/);
assert.match(grid, /<PersonalRatingBadge[\s\S]*?<Text numberOfLines=\{2\}/);
assert.match(grid, /rating: \{[\s\S]*?marginBottom: space\.xs/);
// Current ownership: card -> policy-aware MediaPoster -> identity/URL-aware DetailPoster.
assert.match(grid, /<MediaPoster[\s\S]*?identity=\{identity \?\? accessibilityLabel\}[\s\S]*?posterUrl=\{posterUrl\}/);
assert.match(poster, /<DetailPoster[\s\S]*?posterUrl=\{imageUrl\}/);
assert.match(detailPoster, /usePosterImageError\(identity, posterUrl\)/);
assert.match(detailPoster, /posterUrl && !imageFailed[\s\S]*?<Image[\s\S]*?onError=\{onImageError\}[\s\S]*?<PosterPlaceholder/);
assert.match(grid, /<View[\s\S]*?aria-hidden[\s\S]*?accessibilityElementsHidden[\s\S]*?pointerEvents="none"[\s\S]*?styles\.art/);
assert.match(grid, /isPinned && \([\s\S]*?styles\.pin[\s\S]*?diamond-outline/);
assert.doesNotMatch(grid, /library|tags|search|voteAverage/);

assert.doesNotMatch(badge, /Pressable|accessibilityLabel/);
assert.match(badge, /accessible=\{false\}/);
assert.match(badge, /importantForAccessibility="no-hide-descendants"/);
assert.equal((presentation.match(/accessibilityLabel: `/g) ?? []).length, 1);

for (const source of [library, tags]) {
  assert.match(source, /savedTitleOpenAccessibilityLabel\(item, true\)/);
  assert.match(source, /<PersonalRatingBadge[\s\S]*?value=\{item\.personalRating\}[\s\S]*?\/>/);
  assert.match(source, /<TitleGridCard[\s\S]*?personalRating=\{item\.personalRating\}/);
  assert.doesNotMatch(source, /formatPersonalRating\(item\.personalRating\)/);
}
assert.match(accessibility, /includePersonalRating \? getPersonalRatingPresentation\(item\.personalRating\)/);
assert.match(accessibility, /personalRating\?\.accessibilityLabel/);
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText, filename);
const { savedTitleOpenAccessibilityLabel } = require("../../../src/components/browsing/savedTitleAccessibility.ts");
const item = { title: "Rating TEST", medium: "comic", contentFamily: "manga", primaryFormat: null,
  status: "watching", personalRating: 87, voteAverage: 9.9 };
const label = savedTitleOpenAccessibilityLabel(item, true);
assert.match(label, /Leyendo/);
assert.equal((label.match(/Mi puntuación: 8\.7 de 10/g) ?? []).length, 1);
assert.doesNotMatch(savedTitleOpenAccessibilityLabel(item), /Mi puntuación/);
assert.doesNotMatch(savedTitleOpenAccessibilityLabel({ ...item, personalRating: null }, true), /Mi puntuación|9\.9/);

assert.match(grid, /isPinned[\s\S]*?<PersonalRatingBadge/);
assert.doesNotMatch(search, /personalRating|PersonalRatingBadge|getPersonalRatingPresentation/);
assert.doesNotMatch(collage, /personalRating|PersonalRatingBadge|getPersonalRatingPresentation/);
assert.match(collage, /posterUrl\?: string \| null/);
assert.match(collage, /<MediaPoster identity=\{item\?\.id \?\? "empty"\}/);
assert.match(collage, /posterUrl=\{posterUrl\} context="card"/);
assert.match(poster, /admittedImageUrl\(posterUrl, policy/);
assert.match(detailPoster, /<PosterPlaceholder/);

console.log("Section 2 personal rating integration verification passed.");

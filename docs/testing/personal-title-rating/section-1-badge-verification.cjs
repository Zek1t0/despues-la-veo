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
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  getPersonalRatingPresentation,
} = require("../../../src/components/browsing/personalRatingPresentation.ts");
const { colors } = require("../../../src/theme/colors.ts");

const expectedBoundaries = [
  [10, "1.0", "low"],
  [74, "7.4", "low"],
  [75, "7.5", "medium"],
  [84, "8.4", "medium"],
  [85, "8.5", "high"],
  [100, "10.0", "high"],
];

const visualToneColors = [
  [colors.personalRatingLowBackground, colors.personalRatingLowText],
  [colors.personalRatingMediumBackground, colors.personalRatingMediumText],
  [colors.personalRatingHighBackground, colors.personalRatingHighText],
];

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

for (const [value, text, tone] of expectedBoundaries) {
  assert.deepEqual(getPersonalRatingPresentation(value), {
    canonicalValue: value,
    text,
    tone,
    accessibilityLabel: `Mi puntuación: ${text} de 10`,
  });
}
assert.equal(getPersonalRatingPresentation(null), null);
assert.throws(() => getPersonalRatingPresentation(9), /personalRating/);
assert.throws(() => getPersonalRatingPresentation(101), /personalRating/);
assert.throws(() => getPersonalRatingPresentation(74.5), /personalRating/);
for (const [backgroundColor, textColor] of visualToneColors) {
  assert.ok(
    contrastRatio(backgroundColor, textColor) >= 4.5,
    `${textColor} sobre ${backgroundColor} debe alcanzar contraste 4.5:1`
  );
}

const root = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const badge = read("src/components/browsing/PersonalRatingBadge.tsx");
const presentation = read("src/components/browsing/personalRatingPresentation.ts");
const grid = read("src/components/browsing/TitleGridCard.tsx");
const search = read("app/(tabs)/buscar.tsx");
const collage = read("src/components/browsing/TagCollage.tsx");

assert.doesNotMatch(badge, /Pressable|onPress|onLongPress|accessibilityRole=["']button["']/);
assert.match(badge, /focusable=\{false\}/);
assert.match(badge, /accessibilityElementsHidden/);
assert.match(badge, /accessible=\{false\}/);
assert.match(badge, /importantForAccessibility="no-hide-descendants"/);
assert.doesNotMatch(badge, /accessibilityLabel|importantForAccessibility="yes"/);
assert.match(badge, /presentation\.text/);
assert.doesNotMatch(badge, />\s*Mi puntuación|\/10|de 10\s*</);
assert.match(presentation, /formatPersonalRating\(value\)/);
assert.doesNotMatch(presentation, /theme\/colors|backgroundColor|textColor/);
assert.equal((presentation.match(/value <= 74/g) ?? []).length, 1);
assert.equal((presentation.match(/value <= 84/g) ?? []).length, 1);
for (const token of [
  "personalRatingLowBackground",
  "personalRatingLowText",
  "personalRatingMediumBackground",
  "personalRatingMediumText",
  "personalRatingHighBackground",
  "personalRatingHighText",
]) {
  assert.match(badge, new RegExp(`colors\\.${token}`));
}
assert.match(grid, /personalRating\?: PersonalRating/);
assert.match(grid, /PersonalRatingBadge/);
assert.doesNotMatch(search, /personalRating|PersonalRatingBadge/);
assert.doesNotMatch(collage, /personalRating|PersonalRatingBadge/);

console.log("Section 1 shared personal rating badge verification passed.");

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

const { formatPersonalRating } = require("../../../src/core/personalRating.ts");

const root = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function visiblePersonalRating(value) {
  return value === null ? null : `${formatPersonalRating(value)}/10`;
}

assert.equal(visiblePersonalRating(87), "8.7/10");
assert.equal(visiblePersonalRating(100), "10.0/10");
assert.equal(visiblePersonalRating(10), "1.0/10");
assert.equal(visiblePersonalRating(null), null);

const library = read("app/(tabs)/libreria.tsx");
const tags = read("app/(tabs)/etiquetas.tsx");
const grid = read("src/components/browsing/TitleGridCard.tsx");
const search = read("app/(tabs)/buscar.tsx");
const collage = read("src/components/browsing/TagCollage.tsx");

for (const source of [library, tags]) {
  assert.match(source, /getPersonalRatingPresentation/);
  assert.match(source, /PersonalRatingBadge/);
  assert.match(source, /personalRating=\{item\.personalRating\}/);
}
assert.match(library, /TMDB \$\{tmdbRating\}\/10/);
assert.match(grid, /personalRating\?: PersonalRating/);
assert.match(grid, /PersonalRatingBadge/);
assert.match(grid, /personalRatingPresentation\?\.accessibilityLabel/);
assert.doesNotMatch(search, /personalRating|PersonalRatingBadge/);
assert.doesNotMatch(collage, /personalRating|PersonalRatingBadge/);

console.log("Section 5 passive personal rating presentation verification passed.");

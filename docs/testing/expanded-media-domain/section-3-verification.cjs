const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { selectVisibleLibraryTitles, LIBRARY_CLASSIFICATION_FILTERS } = require("../../../src/core/libraryView.ts");
const { mediaClassificationLabel, titleStatusLabel, mediaYearLabel } = require("../../../src/core/presentationLabels.ts");
const { findUnambiguousTmdbReference } = require("../../../src/core/savedTitleProviderReferences.ts");
const title = (id, medium = "audiovisual", contentFamily = null, primaryFormat = "movie", extra = {}) => ({
  id, medium, contentFamily, primaryFormat, title: id, year: 2020, posterUrl: null, overview: null, genres: [],
  voteAverage: null, personalRating: null, status: "watching", tags: ["Review"], notes: null, createdAt: 1, updatedAt: 2,
  providerReferences: [], ...extra,
});
function predicatesAndSort() {
  const anime = title("anime-movie", "audiovisual", "anime", "movie");
  const items = [anime, title("movie"), title("tv", "audiovisual", null, "tv"),
    title("ova", "audiovisual", "anime", "ova"), title("manga", "comic", "manga", null),
    title("manhwa", "comic", "manhwa", "webtoon"), title("manhua", "comic", "manhua", null),
    title("comic", "comic", null, null), title("novel", "literature", null, "novel")];
  const select = (classificationFilter, overrides = {}) => selectVisibleLibraryTitles({ items, pinnedAtById: new Map(), query: "", sort: "title-asc", statusFilter: "all", classificationFilter, ...overrides });
  const matrix = { all: items.map(x => x.id).sort(), movie: ["anime-movie", "movie"], tv: ["tv"], anime: ["anime-movie", "ova"], manga: ["manga"], manhwa: ["manhwa"], manhua: ["manhua"], comic: ["comic", "manga", "manhua", "manhwa"], literature: ["novel"] };
  assert.equal(LIBRARY_CLASSIFICATION_FILTERS.length, 9);
  for (const [filter, ids] of Object.entries(matrix)) {
    const result = select(filter); assert.deepEqual(result.map(x => x.id).sort(), [...ids].sort());
    assert.equal(new Set(result.map(x => x.id)).size, result.length);
  }
  assert.deepEqual(select("anime", { query: "review", statusFilter: "watching" }).map(x => x.id), ["anime-movie", "ova"]);
  assert.deepEqual(select("anime", { query: "movie", statusFilter: "watching" }).map(x => x.id), ["anime-movie"]);
  assert.deepEqual(select("anime", { statusFilter: "done" }), []);
  assert.deepEqual(select("comic", { query: "unmatched" }), []);
  assert.deepEqual(select("anime", { pinnedAtById: new Map([["manga", 999], ["ova", 3], ["anime-movie", 2]]) }).map(x => x.id), ["ova", "anime-movie"]);
  const scored = [title("a", "comic", null, null, { personalRating: 100 }),
    title("b", "comic", null, null, { personalRating: 10 }), title("high", "audiovisual", null, "movie", { voteAverage: 9 }),
    title("tie-b", "audiovisual", null, "movie", { title: "Same", voteAverage: 8 }),
    title("tie-a", "audiovisual", null, "movie", { title: "Same", voteAverage: 8 }),
    title("z", "comic", null, null, { voteAverage: undefined }), title("nonfinite", "comic", null, null, { voteAverage: NaN })];
  assert.deepEqual(select("all", { items: scored, sort: "rating-desc" }).map(x => x.id), ["high", "tie-a", "tie-b", "a", "b", "nonfinite", "z"]);
  assert.deepEqual(select("all", { items: scored, sort: "rating-desc", pinnedAtById: new Map([["a", 2], ["tie-b", 1]]) }).map(x => x.id), ["a", "tie-b", "high", "tie-a", "b", "nonfinite", "z"]);
  assert.deepEqual(select("all", { items: scored.slice(0, 2), sort: "personal-rating-asc" }).map(x => x.id), ["b", "a"]);
  assert.equal(titleStatusLabel("watching"), "En curso");
  console.log("Section 3 predicates, composition, pins and TMDB-only sorting passed.");
}
predicatesAndSort();

const assert = require("node:assert/strict");
const fs = require("node:fs");
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

const {
  compareLibraryTitles,
  selectVisibleLibraryTitles,
} = require("../../../src/core/libraryView.ts");
const {
  isLibrarySort,
  parseViewPreference,
} = require("../../../src/core/viewPreferences.ts");

function savedTitle(id, title, personalRating, voteAverage = null) {
  return {
    id,
    provider: "tmdb",
    externalId: id,
    type: "movie",
    title,
    year: 2020,
    posterUrl: null,
    overview: null,
    voteAverage,
    personalRating,
    genres: [],
    status: "planned",
    tags: [],
    notes: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function sorted(items, sort) {
  return [...items].sort((a, b) => compareLibraryTitles(a, b, sort));
}

function visible(items, pins, sort) {
  return selectVisibleLibraryTitles({
    items,
    pinnedAtById: new Map(pins),
    query: "",
    sort,
    statusFilter: "all",
    typeFilter: "all",
  });
}

function ids(items) {
  return items.map((item) => item.id);
}

function testComparators() {
  const values = [
    savedTitle("null", "Null", null),
    savedTitle("72", "Setenta y dos", 72),
    savedTitle("100", "Cien", 100),
    savedTitle("87", "Ochenta y siete", 87),
  ];
  assert.deepEqual(ids(sorted(values, "personal-rating-desc")), ["100", "87", "72", "null"]);
  assert.deepEqual(ids(sorted(values, "personal-rating-asc")), ["72", "87", "100", "null"]);

  const ties = [
    savedTitle("z", "Batman", 87),
    savedTitle("b", "Dune", 87),
    savedTitle("a", "Batman", 87),
  ];
  assert.deepEqual(ids(sorted(ties, "personal-rating-desc")), ["a", "z", "b"]);

  const nulls = [savedTitle("b", "Dune", null), savedTitle("a", "Batman", null)];
  assert.deepEqual(ids(sorted(nulls, "personal-rating-asc")), ["a", "b"]);

  const limits = [savedTitle("min", "Min", 10), savedTitle("max", "Max", 100)];
  assert.deepEqual(ids(sorted(limits, "personal-rating-desc")), ["max", "min"]);
  assert.deepEqual(ids(sorted(limits, "personal-rating-asc")), ["min", "max"]);
}

function testPins() {
  const example = [
    savedTitle("batman", "Batman", 50),
    savedTitle("interstellar", "Interstellar", 100),
    savedTitle("dune", "Dune", 100),
    savedTitle("arrival", "Arrival", 90),
  ];
  assert.deepEqual(
    ids(visible(example, [["batman", 300], ["interstellar", 200]], "personal-rating-desc")),
    ["batman", "interstellar", "dune", "arrival"]
  );

  const equalTimestamp = [
    savedTitle("low", "Low", 70),
    savedTitle("high", "High", 90),
    savedTitle("none", "None", null),
  ];
  const pins = [["low", 300], ["high", 300], ["none", 300]];
  assert.deepEqual(ids(visible(equalTimestamp, pins, "personal-rating-desc")), ["high", "low", "none"]);
  assert.deepEqual(ids(visible(equalTimestamp, pins, "personal-rating-asc")), ["low", "high", "none"]);

  const equalRating = [
    savedTitle("z", "Batman", 87),
    savedTitle("a", "Batman", 87),
    savedTitle("d", "Dune", 87),
  ];
  assert.deepEqual(
    ids(visible(equalRating, [["z", 300], ["a", 300], ["d", 300]], "personal-rating-desc")),
    ["a", "z", "d"]
  );

  assert.deepEqual(
    ids(visible(equalTimestamp, [], "personal-rating-desc")),
    ids(sorted(equalTimestamp, "personal-rating-desc"))
  );
}

function testPreferences() {
  for (const value of ["personal-rating-desc", "personal-rating-asc", "rating-desc"]) {
    assert.equal(isLibrarySort(value), true);
    assert.equal(parseViewPreference("library.sort", value), value);
  }
  assert.equal(parseViewPreference("library.sort", "unknown"), "updated-desc");
}

function testTmdbAndPersonalRemainDistinct() {
  const a = savedTitle("a", "A", 20, 9);
  const b = savedTitle("b", "B", 100, 7);
  assert.deepEqual(ids(sorted([b, a], "rating-desc")), ["a", "b"]);
  assert.deepEqual(ids(sorted([a, b], "personal-rating-desc")), ["b", "a"]);
}

testComparators();
testPins();
testPreferences();
testTmdbAndPersonalRemainDistinct();
console.log("Section 4 personal rating library sorting verification passed.");

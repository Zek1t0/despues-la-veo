// Explicit developer invocation only; four public metadata requests, no bulk or cover downloads.
const fs = require("node:fs");
const Module = require("node:module");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  if (request === "react-native") return { Platform: { OS: "direct-development" } };
  return originalLoad.call(this, request, parent, main);
};
const { createMangaUpdatesClient } = require("../../../src/providers/mangaupdates/client.ts");
const { mangaUpdatesMaterializationInput } = require("../../../src/providers/mangaupdates/mapping.ts");
async function main() {
  let requests = 0;
  const results = [];
  const responses = [];
  const client = createMangaUpdatesClient({ platform: "direct-development", perPage: 5,
    fetchImplementation: async (url, options) => {
      requests++; assert.ok(requests <= 4); assert.equal(Object.hasOwn(options.headers, "Authorization"), false);
      const response = await fetch(url, options);
      responses.push({ method: options.method, path: new URL(url).pathname, status: response.status });
      assert.equal(response.status, 200);
      return response;
    } });
  const searches = process.argv.includes("--detail-only") ? [] : [["Manga", "Berserk", "51239621230"], ["Manhwa", "Solo Leveling", "15180124327"], ["Manhua", "The Ravages of Time", null]];
  for (const [type, query, expectedId] of searches) {
    const response = await client.searchSeries(query, type);
    assert.ok(response.records.length > 0);
    assert.ok(response.records.every(record => record.type === type && typeof record.seriesId === "string"));
    if (expectedId) assert.ok(response.records.some(record => record.seriesId === expectedId));
    results.push({ operation: "search", type, query, totalHits: response.totalHits, page: response.page,
      perPage: response.perPage, admittedRecords: response.records.length,
      ids: response.records.map(record => record.seriesId), observedGenreSpellings: [...new Set(response.records.flatMap(record => record.genres))] });
  }
  const detail = await client.getSeries("30535847369", "Manga");
  const input = mangaUpdatesMaterializationInput(detail);
  assert.equal(input.reference.externalId, "30535847369"); assert.equal(input.snapshot.year, 2012);
  assert.equal(input.snapshot.primaryFormat, null); assert.equal(Object.hasOwn(input.snapshot, "voteAverage"), false);
  assert.deepEqual(input.initialTags, []); assert.equal(input.snapshot.posterUrl, null);
  results.push({ operation: "detail", id: detail.seriesId, type: detail.type, year: input.snapshot.year,
    contentFamily: input.snapshot.contentFamily, primaryFormat: input.snapshot.primaryFormat,
    genres: input.snapshot.genres, voteAverageOwnProperty: Object.hasOwn(input.snapshot, "voteAverage"),
    defaultCoverOmitted: input.snapshot.posterUrl === null });
  console.log(JSON.stringify({ context: "Windows Node direct HTTP; no Origin/auth; not native or browser validation", requests, responses, results }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });

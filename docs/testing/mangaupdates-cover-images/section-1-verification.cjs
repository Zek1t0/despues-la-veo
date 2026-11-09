const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

const previousFetch = global.fetch;
let networkCalls = 0;
global.fetch = () => { networkCalls++; throw Error("Cover URL tests must never request the network"); };

try {
  const mapping = require("../../../src/providers/mangaupdates/mapping.ts");
  const { parseSeries } = require("../../../src/providers/mangaupdates/validation.ts");
  const original = "https://cdn.mangaupdates.com/TEST-original.jpg";
  const thumbnail = "https://cdn.mangaupdates.com/TEST-thumbnail.jpg";
  const invalid = "https://other.example/TEST-invalid.jpg";
  const cases = [
    [original, thumbnail, original], [original, invalid, original], [original, null, original],
    [null, thumbnail, thumbnail], [undefined, thumbnail, thumbnail], ["", thumbnail, thumbnail],
    [invalid, thumbnail, thumbnail], [invalid, invalid, null], [invalid, null, null],
    [null, invalid, null], [null, null, null], [undefined, undefined, null],
  ];
  for (const [originalImage, thumbnailImage, expected] of cases) {
    const record = parseSeries({ series_id: "9007199254740993", title: "Synthetic cover selection", type: "Manga",
      image: { url: { original: originalImage, thumb: thumbnailImage } } });
    const before = structuredClone(record);
    for (const policy of [undefined, "omit", "reference-https"]) {
      const poster = policy === "reference-https" ? expected : null;
      const detail = mapping.mapMangaUpdatesDetails(record, policy);
      const result = mapping.mapMangaUpdatesSearchResult(record, policy);
      const input = mapping.mangaUpdatesMaterializationInput(record, policy);
      assert.equal(detail.snapshot.posterUrl, poster);
      assert.equal(result.posterUrl, poster);
      assert.deepEqual(input.snapshot, detail.snapshot);
      assert.deepEqual(input.initialTags, []);
      assert.equal(Object.hasOwn(detail.snapshot, "voteAverage"), false);
      assert.deepEqual(result.reference, detail.reference);
      assert.equal(detail.reference.externalId, "9007199254740993");
      assert.deepEqual(Object.keys(detail).sort(), ["reference", "snapshot"]);
      assert.deepEqual(Object.keys(result).sort(), ["description", "displayTitle", "kindLabel", "posterUrl", "reference", "releaseLabel"]);
      assert.deepEqual(Object.keys(input).sort(), ["initialTags", "reference", "snapshot"]);
      assert.ok(Object.isFrozen(detail.snapshot));
    }
    assert.deepEqual(record, before);
  }
  console.log(`PASS: ${cases.length} selection cases across details/search/materialization and default/omit/reference-https policies; contracts preserved.`);
  const accepted = [
    [original, original],
    ["HTTPS://CDN.MANGAUPDATES.COM/TEST.jpg", "https://cdn.mangaupdates.com/TEST.jpg"],
    ["https://cdn.mangaupdates.com:443/TEST.jpg", "https://cdn.mangaupdates.com/TEST.jpg"],
    ["https://cdn.mangaupdates.com/TEST%20cover.jpg?v=1#test", "https://cdn.mangaupdates.com/TEST%20cover.jpg?v=1#test"],
  ];
  const rejected = [
    null, "", "not a URL", "/TEST.jpg", "//cdn.mangaupdates.com/TEST.jpg",
    "http://cdn.mangaupdates.com/TEST.jpg", "ftp://cdn.mangaupdates.com/TEST.jpg",
    "data:image/png;base64,TEST", "javascript:alert(1)",
    "https:cdn.mangaupdates.com/TEST.jpg", "https:/cdn.mangaupdates.com/TEST.jpg",
    "https:///cdn.mangaupdates.com/TEST.jpg", "https:////cdn.mangaupdates.com/TEST.jpg",
    "https://user:password@cdn.mangaupdates.com/TEST.jpg", "https://user@cdn.mangaupdates.com/TEST.jpg",
    "https://:password@cdn.mangaupdates.com/TEST.jpg", "https://@cdn.mangaupdates.com/TEST.jpg",
    "https://other.example/TEST.jpg", "https://mangaupdates.com/TEST.jpg",
    "https://cdn.mangaupdates.com.evil.example/TEST.jpg", "https://evil.cdn.mangaupdates.com/TEST.jpg",
    "https://cdn.mangaupdates.com./TEST.jpg", "https://cdn%2emangaupdates.com/TEST.jpg",
    "https://cdn.mangaupdates.com@evil.example/TEST.jpg", "https://[::1]/TEST.jpg",
    "https://[invalid/TEST.jpg", "https://cdn.mangaupdates.com:80/TEST.jpg",
    "https://cdn.mangaupdates.com:444/TEST.jpg", "https://cdn.mangaupdates.com:0/TEST.jpg",
    "https://cdn.mangaupdates.com:65536/TEST.jpg", "https://cdn.mangaupdates.com:abc/TEST.jpg",
    "https://cdn.mangaupdates.com:/TEST.jpg", "https://cdn.mangaupdates.com:0443/TEST.jpg",
    "https://cdn.mangaupdates.com\\TEST.jpg", "https:\\cdn.mangaupdates.com\\TEST.jpg",
    "https://cdn.mangaupdates.com/TEST\\cover.jpg", "https://cdn.mangaupdates.com/TEST%.jpg",
    "https://cdn.mangaupdates.com/TEST%ZZ.jpg", " https://cdn.mangaupdates.com/TEST.jpg",
    "https://cdn.mangaupdates.com/TEST.jpg ", "https://cdn.mangaupdates.com/TEST cover.jpg",
    ...Array.from({ length: 33 }, (_, i) => `https://cdn.mangaupdates.com/TEST${String.fromCharCode(i < 32 ? i : 127)}.jpg`),
    "https://cdn.manga\nupdates.com/TEST.jpg", "https://cdn.mangaupdates.com/TEST\u0085.jpg",
  ];
  for (const [url, expected] of accepted) {
    assert.equal(mapping.mangaUpdatesPoster(url, "reference-https"), expected, url);
    assert.equal(mapping.mangaUpdatesPoster(url), null);
    assert.equal(mapping.mangaUpdatesPoster(url, "omit"), null);
  }
  for (const url of rejected) {
    assert.equal(mapping.mangaUpdatesPoster(url, "reference-https"), null, JSON.stringify(url));
    assert.equal(mapping.mangaUpdatesPoster(url, "omit"), null);
    const record = parseSeries({ series_id: "42", title: "Synthetic unsafe original", type: "Manga",
      image: { url: { original: url, thumb: thumbnail } } });
    assert.equal(mapping.mapMangaUpdatesDetails(record, "reference-https").snapshot.posterUrl, thumbnail);
    assert.equal(mapping.mapMangaUpdatesSearchResult(record, "reference-https").posterUrl, thumbnail);
    assert.equal(mapping.mangaUpdatesMaterializationInput(record, "reference-https").snapshot.posterUrl, thumbnail);
  }
  console.log(`PASS: ${accepted.length} accepted and ${rejected.length} rejected initial URLs; each rejected original falls back independently.`);
  assert.equal(networkCalls, 0);
  console.log("PASS: zero network requests; controlled URL strings only. No native Image rendering tested.");
} finally {
  global.fetch = previousFetch;
}

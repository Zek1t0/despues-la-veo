const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
}).outputText, file);
const { parsePublicRating, publicRatingOverTen } = require("../../../src/core/publicRating.ts");
const { metadataImageUrl, NO_METADATA_IMAGE_HOSTS } = require("../../../src/core/metadataImageUrl.ts");
const { parseEnrichedMediaMetadata, METADATA_LIMITS, metadataDate, assertMetadataReference } = require("../../../src/core/metadataValidation.ts");
const { parseMetadataPatch, metadataFieldsToPatch } = require("../../../src/core/metadataPatch.ts");

const policy = { exactHosts: ["poster.example.test", "banner.example.test"], subdomainHosts: ["cdn.example.test"] };
const reference = { provider: "kitsu", resourceNamespace: "anime", externalId: "99999999999999999999" };
const document = fields => ({ version: 1, provenance: { reference, normalizerVersion: 1,
  fetchedAt: null, checkedAt: null, sourceUpdatedAt: null }, fields });
let cases = 0;
function test(name, run) { run(); cases++; console.log(`PASS ${name}`); }
test("public score preserves decimal representation and scale without rounding", () => {
  const score = parsePublicRating({ provider: "kitsu", originalValue: "82.280", originalScale: { min: 0, max: 100 } });
  assert.equal(score.originalValue, "82.280"); assert.equal(publicRatingOverTen(score), 8.228);
  assert.equal(publicRatingOverTen({ provider: "tmdb", originalValue: 0, originalScale: { min: 0, max: 10 } }), 0);
  assert.equal(publicRatingOverTen({ provider: "other", originalValue: 3, originalScale: { min: 1, max: 5 } }), 5);
  for (const value of ["", " ", "NaN", "82oops", "1e2", "-1", "Infinity", NaN, Infinity, -1, 101, {}, null, true]) {
    assert.throws(() => parsePublicRating({ provider: "kitsu", originalValue: value, originalScale: { min: 0, max: 100 } }));
  }
  for (const scale of [{ min: 1, max: 1 }, { min: 10, max: 0 }, { min: 0, max: Infinity }, null]) {
    assert.throws(() => parsePublicRating({ provider: "kitsu", originalValue: 5, originalScale: scale }));
  }
});
test("URL policy rejects unsafe forms before admitting hosts; no URL reconstruction", () => {
  const safe = "https://poster.example.test/a.jpg?sig=ABC%2Fdef";
  assert.equal(metadataImageUrl(safe, policy), safe);
  assert.equal(metadataImageUrl("https://banner.example.test/x", policy), "https://banner.example.test/x");
  assert.ok(metadataImageUrl("https://a.cdn.example.test/x", policy));
  assert.equal(metadataImageUrl(safe, NO_METADATA_IMAGE_HOSTS), null);
  for (const url of ["http://poster.example.test/a", "file:///tmp/a", "data:image/png,foo", "//poster.example.test/a",
    "https://user:secret@poster.example.test/a", "https://@poster.example.test/a", "https://%70oster.example.test/a",
    "https:////poster.example.test/a", "https://poster.example.test:444/a", "https://poster.example.test\\@evil.test/x",
    "https://poster.example.test\n/x", "https://poster.example.test/%GG", "https://poster.example.test.attacker.test/a",
    "https://evilcdn.example.test/a", "https://localhost/x", "https://a.localhost/x", "https://machine.local/x",
    "https://a.internal/x", "https://a.home/x", "https://a.lan/x", "https://printer/x", "https://127.0.0.1/x",
    "https://10.0.0.1/x", "https://169.254.169.254/x", "https://192.168.1.1/x", "https://172.16.1.1/x",
    "https://2130706433/x", "https://0x7f000001/x", "https://0177.0.0.1/x", "https://[::1]/x", "https://[::ffff:127.0.0.1]/x",
    "https://[fc00::1]/x", "https://224.0.0.1/x", "https://poster.example.test./x", "https://poster.example.test/" + "a".repeat(4096)]) {
    assert.equal(metadataImageUrl(url, policy), null, url);
  }
  assert.equal(metadataImageUrl("https://127.0.0.1/x", { exactHosts: ["127.0.0.1"] }), null);
});
test("calendar dates, counts, durations and unknown values are honest", () => {
  for (const date of ["2000-02-29", "0001-01-01", "9999-12-31"]) assert.ok(metadataDate(date));
  for (const date of ["1900-02-29", "2001-02-29", "2024-04-31", "0000-01-01", "2020-13-01", "2020", "2020-1-01"]) assert.equal(metadataDate(date), false);
  const good = parseEnrichedMediaMetadata(document({ episodeCount: 0, episodeLengthMinutes: 0, totalLengthMinutes: null, startDate: "2000-02-29", sensitive: false }));
  assert.equal(good.fields.episodeCount, 0); assert.equal(good.fields.totalLengthMinutes, null);
  assert.equal(Object.hasOwn(good.fields, "endDate"), false);
  for (const [key, value] of [["episodeCount", -1], ["episodeCount", 2.5], ["episodeCount", "12"],
    ["episodeLengthMinutes", Infinity], ["totalLengthMinutes", METADATA_LIMITS.durationMinutes + 1], ["sensitive", "false"],
    ["canonicalTitle", "x".repeat(5001)], ["canonicalTitle", "bad\ntitle"], ["startDate", "2024-02-30"], ["categories", Array(129).fill("Drama")]]) {
    assert.throws(() => parseEnrichedMediaMetadata(document({ [key]: value })));
  }
});
test("normalized document is bounded, detached, immutable and contains no personal/raw keys", () => {
  const input = document({ titles: [{ value: "Title", language: "en", script: null, kind: "localized" }],
    posterImages: [{ variant: "small", url: "https://poster.example.test/x", width: 100, height: 140 }],
    ageRating: { value: "R", system: "kitsu" }, publicRating: { provider: "kitsu", originalValue: "82.28", originalScale: { min: 0, max: 100 } } });
  const output = parseEnrichedMediaMetadata(input, policy);
  input.fields.titles[0].value = "Mutated";
  assert.equal(output.fields.titles[0].value, "Title"); assert.ok(Object.isFrozen(output.fields.titles[0]));
  assert.equal(output.provenance.checkedAt, null); assertMetadataReference(output, reference);
  assert.throws(() => assertMetadataReference(output, { ...reference, resourceNamespace: "manga" }));
  for (const fields of [{ notes: "private" }, { status: "done" }, { updatedAt: 42 }, { personalRating: 90 },
    { publicRating: { ...output.fields.publicRating, provider: "tmdb" } }, { ageRating: { value: "18", system: "Argentina" } },
    { classification: { medium: "audiovisual", contentFamily: "anime", primaryFormat: "tv", notes: "raw" } },
    { titles: [{ value: "X", language: "en", script: null, kind: "localized", staff: ["raw"] }] }]) {
    assert.throws(() => parseEnrichedMediaMetadata(document(fields), policy));
  }
  assert.throws(() => parseEnrichedMediaMetadata({ ...document({}), version: 2 }));
  assert.throws(() => parseEnrichedMediaMetadata({ ...document({}), notes: "private" }));
  for (const time of [-1, Infinity, "42", 0.5]) {
    const invalid = document({}); invalid.provenance.checkedAt = time;
    assert.throws(() => parseEnrichedMediaMetadata(invalid));
  }
});
test("patch distinguishes omission, explicit unknown and valid zero/empty values", () => {
  const patch = metadataFieldsToPatch({ totalLengthMinutes: null, episodeCount: 0, categories: [] }, "kitsu");
  assert.equal(Object.hasOwn(patch, "startDate"), false);
  assert.deepEqual(patch.totalLengthMinutes, { kind: "unknown" });
  assert.deepEqual(patch.episodeCount, { kind: "known", value: 0 });
  assert.deepEqual(patch.categories, { kind: "known", value: [] });
  assert.deepEqual(parseMetadataPatch({ startDate: { kind: "not-provided" } }, "kitsu"), { startDate: { kind: "not-provided" } });
  const raw = { categories: { kind: "known", value: ["Drama"] } };
  const frozen = parseMetadataPatch(raw, "kitsu"); raw.categories.value.push("Action");
  assert.deepEqual(frozen.categories.value, ["Drama"]);
  for (const invalid of [{ notes: { kind: "known", value: "mine" } }, { startDate: { kind: "unknown", value: null } },
    { startDate: { kind: "known", value: null } }, { episodeCount: { kind: "known", value: NaN } }, { categories: { kind: "deleted" } }]) {
    assert.throws(() => parseMetadataPatch(invalid, "kitsu"));
  }
});
console.log(`PASS section 1 core: ${cases} groups (all synthetic, no transport/storage/UI).`);

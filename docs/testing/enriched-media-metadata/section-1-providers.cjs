const assert = require("node:assert/strict"), fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
}).outputText, file);
const { parseAnime, parseAnimeDetail, parseAnimeSearch } = require("../../../src/providers/kitsu/validation.ts");
const { mapKitsuDetails, mapKitsuSearchResult, kitsuMaterializationInput } = require("../../../src/providers/kitsu/mapping.ts");
const { metadataFieldsToPatch } = require("../../../src/core/metadataPatch.ts");
const { publicRatingOverTen } = require("../../../src/core/publicRating.ts");
const { mapTmdbMovieDetails, mapTmdbTvDetails, mapTmdbSearchItem, createTmdbMaterializationInput } = require("../../../src/providers/tmdb/tmdbMappers.ts");
const { tmdbPublicMetadata } = require("../../../src/providers/tmdb/publicMetadata.ts");
const { materializeProviderSavedTitle } = require("../../../src/core/providerSavedTitle.ts");
const { mapMangaUpdatesDetails } = require("../../../src/providers/mangaupdates/mapping.ts");
const { validateManualContent } = require("../../../src/core/manualContentEntry.ts");
const options = { imagePolicy: { exactHosts: ["poster.example.test", "banner.example.test"] } };
const reference = { provider: "kitsu", resourceNamespace: "anime", externalId: "99999999999999999999" };
function fixture(attributes = {}) {
  return { type: "anime", id: reference.externalId, attributes: {
    canonicalTitle: "TEST Faro", titles: { en: "TEST Beacon", en_jp: "TEST Hikari", ja_jp: "TEST 光", es: "TEST Faro español" },
    abbreviatedTitles: ["TF"], description: "<p>TEST Safe &amp; <script>bad()</script>[plain](https://never.test)</p>",
    subtype: "TV", startDate: "2000-02-29", endDate: null, status: "current", episodeCount: 12,
    episodeLength: 24.5, totalLength: 300, averageRating: "82.280", ageRating: "R", ageRatingGuide: "TEST violencia", nsfw: false,
    updatedAt: "2026-10-01T12:00:00.000Z",
    posterImage: { small: "https://poster.example.test/small?sig=ABC", original: "https://poster.example.test/original",
      meta: { dimensions: { small: { width: 100, height: 140 } } } },
    coverImage: { large: "https://banner.example.test/large" }, ...attributes,
  }, relationships: { categories: { data: [{ type: "categories", id: "a" }, { type: "categories", id: "b" }] } } };
}
const included = [{ type: "categories", id: "a", attributes: { title: "Drama" } },
  { type: "categories", id: "b", attributes: { title: "Shounen" } },
  { type: "categories", id: "unrelated", attributes: { title: "Horror" } }];
let cases = 0;
function test(name, run) { run(); cases++; console.log(`PASS ${name}`); }
const originalFetch = global.fetch;
global.fetch = () => { throw Error("No network authorized in section 1 suites"); };
try {
  test("Kitsu complete fixture: source, titles/scripts, images, scores and editorial metadata", () => {
    const input = fixture(), before = structuredClone(input);
    const parsed = parseAnimeDetail({ data: input, included }, reference.externalId, options);
    const details = mapKitsuDetails(parsed), fields = details.metadata.fields;
    assert.deepEqual(details.reference, reference); assert.deepEqual(details.metadata.provenance.reference, reference);
    assert.equal(details.metadata.provenance.checkedAt, null); assert.equal(details.metadata.provenance.fetchedAt, null);
    assert.equal(details.metadata.provenance.sourceUpdatedAt, Date.parse("2026-10-01T12:00:00Z"));
    assert.deepEqual(fields.titles.find(title => title.value === "TEST Hikari"), { value: "TEST Hikari", language: "ja", script: "Latn", kind: "localized" });
    assert.equal(fields.titles.find(title => title.value === "TEST 光").script, "Jpan");
    assert.equal(fields.abbreviatedTitles[0].language, null);
    assert.equal(fields.synopsis.language, null); assert.equal(fields.synopsis.text, "TEST Safe & plain");
    assert.equal(fields.publicRating.originalValue, "82.280"); assert.equal(publicRatingOverTen(fields.publicRating), 8.228);
    assert.equal(fields.posterImages[0].url, input.attributes.posterImage.small); assert.equal(fields.posterImages[0].width, 100);
    assert.equal(fields.bannerImages[0].url, "https://banner.example.test/large");
    assert.equal(fields.episodeLengthMinutes, 24.5); assert.equal(fields.totalLengthMinutes, 300);
    assert.equal(fields.endDate, null); assert.equal(fields.sensitive, false);
    assert.deepEqual(fields.ageRating, { value: "R", system: "kitsu" });
    assert.deepEqual(fields.categories, ["Drama", "Shounen"]); assert.deepEqual(fields.genres, ["Drama"]);
    assert.deepEqual(fields.classification, { medium: "audiovisual", contentFamily: "anime", primaryFormat: "tv" });
    assert.equal(Object.hasOwn(details.snapshot, "voteAverage"), false); assert.equal(details.snapshot.posterUrl, null);
    assert.deepEqual(kitsuMaterializationInput(parsed).initialTags, []);
    assert.equal(mapKitsuSearchResult(parsed).posterUrl, null); assert.ok(mapKitsuSearchResult(parsed).metadata);
    assert.deepEqual(input, before); assert.equal(parsed.metadataDiagnostics.length, 0);
  });
  test("Kitsu absence/null/invalid and independent title groups never invent deletions", () => {
    const minimal = parseAnime({ type: "anime", id: "1", attributes: { canonicalTitle: "TEST Minimal" } });
    assert.equal(Object.hasOwn(minimal.metadata.fields, "episodeCount"), false);
    assert.equal(Object.hasOwn(minimal.metadata.fields, "titles"), false);
    assert.equal(Object.hasOwn(minimal.metadata.fields, "totalLengthMinutes"), false);
    const zero = parseAnime(fixture({ episodeCount: 0, averageRating: "0", totalLength: null, nsfw: null }), included, options);
    assert.equal(zero.metadata.fields.episodeCount, 0); assert.equal(zero.metadata.fields.sensitive, null);
    assert.equal(zero.metadata.fields.totalLengthMinutes, null);
    const patch = metadataFieldsToPatch(zero.metadata.fields, "kitsu", options.imagePolicy);
    assert.deepEqual(patch.totalLengthMinutes, { kind: "unknown" });
    const partial = fixture(); delete partial.attributes.totalLength; delete partial.attributes.abbreviatedTitles;
    const fields = parseAnime(partial, included, options).metadata.fields;
    assert.ok(fields.titles.length > 0); assert.equal(Object.hasOwn(fields, "abbreviatedTitles"), false);
    assert.equal(Object.hasOwn(fields, "totalLengthMinutes"), false, "no episode multiplication");
    for (const [key, invalid] of [["episodeCount", -1], ["episodeCount", "12"], ["episodeLength", NaN], ["totalLength", -2],
      ["averageRating", "101"], ["averageRating", ""], ["endDate", "2001-02-29"], ["nsfw", "false"],
      ["ageRatingGuide", "x".repeat(501)], ["updatedAt", "2026-02-30T00:00:00Z"], ["updatedAt", "2026-01-01T24:00:00Z"]]) {
      const result = parseAnime(fixture({ [key]: invalid }), included, options);
      assert.ok(result.metadataDiagnostics.length > 0, key);
    }
    const noNsfw = fixture(); delete noNsfw.attributes.nsfw;
    assert.equal(Object.hasOwn(parseAnime(noNsfw, included, options).metadata.fields, "sensitive"), false, "ageRating is not nsfw");
  });
  test("Kitsu rejects structural identity errors, omits incomplete relations and bounded optional data", () => {
    assert.throws(() => parseAnimeDetail({ data: fixture(), included }, "1", options));
    assert.throws(() => parseAnime({ ...fixture(), type: "manga" }, included, options));
    assert.throws(() => parseAnime({ ...fixture(), id: 1 }, included, options));
    assert.throws(() => parseAnime(fixture({ canonicalTitle: "x".repeat(5001) }), included, options));
    assert.throws(() => parseAnimeSearch({ data: Array(21).fill(fixture()) }, options));
    for (const related of [included.slice(0, 1), [], Array(513).fill(included[0])]) {
      const result = parseAnime(fixture(), related, options);
      assert.equal(Object.hasOwn(result.metadata.fields, "categories"), false);
      assert.ok(result.metadataDiagnostics.some(d => d.reason === "incomplete"));
    }
    const paged = fixture(); paged.relationships.categories.links = { next: "https://never.test/next" };
    assert.equal(Object.hasOwn(parseAnime(paged, included, options).metadata.fields, "categories"), false);
    const empty = fixture(); empty.relationships.categories.data = [];
    assert.deepEqual(parseAnime(empty, [], options).metadata.fields.categories, []);
    const lots = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`a${i}`, "TEST"]));
    assert.equal(Object.hasOwn(parseAnime(fixture({ titles: lots }), included, options).metadata.fields, "titles"), false);
    assert.equal(Object.hasOwn(parseAnime(fixture({ description: "x".repeat(50001) }), included, options).metadata.fields, "synopsis"), false);
    const unsafe = parseAnime(fixture({ posterImage: { original: "https://127.0.0.1/x" } }), included, options);
    assert.equal(Object.hasOwn(unsafe.metadata.fields, "posterImages"), false);
    assert.ok(unsafe.metadataDiagnostics.some(d => d.reason === "image-not-admitted"));
    const closed = parseAnime(fixture(), included);
    assert.equal(Object.hasOwn(closed.metadata.fields, "posterImages"), false, "no default host activation");
    const forged = { ...parseAnime(fixture(), included, options), id: "1" };
    assert.throws(() => mapKitsuDetails(forged), /referencia/);
  });
  test("TMDB shared public projection leaves legacy values and creation policy intact", () => {
    for (const [map, namespace] of [[mapTmdbMovieDetails, "movie"], [mapTmdbTvDetails, "tv"]]) {
      const dto = { id: 77, title: "TEST Movie", name: "TEST TV", vote_average: 8.4, genres: [{ id: 1, name: "Drama" }] };
      const before = structuredClone(dto), result = map(dto);
      assert.equal(result.snapshot.voteAverage, 8.4);
      assert.equal(result.metadata.fields.publicRating.originalValue, 8.4);
      assert.deepEqual(result.metadata.fields.publicRating.originalScale, { min: 0, max: 10 });
      assert.equal(result.metadata.provenance.reference.resourceNamespace, namespace);
      assert.equal(result.metadata.provenance.checkedAt, null);
      const input = createTmdbMaterializationInput(result, ["Personal policy"]);
      assert.strictEqual(input.metadata, result.metadata); assert.deepEqual(input.initialTags, ["Personal policy"]);
      assert.deepEqual(dto, before);
    }
    assert.equal(tmdbPublicMetadata("movie", 1, {}), undefined);
    assert.equal(tmdbPublicMetadata("movie", 1, { vote_average: "8.4" }), undefined);
    assert.equal(tmdbPublicMetadata("movie", 1, { vote_average: 11 }), undefined);
    assert.equal(tmdbPublicMetadata("movie", 1, { vote_average: NaN }), undefined);
    assert.equal(tmdbPublicMetadata("movie", 1, { vote_average: null }).fields.publicRating, null);
    assert.equal(mapTmdbMovieDetails({ id: 1, vote_average: 11 }).snapshot.voteAverage, 11, "legacy contract retained; enriched projection rejects out of scale");
    assert.equal(mapTmdbSearchItem({ id: 77, media_type: "movie", vote_average: 0 }).metadata.fields.publicRating.originalValue, 0);
    assert.throws(() => createTmdbMaterializationInput({ ...mapTmdbMovieDetails({ id: 1, vote_average: 8 }),
      reference: { provider: "tmdb", resourceNamespace: "tv", externalId: "1" } }, []), /referencia/);
  });
  test("MangaUpdates/manual and existing materialization retain their personal contracts", () => {
    const details = mapMangaUpdatesDetails({ seriesId: "123", title: "TEST Comic", type: "Manga", year: "2020", description: "TEST", genres: ["Drama"], originalImage: null, thumbnailImage: null });
    assert.equal(Object.hasOwn(details, "metadata"), false); assert.equal(Object.hasOwn(details.snapshot, "voteAverage"), false);
    const manual = validateManualContent({ title: " TEST Local ", medium: "comic", contentFamily: "manga", primaryFormat: null, year: null, overview: null, metadata: "never accepted" });
    assert.equal(Object.hasOwn(manual, "metadata"), false);
    const existing = { id: "local-id", medium: "audiovisual", contentFamily: "anime", primaryFormat: "tv", title: "Old", year: null,
      posterUrl: null, overview: null, genres: [], voteAverage: null, personalRating: 85, status: "watching", tags: ["mine"], notes: "my note", createdAt: 1, updatedAt: 2 };
    const original = structuredClone(existing);
    const next = materializeProviderSavedTitle(kitsuMaterializationInput(parseAnime(fixture(), included, options)), existing, () => { throw Error("new identity"); }, 10);
    for (const key of ["id", "personalRating", "status", "tags", "notes", "createdAt"]) assert.deepEqual(next[key], existing[key]);
    assert.equal(Object.hasOwn(next, "metadata"), false, "SQLite6 storage remains unchanged until section 2");
    assert.deepEqual(existing, original);
  });
} finally { global.fetch = originalFetch; }
console.log(`PASS section 1 providers: ${cases} groups, synthetic only (no Web/Android acceptance).`);

async function transportIntegration() {
  const { createKitsuClient } = require("../../../src/providers/kitsu/client.ts");
  const calls = [];
  const client = createKitsuClient({ timing: { now: () => 0, wait: async () => {} }, fetchImplementation: async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ data: fixture(), included }), { status: 200 });
  } });
  const result = mapKitsuDetails(await client.getAnime(reference.externalId));
  assert.equal(calls.length, 1); assert.equal(result.metadata.fields.publicRating.originalValue, "82.280");
  assert.equal(Object.hasOwn(result.metadata.fields, "posterImages"), false);
  assert.ok(!calls[0].url.includes("posterImage"), "HTTP projection not expanded in section 1");
  assert.equal(calls[0].init.credentials, "omit"); assert.equal(calls[0].init.redirect, "error");
  assert.equal(result.metadata.provenance.checkedAt, null, "parsing is not proof of local checkedAt");
  console.log("PASS section 1 injected transport: one existing request, no artwork activation or new HTTP projection.");
}
transportIntegration().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const originalLoad = Module._load;
const runtimePlatform = { OS: "direct-development" };
Module._load = function(request, parent, main) {
  if (request === "react-native") return { Platform: runtimePlatform };
  return originalLoad.call(this, request, parent, main);
};
const root = "../../../src/providers/mangaupdates/";
const identity = require(root + "identity.ts");
const validation = require(root + "validation.ts");
const mapping = require(root + "mapping.ts");
const attribution = require(root + "attribution.ts");
const { createMangaUpdatesClient } = require(root + "client.ts");
const { createMangaUpdatesSearchCapability } = require(root + "adapter.ts");
const { MangaUpdatesError } = require(root + "errors.ts");
const { MANGAUPDATES_REQUEST_POLICY: policy, mangaUpdatesRetryAfter } = require(root + "requestPolicy.ts");
const { materializeProviderSavedTitle } = require("../../../src/core/providerSavedTitle.ts");
const { productionSearchCategories, resolveProductionSearchCategory } = require("../../../src/components/search/searchCategories.ts");
const fixture = require("./fixtures/mangaupdates-minimal.json");
const previousFetch = global.fetch;
global.fetch = async () => { throw Error("Unit tests must never call the real network"); };
const record = (patch = {}) => ({ ...fixture, ...patch });
const search = (records = [record()], patch = {}) => ({ total_hits: records.length, page: 1, per_page: 25,
  results: records.map(record => ({ record, hit_title: "Alternative TEST title" })), ...patch });
const errorCode = code => error => error instanceof MangaUpdatesError && error.code === code;
function client(fetchImplementation, extra = {}) {
  let now = 0; const waits = [];
  const timing = { now: () => now, wait: async (ms, signal) => {
    if (signal?.aborted) throw new MangaUpdatesError("cancelled");
    waits.push(ms); now += ms;
  } };
  return { api: createMangaUpdatesClient({ platform: "direct-development", fetchImplementation, timing, ...extra }),
    waits, now: () => now, advance: ms => { now += ms; } };
}
const json = value => new Response(JSON.stringify(value), { status: 200 });

async function identityAndMapping() {
  for (const id of ["15180124327", "30535847369", "51239621230", "9007199254740993", "18446744073709551615"]) {
    assert.equal(identity.canonicalSeriesId(id), id);
    assert.equal(identity.mangaUpdatesReference(id).externalId, id);
    assert.equal(identity.mangaUpdatesDetailDestination(identity.mangaUpdatesReference(id)), `/mangaupdates/series/${id}`);
  }
  for (const id of ["", "0", "01", " 1", "1 ", "42\n", "42\r\n", "42\u2028", "1.0", "1e3", "-1", "42/path", "slug", 15180124327, null]) {
    assert.throws(() => identity.canonicalSeriesId(id), errorCode("invalid-request"));
  }
  assert.equal(identity.seriesIdFromResponse(15180124327), "15180124327");
  assert.throws(() => identity.seriesIdFromResponse(9007199254740993), errorCode("invalid-response"));
  assert.throws(() => identity.mangaUpdatesDetailDestination({ provider: "arbitrary", resourceNamespace: "series", externalId: "42" }), errorCode("invalid-request"));
  assert.throws(() => identity.mangaUpdatesDetailDestination({ provider: "mangaupdates", resourceNamespace: "movie", externalId: "42" }), errorCode("invalid-request"));
  for (const [type, family] of [["Manga", "manga"], ["Manhwa", "manhwa"], ["Manhua", "manhua"]]) {
    const parsed = validation.parseSeries(record({ type }));
    assert.equal(typeof parsed.seriesId, "string"); assert.equal(Object.hasOwn(parsed, "bayesian_rating"), false);
    const details = mapping.mapMangaUpdatesDetails(parsed), input = mapping.mangaUpdatesMaterializationInput(parsed);
    assert.equal(details.snapshot.medium, "comic"); assert.equal(details.snapshot.contentFamily, family);
    assert.equal(details.snapshot.primaryFormat, null); assert.equal(details.snapshot.posterUrl, null);
    assert.equal(Object.hasOwn(details.snapshot, "voteAverage"), false); assert.equal(Object.hasOwn(input, "voteAverage"), false);
    assert.equal(Object.hasOwn(details, "initialTags"), false); assert.deepEqual(input.initialTags, []);
    assert.deepEqual(details.snapshot.genres, ["Action", "Sci-fi"]);
    assert.equal(details.snapshot.overview, "Descripción original de prueba & texto legible.\n\nSin datos de un catálogo real.");
    const item = materializeProviderSavedTitle(input, null, () => "opaque-local", 100);
    assert.equal(item.id, "opaque-local"); assert.equal(item.voteAverage, null); assert.deepEqual(item.tags, []);
    const personal = { ...item, primaryFormat: "webtoon", voteAverage: 7.9, status: "watching", tags: ["Personal"], notes: "Note", personalRating: 87 };
    const updated = materializeProviderSavedTitle(input, personal, () => "must-not-run", 100);
    assert.equal(updated.primaryFormat, "webtoon"); assert.equal(updated.voteAverage, 7.9); assert.deepEqual(updated.tags, personal.tags);
    assert.equal(updated.notes, personal.notes); assert.equal(updated.personalRating, 87); assert.equal(updated.id, personal.id);
    for (const rating of [9, null, undefined]) {
      assert.throws(() => materializeProviderSavedTitle({ ...input, snapshot: { ...input.snapshot, voteAverage: rating } }, personal, () => "unused", 101));
    }
    const hit = mapping.mapMangaUpdatesSearchResult(parsed, "reference-https");
    assert.equal(hit.displayTitle, fixture.title); assert.equal(hit.reference.resourceNamespace, "series");
    assert.equal(hit.posterUrl, fixture.image.url.thumb); assert.equal(hit.releaseLabel, "2021");
  }
  const excluded = ["Novel", "Doujinshi", "OEL", "Artbook", "Drama CD", "Filipino", "Indonesian", "Thai", "Vietnamese", "Malaysian", "Nordic", "French", "Spanish", "German", "Russian", "Anime", "Unknown"];
  for (const type of excluded) assert.throws(() => validation.parseSeries(record({ type })), errorCode("unsupported-type"));
  const filtered = validation.parseSearchResponse(search([record(), record({ type: "Manhwa" }), record({ type: "Novel" }), record({ series_id: "42" })]), "Manga");
  assert.deepEqual(filtered.records.map(x => x.seriesId), [fixture.series_id, "42"]);
  assert.equal(validation.parseSearchResponse(search([record({ type: "Manhwa" })]), "Manga").records.length, 0);
  for (const value of [null, [], {}, search([], { results: {} }), search([], { page: 0 }), search([], { total_hits: "0" }), search([record({ title: "" })]), search([record({ series_id: "0123" })]), search([record({ genres: ["Action"] })])]) {
    assert.throws(() => validation.parseSearchResponse(value, "Manga"), errorCode("invalid-response"));
  }
  const sparse = validation.parseSeries({ series_id: "42", title: "Sparse TEST", type: "Manga" });
  const sparseSnapshot = mapping.mapMangaUpdatesDetails(sparse).snapshot;
  for (const field of ["year", "posterUrl", "overview", "primaryFormat"]) assert.equal(sparseSnapshot[field], null);
  assert.deepEqual(sparseSnapshot.genres, []);
  assert.throws(() => validation.parseDetailResponse(record(), "42"), errorCode("invalid-response"));
  assert.throws(() => validation.parseDetailResponse(record(), fixture.series_id, "Manhwa"), errorCode("unsupported-type"));
  assert.throws(() => validation.parseSeries(record({ description: {} })), errorCode("invalid-response"));
  assert.throws(() => validation.parseSeries(record({ image: { url: "not-object" } })), errorCode("invalid-response"));
  assert.throws(() => validation.parseSeries(record({ year: {} })), errorCode("invalid-response"));
  for (const year of [null, "", "unknown", "c. 1989", "1989-1990", "1989?", "0000", "2021-01-01"]) assert.equal(mapping.publicationYear(year), null);
  assert.equal(mapping.publicationYear("1989"), 1989);
  assert.equal(mapping.mangaUpdatesPoster(fixture.image.url.original, "reference-https"), fixture.image.url.original);
  for (const url of [null, "", "http://cdn.mangaupdates.com/x", "/relative", "javascript:alert(1)", "https://other.example/x", "https://cdn.mangaupdates.com.evil.example/x", "https://user:password@cdn.mangaupdates.com/x"]) {
    assert.equal(mapping.mangaUpdatesPoster(url, "reference-https"), null);
  }
  assert.deepEqual(mapping.narrativeGenres([...mapping.MANGAUPDATES_NARRATIVE_GENRES, " science fiction ", "SCI-FI", "Shounen", "Shoujo", "Seinen", "Josei", "Webtoon/Webcomic", "Based on a Webcomic/Webtoon", "Unknown"]), [...mapping.MANGAUPDATES_NARRATIVE_GENRES]);
  assert.equal(mapping.plainMangaUpdatesDescription('<script>alert(1)</script><p>A &amp; B &#x1f600;</p><p>[label](https://example.invalid) **bold**</p>'), "A & B 😀\n\nlabel bold");
  assert.equal(mapping.plainMangaUpdatesDescription("&lt;script&gt;bad()&lt;/script&gt;Useful"), "Useful");
  assert.equal(mapping.plainMangaUpdatesDescription("<style>bad</style> <p> </p>"), null);
  assert.equal(mapping.plainMangaUpdatesDescription("x".repeat(10000)).length, 10000);
  assert.equal(attribution.mangaUpdatesProvenance(identity.mangaUpdatesReference("42")).label, "Datos: MangaUpdates");
  assert.equal(attribution.mangaUpdatesProvenance(identity.mangaUpdatesReference("42")).sourceUrl, "https://api.mangaupdates.com/v1/series/42");
  for (const platform of ["web", "android", "ios"]) {
    assert.equal(attribution.mangaUpdatesAvailability(platform).productionEnabled,
      platform === "android" && require("../../../src/providers/mangaupdates/availability.ts").MANGAUPDATES_ANDROID_VALIDATED);
    const enabled = attribution.mangaUpdatesAvailability(platform).productionEnabled;
    assert.deepEqual(productionSearchCategories(platform).map(x => x.id), enabled ? ["movie", "tv", "manga", "manhwa", "manhua"] : ["movie", "tv"]);
    assert.equal(resolveProductionSearchCategory("manga", platform, {}), null);
  }
}

async function transportCacheAndTiming() {
  const calls = [];
  const c = client(async (url, options) => {
    calls.push({ url, options, start: c.now() });
    return json(options.method === "POST" ? search([record({ type: JSON.parse(options.body).type[0] })]) : record());
  });
  for (const type of ["Manga", "Manhwa", "Manhua"]) {
    const results = await createMangaUpdatesSearchCapability(type, c.api).search(" Query ");
    assert.equal(results.length, 1); assert.equal(results[0].kindLabel, type);
  }
  assert.equal(calls.length, 3);
  calls.forEach((call, i) => {
    assert.equal(call.url, "https://api.mangaupdates.com/v1/series/search"); assert.equal(call.options.method, "POST");
    assert.deepEqual(JSON.parse(call.options.body), { search: "Query", stype: "title", type: [["Manga", "Manhwa", "Manhua"][i]], page: 1, perpage: 25 });
    assert.deepEqual(Object.keys(call.options.headers).sort(), ["Accept", "Content-Type"]);
    if (i) assert.ok(call.start - calls[i - 1].start >= policy.spacingMs);
  });
  await c.api.searchSeries("Query", "Manga"); assert.equal(calls.length, 3);
  await c.api.searchSeries("", "Manga"); assert.equal(calls.length, 3);
  await c.api.getSeries(fixture.series_id, "Manga");
  assert.equal(calls.at(-1).url, `https://api.mangaupdates.com/v1/series/${fixture.series_id}`); assert.equal(calls.at(-1).options.method, "GET");
  assert.equal(Object.hasOwn(calls.at(-1).options, "body"), false);
  await c.api.getSeries(fixture.series_id); assert.equal(calls.length, 4);
  await assert.rejects(c.api.getSeries(fixture.series_id, "Manhwa"), errorCode("unsupported-type")); assert.equal(calls.length, 4);
  c.advance(policy.searchTtlMs + 1); await c.api.searchSeries("Query", "Manga"); assert.equal(calls.length, 5);
  await c.api.getSeries(fixture.series_id); assert.equal(calls.length, 5);
  c.advance(policy.detailTtlMs + 1); await c.api.getSeries(fixture.series_id); assert.equal(calls.length, 6);
  const countBefore = calls.length;
  for (let i = 0; i < policy.cacheEntries + 1; i++) await c.api.searchSeries(`bounded-${i}`, "Manga");
  await c.api.searchSeries("bounded-0", "Manga"); assert.equal(calls.length, countBefore + policy.cacheEntries + 2);
  await assert.rejects(c.api.getSeries("00042"), errorCode("invalid-request"));
  await assert.rejects(c.api.searchSeries("x", "Novel"), errorCode("unsupported-type"));
  assert.throws(() => validation.mangaUpdatesSearchBody("x", "Manga", 26), errorCode("invalid-request"));
  const web = createMangaUpdatesClient({ platform: "web", fetchImplementation: async () => { throw Error("Web must never fetch"); } });
  await assert.rejects(web.searchSeries("x", "Manga"), errorCode("platform-unavailable"));
  await assert.rejects(web.getSeries("42"), errorCode("platform-unavailable"));
  runtimePlatform.OS = "web";
  await assert.rejects(c.api.getSeries(fixture.series_id), errorCode("platform-unavailable"));
  await assert.rejects(c.api.searchSeries("bounded-0", "Manga"), errorCode("platform-unavailable"));
  runtimePlatform.OS = "direct-development";
  assert.equal(calls.length, countBefore + policy.cacheEntries + 2, "real Web cannot override the guard or consume cache via diagnostic options");

  let release, active = 0, maxActive = 0, duplicateCalls = 0;
  const blocked = client(async () => { duplicateCalls++; maxActive = Math.max(maxActive, ++active);
    await new Promise(resolve => { release = resolve; }); active--; return json(search()); });
  const first = blocked.api.searchSeries("same", "Manga"), duplicate = blocked.api.searchSeries("same", "Manga");
  await new Promise(setImmediate); assert.equal(duplicateCalls, 1); release(); await Promise.all([first, duplicate]);
  assert.equal(duplicateCalls, 1); assert.equal(maxActive, 1);
  const a = blocked.api.searchSeries("a", "Manga"), b = blocked.api.searchSeries("b", "Manga");
  await new Promise(setImmediate); assert.equal(duplicateCalls, 2); release(); await a;
  await new Promise(setImmediate); assert.equal(duplicateCalls, 3); release(); await b; assert.equal(maxActive, 1);
  let finish;
  const capacity = client(async () => { await new Promise(resolve => { finish = resolve; }); return json(search()); });
  const queued = Array.from({ length: policy.queuedRequests }, (_, i) => capacity.api.searchSeries(`queue-${i}`, "Manga"));
  await assert.rejects(capacity.api.searchSeries("overflow", "Manga"), errorCode("rate-limited"));
  for (let i = 0; i < queued.length; i++) { await new Promise(setImmediate); finish(); await queued[i]; }
}

async function errorsAndRetry() {
  for (const [status, code] of [[400, "http"], [401, "access-rejected"], [403, "access-rejected"], [404, "not-found"], [500, "http"]]) {
    let calls = 0; const c = client(async () => { calls++; return new Response("private remote body", { status }); });
    await assert.rejects(c.api.getSeries("42"), error => errorCode(code)(error) && error.status === status && !error.message.includes("private"));
    assert.equal(calls, 1);
  }
  const network = client(async () => { throw Error("transport diagnostic"); });
  await assert.rejects(network.api.getSeries("42"), errorCode("network"));
  const malformed = client(async () => new Response("not-json", { status: 200 }));
  await assert.rejects(malformed.api.getSeries("42"), errorCode("invalid-response"));
  const wrongId = client(async () => json(record())); await assert.rejects(wrongId.api.getSeries("42"), errorCode("invalid-response"));
  const redirected = client(async () => { const response = json(record()); Object.defineProperty(response, "url", { value: "https://other.example/series/42" }); return response; });
  await assert.rejects(redirected.api.getSeries("42"), errorCode("access-rejected"));
  const unsupported = client(async () => json(record({ type: "Novel" }))); await assert.rejects(unsupported.api.getSeries(fixture.series_id), errorCode("unsupported-type"));
  let timerCallback, cleared = 0;
  const timeout = client(async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Error("abort"))); queueMicrotask(timerCallback);
  }), { setTimer: callback => { timerCallback = callback; return 1; }, clearTimer: () => { cleared++; } });
  await assert.rejects(timeout.api.getSeries("42"), errorCode("timeout")); assert.equal(cleared, 1);
  const ignoredAbort = client(async () => { timerCallback(); return json(record()); },
    { setTimer: callback => { timerCallback = callback; return 1; }, clearTimer: () => {} });
  await assert.rejects(ignoredAbort.api.getSeries(fixture.series_id), errorCode("timeout"));
  const controller = new AbortController(); let cancellationCalls = 0;
  const cancelled = client(async (_url, options) => { cancellationCalls++; return new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Error("abort"))); controller.abort();
  }); });
  await assert.rejects(cancelled.api.getSeries("42", undefined, controller.signal), errorCode("cancelled"));
  await assert.rejects(cancelled.api.getSeries("42", undefined, controller.signal), errorCode("cancelled")); assert.equal(cancellationCalls, 1);
  for (const retryAfter of ["2", null, "invalid"]) {
    let attempts = 0;
    const c = client(async () => ++attempts === 1 ? new Response("", { status: 429, headers: retryAfter ? { "Retry-After": retryAfter } : {} }) : json(record()));
    await c.api.getSeries(fixture.series_id); assert.equal(attempts, 2);
    assert.ok(c.waits.includes(retryAfter === "2" ? 2000 : policy.fallback429DelayMs));
  }
  let attempts = 0;
  const repeated = client(async () => { attempts++; return new Response("", { status: 429 }); });
  await assert.rejects(repeated.api.getSeries("42"), errorCode("rate-limited")); assert.equal(attempts, 2);
  await assert.rejects(repeated.api.getSeries("43"), errorCode("rate-limited")); assert.equal(attempts, 2, "cooldown cannot become a retry storm");
  let longAttempts = 0;
  const long = client(async () => { longAttempts++; return new Response("", { status: 429, headers: { "Retry-After": "120" } }); });
  await assert.rejects(long.api.getSeries("42"), error => errorCode("rate-limited")(error) && error.retryAfterMs === 120000);
  assert.equal(longAttempts, 1); assert.deepEqual(long.waits, []);
  await assert.rejects(long.api.getSeries("43"), errorCode("rate-limited")); assert.equal(longAttempts, 1);
  assert.equal(mangaUpdatesRetryAfter("Wed, 01 Jan 2020 00:00:02 GMT", Date.UTC(2020, 0, 1)), 2000);
  assert.equal(mangaUpdatesRetryAfter("nonsense", 0), null);
  assert.equal(mangaUpdatesRetryAfter("-1", 0), null);
  let failedCalls = 0;
  const recover = client(async () => { failedCalls++; if (failedCalls === 1) throw Error(); return json(record()); });
  await assert.rejects(recover.api.getSeries(fixture.series_id), errorCode("network"));
  await recover.api.getSeries(fixture.series_id); assert.equal(failedCalls, 2, "errors never enter the cache or poison the queue");
}

async function main() {
  await identityAndMapping(); await transportCacheAndTiming(); await errorsAndRetry();
  for (const file of fs.readdirSync("src/providers/mangaupdates")) {
    const source = fs.readFileSync(`src/providers/mangaupdates/${file}`, "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*(?:tmdb|storage|credential)|Authorization:|Origin:|User-Agent:|localStorage|initDb|DetailCapability/);
  }
  // Section 8 now consumes the foundation. It must keep HTTP outside the finite catalog.
  assert.doesNotMatch(fs.readFileSync("src/components/search/searchCategories.ts", "utf8"), /fetch\(|from .*mangaupdates\/(?:client|adapter)/);
  assert.match(fs.readFileSync("app/mangaupdates/series/[id].tsx", "utf8"), /loadMangaUpdatesProductDetail/);
  console.log("Section 6: MangaUpdates identity/DTO/mapping/ratings/genres/HTTPS, explicit search/detail, provider errors, cache/spacing/coalescing/bounded retry and production-off boundaries passed. No real network in this suite.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; global.fetch = previousFetch; });

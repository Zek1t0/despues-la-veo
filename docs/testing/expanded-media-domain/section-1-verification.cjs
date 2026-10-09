const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const { DatabaseSync } = require("node:sqlite");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText, filename);

const c = require("../../../src/core/mediaClassification.ts");
const { materializeProviderSavedTitle: materialize } = require("../../../src/core/providerSavedTitle.ts");
const { createTmdbProviderReference: tmdb } = require("../../../src/core/tmdbSavedTitle.ts");
const { findUnambiguousTmdbReference } = require("../../../src/core/savedTitleProviderReferences.ts");
const { historicalTypeForV4, savedTitleFromHistorical, savedTitleToHistorical } = require("../../../src/core/legacyMediaBoundary.ts");
const labels = require("../../../src/core/presentationLabels.ts");
const classify = (medium, contentFamily = null, primaryFormat = null) => ({ medium, contentFamily, primaryFormat });
const ref = { provider: "unit-test", resourceNamespace: "work", externalId: "opaque" };
function input(classification, overrides = {}, reference = ref) {
  return { reference, snapshot: { ...classification, title: "Original", year: null, posterUrl: null,
    overview: null, genres: ["Remote"], ...overrides }, initialTags: ["Initial"] };
}
const create = (classification) => materialize(input(classification), null, () => "local", 100);

function domain() {
  const families = [null, "anime", "manga", "manhwa", "manhua"];
  const formats = [null, "movie", "tv", "ova", "ona", "special", "music", "webtoon", "one-shot", "novel", "light-novel"];
  const allowed = { audiovisual: [null, "movie", "tv", "ova", "ona", "special", "music"],
    comic: [null, "webtoon", "one-shot"], literature: [null, "novel", "light-novel"] };
  for (const medium of Object.keys(allowed)) for (const family of families) for (const format of formats) {
    const expected = allowed[medium].includes(format) && (family === null ||
      medium === "audiovisual" && family === "anime" || medium === "comic" && ["manga", "manhwa", "manhua"].includes(family));
    assert.equal(c.isMediaClassification(classify(medium, family, format)), expected);
  }
  for (const bad of [null, [], {}, classify("unknown"), classify("comic", "western"),
    classify("comic", null, "serial"), classify("comic", null, "doujin"), classify("comic", null, "OEL"),
    classify("audiovisual", null, "TV-short"), { medium: "comic", contentFamily: null }]) {
    assert.equal(c.isMediaClassification(bad), false);
    assert.throws(() => c.assertMediaClassification(bad), /Clasificación/);
  }
  assert.deepEqual(c.classificationFromHistoricalType("movie"), classify("audiovisual", null, "movie"));
  assert.deepEqual(c.classificationFromHistoricalType("tv"), classify("audiovisual", null, "tv"));
  assert.throws(() => c.classificationFromHistoricalType("anime"));
  assert.equal(create(classify("comic", "manga")).primaryFormat, null);
  assert.equal(create(classify("comic", "manhwa")).primaryFormat, null);
  assert.equal(Object.hasOwn(create(classify("comic")), "type"), false);
}

function refresh() {
  const cases = [
    [classify("audiovisual", "anime", "movie"), classify("audiovisual", null, "movie"), classify("audiovisual", "anime", "movie"), tmdb("movie", 1)],
    [classify("comic", "manga"), classify("comic", "manga", "one-shot"), classify("comic", "manga", "one-shot")],
    [classify("comic", "manhwa", "webtoon"), classify("comic", "manhwa"), classify("comic", "manhwa", "webtoon")],
    [classify("comic", "manhwa", "webtoon"), classify("comic", "manga", "one-shot"), classify("comic", "manhwa", "webtoon")],
    [classify("audiovisual", "anime", "ova"), classify("audiovisual", null, "movie"), classify("audiovisual", "anime", "ova"), tmdb("movie", 1)],
    [classify("comic"), classify("comic", "manhua"), classify("comic", "manhua")],
  ];
  for (const [current, incoming, expected, reference = ref] of cases) {
    const existing = { ...create(current), status: "watching", tags: ["Mine"], notes: "Note", personalRating: 87,
      createdAt: 10, updatedAt: 200, providerReferences: [reference, ref] };
    const before = structuredClone(existing);
    const request = input(incoming, { title: "Refreshed", genres: ["New genre"] }, reference);
    Object.freeze(request.snapshot.genres); Object.freeze(request.initialTags);
    const result = materialize(request, existing, () => { throw Error("No ID generation"); }, 100);
    for (const key of Object.keys(expected)) assert.equal(result[key], expected[key]);
    for (const key of ["id", "createdAt", "status", "tags", "notes", "personalRating"]) assert.deepEqual(result[key], existing[key]);
    assert.equal(result.updatedAt, 201); assert.equal(result.title, "Refreshed");
    assert.deepEqual(result.genres, ["New genre"]); assert.notStrictEqual(result.genres, request.snapshot.genres);
    assert.deepEqual(result.tags, ["Mine"]); assert.deepEqual(existing, before);
  }
  const ova = { ...create(classify("audiovisual", "anime", "ova")), providerReferences: [tmdb("movie", 1)] };
  assert.deepEqual(findUnambiguousTmdbReference(ova), tmdb("movie", 1));
  assert.equal(findUnambiguousTmdbReference({ ...ova, primaryFormat: null })?.resourceNamespace, "movie");
  assert.equal(findUnambiguousTmdbReference({ ...ova, providerReferences: [tmdb("movie", 1), tmdb("tv", 1)] }), null);
  assert.notDeepEqual(tmdb("movie", 1), tmdb("tv", 1));
  assert.throws(() => materialize(input(classify("literature")), ova, () => "unused"), /medio/);
  assert.throws(() => materialize(input(classify("comic"), {}, tmdb("movie", 1)), null, () => "unused"), /TMDB/);
}

function ratingsAndLabels() {
  const classification = classify("audiovisual", null, "movie");
  const existing = { ...create(classification), voteAverage: 7.9, personalRating: 87 };
  assert.equal(materialize(input(classification), existing, () => "unused", 101).voteAverage, 7.9);
  assert.equal(create(classification).voteAverage, null);
  for (const value of [0, 8.1, null]) {
    const result = materialize(input(classification, { voteAverage: value }, tmdb("movie", 1)), existing, () => "unused", 101);
    assert.equal(result.voteAverage, value); assert.equal(result.personalRating, 87);
    assert.throws(() => materialize(input(classification, { voteAverage: value }), existing, () => "unused"), /voteAverage/);
  }
  for (const value of [undefined, NaN, Infinity, "8"]) {
    assert.throws(() => materialize(input(classification, { voteAverage: value }, tmdb("movie", 1)), existing, () => "unused"), /voteAverage/);
  }
  const names = [
    [classification, "Película"], [classify("audiovisual", "anime", "movie"), "Anime · Película"],
    [classify("audiovisual", "anime", "ova"), "Anime · OVA"], [classify("comic", "manga"), "Manga"],
    [classify("comic", "manhwa", "webtoon"), "Manhwa · Webtoon"], [classify("comic"), "Cómic"],
    [classify("literature", null, "novel"), "Novela"], [classify("literature", null, "light-novel"), "Novela ligera"],
  ];
  for (const [c, name] of names) assert.equal(labels.mediaClassificationLabel(c), name);
  assert.equal(labels.titleStatusLabel("watching", "audiovisual"), "Viendo");
  assert.equal(labels.titleStatusLabel("watching", "comic"), "Leyendo");
  assert.equal(labels.titleStatusLabel("watching", "literature"), "Leyendo");
  assert.equal(labels.titleStatusLabel("watching"), "En curso");
  for (const [value, label] of [["planned", "Planeado"], ["done", "Terminado"], ["dropped", "Abandonado"]]) assert.equal(labels.titleStatusLabel(value), label);
  assert.equal(labels.mediaYearLabel("comic"), "Inicio / publicación");
}

async function storageBoundary() {
  const sqlite = new DatabaseSync(":memory:");
  let writes = 0;
  const params = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...params(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...params(values)); },
    async runAsync(sql, ...values) { writes++; const r = sqlite.prepare(sql).run(...params(values)); return { changes: Number(r.changes) }; },
    async withTransactionAsync(task) { sqlite.exec("BEGIN"); try { await task(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; } },
  };
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === "./db" && parent?.filename.includes("src" + require("node:path").sep + "storage")) return { initDb: () => { throw Error("Unexpected production DB"); } };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const schema = require("../../../src/storage/databaseSchema.ts");
    await schema.enableAndVerifyForeignKeys(db); await schema.evolveDatabaseSchema(db, 0);
    const repo = require("../../../src/storage/savedTitlesRepo.ts");
    const movie = input(classify("audiovisual", null, "movie"), { voteAverage: 7.9 }, tmdb("movie", 77));
    await db.withTransactionAsync(() => repo.saveProviderTitleWithDb(db, movie, () => "movie-local", 100));
    await db.withTransactionAsync(() => repo.saveProviderTitleWithDb(db, input(classify("audiovisual", null, "tv"), {}, tmdb("tv", 77)), () => "tv-local", 100));
    await repo.attachProviderReferenceWithDb(db, ref, "movie-local");
    const current = await repo.getSavedTitleWithReferencesByIdWithDb(db, "movie-local");
    assert.equal(current.medium, "audiovisual"); assert.equal(current.primaryFormat, "movie"); assert.equal(Object.hasOwn(current, "type"), false);
    await db.withTransactionAsync(() => repo.saveProviderTitleWithDb(db, input(classify("audiovisual", null, "movie"), { title: "Generic refresh" }), () => "unused", 101));
    const refreshed = await repo.getSavedTitleWithReferencesByIdWithDb(db, "movie-local");
    assert.equal(refreshed.voteAverage, 7.9); assert.equal(refreshed.title, "Generic refresh");
    assert.deepEqual(refreshed.providerReferences, current.providerReferences);
    for (const request of [input(classify("comic")), input(classify("audiovisual", "anime", "ova")),
      input(classify("audiovisual", null, "movie"), { voteAverage: null })]) {
      const before = writes;
      await assert.rejects(db.withTransactionAsync(() => repo.saveProviderTitleWithDb(db, request, () => "unsupported", 102)));
      assert.equal(writes, before, "reject before writes at v4 boundary");
    }
    assert.equal(sqlite.prepare("PRAGMA user_version").get().user_version, 4);
    const { createLibraryBackupV5, parseLibraryBackupV5 } = require("../../../src/core/libraryBackupV5.ts");
    const titles = await repo.listSavedTitlesWithDb(db);
    const backup = createLibraryBackupV5(titles, [], { status: "unavailable" });
    assert.equal(backup.version, 5); assert.equal(backup.items[0].type, "movie");
    assert.equal(Object.hasOwn(backup.items[0], "medium"), false);
    assert.equal(parseLibraryBackupV5(JSON.stringify(backup)).payload.invalid.length, 0);
    assert.throws(() => savedTitleToHistorical(create(classify("comic"))), /requiere SQLite v5/);
    assert.throws(() => historicalTypeForV4(classify("audiovisual", "anime", "movie")), /sin pérdida/);
    assert.deepEqual(savedTitleFromHistorical(savedTitleToHistorical(refreshed)), { ...refreshed });
  } finally { Module._load = originalLoad; sqlite.close(); }
}

(async () => {
  domain(); refresh(); ratingsAndLabels(); await storageBoundary();
  console.log("Section 1 classification, refresh, ratings, labels and unchanged v4/v5 boundary passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });

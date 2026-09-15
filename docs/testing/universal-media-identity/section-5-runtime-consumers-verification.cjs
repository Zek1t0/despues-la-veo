const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");

require.extensions[".ts"] = function compile(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename });
  module._compile(output.outputText, filename);
};
const originalLoad = Module._load;
Module._load = function mocked(request, parent, isMain) { if (request === "expo-sqlite") return {}; return originalLoad.call(this, request, parent, isMain); };
const repo = require("../../../src/storage/savedTitlesRepo.ts");
const pins = require("../../../src/storage/titlePinsRepo.ts");
const { mergeLibraryBackupWithDb } = require("../../../src/storage/libraryBackupMerge.ts");
const { parseLibraryBackup } = require("../../../src/core/libraryBackup.ts");
const { createTmdbProviderReference } = require("../../../src/core/tmdbSavedTitle.ts");
const { findUnambiguousTmdbReference } = require("../../../src/core/savedTitleProviderReferences.ts");
const { selectVisibleLibraryTitles } = require("../../../src/core/libraryView.ts");
Module._load = originalLoad;

function fixture() {
  const file = path.join(os.tmpdir(), `dlv-section5-${process.pid}-${Date.now()}.sqlite`);
  const sqlite = new DatabaseSync(file);
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE saved_titles (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, year INTEGER, poster_url TEXT, overview TEXT, vote_average REAL,
      personal_rating INTEGER, genres_json TEXT, status TEXT NOT NULL, tags_json TEXT NOT NULL, notes TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE media_provider_references (provider TEXT NOT NULL, resource_namespace TEXT NOT NULL, external_id TEXT NOT NULL, saved_title_id TEXT NOT NULL,
      PRIMARY KEY(provider,resource_namespace,external_id), FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE);
    CREATE TABLE legacy_saved_title_identities (legacy_format TEXT NOT NULL, legacy_provider TEXT NOT NULL, legacy_external_id TEXT NOT NULL, saved_title_id TEXT NOT NULL,
      PRIMARY KEY(legacy_format,legacy_provider,legacy_external_id), FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE);
    CREATE TABLE title_pins (saved_title_id TEXT NOT NULL, context_type TEXT NOT NULL, context_key TEXT NOT NULL, pinned_at INTEGER NOT NULL,
      PRIMARY KEY(saved_title_id,context_type,context_key), FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE);`);
  const params = (v) => v.length === 1 && Array.isArray(v[0]) ? v[0] : v;
  const db = { async getFirstAsync(sql, ...v) { return sqlite.prepare(sql).get(...params(v)) ?? null; }, async getAllAsync(sql, ...v) { return sqlite.prepare(sql).all(...params(v)); }, async runAsync(sql, ...v) { return sqlite.prepare(sql).run(...params(v)); }, async withTransactionAsync(task) { sqlite.exec("BEGIN"); try { await task(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; } } };
  return { db, sqlite, close() { sqlite.close(); fs.unlinkSync(file); } };
}
const item = (id, type, title, refs, extra = {}) => ({ id, type, title, personalRating: 60, genres: ["Drama"], status: "watching", tags: ["Local"], notes: `${title} note`, createdAt: 100, updatedAt: 200, providerReferences: refs, ...extra });
function parse(value) { const parsed = parseLibraryBackup(JSON.stringify(value)); assert.equal(parsed.ok, true); return parsed.payload; }

async function main() {
  const f = fixture();
  try {
    const payload = parse({ version: 5, items: [
      item("local-a", "movie", "Multi", [{ provider: "tmdb", resourceNamespace: "movie", externalId: "77" }, { provider: "future-catalog", resourceNamespace: "work", externalId: "example" }]),
      item("local-only", "tv", "Offline local", [], { personalRating: 80, status: "done", tags: ["Offline"], notes: "works offline" }),
      item("generic-only", "movie", "Generic only", [{ provider: "catalog-a", resourceNamespace: "work", externalId: "first" }, { provider: "catalog-b", resourceNamespace: "edition", externalId: "second" }]),
      item("movie-same", "movie", "Movie same", [{ provider: "tmdb", resourceNamespace: "movie", externalId: "991" }], { personalRating: 20 }),
      item("tv-same", "tv", "TV same", [{ provider: "tmdb", resourceNamespace: "tv", externalId: "991" }], { personalRating: 90 }),
    ], pins: [{ itemId: "local-a", contextType: "library", contextKey: "", pinnedAt: 300 }, { itemId: "local-only", contextType: "tag", contextKey: "Offline", pinnedAt: 301 }] });
    let merged; await f.db.withTransactionAsync(async () => { merged = await mergeLibraryBackupWithDb(f.db, payload, () => "unused"); });
    assert.equal(merged.inserted, 5); assert.equal(merged.pins.inserted, 2);

    const listed = await repo.listSavedTitlesWithDb(f.db); assert.equal(listed.length, 5);
    const multi = await repo.getSavedTitleByIdWithDb(f.db, "local-a"); assert.equal(multi.providerReferences.length, 2);
    assert.deepEqual(findUnambiguousTmdbReference(multi), { provider: "tmdb", resourceNamespace: "movie", externalId: "77" });
    const localOnly = await repo.getSavedTitleByIdWithDb(f.db, "local-only"); assert.deepEqual(localOnly.providerReferences, []); assert.equal(findUnambiguousTmdbReference(localOnly), null);
    const generic = await repo.getSavedTitleByIdWithDb(f.db, "generic-only"); assert.equal(generic.providerReferences.length, 2); assert.equal(findUnambiguousTmdbReference(generic), null);
    assert.deepEqual(generic.providerReferences.map((r) => r.externalId), ["first", "second"]);

    await f.db.withTransactionAsync(() => repo.setPersonalRatingWithDb(f.db, "local-only", 100, () => 400));
    await f.db.withTransactionAsync(() => repo.updateSavedTitleMetadataWithDb(f.db, "local-only", { tags: ["Offline", "Edited"], notes: "edited", status: "dropped" }, () => 401));
    await f.db.withTransactionAsync(() => pins.pinTitleWithDb(f.db, "local-only", { contextType: "library", contextKey: "" }, 402));
    const edited = await repo.getSavedTitleByIdWithDb(f.db, "local-only"); assert.equal(edited.personalRating, 100); assert.deepEqual(edited.tags, ["Offline", "Edited"]); assert.equal(edited.notes, "edited"); assert.equal(edited.status, "dropped");
    assert.equal(await pins.isTitlePinnedWithDb(f.db, "local-only", { contextType: "library", contextKey: "" }), true);
    const visible = selectVisibleLibraryTitles({ items: listed, pinnedAtById: new Map(), query: "Offline", sort: "personal-rating-desc", statusFilter: "all", typeFilter: "all" }); assert.equal(visible[0].id, "local-only");

    const movie = await repo.getSavedTitleByProviderReferenceWithDb(f.db, createTmdbProviderReference("movie", "991"));
    const tv = await repo.getSavedTitleByProviderReferenceWithDb(f.db, createTmdbProviderReference("tv", "991"));
    assert.equal(movie.id, "movie-same"); assert.equal(tv.id, "tv-same"); assert.notEqual(movie.id, tv.id);
    assert.equal(findUnambiguousTmdbReference(movie).resourceNamespace, "movie"); assert.equal(findUnambiguousTmdbReference(tv).resourceNamespace, "tv");
    await f.db.withTransactionAsync(() => repo.saveTmdbTitleWithDb(f.db, { externalId: "000991", type: "movie", title: "Movie refreshed", year: 2026, posterUrl: null, overview: null, genres: [], voteAverage: 8 }, () => "wrong", 500));
    assert.equal((await repo.getSavedTitleByIdWithDb(f.db, "movie-same")).personalRating, 20); assert.equal((await repo.getSavedTitleByIdWithDb(f.db, "tv-same")).personalRating, 90);

    const detailSource = fs.readFileSync(path.join(__dirname, "../../../app/title/[id].tsx"), "utf8");
    const remoteSource = fs.readFileSync(path.join(__dirname, "../../../app/tmdb/[type]/[id].tsx"), "utf8");
    assert.match(detailSource, /findUnambiguousTmdbReference/); assert.doesNotMatch(detailSource, /item\.provider|item\.externalId/);
    assert.match(remoteSource, /getByProviderReference\([\s\S]*createTmdbProviderReference\(type, externalId\)/);
    assert.match(remoteSource, /saveTmdbTitle\(/);
    console.log("Section 5 runtime consumer integration verification passed.");
  } finally { f.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

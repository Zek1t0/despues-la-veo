const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

function createFixture() {
  const databasePath = path.join(os.tmpdir(), `dlv-v3-runtime-${process.pid}-${Date.now()}.sqlite`);
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE saved_titles (
      id TEXT NOT NULL PRIMARY KEY, provider TEXT NOT NULL, external_id TEXT NOT NULL,
      type TEXT NOT NULL, title TEXT NOT NULL, year INTEGER, poster_url TEXT,
      overview TEXT, vote_average REAL,
      personal_rating INTEGER NULL CHECK (personal_rating IS NULL OR (
        typeof(personal_rating) = 'integer' AND personal_rating >= 10 AND personal_rating <= 100
      )),
      genres_json TEXT, status TEXT NOT NULL, tags_json TEXT NOT NULL, notes TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_saved_titles_provider_external ON saved_titles(provider, external_id);
    CREATE TABLE app_preferences (
      key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE title_pins (
      saved_title_id TEXT NOT NULL, context_type TEXT NOT NULL, context_key TEXT NOT NULL,
      pinned_at INTEGER NOT NULL CHECK (typeof(pinned_at) = 'integer' AND pinned_at >= 0 AND pinned_at <= 9007199254740991),
      PRIMARY KEY(saved_title_id, context_type, context_key),
      FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
      CHECK ((context_type = 'library' AND context_key = '') OR (context_type = 'tag' AND context_key <> ''))
    );
    CREATE INDEX idx_title_pins_context ON title_pins(context_type, context_key, saved_title_id);
    INSERT INTO saved_titles VALUES (
      'opaque-existing', 'tmdb', '00042', 'movie', 'Old movie', 2020, 'old.jpg',
      'old overview', 7.1, 87, NULL, 'watching', '["Keep"]', 'personal note', 1000, 2000
    );
    INSERT INTO saved_titles VALUES (
      'manual-existing', 'manual', 'manual-key', 'movie', 'Manual', NULL, NULL,
      NULL, NULL, NULL, '[]', 'planned', '["Local"]', 'manual note', 3000, 4000
    );
    INSERT INTO title_pins VALUES ('opaque-existing', 'library', '', 5000);
    PRAGMA user_version = 3;`);
  const normalize = (values) => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...normalize(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...normalize(values)); },
    async runAsync(sql, ...values) {
      const result = sqlite.prepare(sql).run(...normalize(values));
      return { changes: Number(result.changes) };
    },
    async withTransactionAsync(task) {
      sqlite.exec("BEGIN;");
      try { await task(); sqlite.exec("COMMIT;"); }
      catch (error) { sqlite.exec("ROLLBACK;"); throw error; }
    },
    async closeAsync() {},
  };
  return { db, sqlite, close() { sqlite.close(); fs.unlinkSync(databasePath); } };
}

function snapshot(externalId, type, title) {
  return {
    externalId, type, title, year: 2026, posterUrl: `${type}.jpg`,
    overview: `${type} overview`, genres: ["Drama"], voteAverage: 8.5,
  };
}

async function main() {
  const fixture = createFixture();
  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "expo-sqlite") {
      return { openDatabaseAsync: async () => fixture.db };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const dbModulePath = require.resolve("../../../src/storage/db.ts");
    const { initDb } = require(dbModulePath);
    const repo = require("../../../src/storage/savedTitlesRepo.ts");
    const integrity = require("../../../src/storage/savedTitleIntegrity.ts");
    const pins = require("../../../src/storage/titlePinsRepo.ts");
    const backup = require("../../../src/storage/libraryBackupExport.ts");
    const { parseLibraryBackup } = require("../../../src/core/libraryBackup.ts");
    const { createTmdbProviderReference } = require("../../../src/core/tmdbSavedTitle.ts");

    const db = await initDb();
    assert.equal(fixture.sqlite.prepare("PRAGMA user_version").get().user_version, 4);
    assert.equal(fixture.sqlite.prepare("SELECT genres_json FROM saved_titles WHERE id='opaque-existing'").get().genres_json, "[]");

    const listed = await repo.listSavedTitlesWithDb(db);
    assert.equal(listed.length, 2);
    assert.deepEqual((await repo.getSavedTitleByIdWithDb(db, "opaque-existing")).providerReferences,
      [{ provider: "tmdb", resourceNamespace: "movie", externalId: "42" }]);
    assert.deepEqual((await repo.getSavedTitleByIdWithDb(db, "manual-existing")).providerReferences, []);

    const movie42 = createTmdbProviderReference("movie", "42");
    assert.equal((await repo.getSavedTitleByProviderReferenceWithDb(db, movie42)).id, "opaque-existing");
    assert.equal(await repo.getSavedTitleByProviderReferenceWithDb(
      db, createTmdbProviderReference("tv", "42")
    ), null);

    let refreshedId;
    await db.withTransactionAsync(async () => {
      refreshedId = await repo.saveTmdbTitleWithDb(
        db, snapshot("00042", "movie", "Refreshed movie"), () => "unused", 2000
      );
    });
    assert.equal(refreshedId, "opaque-existing");
    const refreshed = await repo.getSavedTitleWithReferencesByIdWithDb(db, refreshedId);
    assert.equal(refreshed.createdAt, 1000);
    assert.equal(refreshed.updatedAt, 2001);
    assert.equal(refreshed.personalRating, 87);
    assert.deepEqual(refreshed.tags, ["Keep"]);
    assert.equal(refreshed.notes, "personal note");

    let movie77Id;
    let tv77Id;
    await db.withTransactionAsync(async () => {
      movie77Id = await repo.saveTmdbTitleWithDb(db, snapshot("77", "movie", "Movie 77"), () => "movie-77", 6000);
    });
    await db.withTransactionAsync(async () => {
      tv77Id = await repo.saveTmdbTitleWithDb(db, snapshot("00077", "tv", "TV 77"), () => "tv-77", 7000);
    });
    assert.notEqual(movie77Id, tv77Id);
    assert.equal((await repo.getSavedTitleByProviderReferenceWithDb(db, createTmdbProviderReference("movie", 77))).id, movie77Id);
    assert.equal((await repo.getSavedTitleByProviderReferenceWithDb(db, createTmdbProviderReference("tv", 77))).id, tv77Id);

    await db.withTransactionAsync(() => repo.setPersonalRatingWithDb(db, movie77Id, 10, () => 8000));
    await db.withTransactionAsync(() => repo.setPersonalRatingWithDb(db, tv77Id, 100, () => 8000));
    await db.withTransactionAsync(() => repo.updateSavedTitleMetadataWithDb(
      db, movie77Id, { status: "done", tags: ["Movie tag"], notes: "movie note" }, () => 8100
    ));
    await db.withTransactionAsync(() => repo.updateSavedTitleMetadataWithDb(
      db, tv77Id, { status: "watching", tags: ["TV tag"], notes: "tv note" }, () => 8100
    ));
    await db.withTransactionAsync(() => repo.saveTmdbTitleWithDb(
      db, snapshot("00077", "movie", "Movie 77 refreshed"), () => "unused-movie", 8200
    ));
    await db.withTransactionAsync(() => repo.saveTmdbTitleWithDb(
      db, snapshot("77", "tv", "TV 77 refreshed"), () => "unused-tv", 8200
    ));
    const finalMovie77 = await repo.getSavedTitleWithReferencesByIdWithDb(db, movie77Id);
    const finalTv77 = await repo.getSavedTitleWithReferencesByIdWithDb(db, tv77Id);
    assert.deepEqual(
      { rating: finalMovie77.personalRating, tags: finalMovie77.tags, notes: finalMovie77.notes,
        status: finalMovie77.status, title: finalMovie77.title },
      { rating: 10, tags: ["Movie tag"], notes: "movie note", status: "done",
        title: "Movie 77 refreshed" }
    );
    assert.deepEqual(
      { rating: finalTv77.personalRating, tags: finalTv77.tags, notes: finalTv77.notes,
        status: finalTv77.status, title: finalTv77.title },
      { rating: 100, tags: ["TV tag"], notes: "tv note", status: "watching",
        title: "TV 77 refreshed" }
    );

    const beforePinUpdatedAt = (await repo.getSavedTitleWithReferencesByIdWithDb(db, movie77Id)).updatedAt;
    await db.withTransactionAsync(() => pins.pinTitleWithDb(db, movie77Id, { contextType: "library", contextKey: "" }, 8300));
    assert.equal(await pins.isTitlePinnedWithDb(db, movie77Id, { contextType: "library", contextKey: "" }), true);
    assert.equal((await repo.getSavedTitleWithReferencesByIdWithDb(db, movie77Id)).updatedAt, beforePinUpdatedAt);

    const exportData = await backup.getLibraryBackupExportDataWithDb(db, { status: "unavailable" });
    assert.equal(exportData.items.length, 4);
    assert.ok(exportData.items.some((item) => item.legacyIdentity?.externalId === "manual-key"));
    assert.ok(exportData.items.some((item) => item.providerReferences.some((reference) =>
      reference.provider === "tmdb" && reference.resourceNamespace === "movie" && reference.externalId === "77"
    )));
    assert.ok(exportData.pins.some((pin) => pin.itemId === movie77Id && pin.pinnedAt === 8300));

    const parsedV4 = parseLibraryBackup(JSON.stringify({
      version: 4,
      exportedAt: "2030-01-01T00:00:00.000Z",
      items: [{
        id: "backup-v4-item", provider: "tmdb", externalId: "88", type: "movie",
        title: "Backup v4", personalRating: 92, status: "done", tags: ["Backup"],
        genres: [], createdAt: 9100, updatedAt: 9200,
      }],
      pins: [{ provider: "tmdb", externalId: "88", contextType: "library", contextKey: "", pinnedAt: 9300 }],
    }));
    assert.equal(parsedV4.ok, true);
    const importedV4 = await repo.mergeLibraryBackup(parsedV4.payload, () => "unused-backup-id");
    assert.equal(importedV4.inserted, 1);
    assert.equal(importedV4.pins.inserted, 1);
    assert.equal((await repo.getSavedTitleByProviderReferenceWithDb(
      db, createTmdbProviderReference("movie", 88)
    )).personalRating, 92);

    const manual = await repo.getSavedTitleWithReferencesByIdWithDb(db, "manual-existing");
    const one = await repo.getSavedTitleWithReferencesByIdWithDb(db, movie77Id);
    assert.equal(manual.providerReferences.length, 0);
    assert.equal(one.providerReferences.length, 1);
    await repo.attachProviderReferenceWithDb(db, { provider: "catalog", resourceNamespace: "work", externalId: "alpha" }, movie77Id);
    assert.equal((await repo.listProviderReferencesForSavedTitleWithDb(db, movie77Id)).length, 2);
    fixture.sqlite.prepare("DELETE FROM media_provider_references WHERE provider='catalog'").run();
    assert.equal((await repo.getSavedTitleWithReferencesByIdWithDb(db, movie77Id)).id, movie77Id);

    await assert.rejects(
      () => db.withTransactionAsync(async () => {
        await integrity.upsertSavedTitleAndCleanPinsWithDb(db, {
          ...one, id: "rolled-back-item", title: "Must roll back", providerReferences: undefined,
        });
        await repo.attachProviderReferenceWithDb(db, movie42, "rolled-back-item");
      }),
      /otro MediaItem/
    );
    assert.equal(fixture.sqlite.prepare("SELECT id FROM saved_titles WHERE id='rolled-back-item'").get(), undefined);
    assert.equal((await repo.getSavedTitleByProviderReferenceWithDb(db, movie42)).id, "opaque-existing");

    await db.withTransactionAsync(() => pins.pinTitleWithDb(db, tv77Id, { contextType: "library", contextKey: "" }, 8900));
    await db.withTransactionAsync(() => integrity.deleteSavedTitleAndPinsWithDb(db, tv77Id));
    assert.equal(await repo.getSavedTitleByProviderReferenceWithDb(
      db, createTmdbProviderReference("tv", 77)
    ), null);
    assert.equal(fixture.sqlite.prepare("SELECT * FROM media_provider_references WHERE saved_title_id=?").get(tv77Id), undefined);
    assert.equal(fixture.sqlite.prepare("SELECT * FROM title_pins WHERE saved_title_id=?").get(tv77Id), undefined);
    assert.equal((await repo.getSavedTitleByProviderReferenceWithDb(
      db, createTmdbProviderReference("movie", 77)
    )).id, movie77Id);

    await db.withTransactionAsync(() => pins.pinTitleWithDb(db, "manual-existing", { contextType: "tag", contextKey: "Local" }, 9000));
    await db.withTransactionAsync(() => integrity.deleteSavedTitleAndPinsWithDb(db, "manual-existing"));
    assert.equal(fixture.sqlite.prepare("SELECT id FROM saved_titles WHERE id='manual-existing'").get(), undefined);
    assert.equal(fixture.sqlite.prepare("SELECT * FROM legacy_saved_title_identities WHERE saved_title_id='manual-existing'").get(), undefined);
    assert.equal(fixture.sqlite.prepare("SELECT * FROM title_pins WHERE saved_title_id='manual-existing'").get(), undefined);

    delete require.cache[dbModulePath];
    const reopened = await require(dbModulePath).initDb();
    assert.equal(fixture.sqlite.prepare("PRAGMA user_version").get().user_version, 4);
    assert.equal((await repo.listSavedTitlesWithReferencesWithDb(reopened)).length, 3);
    assert.deepEqual(fixture.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    console.log("Section 3 v3 migration to v4 runtime integration verification passed.");
  } finally {
    Module._load = originalLoad;
    fixture.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

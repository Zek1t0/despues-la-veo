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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const originalModuleLoad = Module._load;
Module._load = function loadForStorage(request, parent, isMain) {
  if (request === "expo-sqlite") return {};
  return originalModuleLoad.call(this, request, parent, isMain);
};
const { rowToSavedTitle } = require("../../../src/storage/libraryBackupMerge.ts");
const {
  setPersonalRatingWithDb,
  saveTmdbTitleWithDb,
} = require("../../../src/storage/savedTitlesRepo.ts");
const {
  upsertSavedTitleAndCleanPinsWithDb,
} = require("../../../src/storage/savedTitleIntegrity.ts");
const {
  materializeTmdbSavedTitle,
} = require("../../../src/core/tmdbSavedTitle.ts");
Module._load = originalModuleLoad;

function createDatabase() {
  const databasePath = path.join(
    os.tmpdir(),
    `despues-la-veo-rating-section-2-${process.pid}-${Date.now()}.sqlite`
  );
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE saved_titles (
      id TEXT NOT NULL PRIMARY KEY,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      poster_url TEXT,
      overview TEXT,
      vote_average REAL,
      personal_rating INTEGER CHECK (
        personal_rating IS NULL OR
        (typeof(personal_rating) = 'integer' AND personal_rating BETWEEN 10 AND 100)
      ),
      genres_json TEXT,
      status TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_saved_titles_provider_external
      ON saved_titles(provider, external_id);
    CREATE TABLE title_pins (
      saved_title_id TEXT NOT NULL,
      context_type TEXT NOT NULL,
      context_key TEXT NOT NULL,
      pinned_at INTEGER NOT NULL,
      PRIMARY KEY(saved_title_id, context_type, context_key),
      FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE
    );
  `);
  const normalizeParams = (params) =>
    params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  const db = {
    async getFirstAsync(sql, ...params) {
      return sqlite.prepare(sql).get(...normalizeParams(params)) ?? null;
    },
    async getAllAsync(sql, ...params) {
      return sqlite.prepare(sql).all(...normalizeParams(params));
    },
    async runAsync(sql, ...params) {
      const result = sqlite.prepare(sql).run(...normalizeParams(params));
      return { changes: Number(result.changes) };
    },
    async withTransactionAsync(task) {
      sqlite.exec("BEGIN;");
      try {
        await task();
        sqlite.exec("COMMIT;");
      } catch (error) {
        sqlite.exec("ROLLBACK;");
        throw error;
      }
    },
  };
  return {
    db,
    sqlite,
    close() {
      sqlite.close();
      fs.unlinkSync(databasePath);
    },
  };
}

function savedTitle(id, personalRating = null) {
  return {
    id,
    provider: "tmdb",
    externalId: id,
    type: "movie",
    title: `Title ${id}`,
    year: 2020,
    posterUrl: "old-poster",
    overview: "old overview",
    voteAverage: 7.1,
    personalRating,
    genres: ["Drama"],
    status: "watching",
    tags: ["Custom", "Drama"],
    notes: "personal notes",
    createdAt: 1000,
    updatedAt: 2000,
  };
}

async function testStorageRoundTripAndSetter() {
  const fixture = createDatabase();
  try {
    for (const value of [null, 10, 87, 100]) {
      const item = savedTitle(`roundtrip-${value}`, value);
      await fixture.db.withTransactionAsync(() =>
        upsertSavedTitleAndCleanPinsWithDb(fixture.db, item)
      );
      const row = fixture.sqlite.prepare("SELECT * FROM saved_titles WHERE id = ?").get(item.id);
      assert.equal(rowToSavedTitle(row).personalRating, value);
    }

    const id = "setter";
    await fixture.db.withTransactionAsync(() =>
      upsertSavedTitleAndCleanPinsWithDb(fixture.db, savedTitle(id, null))
    );
    fixture.sqlite.prepare(`
      INSERT INTO title_pins(saved_title_id, context_type, context_key, pinned_at)
      VALUES (?, 'library', '', 777)
    `).run(id);

    const firstUpdatedAt = await setPersonalRatingWithDb(fixture.db, id, 87, () => 2000);
    assert.equal(firstUpdatedAt, 2001);
    let row = fixture.sqlite.prepare("SELECT * FROM saved_titles WHERE id = ?").get(id);
    let mapped = rowToSavedTitle(row);
    assert.equal(mapped.personalRating, 87);
    assert.equal(mapped.updatedAt, 2001);
    assert.equal(mapped.status, "watching");
    assert.deepEqual(mapped.tags, ["Custom", "Drama"]);
    assert.equal(mapped.notes, "personal notes");
    assert.equal(
      fixture.sqlite.prepare("SELECT pinned_at FROM title_pins WHERE saved_title_id = ?").get(id).pinned_at,
      777
    );

    const secondUpdatedAt = await setPersonalRatingWithDb(fixture.db, id, 88, () => 2000);
    const thirdUpdatedAt = await setPersonalRatingWithDb(fixture.db, id, 89, () => 2000);
    assert.equal(secondUpdatedAt, 2002);
    assert.equal(thirdUpdatedAt, 2003);
    assert.ok(firstUpdatedAt < secondUpdatedAt && secondUpdatedAt < thirdUpdatedAt);

    const clearedUpdatedAt = await setPersonalRatingWithDb(fixture.db, id, null, () => 2000);
    row = fixture.sqlite.prepare("SELECT * FROM saved_titles WHERE id = ?").get(id);
    mapped = rowToSavedTitle(row);
    assert.equal(mapped.personalRating, null);
    assert.equal(mapped.updatedAt, clearedUpdatedAt);

    for (const invalid of [9, 101, 87.5, NaN, Infinity, undefined]) {
      await assert.rejects(
        () => setPersonalRatingWithDb(fixture.db, id, invalid, () => 3000),
        /personalRating/
      );
    }
  } finally {
    fixture.close();
  }
}

async function testDeleteDoesNotResurrect() {
  const fixture = createDatabase();
  try {
    const id = "deleted";
    await fixture.db.withTransactionAsync(() =>
      upsertSavedTitleAndCleanPinsWithDb(fixture.db, savedTitle(id, 87))
    );
    fixture.sqlite.prepare("DELETE FROM saved_titles WHERE id = ?").run(id);

    await assert.rejects(
      () => setPersonalRatingWithDb(fixture.db, id, 87, () => 3000),
      /no existe/
    );
    assert.equal(
      fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM saved_titles WHERE id = ?").get(id).count,
      0
    );
    assert.equal(
      fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM title_pins WHERE saved_title_id = ?").get(id).count,
      0
    );
  } finally {
    fixture.close();
  }
}

async function testAffectedRowsGuard() {
  const statements = [];
  const db = {
    async getFirstAsync() {
      return { updated_at: 2000 };
    },
    async getAllAsync() {
      return [];
    },
    async runAsync(sql) {
      statements.push(sql);
      return { changes: 0 };
    },
    async withTransactionAsync(task) {
      await task();
    },
  };
  await assert.rejects(
    () => setPersonalRatingWithDb(db, "removed-between-read-and-update", 87, () => 3000),
    /dejó de existir/
  );
  assert.equal(statements.length, 1);
  assert.match(statements[0], /^UPDATE saved_titles/);
  assert.doesNotMatch(statements[0], /INSERT|UPSERT|ON CONFLICT/i);
}

async function testCorruptUpdatedAtIsNotCoerced() {
  let updateAttempted = false;
  const db = {
    async getFirstAsync() {
      return { updated_at: "2000" };
    },
    async getAllAsync() {
      return [];
    },
    async runAsync() {
      updateAttempted = true;
      return { changes: 1 };
    },
  };
  await assert.rejects(
    () => setPersonalRatingWithDb(db, "corrupt-timestamp", 87, () => 3000),
    /updatedAt actual/
  );
  assert.equal(updateAttempted, false);
}

async function testWithDbCompositionInsideExternalTransaction() {
  const fixture = createDatabase();
  try {
    const existing = savedTitle("externally-transactional", 87);
    await fixture.db.withTransactionAsync(() =>
      upsertSavedTitleAndCleanPinsWithDb(fixture.db, existing)
    );

    let updatedAt;
    await fixture.db.withTransactionAsync(async () => {
      updatedAt = await setPersonalRatingWithDb(
        fixture.db,
        existing.id,
        88,
        () => 2000
      );
    });
    assert.equal(updatedAt, 2001);

    let refreshedId;
    await fixture.db.withTransactionAsync(async () => {
      refreshedId = await saveTmdbTitleWithDb(
        fixture.db,
        {
          externalId: existing.externalId,
          type: "movie",
          title: "Externally transactional refresh",
          year: 2026,
          posterUrl: "new-poster",
          overview: "new overview",
          genres: ["Drama"],
          voteAverage: 8.8,
        },
        () => "must-not-be-used",
        2001
      );
    });
    assert.equal(refreshedId, existing.id);
    const refreshed = rowToSavedTitle(
      fixture.sqlite.prepare("SELECT * FROM saved_titles WHERE id = ?").get(existing.id)
    );
    assert.equal(refreshed.personalRating, 88);
    assert.equal(refreshed.title, "Externally transactional refresh");
    assert.equal(refreshed.updatedAt, 2002);
  } finally {
    fixture.close();
  }
}

async function testTmdbRepositoryResave() {
  const fixture = createDatabase();
  try {
    const existing = savedTitle("repository-refresh", 87);
    await fixture.db.withTransactionAsync(() =>
      upsertSavedTitleAndCleanPinsWithDb(fixture.db, existing)
    );
    let resultId;
    await fixture.db.withTransactionAsync(async () => {
      resultId = await saveTmdbTitleWithDb(
        fixture.db,
        {
          externalId: existing.externalId,
          type: "tv",
          title: "Repository refresh",
          year: 2026,
          posterUrl: "new-poster",
          overview: "new overview",
          genres: ["Science Fiction"],
          voteAverage: 9.2,
        },
        () => "must-not-be-used",
        2000
      );
    });
    assert.equal(resultId, existing.id);
    const refreshed = rowToSavedTitle(
      fixture.sqlite.prepare("SELECT * FROM saved_titles WHERE id = ?").get(existing.id)
    );
    assert.equal(refreshed.createdAt, existing.createdAt);
    assert.equal(refreshed.status, existing.status);
    assert.deepEqual(refreshed.tags, existing.tags);
    assert.equal(refreshed.notes, existing.notes);
    assert.equal(refreshed.personalRating, 87);
    assert.equal(refreshed.type, "tv");
    assert.equal(refreshed.title, "Repository refresh");
    assert.equal(refreshed.voteAverage, 9.2);
    assert.equal(refreshed.updatedAt, 2001);
  } finally {
    fixture.close();
  }
}

function testTmdbResavePolicy() {
  const existing = savedTitle("existing", 87);
  const refreshed = materializeTmdbSavedTitle(
    {
      externalId: existing.externalId,
      type: "tv",
      title: "New TMDB title",
      year: 2026,
      posterUrl: "new-poster",
      overview: "new overview",
      genres: ["Science Fiction"],
      voteAverage: null,
    },
    existing,
    () => "must-not-be-used",
    2000
  );
  assert.deepEqual(
    {
      id: refreshed.id,
      createdAt: refreshed.createdAt,
      status: refreshed.status,
      tags: refreshed.tags,
      notes: refreshed.notes,
      personalRating: refreshed.personalRating,
    },
    {
      id: existing.id,
      createdAt: existing.createdAt,
      status: existing.status,
      tags: existing.tags,
      notes: existing.notes,
      personalRating: 87,
    }
  );
  assert.equal(refreshed.updatedAt, 2001);
  assert.equal(refreshed.type, "tv");
  assert.equal(refreshed.title, "New TMDB title");
  assert.equal(refreshed.year, 2026);
  assert.equal(refreshed.posterUrl, "new-poster");
  assert.equal(refreshed.overview, "new overview");
  assert.deepEqual(refreshed.genres, ["Science Fiction"]);
  assert.equal(refreshed.voteAverage, null);

  assert.equal(
    materializeTmdbSavedTitle(
      { ...refreshed, externalId: "null-rating", personalRating: undefined },
      savedTitle("null-rating", null),
      () => "unused",
      3000
    ).personalRating,
    null
  );

  const created = materializeTmdbSavedTitle(
    {
      externalId: "new",
      type: "movie",
      title: "New",
      year: null,
      posterUrl: null,
      overview: null,
      genres: ["Drama"],
      voteAverage: 8.2,
    },
    null,
    () => "generated-id",
    4000
  );
  assert.equal(created.id, "generated-id");
  assert.equal(created.status, "planned");
  assert.deepEqual(created.tags, ["Drama"]);
  assert.equal(created.notes, null);
  assert.equal(created.personalRating, null);
  assert.equal(created.createdAt, 4000);
  assert.equal(created.updatedAt, 4000);
}

async function main() {
  await testStorageRoundTripAndSetter();
  await testDeleteDoesNotResurrect();
  await testAffectedRowsGuard();
  await testCorruptUpdatedAtIsNotCoerced();
  await testWithDbCompositionInsideExternalTransaction();
  await testTmdbRepositoryResave();
  testTmdbResavePolicy();
  console.log("Section 2 personal rating repository and TMDB re-save verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

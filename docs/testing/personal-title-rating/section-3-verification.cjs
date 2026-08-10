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
const { parseLibraryBackup } = require("../../../src/core/libraryBackup.ts");
const {
  createLibraryBackupV3,
  parseLibraryBackupV3Value,
} = require("../../../src/core/libraryBackupV3.ts");
const {
  mergeLibraryBackupWithDb,
  rowToSavedTitle,
} = require("../../../src/storage/libraryBackupMerge.ts");
const {
  upsertSavedTitleAndCleanPinsWithDb,
} = require("../../../src/storage/savedTitleIntegrity.ts");
Module._load = originalModuleLoad;

function createDatabase(label) {
  const databasePath = path.join(
    os.tmpdir(),
    `despues-la-veo-rating-section-3-${label}-${process.pid}-${Date.now()}-${Math.random()}.sqlite`
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

function savedTitle(overrides = {}) {
  return {
    id: "local-id",
    provider: "tmdb",
    externalId: "logical-title",
    type: "movie",
    title: "Local title",
    year: 2020,
    posterUrl: null,
    overview: "local overview",
    voteAverage: 7.1,
    personalRating: null,
    genres: ["Drama"],
    status: "watching",
    tags: ["Local"],
    notes: "local notes",
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function backupItem(overrides = {}) {
  return {
    id: "portable-source-id",
    provider: "tmdb",
    externalId: "logical-title",
    type: "movie",
    title: "Incoming title",
    year: 2026,
    posterUrl: "incoming-poster",
    overview: "incoming overview",
    voteAverage: 8.8,
    personalRating: 87,
    genres: ["Science Fiction"],
    status: "done",
    tags: ["Imported"],
    notes: "incoming notes",
    createdAt: 50,
    updatedAt: 200,
    ...overrides,
  };
}

function pin(overrides = {}) {
  return {
    provider: "tmdb",
    externalId: "logical-title",
    contextType: "library",
    contextKey: "",
    pinnedAt: 555,
    ...overrides,
  };
}

function parsePayload(value) {
  const result = parseLibraryBackup(JSON.stringify(value));
  assert.equal(result.ok, true, result.ok ? "" : result.error.message);
  return result.payload;
}

async function seed(fixture, item) {
  await fixture.db.withTransactionAsync(() =>
    upsertSavedTitleAndCleanPinsWithDb(fixture.db, item)
  );
}

function readTitle(fixture, externalId = "logical-title") {
  const row = fixture.sqlite.prepare(
    "SELECT * FROM saved_titles WHERE provider = 'tmdb' AND external_id = ?"
  ).get(externalId);
  return row ? rowToSavedTitle(row) : null;
}

async function importValue(fixture, value, generateId = () => "generated-local-id") {
  const payload = parsePayload(value);
  return mergeLibraryBackupWithDb(
    fixture.db,
    payload.items,
    payload.version === 1 ? null : payload.pins,
    generateId
  );
}

function testExportV3() {
  const items = [
    savedTitle({ id: "null", externalId: "null", personalRating: null }),
    savedTitle({ id: "rated", externalId: "rated", personalRating: 87 }),
  ];
  const pins = [pin({ externalId: "rated", pinnedAt: 321 })];
  const payload = createLibraryBackupV3(items, pins, "2030-01-01T00:00:00.000Z");
  const json = JSON.stringify(payload);
  const serialized = JSON.parse(json);
  assert.equal(serialized.version, 3);
  assert.equal(serialized.items[0].personalRating, null);
  assert.equal(serialized.items[1].personalRating, 87);
  assert.equal(Object.hasOwn(serialized.items[0], "personalRating"), true);
  assert.equal(Object.hasOwn(serialized.items[1], "personalRating"), true);
  assert.equal(json.includes('"personalRating":8.7'), false);
  assert.deepEqual(serialized.pins, pins);
  assert.equal(Object.hasOwn(serialized, "preferences"), false);
}

function testParserAndDispatch() {
  const validValues = [null, 10, 87, 100];
  const valid = parseLibraryBackupV3Value({
    version: 3,
    items: validValues.map((personalRating, index) =>
      backupItem({ externalId: `valid-${index}`, personalRating })
    ),
    pins: [],
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.payload.invalid.length, 0);
  assert.deepEqual(
    valid.payload.items.map((item) => item.personalRating),
    validValues.map((value) => ({ present: true, value }))
  );

  const invalidValues = [9, 101, 87.5, "87", [], {}, NaN, Infinity];
  const invalidItems = [
    (() => {
      const item = backupItem({ externalId: "missing" });
      delete item.personalRating;
      return item;
    })(),
    ...invalidValues.map((personalRating, index) =>
      backupItem({ externalId: `invalid-${index}`, personalRating })
    ),
  ];
  const invalid = parseLibraryBackupV3Value({ version: 3, items: invalidItems, pins: [] });
  assert.equal(invalid.ok, true);
  assert.equal(invalid.payload.items.length, 0);
  assert.equal(invalid.payload.invalid.length, invalidItems.length);
  assert.equal(
    invalid.payload.invalid.every((error) => error.field === "personalRating"),
    true
  );

  assert.equal(parseLibraryBackupV3Value({ version: 3, items: {}, pins: [] }).ok, false);
  assert.equal(parseLibraryBackupV3Value({ version: 3, items: [], pins: {} }).ok, false);
  assert.equal(parseLibraryBackup(JSON.stringify({ version: 4, items: [], pins: [] })).ok, false);

  for (const version of [1, 2, 3]) {
    const item = backupItem({ externalId: `dispatch-${version}` });
    if (version !== 3) delete item.personalRating;
    const result = parseLibraryBackup(JSON.stringify({
      version,
      items: [item],
      ...(version === 1 ? {} : { pins: [] }),
    }));
    assert.equal(result.ok, true);
    assert.equal(result.payload.version, version);
    assert.deepEqual(
      result.payload.items[0].personalRating,
      version === 3 ? { present: true, value: 87 } : { present: false }
    );
  }
}

async function testLegacyInsertAndNewerMerge() {
  for (const version of [1, 2]) {
    const insertedFixture = createDatabase(`legacy-insert-${version}`);
    try {
      const item = backupItem({ externalId: `legacy-insert-${version}` });
      delete item.personalRating;
      await importValue(insertedFixture, {
        version,
        items: [item],
        ...(version === 1 ? {} : { pins: [] }),
      });
      assert.equal(readTitle(insertedFixture, item.externalId).personalRating, null);
    } finally {
      insertedFixture.close();
    }

    const updateFixture = createDatabase(`legacy-update-${version}`);
    try {
      await seed(updateFixture, savedTitle({ personalRating: 87, updatedAt: 100 }));
      const item = backupItem({ title: `Legacy v${version} newer`, updatedAt: 200 });
      delete item.personalRating;
      const result = await importValue(updateFixture, {
        version,
        items: [item],
        ...(version === 1 ? {} : { pins: [] }),
      });
      const final = readTitle(updateFixture);
      assert.equal(result.updated, 1);
      assert.equal(final.title, `Legacy v${version} newer`);
      assert.equal(final.updatedAt, 200);
      assert.equal(final.personalRating, 87);
    } finally {
      updateFixture.close();
    }
  }
}

async function testV3Inserts() {
  for (const personalRating of [null, 87]) {
    const fixture = createDatabase(`v3-insert-${String(personalRating)}`);
    try {
      const externalId = `v3-insert-${String(personalRating)}`;
      const result = await importValue(fixture, {
        version: 3,
        items: [backupItem({ externalId, personalRating })],
        pins: [],
      });
      assert.equal(result.inserted, 1);
      assert.equal(readTitle(fixture, externalId).personalRating, personalRating);
    } finally {
      fixture.close();
    }
  }
}

async function testLegacyTagPinIntegrity() {
  const fixture = createDatabase("legacy-tag-pin-integrity");
  try {
    await seed(fixture, savedTitle({
      personalRating: 87,
      tags: ["Removed by legacy"],
      updatedAt: 100,
    }));
    fixture.sqlite.prepare(`
      INSERT INTO title_pins(saved_title_id, context_type, context_key, pinned_at)
      VALUES ('local-id', 'tag', 'Removed by legacy', 444)
    `).run();
    const incoming = backupItem({ tags: [], updatedAt: 200 });
    delete incoming.personalRating;
    const result = await importValue(fixture, {
      version: 2,
      items: [incoming],
      pins: [],
    });
    assert.equal(result.updated, 1);
    assert.equal(readTitle(fixture).personalRating, 87);
    assert.deepEqual(readTitle(fixture).tags, []);
    assert.equal(
      fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM title_pins").get().count,
      0
    );
  } finally {
    fixture.close();
  }
}

async function assertV3Merge({ localRating, localUpdatedAt, incomingRating, incomingUpdatedAt, expected }) {
  const fixture = createDatabase(`merge-${String(localRating)}-${incomingUpdatedAt}-${String(incomingRating)}`);
  try {
    await seed(fixture, savedTitle({ personalRating: localRating, updatedAt: localUpdatedAt }));
    const result = await importValue(fixture, {
      version: 3,
      items: [backupItem({ personalRating: incomingRating, updatedAt: incomingUpdatedAt })],
      pins: [],
    });
    assert.equal(readTitle(fixture).personalRating, expected);
    return result;
  } finally {
    fixture.close();
  }
}

async function testV3MergeMatrixAndIdempotence() {
  assert.equal((await assertV3Merge({ localRating: null, localUpdatedAt: 100, incomingRating: 87, incomingUpdatedAt: 200, expected: 87 })).updated, 1);
  assert.equal((await assertV3Merge({ localRating: 87, localUpdatedAt: 100, incomingRating: 92, incomingUpdatedAt: 200, expected: 92 })).updated, 1);
  assert.equal((await assertV3Merge({ localRating: 87, localUpdatedAt: 100, incomingRating: null, incomingUpdatedAt: 200, expected: null })).updated, 1);
  assert.equal((await assertV3Merge({ localRating: 87, localUpdatedAt: 300, incomingRating: 92, incomingUpdatedAt: 200, expected: 87 })).skipped, 1);
  assert.equal((await assertV3Merge({ localRating: 87, localUpdatedAt: 200, incomingRating: 92, incomingUpdatedAt: 200, expected: 87 })).skipped, 1);
  assert.equal((await assertV3Merge({ localRating: null, localUpdatedAt: 100, incomingRating: null, incomingUpdatedAt: 200, expected: null })).updated, 1);

  const fixture = createDatabase("idempotence-null");
  try {
    await seed(fixture, savedTitle({ personalRating: 87, updatedAt: 100 }));
    const backup = { version: 3, items: [backupItem({ personalRating: null, updatedAt: 200 })], pins: [] };
    assert.equal((await importValue(fixture, backup)).updated, 1);
    const second = await importValue(fixture, backup);
    assert.equal(second.skipped, 1);
    assert.equal(readTitle(fixture).personalRating, null);
    assert.equal(readTitle(fixture).updatedAt, 200);
  } finally {
    fixture.close();
  }
}

async function testPinsRatingsAndPortableIdentity() {
  const fixture = createDatabase("pins-identity");
  try {
    await seed(fixture, savedTitle({ id: "different-local-id", personalRating: 87, updatedAt: 100 }));
    const backup = {
      version: 3,
      items: [backupItem({ id: "foreign-portable-id", personalRating: 92, updatedAt: 200 })],
      pins: [pin({ pinnedAt: 555 })],
    };
    const first = await importValue(fixture, backup);
    const final = readTitle(fixture);
    assert.equal(first.updated, 1);
    assert.equal(first.pins.inserted, 1);
    assert.equal(final.id, "different-local-id");
    assert.equal(final.personalRating, 92);
    const storedPin = fixture.sqlite.prepare(
      "SELECT saved_title_id, pinned_at FROM title_pins WHERE context_type = 'library'"
    ).get();
    assert.equal(storedPin.saved_title_id, "different-local-id");
    assert.equal(storedPin.pinned_at, 555);

    const second = await importValue(fixture, backup);
    assert.equal(second.skipped, 1);
    assert.equal(second.pins.preserved, 1);
    assert.equal(
      fixture.sqlite.prepare("SELECT pinned_at FROM title_pins").get().pinned_at,
      555
    );
    assert.equal(readTitle(fixture).personalRating, 92);
  } finally {
    fixture.close();
  }
}

function testHistoricalV1Fixtures() {
  const fixturesDir = path.join(__dirname, "../library-backup-integrity/fixtures");
  const files = fs.readdirSync(fixturesDir).filter((name) => name.endsWith(".json"));
  assert.ok(files.length > 0);
  for (const name of files) {
    const text = fs.readFileSync(path.join(fixturesDir, name), "utf8");
    assert.doesNotThrow(() => parseLibraryBackup(text), name);
    const parsed = parseLibraryBackup(text);
    if (parsed.ok) {
      assert.equal(parsed.payload.version, 1);
      for (const item of parsed.payload.items) {
        assert.deepEqual(item.personalRating, { present: false });
      }
    }
  }
}

async function main() {
  testExportV3();
  testParserAndDispatch();
  await testLegacyInsertAndNewerMerge();
  await testV3Inserts();
  await testLegacyTagPinIntegrity();
  await testV3MergeMatrixAndIdempotence();
  await testPinsRatingsAndPortableIdentity();
  testHistoricalV1Fixtures();
  console.log("Section 3 personal rating backup v3 verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

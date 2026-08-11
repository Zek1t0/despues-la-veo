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

const {
  assertPersonalRating,
  formatPersonalRating,
  isPersonalRating,
  parsePersonalRating,
} = require("../../../src/core/personalRating.ts");
const {
  DATABASE_SCHEMA_VERSION,
  enableAndVerifyForeignKeys,
  ensureLibrarySchema,
  evolveDatabaseSchema,
  readUserVersion,
  verifyAppPreferencesTable,
  verifySavedTitlesV3Schema,
  verifyTitlePinsSchema,
} = require("../../../src/storage/databaseSchema.ts");

const originalModuleLoad = Module._load;
Module._load = function loadForStorageMapper(request, parent, isMain) {
  if (request === "expo-sqlite") return {};
  return originalModuleLoad.call(this, request, parent, isMain);
};
const { rowToSavedTitle } = require("../../../src/storage/libraryBackupMerge.ts");
Module._load = originalModuleLoad;

function testDomain() {
  for (const value of [null, 10, 11, 87, 99, 100]) {
    assert.equal(isPersonalRating(value), true);
    assert.doesNotThrow(() => assertPersonalRating(value));
    assert.equal(parsePersonalRating(value), value);
  }
  for (const value of [0, 9, 101, 10.5, 87.1, NaN, Infinity, -Infinity, "87"] ) {
    assert.equal(isPersonalRating(value), false);
    assert.throws(() => parsePersonalRating(value), /personalRating/);
  }
  assert.equal(formatPersonalRating(10), "1.0");
  assert.equal(formatPersonalRating(87), "8.7");
  assert.equal(formatPersonalRating(100), "10.0");
  assert.throws(() => formatPersonalRating(87.1), /personalRating/);
  assert.throws(
    () => rowToSavedTitle({
      id: "missing-rating",
      provider: "manual",
      external_id: "missing-rating",
      type: "movie",
      title: "Missing rating column",
      status: "planned",
      tags_json: "[]",
      created_at: 1,
      updated_at: 1,
    }),
    /personalRating/
  );
}

function createDatabase(label) {
  const databasePath = path.join(
    os.tmpdir(),
    `despues-la-veo-rating-${label}-${process.pid}-${Date.now()}-${Math.random()}.sqlite`
  );
  assert.equal(fs.existsSync(databasePath), false);
  const sqlite = new DatabaseSync(databasePath);
  const normalizeParams = (params) =>
    params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  const db = {
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async getFirstAsync(sql, ...params) {
      return sqlite.prepare(sql).get(...normalizeParams(params)) ?? null;
    },
    async getAllAsync(sql, ...params) {
      return sqlite.prepare(sql).all(...normalizeParams(params));
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
      assert.equal(fs.existsSync(databasePath), false);
    },
  };
}

async function evolve(db, currentVersion) {
  await enableAndVerifyForeignKeys(db);
  await ensureLibrarySchema(db);
  await evolveDatabaseSchema(db, currentVersion);
}

function assertRatingConstraint(sqlite) {
  const insert = sqlite.prepare(`
    INSERT INTO saved_titles (
      id, provider, external_id, type, title, personal_rating,
      status, tags_json, created_at, updated_at
    ) VALUES (?, 'manual', ?, 'movie', ?, ?, 'planned', '[]', 1, 1)
  `);
  insert.run("null", "null", "Null", null);
  insert.run("min", "min", "Min", 10);
  insert.run("max", "max", "Max", 100);
  assert.throws(() => insert.run("low", "low", "Low", 9), /constraint/i);
  assert.throws(() => insert.run("high", "high", "High", 101), /constraint/i);
  assert.throws(() => insert.run("real", "real", "Real", 87.5), /constraint/i);
  assert.equal(
    fixtureStoredTypes(sqlite).every((row) => row.personal_rating === null || row.storage_type === "integer"),
    true
  );
}

function fixtureStoredTypes(sqlite) {
  return sqlite.prepare(
    "SELECT personal_rating, typeof(personal_rating) AS storage_type FROM saved_titles"
  ).all();
}

async function testFreshV3() {
  const fixture = createDatabase("fresh");
  try {
    await evolve(fixture.db, 0);
    assert.equal(await readUserVersion(fixture.db), DATABASE_SCHEMA_VERSION);
    assert.equal(DATABASE_SCHEMA_VERSION, 3);
    await verifySavedTitlesV3Schema(fixture.db);
    await verifyAppPreferencesTable(fixture.db);
    await verifyTitlePinsSchema(fixture.db);
    assertRatingConstraint(fixture.sqlite);
  } finally {
    fixture.close();
  }
}

function createLegacySavedTitles(sqlite) {
  sqlite.exec(`
    CREATE TABLE saved_titles (
      id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      poster_url TEXT,
      overview TEXT,
      vote_average REAL,
      genres_json TEXT,
      status TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(id)
    );
    CREATE UNIQUE INDEX idx_saved_titles_provider_external
      ON saved_titles(provider, external_id);
  `);
}

function seedRealisticV2(sqlite) {
  createLegacySavedTitles(sqlite);
  sqlite.exec(`
    CREATE TABLE app_preferences (
      key TEXT NOT NULL PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE title_pins (
      saved_title_id TEXT NOT NULL,
      context_type TEXT NOT NULL,
      context_key TEXT NOT NULL,
      pinned_at INTEGER NOT NULL CHECK (
        typeof(pinned_at) = 'integer' AND pinned_at >= 0 AND
        pinned_at <= 9007199254740991
      ),
      PRIMARY KEY (saved_title_id, context_type, context_key),
      FOREIGN KEY (saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
      CHECK (
        (context_type = 'library' AND context_key = '') OR
        (context_type = 'tag' AND context_key <> '')
      )
    );
    CREATE INDEX idx_title_pins_context
      ON title_pins(context_type, context_key, saved_title_id);
    INSERT INTO saved_titles (
      id, provider, external_id, type, title, genres_json, status,
      tags_json, notes, created_at, updated_at
    ) VALUES (
      'legacy-title', 'manual', 'legacy-external', 'movie', 'Legacy', '[]',
      'watching', '["Favoritas"]', 'nota', 1000, 2000
    );
    INSERT INTO app_preferences (key, value, updated_at)
      VALUES ('library.viewMode', 'grid', 3000);
    INSERT INTO title_pins (saved_title_id, context_type, context_key, pinned_at)
      VALUES ('legacy-title', 'library', '', 4000);
    PRAGMA user_version = 2;
  `);
}

function assertV2DataIntact(sqlite) {
  const title = sqlite.prepare(
    "SELECT title, status, tags_json, notes, created_at, updated_at FROM saved_titles WHERE id = 'legacy-title'"
  ).get();
  assert.equal(title.title, "Legacy");
  assert.equal(title.status, "watching");
  assert.equal(title.tags_json, '["Favoritas"]');
  assert.equal(title.notes, "nota");
  assert.equal(title.created_at, 1000);
  assert.equal(title.updated_at, 2000);
  assert.equal(
    sqlite.prepare("SELECT value FROM app_preferences WHERE key = 'library.viewMode'").get().value,
    "grid"
  );
  assert.equal(
    sqlite.prepare("SELECT pinned_at FROM title_pins WHERE saved_title_id = 'legacy-title'").get().pinned_at,
    4000
  );
}

async function testMigrationV2() {
  const fixture = createDatabase("v2");
  try {
    seedRealisticV2(fixture.sqlite);

    await evolve(fixture.db, 2);
    assert.equal(await readUserVersion(fixture.db), 3);
    await verifySavedTitlesV3Schema(fixture.db);
    await verifyAppPreferencesTable(fixture.db);
    await verifyTitlePinsSchema(fixture.db);

    const row = fixture.sqlite.prepare(
      "SELECT * FROM saved_titles WHERE id = 'legacy-title'"
    ).get();
    assert.equal(row.title, "Legacy");
    assert.equal(row.status, "watching");
    assert.equal(row.tags_json, '["Favoritas"]');
    assert.equal(row.notes, "nota");
    assert.equal(row.personal_rating, null);
    assert.equal(
      fixture.sqlite.prepare("SELECT value FROM app_preferences WHERE key = 'library.viewMode'").get().value,
      "grid"
    );
    assert.equal(
      fixture.sqlite.prepare("SELECT pinned_at FROM title_pins WHERE saved_title_id = 'legacy-title'").get().pinned_at,
      4000
    );
    const identityIndex = fixture.sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_saved_titles_provider_external'"
    ).get();
    assert.equal(identityIndex.name, "idx_saved_titles_provider_external");

    await evolveDatabaseSchema(fixture.db, 3);
    assert.equal(await readUserVersion(fixture.db), 3);
    assert.equal(
      fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM saved_titles").get().count,
      1
    );
  } finally {
    fixture.close();
  }
}

async function testMigrationV3Rollback() {
  const fixture = createDatabase("v3-rollback");
  const controlledError = new Error("controlled failure before v3 publication");
  try {
    seedRealisticV2(fixture.sqlite);
    await enableAndVerifyForeignKeys(fixture.db);
    await ensureLibrarySchema(fixture.db);

    await assert.rejects(
      () => evolveDatabaseSchema(fixture.db, 2, {
        beforeVersion3Published() {
          throw controlledError;
        },
      }),
      (error) => error === controlledError
    );

    assert.equal(await readUserVersion(fixture.db), 2);
    const columnsAfterRollback = fixture.sqlite.prepare(
      "PRAGMA table_info(saved_titles)"
    ).all();
    assert.equal(
      columnsAfterRollback.some((column) => column.name === "personal_rating"),
      false
    );
    assertV2DataIntact(fixture.sqlite);
    assert.deepEqual(fixture.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    assert.throws(
      () => fixture.sqlite.prepare(`
        INSERT INTO title_pins (saved_title_id, context_type, context_key, pinned_at)
        VALUES ('missing-title', 'library', '', 5000)
      `).run(),
      /foreign key/i
    );

    await evolveDatabaseSchema(fixture.db, 2);
    assert.equal(await readUserVersion(fixture.db), 3);
    const columnsAfterRetry = fixture.sqlite.prepare(
      "PRAGMA table_info(saved_titles)"
    ).all();
    assert.equal(
      columnsAfterRetry.some((column) => column.name === "personal_rating"),
      true
    );
    assert.equal(
      fixture.sqlite.prepare(
        "SELECT personal_rating FROM saved_titles WHERE id = 'legacy-title'"
      ).get().personal_rating,
      null
    );
    assertV2DataIntact(fixture.sqlite);
    assert.deepEqual(fixture.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    fixture.close();
  }
}

async function testEarlierVersionsAndFutureRejection() {
  for (const version of [0, 1]) {
    const fixture = createDatabase(`v${version}`);
    try {
      if (version === 1) {
        createLegacySavedTitles(fixture.sqlite);
        fixture.sqlite.exec("PRAGMA user_version = 1;");
      }
      await evolve(fixture.db, version);
      assert.equal(await readUserVersion(fixture.db), 3);
      await verifySavedTitlesV3Schema(fixture.db);
      await verifyTitlePinsSchema(fixture.db);
    } finally {
      fixture.close();
    }
  }

  const future = createDatabase("future");
  try {
    future.sqlite.exec("PRAGMA user_version = 4;");
    await assert.rejects(() => evolveDatabaseSchema(future.db, 4), /no soportada/i);
    assert.equal(await readUserVersion(future.db), 4);
  } finally {
    future.close();
  }
}

async function main() {
  testDomain();
  await testFreshV3();
  await testMigrationV2();
  await testMigrationV3Rollback();
  await testEarlierVersionsAndFutureRejection();
  console.log("Section 1 personal rating domain and SQLite v3 verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

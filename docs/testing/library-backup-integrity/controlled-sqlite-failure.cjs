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
const { parseLibraryBackupV1 } = require("../../../src/core/libraryBackupV1.ts");
const {
  mergeLibraryBackupItemsWithDb,
} = require("../../../src/storage/libraryBackupMerge.ts");
Module._load = originalModuleLoad;

const databasePath = path.join(
  os.tmpdir(),
  `despues-la-veo-controlled-import-${process.pid}-${Date.now()}.sqlite`
);

assert.notEqual(path.basename(databasePath), "despues-la-veo.db");
assert.equal(fs.existsSync(databasePath), false);

let sqlite;

async function main() {
  sqlite = new DatabaseSync(databasePath);
  sqlite.exec(`
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
        personal_rating IS NULL OR (
          typeof(personal_rating) = 'integer' AND
          personal_rating >= 10 AND
          personal_rating <= 100
        )
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
      PRIMARY KEY(saved_title_id, context_type, context_key)
    );

    CREATE TRIGGER controlled_import_failure
    BEFORE INSERT ON saved_titles
    WHEN NEW.external_id = 'controlled-failure'
    BEGIN
      SELECT RAISE(ABORT, 'controlled import failure');
    END;
  `);

  const db = {
    async getFirstAsync(sql, params = []) {
      return sqlite.prepare(sql).get(...params);
    },
    async runAsync(sql, ...params) {
      return sqlite.prepare(sql).run(...params);
    },
  };

  const parsed = parseLibraryBackupV1(JSON.stringify({
    version: 1,
    exportedAt: "2030-01-01T00:00:00.000Z",
    items: [
      {
        id: "controlled-success-before-id",
        provider: "manual",
        externalId: "controlled-success-before",
        type: "movie",
        title: "Controlled Success Before",
        createdAt: 1893456100000,
        updatedAt: 1893456100000,
      },
      {
        id: "controlled-failure-id",
        provider: "manual",
        externalId: "controlled-failure",
        type: "movie",
        title: "Controlled SQLite Failure",
        createdAt: 1893456101000,
        updatedAt: 1893456101000,
      },
      {
        id: "controlled-success-after-id",
        provider: "manual",
        externalId: "controlled-success-after",
        type: "tv",
        title: "Controlled Success After",
        createdAt: 1893456102000,
        updatedAt: 1893456102000,
      },
    ],
  }));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.payload.invalid.length, 0);

  const result = await mergeLibraryBackupItemsWithDb(
    db,
    parsed.payload.items,
    () => "unused-generated-id"
  );

  const rows = sqlite.prepare(
    `SELECT id, external_id, title FROM saved_titles ORDER BY external_id`
  ).all();
  const failedRow = sqlite.prepare(
    `SELECT id FROM saved_titles WHERE external_id = ?`
  ).get("controlled-failure");
  const successAfter = sqlite.prepare(
    `SELECT id FROM saved_titles WHERE external_id = ?`
  ).get("controlled-success-after");

  assert.equal(result.inserted, 2);
  assert.equal(result.updated, 0);
  assert.equal(result.skipped, 0);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(
    result.failed[0].reference,
    "Controlled SQLite Failure [manual/movie/controlled-failure]"
  );
  assert.match(result.failed[0].reason, /controlled import failure/i);
  assert.equal(rows.length, 2);
  assert.equal(failedRow, undefined);
  assert.equal(successAfter.id, "controlled-success-after-id");

  console.log(JSON.stringify({
    databasePath,
    productionDatabaseOpened: false,
    result: {
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      conflicts: result.conflicts.length,
      invalid: parsed.payload.invalid.length,
      failed: result.failed.length,
    },
    failedIssue: result.failed[0],
    persistedRows: rows,
    continuedAfterFailure: Boolean(successAfter),
    failedRowPersisted: Boolean(failedRow),
  }, null, 2));
}

main()
  .then(() => {
    sqlite.close();
    sqlite = undefined;
    fs.unlinkSync(databasePath);
    assert.equal(fs.existsSync(databasePath), false);
    console.log(`Disposable database removed: ${databasePath}`);
  })
  .catch((error) => {
    if (sqlite) sqlite.close();
    if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
    console.error(error);
    process.exitCode = 1;
  });

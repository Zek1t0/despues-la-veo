const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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

const {
  DATABASE_SCHEMA_VERSION,
  LEGACY_BACKUP_FORMAT,
  enableAndVerifyForeignKeys,
  evolveDatabaseSchema,
  readUserVersion,
  verifyV4Schema,
} = require("../../../src/storage/databaseSchema.ts");

function createDatabase(label) {
  const databasePath = path.join(
    os.tmpdir(),
    `dlv-identity-v4-${label}-${process.pid}-${Date.now()}-${Math.random()}.sqlite`
  );
  const sqlite = new DatabaseSync(databasePath);
  const params = (values) => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...params(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...params(values)); },
    async runAsync(sql, ...values) {
      const result = sqlite.prepare(sql).run(...params(values));
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

function createHistoricalSavedTitles(sqlite, withRating) {
  sqlite.exec(`CREATE TABLE saved_titles (
    id TEXT NOT NULL PRIMARY KEY,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    poster_url TEXT,
    overview TEXT,
    vote_average REAL,
    ${withRating ? `personal_rating INTEGER NULL CHECK (
      personal_rating IS NULL OR (
        typeof(personal_rating) = 'integer' AND personal_rating >= 10 AND personal_rating <= 100
      )
    ),` : ""}
    genres_json TEXT,
    status TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX idx_saved_titles_provider_external
    ON saved_titles(provider, external_id);`);
}

function createHistoricalPins(sqlite) {
  sqlite.exec(`CREATE TABLE title_pins (
    saved_title_id TEXT NOT NULL,
    context_type TEXT NOT NULL,
    context_key TEXT NOT NULL,
    pinned_at INTEGER NOT NULL CHECK (
      typeof(pinned_at) = 'integer' AND pinned_at >= 0 AND pinned_at <= 9007199254740991
    ),
    PRIMARY KEY (saved_title_id, context_type, context_key),
    FOREIGN KEY (saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
    CHECK (
      (context_type = 'library' AND context_key = '') OR
      (context_type = 'tag' AND context_key <> '')
    )
  );
  CREATE INDEX idx_title_pins_context ON title_pins(context_type, context_key, saved_title_id);`);
}

function seedVersion(sqlite, version, rows = []) {
  createHistoricalSavedTitles(sqlite, version >= 3);
  if (version >= 1) {
    sqlite.exec(`CREATE TABLE app_preferences (
      key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
    );`);
  }
  if (version >= 2) createHistoricalPins(sqlite);
  const columns = version >= 3
    ? `id, provider, external_id, type, title, year, poster_url, overview, vote_average,
       personal_rating, genres_json, status, tags_json, notes, created_at, updated_at`
    : `id, provider, external_id, type, title, year, poster_url, overview, vote_average,
       genres_json, status, tags_json, notes, created_at, updated_at`;
  const placeholders = version >= 3 ? Array(16).fill("?").join(",") : Array(15).fill("?").join(",");
  const insert = sqlite.prepare(`INSERT INTO saved_titles (${columns}) VALUES (${placeholders})`);
  for (const row of rows) {
    const common = [row.id, row.provider, row.externalId, row.type, row.title,
      row.year ?? null, row.posterUrl ?? null, row.overview ?? null, row.voteAverage ?? null];
    const tail = [row.genresJson === undefined ? "[]" : row.genresJson,
      row.status ?? "planned", row.tagsJson ?? "[]",
      row.notes ?? null, row.createdAt ?? 1, row.updatedAt ?? 1];
    insert.run(...common, ...(version >= 3 ? [row.personalRating ?? null] : []), ...tail);
  }
  sqlite.exec(`PRAGMA user_version = ${version};`);
}

function representativeRows() {
  return [
    {
      id: "opaque-local-id", provider: "tmdb", externalId: "000106", type: "movie",
      title: "Movie", year: 2020, posterUrl: "movie.jpg", overview: "movie overview",
      voteAverage: 7.4, personalRating: 10, genresJson: '["Drama"]', status: "done",
      tagsJson: '["Favoritas"]', notes: "movie note", createdAt: 1000, updatedAt: 2000,
    },
    {
      id: "tv-local", provider: "tmdb", externalId: "106", type: "tv",
      title: "TV", personalRating: 100, status: "watching", createdAt: 3000, updatedAt: 4000,
    },
    {
      id: "manual-not-a-uuid", provider: "manual", externalId: " manual-key ", type: "movie",
      title: "Manual", personalRating: null, status: "planned", tagsJson: '["Local"]',
      genresJson: null, notes: "manual note", createdAt: 5000, updatedAt: 6000,
    },
  ];
}

async function initialize(fixture, version, hooks) {
  await enableAndVerifyForeignKeys(fixture.db);
  await evolveDatabaseSchema(fixture.db, version, hooks);
}

function snapshotV3(sqlite) {
  return {
    version: sqlite.prepare("PRAGMA user_version").get().user_version,
    schema: sqlite.prepare(`SELECT type, name, tbl_name, sql FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`).all(),
    titles: sqlite.prepare("SELECT * FROM saved_titles ORDER BY id").all(),
    pins: sqlite.prepare("SELECT * FROM title_pins ORDER BY saved_title_id, context_type, context_key").all(),
    preferences: sqlite.prepare("SELECT * FROM app_preferences ORDER BY key").all(),
    foreignKeys: sqlite.prepare("PRAGMA foreign_key_check").all(),
  };
}

async function testFreshV4AndReopen() {
  const fixture = createDatabase("fresh");
  try {
    await initialize(fixture, 0);
    assert.equal(DATABASE_SCHEMA_VERSION, 4);
    assert.equal(await readUserVersion(fixture.db), 4);
    await verifyV4Schema(fixture.db);
    const columns = fixture.sqlite.prepare("PRAGMA table_info(saved_titles)").all().map((row) => row.name);
    assert.equal(columns.includes("provider"), false);
    assert.equal(columns.includes("external_id"), false);

    fixture.sqlite.prepare(`INSERT INTO saved_titles
      (id, type, title, personal_rating, status, tags_json, created_at, updated_at)
      VALUES ('one', 'movie', 'One', 10, 'planned', '[]', 1, 1)`).run();
    const insertReference = fixture.sqlite.prepare(`INSERT INTO media_provider_references
      (provider, resource_namespace, external_id, saved_title_id) VALUES (?, ?, ?, 'one')`);
    insertReference.run("tmdb", "movie", "123");
    insertReference.run("tmdb", "tv", "123");
    assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM media_provider_references").get().count, 2);
    assert.throws(() => insertReference.run(" tmdb", "movie", "124"), /constraint/i);
    assert.throws(() => insertReference.run("tmdb", "movie ", "124"), /constraint/i);
    assert.throws(() => insertReference.run("tmdb", "movie", "   "), /constraint/i);
    assert.throws(() => fixture.sqlite.prepare(`INSERT INTO saved_titles
      (id, type, title, personal_rating, status, tags_json, created_at, updated_at)
      VALUES ('bad-rating', 'movie', 'Bad', 87.5, 'planned', '[]', 1, 1)`).run(), /constraint/i);

    const before = JSON.stringify({
      titles: fixture.sqlite.prepare("SELECT * FROM saved_titles ORDER BY id").all(),
      refs: fixture.sqlite.prepare("SELECT * FROM media_provider_references ORDER BY resource_namespace").all(),
    });
    await evolveDatabaseSchema(fixture.db, 4);
    const after = JSON.stringify({
      titles: fixture.sqlite.prepare("SELECT * FROM saved_titles ORDER BY id").all(),
      refs: fixture.sqlite.prepare("SELECT * FROM media_provider_references ORDER BY resource_namespace").all(),
    });
    assert.equal(after, before);
  } finally { fixture.close(); }
}

async function testV3Migration() {
  const fixture = createDatabase("v3-normal");
  try {
    const rows = representativeRows();
    seedVersion(fixture.sqlite, 3, rows);
    fixture.sqlite.exec(`INSERT INTO app_preferences VALUES ('library.viewMode', 'grid', 7000);
    INSERT INTO title_pins VALUES ('opaque-local-id', 'library', '', 8000);
    INSERT INTO title_pins VALUES ('manual-not-a-uuid', 'tag', 'Local', 9000);`);
    assert.throws(
      () => fixture.sqlite.prepare("UPDATE saved_titles SET tags_json = NULL WHERE id = ?").run("manual-not-a-uuid"),
      /constraint/i
    );
    await initialize(fixture, 3);
    await verifyV4Schema(fixture.db);
    assert.equal(await readUserVersion(fixture.db), 4);
    assert.deepEqual(
      fixture.sqlite.prepare(`SELECT provider, resource_namespace, external_id, saved_title_id
        FROM media_provider_references ORDER BY resource_namespace`).all().map((row) => ({ ...row })),
      [
        { provider: "tmdb", resource_namespace: "movie", external_id: "106", saved_title_id: "opaque-local-id" },
        { provider: "tmdb", resource_namespace: "tv", external_id: "106", saved_title_id: "tv-local" },
      ]
    );
    assert.deepEqual(
      { ...fixture.sqlite.prepare("SELECT * FROM legacy_saved_title_identities").get() },
      { legacy_format: LEGACY_BACKUP_FORMAT, legacy_provider: "manual",
        legacy_external_id: " manual-key ", saved_title_id: "manual-not-a-uuid" }
    );
    const movie = fixture.sqlite.prepare("SELECT * FROM saved_titles WHERE id = 'opaque-local-id'").get();
    assert.equal(movie.personal_rating, 10);
    assert.equal(movie.created_at, 1000);
    assert.equal(movie.updated_at, 2000);
    assert.equal(movie.notes, "movie note");
    assert.equal(fixture.sqlite.prepare("SELECT personal_rating FROM saved_titles WHERE id = 'tv-local'").get().personal_rating, 100);
    assert.equal(fixture.sqlite.prepare("SELECT personal_rating FROM saved_titles WHERE id = 'manual-not-a-uuid'").get().personal_rating, null);
    assert.equal(fixture.sqlite.prepare("SELECT genres_json FROM saved_titles WHERE id = 'manual-not-a-uuid'").get().genres_json, "[]");
    assert.deepEqual(fixture.sqlite.prepare("SELECT saved_title_id, context_type, context_key, pinned_at FROM title_pins ORDER BY pinned_at").all().map((row) => ({ ...row })), [
      { saved_title_id: "opaque-local-id", context_type: "library", context_key: "", pinned_at: 8000 },
      { saved_title_id: "manual-not-a-uuid", context_type: "tag", context_key: "Local", pinned_at: 9000 },
    ]);
    assert.equal(fixture.sqlite.prepare("SELECT value FROM app_preferences").get().value, "grid");
  } finally { fixture.close(); }
}

async function testHistoricalVersions() {
  for (const version of [0, 1, 2]) {
    const fixture = createDatabase(`v${version}`);
    try {
      seedVersion(fixture.sqlite, version, [{
        id: `opaque-v${version}`, provider: "manual", externalId: `legacy-v${version}`,
        type: "movie", title: `V${version}`,
      }]);
      await initialize(fixture, version);
      assert.equal(await readUserVersion(fixture.db), 4);
      await verifyV4Schema(fixture.db);
      assert.equal(fixture.sqlite.prepare("SELECT id FROM saved_titles").get().id, `opaque-v${version}`);
      assert.equal(fixture.sqlite.prepare("SELECT legacy_external_id FROM legacy_saved_title_identities").get().legacy_external_id, `legacy-v${version}`);
    } finally { fixture.close(); }
  }
}

async function assertMigrationRollback(label, rows, expectedError) {
  const fixture = createDatabase(label);
  try {
    seedVersion(fixture.sqlite, 3, rows);
    fixture.sqlite.exec(`INSERT INTO app_preferences VALUES ('library.sort', 'updated-desc', 77);
    INSERT INTO title_pins VALUES ('${rows[0].id}', 'library', '', 88);`);
    await enableAndVerifyForeignKeys(fixture.db);
    const before = snapshotV3(fixture.sqlite);
    await assert.rejects(() => evolveDatabaseSchema(fixture.db, 3), expectedError);
    assert.deepEqual(snapshotV3(fixture.sqlite), before);
  } finally { fixture.close(); }
}

async function testInvalidAndCollisionRollback() {
  await assertMigrationRollback("invalid", [{
    id: "invalid", provider: "tmdb", externalId: "not-numeric", type: "movie", title: "Invalid",
  }], /TMDB/i);
  await assertMigrationRollback("collision", [
    { id: "first", provider: "tmdb", externalId: "00106", type: "movie", title: "First" },
    { id: "second", provider: "tmdb", externalId: "106", type: "movie", title: "Second" },
  ], /misma referencia TMDB canónica/i);
}

async function testInjectedRollback() {
  const stages = [
    "afterV4TargetTablesCreated", "afterV4ItemsCopied", "afterV4IdentitiesCopied",
    "afterV4PinsCopied", "beforeV4Verification", "beforeVersion4Published",
    "afterVersion4Published",
  ];
  for (const stage of stages) {
    const fixture = createDatabase(`failure-${stage}`);
    try {
      seedVersion(fixture.sqlite, 3, [{
        id: "rollback-item", provider: "tmdb", externalId: "00123", type: "movie",
        title: "Rollback", personalRating: 87, notes: "keep", createdAt: 10, updatedAt: 20,
      }]);
      fixture.sqlite.exec(`INSERT INTO app_preferences VALUES ('library.viewMode', 'list', 30);
      INSERT INTO title_pins VALUES ('rollback-item', 'tag', 'Keep', 40);`);
      await enableAndVerifyForeignKeys(fixture.db);
      const before = snapshotV3(fixture.sqlite);
      const controlled = new Error(`controlled-${stage}`);
      await assert.rejects(
        () => evolveDatabaseSchema(fixture.db, 3, { [stage]: () => { throw controlled; } }),
        (error) => error === controlled
      );
      assert.deepEqual(snapshotV3(fixture.sqlite), before, stage);
    } finally { fixture.close(); }
  }
}

async function testFutureVersionRejected() {
  const fixture = createDatabase("future");
  try {
    fixture.sqlite.exec("PRAGMA user_version = 5;");
    await enableAndVerifyForeignKeys(fixture.db);
    await assert.rejects(() => evolveDatabaseSchema(fixture.db, 5), /no soportada/i);
    assert.equal(await readUserVersion(fixture.db), 5);
  } finally { fixture.close(); }
}

async function main() {
  await testFreshV4AndReopen();
  await testV3Migration();
  await testHistoricalVersions();
  await testInvalidAndCollisionRollback();
  await testInjectedRollback();
  await testFutureVersionRejected();
  console.log("Section 2 SQLite v4 schema, migration, and rollback verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

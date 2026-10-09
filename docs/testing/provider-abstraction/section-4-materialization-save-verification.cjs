const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const { DatabaseSync } = require("node:sqlite");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { materializeProviderSavedTitle } = require("../../../src/core/providerSavedTitle.ts");
const {
  createTmdbProviderReference,
  materializeTmdbSavedTitle,
} = require("../../../src/core/tmdbSavedTitle.ts");

const inputFor = (reference, overrides = {}) => ({
  reference,
  snapshot: {
    medium: "audiovisual", contentFamily: null, primaryFormat: reference.resourceNamespace === "tv" ? "tv" : "movie", title: "Normalized", year: 2026,
    posterUrl: "https://example.test/poster.jpg", overview: "Overview",
    genres: ["Remote metadata"], ...(reference.provider === "tmdb" ? { voteAverage: 8.7 } : {}),
    ...overrides,
  },
  initialTags: ["Creation policy"],
});
const genericInput = () => inputFor({
  provider: "catalog-test", resourceNamespace: "entry", externalId: "Opaque/77",
});

function pureMaterialization() {
  const input = genericInput();
  Object.freeze(input.snapshot.genres);
  Object.freeze(input.initialTags);
  const created = materializeProviderSavedTitle(input, null, () => "opaque-local-id", 100);
  assert.deepEqual(created, {
    ...input.snapshot, voteAverage: null, genres: ["Remote metadata"], id: "opaque-local-id",
    tags: ["Creation policy"], status: "planned", notes: null,
    personalRating: null, createdAt: 100, updatedAt: 100,
  });
  assert.notStrictEqual(created.genres, input.snapshot.genres);
  assert.notStrictEqual(created.tags, input.initialTags);
  created.genres.push("local copy");
  created.tags.push("local copy");
  assert.deepEqual(input.snapshot.genres, ["Remote metadata"]);
  assert.deepEqual(input.initialTags, ["Creation policy"]);

  const existing = {
    ...created, status: "watching", tags: ["User tag"], notes: "User note",
    personalRating: 87, createdAt: 10, updatedAt: 200,
  };
  const before = structuredClone(existing);
  const refreshedInput = {
    ...inputFor(input.reference, { primaryFormat: "tv", title: "Refresh", year: null,
      posterUrl: null, overview: null, genres: ["New remote genre"] }),
    initialTags: ["Incoming policy"],
  };
  const neverGenerate = () => { throw new Error("Refresh must not generate an ID"); };
  for (const [now, updatedAt] of [[100, 201], [200, 201], [500, 500]]) {
    const refreshed = materializeProviderSavedTitle(refreshedInput, existing, neverGenerate, now);
    assert.deepEqual(refreshed, {
      ...refreshedInput.snapshot, primaryFormat: existing.primaryFormat, voteAverage: null, genres: ["New remote genre"], id: existing.id,
      status: "watching", tags: ["User tag"], notes: "User note", personalRating: 87,
      createdAt: 10, updatedAt,
    });
    assert.notStrictEqual(refreshed.tags, existing.tags);
  }
  assert.deepEqual(existing, before);
  assert.deepEqual(refreshedInput.initialTags, ["Incoming policy"]);
  assert.equal(materializeProviderSavedTitle(input, { ...existing, notes: undefined }, neverGenerate, 500).notes, null);
  for (const now of [-1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => materializeProviderSavedTitle(input, null, neverGenerate, now), /timestamp/);
  }
  assert.throws(() => materializeProviderSavedTitle(input,
    { ...existing, updatedAt: Number.MAX_SAFE_INTEGER }, neverGenerate, 500), /precisión/);
  assert.throws(() => materializeProviderSavedTitle({ ...input, reference: { ...input.reference, provider: " " } }, null, neverGenerate, 500), /provider/);

  const legacySnapshot = { ...input.snapshot, voteAverage: 8.7, genres: ["TMDB genre"] };
  const ref = createTmdbProviderReference("movie", 77);
  const normalized = { reference: ref, snapshot: legacySnapshot, initialTags: legacySnapshot.genres };
  for (const item of [null, existing]) {
    assert.deepEqual(materializeTmdbSavedTitle(ref, legacySnapshot, item, () => "compat-id", 500),
      materializeProviderSavedTitle(normalized, item, () => "compat-id", 500));
  }
}

function createFixture() {
  const sqlite = new DatabaseSync(":memory:");
  const events = [];
  let activeTransactions = 0;
  let maximumTransactions = 0;
  let failAttach = false;
  const normalize = (values) => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...normalize(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...normalize(values)); },
    async runAsync(sql, ...values) {
      if (failAttach && /INSERT INTO media_provider_references/.test(sql)) throw new Error("Controlled attach failure");
      const result = sqlite.prepare(sql).run(...normalize(values));
      return { changes: Number(result.changes) };
    },
    async withTransactionAsync(task) {
      assert.equal(activeTransactions, 0, "no nested or overlapping transactions");
      activeTransactions++;
      maximumTransactions = Math.max(maximumTransactions, activeTransactions);
      events.push("begin");
      sqlite.exec("BEGIN;");
      try { await task(); sqlite.exec("COMMIT;"); events.push("commit"); }
      catch (error) { sqlite.exec("ROLLBACK;"); events.push("rollback"); throw error; }
      finally { activeTransactions--; }
    },
  };
  return { db, sqlite, events, setFailAttach(value) { failAttach = value; },
    get maximumTransactions() { return maximumTransactions; } };
}

async function repositorySaving() {
  const fixture = createFixture();
  const { db, sqlite, events } = fixture;
  const schema = require("../../../src/storage/databaseSchema.ts");
  const queue = require("../../../src/storage/storageMutationQueue.ts");
  const core = require("../../../src/core/providerSavedTitle.ts");
  const originalMaterialize = core.materializeProviderSavedTitle;
  let materializations = 0;
  core.materializeProviderSavedTitle = (...args) => {
    materializations++;
    return originalMaterialize(...args);
  };
  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "expo-sqlite") return { openDatabaseAsync: async () => db };
    if (parent?.filename.endsWith(`${path.sep}savedTitlesRepo.ts`)) {
      if (request === "./db") return { initDb: async () => { events.push("init"); return db; } };
      if (request === "./storageMutationQueue") return {
        runSerializedStorageMutation: (task) => {
          events.push("queue");
          return queue.runSerializedStorageMutation(task);
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    await schema.enableAndVerifyForeignKeys(db);
    await schema.evolveDatabaseSchema(db, 0);
    events.length = 0;
    const repo = require("../../../src/storage/savedTitlesRepo.ts");
    const integrity = require("../../../src/storage/savedTitleIntegrity.ts");
    const pins = require("../../../src/storage/titlePinsRepo.ts");
    const input = genericInput();
    const beforeInput = structuredClone(input);
    const id = await repo.saveProviderTitle(input, () => "generic-local-id");
    assert.deepEqual(events, ["init", "queue", "begin", "commit"]);
    assert.equal(materializations, 1);
    const created = await repo.getSavedTitleByProviderReferenceWithDb(db, input.reference);
    assert.equal(id, "generic-local-id");
    assert.deepEqual(created.providerReferences, [input.reference]);
    for (const key of Object.keys(input.snapshot)) assert.deepEqual(created[key], input.snapshot[key]);
    assert.deepEqual(created.tags, input.initialTags);
    assert.equal(created.status, "planned");
    assert.equal(created.notes, null);
    assert.equal(created.personalRating, null);
    assert.equal(created.createdAt, created.updatedAt);
    assert.ok(Number.isSafeInteger(created.createdAt));
    assert.deepEqual(input, beforeInput);

    const extraReference = { provider: "aaa-fixture", resourceNamespace: "other", externalId: "77" };
    await db.withTransactionAsync(async () => {
      await repo.attachProviderReferenceWithDb(db, extraReference, id);
      await repo.updateSavedTitleMetadataWithDb(db, id,
        { status: "done", tags: ["User tag"], notes: "User note" }, () => created.updatedAt);
      await repo.setPersonalRatingWithDb(db, id, 93, () => created.updatedAt);
      await pins.pinTitleWithDb(db, id, { contextType: "tag", contextKey: "User tag" }, 123);
      await pins.pinTitleWithDb(db, id, { contextType: "library", contextKey: "" }, 124);
    });
    const existing = await repo.getSavedTitleWithReferencesByIdWithDb(db, id);
    assert.deepEqual(existing.providerReferences, [extraReference, input.reference], "incoming reference is not the first reference");
    const countBefore = sqlite.prepare("SELECT COUNT(*) AS n FROM saved_titles").get().n;
    const refreshedInput = {
      ...inputFor(input.reference, { primaryFormat: "tv", title: "Refreshed", year: 2027,
        posterUrl: "https://example.test/new.jpg", overview: "New overview",
        genres: ["Incoming genre"] }),
      initialTags: ["Incoming tag policy"],
    };
    events.length = 0;
    await db.withTransactionAsync(async () => {
      const savedId = await repo.saveProviderTitleWithDb(db, refreshedInput,
        () => { throw new Error("must not generate a duplicate"); }, existing.updatedAt);
      assert.equal(savedId, id);
    });
    assert.deepEqual(events, ["begin", "commit"], "WithDb does not initialize or queue");
    const refreshed = await repo.getSavedTitleWithReferencesByIdWithDb(db, id);
    for (const key of ["id", "createdAt", "status", "tags", "notes", "personalRating", "providerReferences"]) {
      assert.deepEqual(refreshed[key], existing[key], `preserved ${key}`);
    }
    for (const key of Object.keys(refreshedInput.snapshot).filter(key => key !== "primaryFormat")) assert.deepEqual(refreshed[key], refreshedInput.snapshot[key]);
    assert.equal(refreshed.primaryFormat, existing.primaryFormat);
    assert.equal(refreshed.updatedAt, existing.updatedAt + 1);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM saved_titles").get().n, countBefore);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM title_pins WHERE saved_title_id = ?").get(id).n, 2);

    // Every part of identity matters; local type is not an identity fallback.
    const identities = [
      createTmdbProviderReference("movie", 77),
      createTmdbProviderReference("tv", 77),
      { provider: "other-fixture", resourceNamespace: "movie", externalId: "77" },
    ];
    for (let index = 0; index < identities.length; index++) {
      const reference = identities[index];
      const localId = `identity-${index}`;
      await db.withTransactionAsync(() => repo.saveProviderTitleWithDb(db,
        inputFor(reference), () => localId, 1000));
      assert.equal((await repo.getSavedTitleByProviderReferenceWithDb(db, reference)).id, localId);
    }
    assert.equal(await repo.getSavedTitleByProviderReferenceWithDb(db,
      { provider: "unknown-fixture", resourceNamespace: "movie", externalId: "77" }), null);
    assert.equal(await repo.getSavedTitleByProviderReferenceWithDb(db,
      { provider: "tmdb", resourceNamespace: "other", externalId: "77" }), null);

    const legacy = { externalId: "00077", type: "movie", title: "TMDB refresh", year: 2028,
      posterUrl: null, overview: null, genres: ["TMDB genre"], voteAverage: 6.9 };
    const compatBefore = materializations;
    await db.withTransactionAsync(() => repo.saveTmdbTitleWithDb(db, legacy,
      () => { throw new Error("unused ID"); }, 1000));
    assert.equal(materializations, compatBefore + 1, "compatibility save uses authoritative materializer once");
    const legacyRefreshed = await repo.getSavedTitleWithReferencesByIdWithDb(db, "identity-0");
    assert.equal(legacyRefreshed.updatedAt, 1001);
    assert.deepEqual(legacyRefreshed.genres, ["TMDB genre"]);
    assert.deepEqual(legacyRefreshed.tags, ["Creation policy"]);
    events.length = 0;
    const compatPublicBefore = materializations;
    const legacyNewId = await repo.saveTmdbTitle({ ...legacy, externalId: "00088" }, () => "legacy-new");
    assert.equal(legacyNewId, "legacy-new");
    assert.equal(materializations, compatPublicBefore + 1);
    assert.deepEqual(events, ["init", "queue", "begin", "commit"]);
    const legacyNew = await repo.getSavedTitleWithReferencesByIdWithDb(db, legacyNewId);
    assert.deepEqual(legacyNew.genres, ["TMDB genre"]);
    assert.deepEqual(legacyNew.tags, ["TMDB genre"]);
    assert.deepEqual(legacyNew.providerReferences, [createTmdbProviderReference("movie", 88)]);

    // Reference ownership remains protected, including transaction rollback.
    await assert.rejects(db.withTransactionAsync(async () => {
      await integrity.upsertSavedTitleAndCleanPinsWithDb(db, { ...created, id: "conflicting-local-id" });
      await repo.attachProviderReferenceWithDb(db, input.reference, "conflicting-local-id");
    }), /otro MediaItem/);
    assert.equal(await repo.getSavedTitleWithReferencesByIdWithDb(db, "conflicting-local-id"), null);
    assert.deepEqual((await repo.getSavedTitleWithReferencesByIdWithDb(db, id)).providerReferences, existing.providerReferences);

    const failureInput = inputFor({ provider: "catalog-test", resourceNamespace: "entry", externalId: "fail" });
    fixture.setFailAttach(true);
    await assert.rejects(repo.saveProviderTitle(failureInput, () => "rolled-back"), /Controlled attach failure/);
    fixture.setFailAttach(false);
    assert.equal(await repo.getSavedTitleWithReferencesByIdWithDb(db, "rolled-back"), null);
    assert.equal(await repo.getSavedTitleByProviderReferenceWithDb(db, failureInput.reference), null);

    const concurrent = inputFor({ provider: "catalog-test", resourceNamespace: "entry", externalId: "concurrent" });
    const results = await Promise.all([
      repo.saveProviderTitle(concurrent, () => "concurrent-local"),
      repo.saveProviderTitle({ ...concurrent, snapshot: { ...concurrent.snapshot, title: "Latest" } },
        () => { throw new Error("concurrent duplicate"); }),
    ]);
    assert.deepEqual(results, ["concurrent-local", "concurrent-local"]);
    assert.equal((await repo.getSavedTitleByProviderReferenceWithDb(db, concurrent.reference)).title, "Latest");
    assert.equal(fixture.maximumTransactions, 1);
    assert.equal(sqlite.prepare("PRAGMA user_version").get().user_version, 5);
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    Module._load = originalLoad;
    core.materializeProviderSavedTitle = originalMaterialize;
    sqlite.close();
  }
}

function architectureBoundaries() {
  const read = (relative) => fs.readFileSync(path.join(__dirname, "../../..", relative), "utf8");
  const materializer = read("src/core/providerSavedTitle.ts");
  assert.doesNotMatch(materializer, /tmdb|backup|react|router|credential|fetch|\.map\(/i);
  const functions = (relative) => {
    const source = ts.createSourceFile(relative, read(relative), ts.ScriptTarget.Latest, true);
    return Object.fromEntries(source.statements.filter(ts.isFunctionDeclaration)
      .map((statement) => [statement.name.text, statement.getText(source)]));
  };
  const repo = functions("src/storage/savedTitlesRepo.ts");
  for (const name of ["saveProviderTitleWithDb", "saveTmdbTitleWithDb"]) {
    assert.doesNotMatch(repo[name], /initDb|runSerializedStorageMutation|withTransactionAsync/);
  }
  assert.match(repo.saveProviderTitleWithDb, /getSavedTitleByProviderReferenceWithDb\(db, input.reference\)/);
  assert.doesNotMatch(repo.saveProviderTitleWithDb, /externalId|legacy|\.type|providerReferences\[/);
  assert.match(repo.saveProviderTitleWithDb, /if \(!existing\)[\s\S]*attachProviderReferenceWithDb/);
  assert.match(repo.saveTmdbTitleWithDb, /return saveProviderTitleWithDb\(/);
  assert.match(repo.saveTmdbTitle, /return saveProviderTitle\(/);
  for (const name of ["saveTmdbTitleWithDb", "saveTmdbTitle"]) {
    assert.doesNotMatch(repo[name], /getSavedTitle|upsert|attachProvider|materialize|withTransactionAsync|initDb|runSerializedStorageMutation/);
  }
  const tmdb = functions("src/core/tmdbSavedTitle.ts");
  assert.match(tmdb.materializeTmdbSavedTitle, /return materializeProviderSavedTitle\(/);
  assert.doesNotMatch(tmdb.materializeTmdbSavedTitle, /existing\.|personalFields|nextSavedTitleUpdatedAt/);
  const storage = read("src/storage/savedTitleStorage.ts");
  assert.match(storage, /WHERE provider = \? AND resource_namespace = \? AND external_id = \?/);
}

async function main() {
  pureMaterialization();
  architectureBoundaries();
  await repositorySaving();
  console.log("Section 4 provider-independent materialization/save verification passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};

const repoRoot = path.resolve(__dirname, "../../..");
const { parseLibraryBackup } = require("../../../src/core/libraryBackup.ts");
const { createLibraryBackupV4, parseLibraryBackupV4Value } =
  require("../../../src/core/libraryBackupV4.ts");
const { AppearanceCoordinator } = require("../../../src/theme/appearanceCoordinator.ts");
const { getAppearanceBackupAvailability } =
  require("../../../src/theme/appearanceBackupAvailability.ts");
const originalModuleLoad = Module._load;
Module._load = function loadForStorage(request, parent, isMain) {
  if (request === "expo-sqlite") return {};
  return originalModuleLoad.call(this, request, parent, isMain);
};
const { mergeLibraryBackupWithDb } =
  require("../../../src/storage/libraryBackupMerge.ts");
Module._load = originalModuleLoad;

const pref = (scheme, palette) => ({ version: 1, scheme, palette });
const C = pref("dark", "original");
const A = pref("light", "tide");
const B = pref("system", "lavender");
const D = pref("dark", "obsidian");
const availability = (preference) => ({ status: "confirmed", preference });
const unavailable = (reason) => ({ status: "unavailable", reason });
const tick = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function savedTitle(overrides = {}) {
  return {
    id: "id-1", provider: "manual", externalId: "portable-1", type: "movie",
    title: "Portable", year: null, posterUrl: null, overview: null, voteAverage: null,
    personalRating: 87, genres: [], status: "planned", tags: [], notes: null,
    createdAt: 10, updatedAt: 20, ...overrides,
  };
}

function v4(overrides = {}) {
  return {
    version: 4, exportedAt: "2030-01-01T00:00:00.000Z",
    items: [savedTitle()], pins: [], appearance: { scheme: "light", palette: "tide" },
    ...overrides,
  };
}

function pin(externalId = "portable-1") {
  return { provider: "manual", externalId, contextType: "library", contextKey: "", pinnedAt: 30 };
}

function normalizeParams(params) {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

function createMergeFixture(label) {
  const databasePath = path.join(os.tmpdir(),
    `dlv-section-11-${label}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec(`
    CREATE TABLE saved_titles (
      id TEXT NOT NULL PRIMARY KEY, provider TEXT NOT NULL, external_id TEXT NOT NULL,
      type TEXT NOT NULL, title TEXT NOT NULL, year INTEGER, poster_url TEXT, overview TEXT,
      vote_average REAL, personal_rating INTEGER, genres_json TEXT, status TEXT NOT NULL,
      tags_json TEXT NOT NULL, notes TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_saved_titles_provider_external
      ON saved_titles(provider, external_id);
    CREATE TABLE title_pins (
      saved_title_id TEXT NOT NULL, context_type TEXT NOT NULL, context_key TEXT NOT NULL,
      pinned_at INTEGER NOT NULL, PRIMARY KEY(saved_title_id, context_type, context_key)
    );
  `);
  let transactions = 0;
  const db = {
    async getFirstAsync(sql, ...params) {
      return sqlite.prepare(sql).get(...normalizeParams(params));
    },
    async getAllAsync(sql, ...params) {
      return sqlite.prepare(sql).all(...normalizeParams(params));
    },
    async runAsync(sql, ...params) {
      return sqlite.prepare(sql).run(...normalizeParams(params));
    },
    async withTransactionAsync(task) {
      transactions++;
      sqlite.exec("BEGIN");
      try {
        await task();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return {
    db,
    sqlite,
    get transactions() { return transactions; },
    close() {
      sqlite.close();
      fs.unlinkSync(databasePath);
      assert.equal(fs.existsSync(databasePath), false);
    },
  };
}

async function mergeParsedPayload(fixture, payload) {
  let result;
  await fixture.db.withTransactionAsync(async () => {
    result = await mergeLibraryBackupWithDb(
      fixture.db,
      payload.items,
      payload.version === 1 ? null : payload.pins,
      () => `generated-${Math.random().toString(16).slice(2)}`
    );
  });
  assert.equal(fixture.transactions, 1);
  return result;
}

function assertDataPersisted(fixture, externalId = "portable-1", expectPin = true) {
  const row = fixture.sqlite.prepare(
    "SELECT id, external_id, personal_rating FROM saved_titles WHERE external_id = ?"
  ).get(externalId);
  assert.equal(row.external_id, externalId);
  if (expectPin) {
    const persistedPin = fixture.sqlite.prepare(
      "SELECT saved_title_id, pinned_at FROM title_pins WHERE saved_title_id = ?"
    ).get(row.id);
    assert.equal(persistedPin.pinned_at, 30);
  }
}

function hydratedCoordinator(writer, baseline = C) {
  const coordinator = new AppearanceCoordinator(writer);
  coordinator.completeHydration(coordinator.beginHydration(),
    { status: "valid", preference: baseline, updatedAt: 1 });
  return coordinator;
}

function testV4CreatorAndParser() {
  const present = createLibraryBackupV4([savedTitle()], [], availability(B),
    "2030-01-01T00:00:00.000Z");
  assert.equal(present.version, 4);
  assert.deepEqual(present.appearance, { scheme: "system", palette: "lavender" });
  assert.equal(present.items[0].personalRating, 87);
  for (const excluded of ["effectiveScheme", "theme", "tokens", "systemScheme",
    "viewMode", "sort", "latestIntent", "hydrationStatus"]) {
    assert.equal(JSON.stringify(present).includes(excluded), false);
  }
  const roundTrip = parseLibraryBackup(JSON.stringify(present));
  assert.equal(roundTrip.ok, true);
  assert.equal(roundTrip.payload.version, 4);
  assert.equal(roundTrip.payload.appearance.status, "valid");
  assert.deepEqual(roundTrip.payload.appearance.preference, B);

  for (const reason of ["pending", "invalid", "read-error"]) {
    const absent = createLibraryBackupV4([], [], unavailable(reason));
    assert.equal(Object.hasOwn(absent, "appearance"), false);
    assert.equal(parseLibraryBackup(JSON.stringify(absent)).payload.appearance.status, "absent");
  }
  const noRow = createLibraryBackupV4([], [], { status: "known-default", preference: C });
  assert.deepEqual(noRow.appearance, { scheme: "dark", palette: "original" });

  const unknown = parseLibraryBackupV4Value(v4({ appearance: {
    scheme: "light", palette: "future-palette",
  } }));
  assert.equal(unknown.ok, true);
  assert.equal(unknown.payload.appearance.status, "incompatible");
  assert.equal(unknown.payload.items.length, 1);
  const invalidScheme = parseLibraryBackupV4Value(v4({ appearance: {
    scheme: "auto", palette: "tide",
  } }));
  assert.equal(invalidScheme.ok, true);
  assert.equal(invalidScheme.payload.appearance.status, "incompatible");
  for (const bad of [null, [], "bad", { scheme: "light" },
    { scheme: "light", palette: "tide", version: 1 }]) {
    const result = parseLibraryBackupV4Value(v4({ appearance: bad }));
    assert.equal(result.ok, true);
    assert.equal(result.payload.appearance.status, "incompatible");
  }
  assert.equal(parseLibraryBackupV4Value({ version: 4, items: {}, pins: [] }).ok, false);
  assert.equal(parseLibraryBackupV4Value({ version: 4, items: [], pins: {} }).ok, false);
}

async function testHistoricalCompatibility() {
  for (const version of [1, 2, 3]) {
    const item = savedTitle({ externalId: `historical-${version}` });
    if (version !== 3) delete item.personalRating;
    const parsed = parseLibraryBackup(JSON.stringify({
      version, items: [item], ...(version === 1 ? {} : { pins: [] }),
    }));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.payload.version, version);
    assert.equal(Object.hasOwn(parsed.payload, "appearance"), false);
    let writes = 0;
    const local = hydratedCoordinator(async () => { writes++; }, D);
    const fixture = createMergeFixture(`historical-${version}`);
    try {
      const result = await mergeParsedPayload(fixture, parsed.payload);
      assert.equal(result.inserted, 1);
      assertDataPersisted(fixture, `historical-${version}`, false);
      assert.equal(local.getState().revision, 0);
      assert.equal(writes, 0);
      assert.deepEqual(local.getState().displayed, D);
      assert.deepEqual(local.getState().confirmedPersisted, D);
    } finally {
      fixture.close();
    }
  }
  const fixturesDir = path.join(repoRoot, "docs/testing/library-backup-integrity/fixtures");
  for (const name of fs.readdirSync(fixturesDir).filter((entry) => entry.endsWith(".json"))) {
    assert.doesNotThrow(() => parseLibraryBackup(
      fs.readFileSync(path.join(fixturesDir, name), "utf8")
    ), name);
  }
}

async function testReadErrorRoundTripAndUnknownPaletteRestore() {
  for (const scenario of ["read-error", "unknown-palette"]) {
    let appearanceWrites = 0;
    const destination = hydratedCoordinator(async () => { appearanceWrites++; }, D);
    let backup;
    if (scenario === "read-error") {
      const source = new AppearanceCoordinator(async () => {});
      source.completeHydration(source.beginHydration(),
        { status: "error", error: new Error("controlled read error") });
      const sourceAvailability = getAppearanceBackupAvailability(source.getState());
      assert.equal(sourceAvailability.status, "unavailable");
      backup = createLibraryBackupV4([savedTitle()], [pin()], sourceAvailability,
        "2030-01-01T00:00:00.000Z");
      assert.equal(Object.hasOwn(backup, "appearance"), false);
    } else {
      backup = v4({ pins: [pin()], appearance: { scheme: "light", palette: "future-palette" } });
    }

    const parsed = parseLibraryBackup(JSON.stringify(backup));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.payload.appearance.status,
      scenario === "read-error" ? "absent" : "incompatible");
    const fixture = createMergeFixture(scenario);
    try {
      const result = await mergeParsedPayload(fixture, parsed.payload);
      assert.equal(result.inserted, 1);
      assert.equal(result.pins.inserted, 1);
      assertDataPersisted(fixture);
      assert.equal(destination.getState().revision, 0);
      assert.equal(appearanceWrites, 0);
      assert.deepEqual(destination.getState().displayed, D);
      assert.deepEqual(destination.getState().confirmedPersisted, D);
    } finally {
      fixture.close();
    }
  }
}

async function testExportAvailabilityAndDeferredConcurrency() {
  const noRow = new AppearanceCoordinator(async () => {});
  noRow.completeHydration(noRow.beginHydration(), { status: "absent" });
  assert.equal(getAppearanceBackupAvailability(noRow.getState()).status, "known-default");
  assert.deepEqual(getAppearanceBackupAvailability(noRow.getState()).preference, C);
  for (const result of [{ status: "invalid" }, { status: "error", error: new Error("read") }]) {
    const coordinator = new AppearanceCoordinator(async () => {});
    coordinator.completeHydration(coordinator.beginHydration(), result);
    assert.equal(getAppearanceBackupAvailability(coordinator.getState()).status, "unavailable");
  }

  const displayedOnly = hydratedCoordinator(async () => {});
  const pending = deferred();
  const optimistic = hydratedCoordinator(() => pending.promise, C);
  const optimisticWrite = optimistic.select(B);
  await tick();
  assert.deepEqual(getAppearanceBackupAvailability(optimistic.getState()).preference, C);
  pending.resolve();
  await optimisticWrite;
  assert.deepEqual(getAppearanceBackupAvailability(optimistic.getState()).preference, B);
  assert.ok(displayedOnly);

  const writes = [];
  const coordinator = hydratedCoordinator(async (value) => { writes.push(value); });
  await coordinator.select(B);
  const importA = coordinator.reserveDeferred(A);
  assert.deepEqual(getAppearanceBackupAvailability(coordinator.getState()).preference, B);
  assert.deepEqual(createLibraryBackupV4([], [],
    getAppearanceBackupAvailability(coordinator.getState())).appearance,
  { scheme: "system", palette: "lavender" });
  coordinator.discardDeferred(importA);

  const first = deferred();
  let failureStorage = C;
  const failure = hydratedCoordinator(async (value) => {
    await first.promise;
    failureStorage = value;
  }, C);
  const writeB = failure.select(B);
  await tick();
  const reserved = failure.reserveDeferred(A);
  first.reject(new Error("B failed"));
  await assert.rejects(writeB);
  assert.deepEqual(failure.getState().displayed, C);
  assert.deepEqual(failure.getState().confirmedPersisted, C);
  assert.deepEqual(failureStorage, C);
  failure.discardDeferred(reserved);
  assert.deepEqual(failure.getState().displayed, C);

  const successGate = deferred();
  let successStorage = C;
  const success = hydratedCoordinator(async (value) => {
    await successGate.promise;
    successStorage = value;
  }, C);
  const successB = success.select(B);
  await tick();
  const pendingA = success.reserveDeferred(A);
  successGate.resolve();
  await successB;
  assert.deepEqual(success.getState().displayed, B);
  assert.deepEqual(success.getState().confirmedPersisted, B);
  assert.deepEqual(successStorage, B);
  success.discardDeferred(pendingA);
  assert.deepEqual(successStorage, B);
}

async function testRealImportLifecycle() {
  const appliedFixture = createMergeFixture("applied");
  let appliedStorage = C;
  try {
    const parsed = parseLibraryBackup(JSON.stringify(v4({ pins: [pin()] })));
    assert.equal(parsed.ok, true);
    const applied = hydratedCoordinator(async (value) => { appliedStorage = value; }, C);
    const handle = applied.reserveDeferred(parsed.payload.appearance.preference);
    const dataResult = await mergeParsedPayload(appliedFixture, parsed.payload);
    assert.equal(dataResult.inserted, 1);
    assert.equal(dataResult.pins.inserted, 1);
    assertDataPersisted(appliedFixture);
    assert.equal((await applied.activateDeferred(handle)).status, "applied");
    assert.deepEqual(appliedStorage, A);
  } finally {
    appliedFixture.close();
  }

  const lateFixture = createMergeFixture("late-a-user-b");
  let lateStorage = C;
  const mergeGate = deferred();
  const mergeExited = deferred();
  try {
    const parsed = parseLibraryBackup(JSON.stringify(v4({ pins: [pin()] })));
    const late = hydratedCoordinator(async (value) => {
      await mergeExited.promise;
      lateStorage = value;
    }, C);
    const lateA = late.reserveDeferred(A);
    const mainMerge = (async () => {
      await mergeGate.promise;
      const result = await mergeParsedPayload(lateFixture, parsed.payload);
      mergeExited.resolve();
      return result;
    })();
    const writeB = late.select(B);
    await tick();
    assert.deepEqual(lateStorage, C);
    mergeGate.resolve();
    const dataResult = await mainMerge;
    await writeB;
    assert.equal(dataResult.inserted, 1);
    assertDataPersisted(lateFixture);
    assert.equal((await late.activateDeferred(lateA)).status, "superseded");
    assert.deepEqual(late.getState().displayed, B);
    assert.deepEqual(late.getState().confirmedPersisted, B);
    assert.deepEqual(lateStorage, B);

    const restarted = new AppearanceCoordinator(async () => {});
    restarted.completeHydration(restarted.beginHydration(),
      { status: "valid", preference: lateStorage, updatedAt: 2 });
    assert.deepEqual(restarted.getState().displayed, B);
    assert.deepEqual(restarted.getState().confirmedPersisted, B);
  } finally {
    mergeExited.resolve();
    lateFixture.close();
  }

  const repeated = hydratedCoordinator(async () => {});
  const oldA = repeated.reserveDeferred(A);
  const newD = repeated.reserveDeferred(D);
  assert.equal((await repeated.activateDeferred(oldA)).status, "superseded");
  assert.equal((await repeated.activateDeferred(newD)).status, "applied");

  for (const mode of ["cancel", "reject", "throw"]) {
    const coordinator = hydratedCoordinator(async () => { throw new Error("zombie write"); });
    const reservation = coordinator.reserveDeferred(A);
    assert.equal(coordinator.discardDeferred(reservation), true, mode);
    assert.equal((await coordinator.activateDeferred(reservation)).status, "discarded", mode);
    assert.deepEqual(coordinator.getState().displayed, C);
  }

  const failureFixture = createMergeFixture("appearance-write-failure");
  let failureStorage = C;
  try {
    const parsed = parseLibraryBackup(JSON.stringify(v4({ pins: [pin()] })));
    const persistenceFailure = hydratedCoordinator(async () => {
      throw new Error("write failed");
    }, C);
    const reservation = persistenceFailure.reserveDeferred(A);
    const data = await mergeParsedPayload(failureFixture, parsed.payload);
    assert.equal(data.inserted, 1);
    assert.equal(data.pins.inserted, 1);
    assertDataPersisted(failureFixture);
    const failed = await persistenceFailure.activateDeferred(reservation);
    assert.equal(failed.status, "persistence-failure");
    assert.deepEqual(persistenceFailure.getState().displayed, C);
    assert.deepEqual(persistenceFailure.getState().confirmedPersisted, C);
    assert.deepEqual(failureStorage, C);
    assertDataPersisted(failureFixture);
  } finally {
    failureFixture.close();
  }
}

function testQueueAndTransactionStructure() {
  const savedTitles = fs.readFileSync(path.join(repoRoot, "src/storage/savedTitlesRepo.ts"), "utf8");
  const mergePublic = savedTitles.slice(savedTitles.indexOf("export async function mergeLibraryBackup("),
    savedTitles.indexOf("export async function deleteSavedTitle("));
  assert.equal((mergePublic.match(/runSerializedStorageMutation/g) || []).length, 1);
  assert.equal((mergePublic.match(/withTransactionAsync/g) || []).length, 1);

  const mergeHelper = fs.readFileSync(path.join(repoRoot,
    "src/storage/libraryBackupMerge.ts"), "utf8");
  assert.equal((mergeHelper.match(/\.withTransactionAsync\(/g) || []).length, 0);

  const appearanceRepo = fs.readFileSync(path.join(repoRoot,
    "src/storage/appearancePreferencesRepo.ts"), "utf8");
  const publicSetter = appearanceRepo.slice(appearanceRepo.indexOf(
    "export async function setAppearancePreference("));
  assert.equal((publicSetter.match(/runSerializedStorageMutation/g) || []).length, 1);
  assert.equal((publicSetter.match(/withTransactionAsync/g) || []).length, 1);

  const settings = fs.readFileSync(path.join(repoRoot, "app/(tabs)/ajustes.tsx"), "utf8");
  assert.match(settings, /reserveDeferred\([\s\S]*await mergeLibraryBackup\([\s\S]*await activateDeferred\(/);
  assert.match(settings, /catch[\s\S]*discardDeferred\(/);
  assert.doesNotMatch(settings, /setAppearancePreferenceWithDb|withTransactionAsync|runSerializedStorageMutation/);
}

(async () => {
  testV4CreatorAndParser();
  await testHistoricalCompatibility();
  await testReadErrorRoundTripAndUnknownPaletteRestore();
  await testExportAvailabilityAndDeferredConcurrency();
  await testRealImportLifecycle();
  testQueueAndTransactionStructure();
  console.log("Section 11 global appearance backup verification passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

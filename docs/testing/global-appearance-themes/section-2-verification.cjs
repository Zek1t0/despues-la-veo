const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};

const repoRoot = path.resolve(__dirname, "../../..");
const preferenceModule = require("../../../src/theme/appearancePreference.ts");
const { AppearanceCoordinator } = require("../../../src/theme/appearanceCoordinator.ts");
const { getAppearanceBackupAvailability } = require("../../../src/theme/appearanceBackupAvailability.ts");
const { resolveAppearanceTheme, resolveEffectiveScheme } = require("../../../src/theme/resolver.ts");
const { runSerializedStorageMutation } = require("../../../src/storage/storageMutationQueue.ts");
const { DEFAULT_APPEARANCE_PREFERENCE, parseSerializedAppearance,
  serializeAppearancePreference } = preferenceModule;

const pref = (scheme, palette) => ({ version: 1, scheme, palette });
const C = pref("dark", "original");
const A = pref("light", "tide");
const B = pref("system", "lavender");
const P = pref("system", "pinky-clouds");

function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function testParser() {
  assert.deepEqual(DEFAULT_APPEARANCE_PREFERENCE, C);
  assert.equal(parseSerializedAppearance(JSON.stringify(B)).status, "valid");
  assert.deepEqual(parseSerializedAppearance(JSON.stringify(P)), {
    status: "valid", preference: P,
  });
  for (const value of ["{", JSON.stringify({ ...B, version: 2 }),
    JSON.stringify({ ...B, scheme: "auto" }), JSON.stringify({ ...B, palette: "unknown" }),
    JSON.stringify({ ...B, extra: true })]) {
    assert.equal(parseSerializedAppearance(value).status, "invalid");
  }
  const input = { ...B };
  parseSerializedAppearance(JSON.stringify(input));
  assert.deepEqual(input, B);
  assert.equal(serializeAppearancePreference(B),
    '{"version":1,"scheme":"system","palette":"lavender"}');
  assert.equal(serializeAppearancePreference(P),
    '{"version":1,"scheme":"system","palette":"pinky-clouds"}');
}

async function loadRepoFixture() {
  const counters = { init: 0, queue: 0, transaction: 0, run: 0 };
  let row = null;
  let failRun = false;
  let failRead = false;
  const db = {
    async getFirstAsync() {
      if (failRead) { failRead = false; throw new Error("read failed"); }
      return row;
    },
    async runAsync(_sql, key, value, updatedAt) {
      counters.run += 1;
      if (failRun) { failRun = false; throw new Error("write failed"); }
      row = { key, value, updated_at: updatedAt };
    },
    async withTransactionAsync(task) { counters.transaction += 1; await task(); },
  };
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (parent?.filename?.endsWith("appearancePreferencesRepo.ts") && request === "./db") {
      return { initDb: async () => { counters.init += 1; return db; } };
    }
    if (parent?.filename?.endsWith("appearancePreferencesRepo.ts") &&
        request === "./storageMutationQueue") {
      return { runSerializedStorageMutation: (task) => {
        counters.queue += 1;
        return runSerializedStorageMutation(task);
      } };
    }
    return originalLoad.apply(this, arguments);
  };
  const filename = require.resolve("../../../src/storage/appearancePreferencesRepo.ts");
  delete require.cache[filename];
  const repo = require(filename);
  Module._load = originalLoad;
  return { repo, counters, db, setRow(value) { row = value; },
    failNextRead() { failRead = true; }, failNext() { failRun = true; } };
}

async function testRepositoryAndStorageStructure() {
  const fixture = await loadRepoFixture();
  assert.equal(fixture.repo.APPEARANCE_PREFERENCE_KEY, "appearance");
  assert.equal((await fixture.repo.getAppearancePreference()).status, "absent");
  fixture.setRow({ value: JSON.stringify(B), updated_at: 7 });
  assert.deepEqual(await fixture.repo.getAppearancePreference(),
    { status: "valid", preference: B, updatedAt: 7 });
  fixture.setRow({ value: "{", updated_at: 7 });
  assert.equal((await fixture.repo.getAppearancePreference()).status, "invalid");
  fixture.failNextRead();
  assert.equal((await fixture.repo.getAppearancePreference()).status, "error");
  await fixture.repo.setAppearancePreference(B);
  assert.deepEqual(fixture.counters, { init: 5, queue: 1, transaction: 1, run: 1 });
  fixture.failNext();
  await assert.rejects(fixture.repo.setAppearancePreference(A));
  await fixture.repo.setAppearancePreference(C);
  assert.equal(fixture.counters.queue, 3);
  assert.equal(fixture.counters.transaction, 3);
  const source = fs.readFileSync(path.join(repoRoot,
    "src/storage/appearancePreferencesRepo.ts"), "utf8");
  const helper = source.slice(source.indexOf("export async function setAppearancePreferenceWithDb"),
    source.indexOf("export async function setAppearancePreference("));
  assert.doesNotMatch(helper, /initDb|runSerializedStorageMutation|withTransactionAsync|setAppearancePreference\(/);
  assert.match(source, /const db = await initDb\(\);[\s\S]*runSerializedStorageMutation\(\(\) =>[\s\S]*db\.withTransactionAsync\(\(\) =>[\s\S]*setAppearancePreferenceWithDb\(db, preference, updatedAt\)/);
}

function hydratedCoordinator(writer, baseline = C) {
  const coordinator = new AppearanceCoordinator(writer);
  const token = coordinator.beginHydration();
  coordinator.completeHydration(token, { status: "valid", preference: baseline, updatedAt: 1 });
  return coordinator;
}

async function testASuccessBFailure() {
  const first = deferred();
  let calls = 0;
  const coordinator = hydratedCoordinator(() => ++calls === 1 ? first.promise : Promise.reject(new Error("B")));
  const a = coordinator.select(A); await tick();
  const b = coordinator.select(B); first.resolve(); await a;
  assert.deepEqual(coordinator.getState().displayed, B);
  assert.deepEqual(coordinator.getState().confirmedPersisted, A);
  await assert.rejects(b);
  assert.deepEqual(coordinator.getState().displayed, A);
  assert.deepEqual(coordinator.getState().confirmedPersisted, A);
}

async function testCoalescingAndRapidIntents() {
  const writes = [];
  const coordinator = hydratedCoordinator(async (value) => { writes.push(value); });
  const a = coordinator.select(A);
  const b = coordinator.select(B);
  await Promise.all([a, b]);
  assert.deepEqual(writes, [B]);
  assert.deepEqual(coordinator.getState().confirmedPersisted, B);
  const values = [A, C, B, A];
  await Promise.all(values.map((value) => coordinator.select(value)));
  assert.deepEqual(writes.at(-1), A);
  assert.deepEqual(coordinator.getState().displayed, A);
}

async function testSupersededResultsAndRetry() {
  const first = deferred();
  let calls = 0;
  const coordinator = hydratedCoordinator(() => ++calls === 1 ? first.promise : Promise.resolve());
  const a = coordinator.select(A); await tick();
  const b = coordinator.select(B);
  first.reject(new Error("superseded"));
  await assert.rejects(a); await b;
  assert.deepEqual(coordinator.getState().displayed, B);
  assert.deepEqual(coordinator.getState().confirmedPersisted, B);

  let fail = true;
  const retry = hydratedCoordinator(async () => { if (fail) { fail = false; throw new Error("once"); } });
  await assert.rejects(retry.select(A));
  assert.deepEqual(retry.getState().displayed, C);
  assert.equal(await retry.retryWrite(), true);
  assert.deepEqual(retry.getState().displayed, A);
  assert.deepEqual(retry.getState().confirmedPersisted, A);
}

async function testNoTrustworthyConfirmed() {
  for (const result of [{ status: "invalid" }, { status: "error", error: new Error("read") }]) {
    const coordinator = new AppearanceCoordinator(async () => { throw new Error("write"); });
    coordinator.completeHydration(coordinator.beginHydration(), result);
    assert.equal(coordinator.getState().confirmedPersisted, null);
    await assert.rejects(coordinator.select(B));
    assert.deepEqual(coordinator.getState().displayed, C);
    assert.equal(coordinator.getState().confirmedPersisted, null);
  }
}

async function testInvalidHydrationIsRepairedBySuccessfulWrite() {
  const direct = new AppearanceCoordinator(async () => {});
  direct.completeHydration(direct.beginHydration(), { status: "invalid" });
  assert.equal(direct.getState().hydrationStatus, "invalid");
  await direct.select(B);
  assert.deepEqual(direct.getState().displayed, B);
  assert.deepEqual(direct.getState().confirmedPersisted, B);
  assert.equal(direct.getState().hydrationStatus, "ready");
  assert.equal(direct.getState().storageError, null);

  let fail = true;
  const retried = new AppearanceCoordinator(async () => {
    if (fail) { fail = false; throw new Error("first write failed"); }
  });
  retried.completeHydration(retried.beginHydration(), { status: "invalid" });
  await assert.rejects(retried.select(B));
  assert.equal(retried.getState().hydrationStatus, "invalid");
  assert.equal(await retried.retryWrite(), true);
  assert.deepEqual(retried.getState().displayed, B);
  assert.deepEqual(retried.getState().confirmedPersisted, B);
  assert.equal(retried.getState().hydrationStatus, "ready");
  assert.equal(retried.getState().storageError, null);

  const readError = new AppearanceCoordinator(async () => {});
  readError.completeHydration(readError.beginHydration(),
    { status: "error", error: new Error("read failed") });
  await readError.select(B);
  assert.equal(readError.getState().hydrationStatus, "error");
  assert.equal(readError.getState().storageError.operation, "read");
}

async function testPersistenceRetryUsesFailedIntent() {
  const writes = [];
  let fail = true;
  const coordinator = hydratedCoordinator(async (value) => {
    writes.push(value);
    if (fail) { fail = false; throw new Error("B failed"); }
  }, A);
  await assert.rejects(coordinator.select(B));
  assert.deepEqual(coordinator.getState().displayed, A);
  assert.deepEqual(coordinator.getState().latestIntent.preference, B);
  const retry = coordinator.retryWrite();
  assert.deepEqual(coordinator.getState().displayed, B);
  assert.equal(await retry, true);
  assert.deepEqual(writes, [B, B]);
  assert.deepEqual(coordinator.getState().confirmedPersisted, B);
  assert.deepEqual(coordinator.getState().displayed, B);

  for (const initial of [{ status: "invalid" },
    { status: "error", error: new Error("read") }]) {
    const attempted = [];
    let rejectFirst = true;
    const untrusted = new AppearanceCoordinator(async (value) => {
      attempted.push(value);
      if (rejectFirst) { rejectFirst = false; throw new Error("B failed"); }
    });
    untrusted.completeHydration(untrusted.beginHydration(), initial);
    await assert.rejects(untrusted.select(B));
    assert.deepEqual(untrusted.getState().displayed, C);
    assert.equal(untrusted.getState().confirmedPersisted, null);
    assert.equal(await untrusted.retryWrite(), true);
    assert.deepEqual(attempted, [B, B]);
    assert.deepEqual(untrusted.getState().displayed, B);
    assert.deepEqual(untrusted.getState().confirmedPersisted, B);
  }

  const noFailedWrite = new AppearanceCoordinator(async (value) => writes.push(value));
  noFailedWrite.completeHydration(noFailedWrite.beginHydration(),
    { status: "error", error: new Error("read") });
  const countBefore = writes.length;
  assert.equal(await noFailedWrite.retryWrite(), false);
  assert.equal(writes.length, countBefore);
  assert.equal(noFailedWrite.getState().confirmedPersisted, null);
}

async function testWriteCompletionInvalidatesReads() {
  const writeB = deferred();
  const coordinator = hydratedCoordinator(() => writeB.promise, A);
  const selection = coordinator.select(B);
  await tick();
  const retry = coordinator.beginHydration();
  writeB.resolve();
  await selection;
  assert.equal(coordinator.completeHydration(retry,
    { status: "valid", preference: A, updatedAt: 1 }), false);
  assert.deepEqual(coordinator.getState().displayed, B);
  assert.deepEqual(coordinator.getState().confirmedPersisted, B);

  const writeA = deferred();
  let call = 0;
  const strong = hydratedCoordinator(() => ++call === 1
    ? writeA.promise : Promise.reject(new Error("B failed")), C);
  const a = strong.select(A);
  await tick();
  const b = strong.select(B);
  const oldRetry = strong.beginHydration();
  writeA.resolve();
  await a;
  await assert.rejects(b);
  assert.equal(strong.completeHydration(oldRetry,
    { status: "valid", preference: C, updatedAt: 1 }), false);
  assert.deepEqual(strong.getState().displayed, A);
  assert.deepEqual(strong.getState().confirmedPersisted, A);
}

async function testHydrationAndStaleReads() {
  const coordinator = new AppearanceCoordinator(async () => {});
  assert.equal(coordinator.getState().isHydrationGateOpen, false);
  coordinator.completeHydration(coordinator.beginHydration(), { status: "absent" });
  assert.equal(coordinator.getState().hydrationStatus, "ready");
  assert.deepEqual(coordinator.getState().displayed, C);
  assert.equal(coordinator.getState().confirmedPersisted, null);

  const absentFailure = new AppearanceCoordinator(async () => { throw new Error("B"); });
  absentFailure.completeHydration(absentFailure.beginHydration(), { status: "absent" });
  await assert.rejects(absentFailure.select(B));
  assert.deepEqual(absentFailure.getState().displayed, C);
  assert.equal(absentFailure.getState().confirmedPersisted, null);

  const retryToken = coordinator.beginHydration();
  await coordinator.select(B);
  assert.equal(coordinator.completeHydration(retryToken,
    { status: "valid", preference: A, updatedAt: 1 }), false);
  assert.deepEqual(coordinator.getState().displayed, B);
  assert.deepEqual(coordinator.getState().confirmedPersisted, B);

  const failure = hydratedCoordinator(async () => { throw new Error("B"); }, A);
  const oldRetry = failure.beginHydration();
  await assert.rejects(failure.select(B));
  assert.equal(failure.completeHydration(oldRetry,
    { status: "valid", preference: C, updatedAt: 1 }), false);
  assert.deepEqual(failure.getState().displayed, A);
  assert.deepEqual(failure.getState().confirmedPersisted, A);

  const recover = new AppearanceCoordinator(async () => {});
  recover.completeHydration(recover.beginHydration(), { status: "error", error: new Error("read") });
  recover.completeHydration(recover.beginHydration(), { status: "valid", preference: A, updatedAt: 2 });
  assert.equal(recover.getState().hydrationStatus, "ready");
  assert.deepEqual(recover.getState().confirmedPersisted, A);

  const disposed = new AppearanceCoordinator(async () => {});
  const late = disposed.beginHydration();
  disposed.dispose();
  assert.equal(disposed.completeHydration(late,
    { status: "valid", preference: A, updatedAt: 2 }), false);
}

async function testDeferredCoordinatorBoundary() {
  const writes = [];
  const coordinator = hydratedCoordinator(async (value) => { writes.push(value); });
  const initial = coordinator.getState();
  const reservedA = coordinator.reserveDeferred(A);
  assert.deepEqual(coordinator.getState().displayed, initial.displayed);
  assert.deepEqual(coordinator.getState().confirmedPersisted, initial.confirmedPersisted);
  assert.equal(writes.length, 0);
  assert.equal(coordinator.getState().revision, initial.revision + 1);
  const applied = await coordinator.activateDeferred(reservedA);
  assert.equal(applied.status, "applied");
  assert.deepEqual(writes, [A]);
  assert.deepEqual(coordinator.getState().displayed, A);
  assert.deepEqual(coordinator.getState().confirmedPersisted, A);
  assert.equal(coordinator.getState().latestIntent.id, initial.revision + 1);
  assert.equal(coordinator.getState().revision, initial.revision + 1);

  const superseded = hydratedCoordinator(async (value) => { writes.push(value); });
  const old = superseded.reserveDeferred(A);
  await superseded.select(B);
  assert.equal((await superseded.activateDeferred(old)).status, "superseded");
  assert.deepEqual(superseded.getState().displayed, B);

  const repeated = hydratedCoordinator(async () => {});
  const first = repeated.reserveDeferred(A);
  const firstOrder = repeated.getState().revision;
  const second = repeated.reserveDeferred(B);
  assert.equal(repeated.getState().revision, firstOrder + 1);
  assert.equal((await repeated.activateDeferred(first)).status, "superseded");
  assert.equal((await repeated.activateDeferred(second)).status, "applied");

  const discarded = hydratedCoordinator(async () => { throw new Error("must not write"); });
  const discardedHandle = discarded.reserveDeferred(A);
  const discardedOrder = discarded.getState().revision;
  const beforeDiscard = discarded.getState();
  assert.equal(discarded.discardDeferred(discardedHandle), true);
  assert.deepEqual(discarded.getState(), beforeDiscard);
  assert.equal((await discarded.activateDeferred(discardedHandle)).status, "discarded");
  const afterDiscard = discarded.reserveDeferred(B);
  assert.equal(discarded.getState().revision, discardedOrder + 1);
  discarded.discardDeferred(afterDiscard);

  const failing = hydratedCoordinator(async () => { throw new Error("activation failed"); }, C);
  const failure = await failing.activateDeferred(failing.reserveDeferred(A));
  assert.equal(failure.status, "persistence-failure");
  assert.deepEqual(failing.getState().displayed, C);
  assert.deepEqual(failing.getState().confirmedPersisted, C);
}

async function testNormalWriteLifecycleDuringDeferredReservation() {
  const successfulWrites = [];
  const success = hydratedCoordinator(async (value) => { successfulWrites.push(value); });
  const writeB = success.select(B);
  const reservedA = success.reserveDeferred(A);
  await writeB;
  assert.deepEqual(successfulWrites, [B]);
  assert.deepEqual(success.getState().displayed, B);
  assert.deepEqual(success.getState().confirmedPersisted, B);
  assert.equal(getAppearanceBackupAvailability(success.getState()).preference, B);
  success.discardDeferred(reservedA);
  assert.deepEqual(success.getState().displayed, B);
  assert.deepEqual(success.getState().confirmedPersisted, B);

  const failedWrite = deferred();
  const failure = hydratedCoordinator(() => failedWrite.promise, C);
  const failingB = failure.select(B);
  await tick();
  const pendingA = failure.reserveDeferred(A);
  failedWrite.reject(new Error("B failed"));
  await assert.rejects(failingB);
  assert.deepEqual(failure.getState().displayed, C);
  assert.deepEqual(failure.getState().confirmedPersisted, C);
  failure.discardDeferred(pendingA);
  assert.deepEqual(failure.getState().displayed, C);

  const activationWrites = [];
  const activation = hydratedCoordinator(async (value) => { activationWrites.push(value); }, C);
  await activation.select(B);
  const laterA = activation.reserveDeferred(A);
  assert.equal((await activation.activateDeferred(laterA)).status, "applied");
  assert.deepEqual(activationWrites, [B, A]);
  assert.deepEqual(activation.getState().confirmedPersisted, A);

  const laterSelection = hydratedCoordinator(async () => {});
  const importA = laterSelection.reserveDeferred(A);
  await laterSelection.select(B);
  assert.equal((await laterSelection.activateDeferred(importA)).status, "superseded");
}

async function testReusableEffectLifecycleAndPureBoundary() {
  const coordinator = new AppearanceCoordinator(async () => {});
  let publications = 0;
  const unsubscribeFirst = coordinator.subscribe(() => { publications += 1; });
  const firstRead = coordinator.beginHydration();
  unsubscribeFirst();
  coordinator.invalidateHydration();
  const unsubscribeSecond = coordinator.subscribe(() => { publications += 1; });
  const secondRead = coordinator.beginHydration();
  assert.equal(coordinator.completeHydration(firstRead,
    { status: "valid", preference: A, updatedAt: 1 }), false);
  assert.equal(coordinator.completeHydration(secondRead,
    { status: "valid", preference: B, updatedAt: 2 }), true);
  assert.deepEqual(coordinator.getState().displayed, B);
  assert.ok(publications > 0);
  unsubscribeSecond();

  const providerSource = fs.readFileSync(path.join(repoRoot,
    "src/theme/AppThemeProvider.tsx"), "utf8");
  assert.doesNotMatch(providerSource, /return \(\) =>\s*\{[^}]*coordinator\.dispose\(\)/s);
  assert.match(providerSource, /unsubscribe\(\);\s*coordinator\.invalidateHydration\(\);/);
  const coordinatorSource = fs.readFileSync(path.join(repoRoot,
    "src/theme/appearanceCoordinator.ts"), "utf8");
  assert.doesNotMatch(coordinatorSource, /from ["']\.\.\/storage\//);
}

async function testSystemRuntime() {
  assert.equal(resolveEffectiveScheme("system", "light"), "light");
  assert.equal(resolveEffectiveScheme("system", "dark"), "dark");
  assert.equal(resolveEffectiveScheme("dark", "light"), "dark");
  assert.equal(resolveAppearanceTheme(B, "light").paletteId, "lavender");
  assert.equal(resolveAppearanceTheme(B, "dark").paletteId, "lavender");
  assert.equal(B.scheme, "system");
  assert.equal(resolveAppearanceTheme(P, "light").paletteId, "pinky-clouds");
  assert.equal(resolveAppearanceTheme(P, "light").effectiveScheme, "light");
  assert.equal(resolveAppearanceTheme(P, "dark").paletteId, "pinky-clouds");
  assert.equal(resolveAppearanceTheme(P, "dark").effectiveScheme, "dark");

  let restartedPreference = C;
  const persisted = hydratedCoordinator(async (value) => { restartedPreference = value; });
  await persisted.select(P);
  const restarted = hydratedCoordinator(async () => {}, restartedPreference);
  assert.deepEqual(restarted.getState().displayed, P);
  assert.deepEqual(restarted.getState().confirmedPersisted, P);
}

async function testGlobalQueueRecovery() {
  await assert.rejects(runSerializedStorageMutation(async () => { throw new Error("queue"); }));
  assert.equal(await runSerializedStorageMutation(async () => "alive"), "alive");
}

(async () => {
  await testParser();
  await testRepositoryAndStorageStructure();
  await testASuccessBFailure();
  await testCoalescingAndRapidIntents();
  await testSupersededResultsAndRetry();
  await testNoTrustworthyConfirmed();
  await testInvalidHydrationIsRepairedBySuccessfulWrite();
  await testPersistenceRetryUsesFailedIntent();
  await testWriteCompletionInvalidatesReads();
  await testHydrationAndStaleReads();
  await testDeferredCoordinatorBoundary();
  await testNormalWriteLifecycleDuringDeferredReservation();
  await testReusableEffectLifecycleAndPureBoundary();
  await testSystemRuntime();
  await testGlobalQueueRecovery();
  console.log("Section 2 global appearance verification passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

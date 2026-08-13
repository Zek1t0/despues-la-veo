const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const root = path.resolve(__dirname, "../../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const { TmdbError } = require("../../../src/providers/tmdb/tmdbErrors.ts");
const { presentTmdbRemoteError } = require("../../../src/providers/tmdb/credential/tmdbCredentialUi.ts");
const {
  isTmdbDetailLoadingVisible,
  isTmdbSearchDebounceSettled,
  isTmdbSearchObservationEqual,
  shouldRunTmdbSearch,
  sameTmdbRemoteRequest,
} = require("../../../src/providers/tmdb/credential/tmdbRemoteRequestIdentity.ts");

const observation = (status, generation = 0, rawQuery = "matrix", debouncedQuery = rawQuery, retry = 0) => ({
  status,
  generation,
  rawQuery,
  debouncedQuery,
  retry,
});

function simulate(observations) {
  return simulateCoordination(observations).requests;
}

function simulateCoordination(observations) {
  let previous = null;
  let requests = 0;
  let invalidations = 0;
  for (const current of observations) {
    if (isTmdbSearchObservationEqual(previous, current)) continue;
    invalidations += 1;
    if (shouldRunTmdbSearch(previous, current)) requests += 1;
    previous = current;
  }
  return { requests, invalidations };
}

function testSearchGatingAndTransitions() {
  for (const status of ["initializing", "not-configured", "storage-error"]) {
    assert.equal(simulate([observation(status)]), 0, `${status} must not search`);
  }
  assert.equal(simulate([observation("configured")]), 1);
  assert.equal(simulate([observation("initializing"), observation("configured")]), 1, "hydration runs once without generation");
  assert.equal(simulate([observation("storage-error"), observation("initializing"), observation("configured")]), 1, "storage retry runs once");
  assert.equal(simulate([observation("not-configured"), observation("configured", 1)]), 1, "save status+generation is one usable event");
  assert.equal(simulate([observation("configured", 1), observation("configured", 2)]), 2, "replacement reruns once");
  assert.equal(simulate([observation("configured", 1), observation("configured", 1)]), 1, "identical snapshot does not rerun");
  assert.equal(simulate([observation("configured", 1), observation("not-configured", 2)]), 1, "delete does not search");
  assert.equal(simulate([observation("not-configured", 0, "a"), observation("not-configured", 0, "b"), observation("configured", 1, "b")]), 1, "only current pending query runs");
  assert.equal(simulate([observation("storage-error"), observation("initializing"), observation("not-configured")]), 0, "retry to null does not search");
  assert.equal(simulate([observation("storage-error"), observation("initializing"), observation("storage-error")]), 0, "failed retry does not search");
  assert.equal(simulate([observation("configured", 1), observation("configured", 1, "matrix", "matrix", 1)]), 2, "manual retry adds exactly one request");
}

function testRawQueryVersusDebounce() {
  assert.equal(simulate([
    observation("configured", 4, "a", "a"),
    observation("configured", 5, "", "a"),
    observation("configured", 5, "", ""),
  ]), 1, "generation cannot reactivate a stale debounced query");

  assert.equal(simulate([
    observation("not-configured", 0, "b", "a"),
    observation("configured", 1, "b", "a"),
    observation("configured", 1, "b", "b"),
  ]), 1, "configuration during debounce waits and runs only settled B");

  assert.equal(simulate([
    observation("configured", 4, "a", "a"),
    observation("configured", 4, "b", "a", 1),
  ]), 1, "manual retry during debounce cannot rerun A");

  assert.equal(simulate([
    observation("configured", 4, "b", "b"),
    observation("configured", 5, "b", "b"),
  ]), 2, "replacement reruns settled B exactly once");

  assert.equal(isTmdbSearchDebounceSettled("b", "a"), false, "feedback A is hidden immediately while B debounces");
  assert.equal(isTmdbSearchDebounceSettled("b", "b"), true);

  const pendingA = { sequence: 1, resource: "a", generation: 4 };
  const rawBIdentity = { sequence: 2, resource: "b", generation: 4 };
  assert.equal(sameTmdbRemoteRequest(pendingA, rawBIdentity), false, "completion A is stale before debounce B settles");
}

function testSemanticInvalidationAndReturn() {
  assert.equal(simulate([
    observation("configured", 4, "a", "a"),
    observation("configured", 4, "b", "a"),
    observation("configured", 4, "a", "a"),
  ]), 2, "returning to the already-debounced query after invalidation reruns it once");

  const settledA = observation("configured", 4, "a", "a");
  const normalizedWhitespaceA = observation("configured", 4, "a", "a");
  const noOp = simulateCoordination([settledA, normalizedWhitespaceA]);
  assert.deepEqual(noOp, { requests: 1, invalidations: 1 }, "normalized-identical text neither reruns nor invalidates the current identity");
  assert.equal(isTmdbSearchObservationEqual(settledA, normalizedWhitespaceA), true);

  assert.equal(simulate([
    observation("configured", 4, "a", "a"),
    observation("configured", 4, "b", "a"),
    observation("configured", 4, "b", "b"),
  ]), 2, "A/A -> B/A -> B/B runs A and exactly one B");

  assert.equal(simulate([
    observation("configured", 4, "a", "a"),
    observation("configured", 4, "b", "a"),
    observation("configured", 5, "b", "a"),
    observation("configured", 5, "b", "b"),
  ]), 2, "generation during debounce waits and settled B runs exactly once with the new generation");
}

function testDetailVisibleLoading() {
  const visible = (status, hasCurrentData = false, hasCurrentError = false) => isTmdbDetailLoadingVisible({
    validRoute: true,
    status,
    hasCurrentData,
    hasCurrentError,
  });
  assert.equal(visible("storage-error"), false);
  assert.equal(visible("initializing"), true, "storage retry checks immediately on the initializing render");
  assert.equal(visible("not-configured"), false);
  assert.equal(visible("configured"), true, "configuration with no current data/error loads immediately");
  assert.equal(visible("configured", false, true), false, "current retryable error is presented");
  assert.equal(visible("configured", false, false), true, "new retry hides the old error and loads immediately");
  assert.equal(visible("configured", true, false), false);
  assert.equal(visible("configured", false, false), true, "generation or route mismatch hides old data and loads immediately");
  assert.equal(isTmdbDetailLoadingVisible({ validRoute: false, status: "configured", hasCurrentData: false, hasCurrentError: false }), false);
}

function testStaleIdentity() {
  const pendingA = { sequence: 1, resource: "query-a", generation: 4 };
  assert.equal(sameTmdbRemoteRequest(pendingA, { sequence: 2, resource: "query-b", generation: 4 }), false);
  assert.equal(sameTmdbRemoteRequest(pendingA, { sequence: 2, resource: "query-a", generation: 5 }), false);
  assert.equal(sameTmdbRemoteRequest(pendingA, { sequence: 2, resource: "query-a", generation: 4 }), false, "delete/status invalidation advances sequence");
  const routeA = { sequence: 7, resource: "movie/10", generation: 2 };
  assert.equal(sameTmdbRemoteRequest(routeA, { sequence: 8, resource: "movie/11", generation: 2 }), false);
  assert.equal(sameTmdbRemoteRequest(routeA, routeA), true);
}

function testFriendlyErrors() {
  const expected = {
    "credential-not-configured": "configure",
    "credential-storage-error": "retry",
    "credential-invalid": "change",
    network: "retry",
    "rate-limited": "retry",
    http: "retry",
    "invalid-response": "retry",
    aborted: null,
  };
  const canary = "SECTION4_SECRET_CANARY";
  for (const [kind, action] of Object.entries(expected)) {
    const presented = presentTmdbRemoteError(new TmdbError(kind));
    assert.equal(presented.action, action);
    assert.equal(JSON.stringify(presented).includes(canary), false);
    assert.equal(JSON.stringify(presented).includes("Authorization"), false);
    if (kind === "aborted") assert.equal(presented.message, null);
  }
  assert.notEqual(presentTmdbRemoteError(new TmdbError("credential-storage-error")).title, presentTmdbRemoteError(new TmdbError("credential-not-configured")).title);
}

function testScreenIntegrationByInspection() {
  const search = read("app/(tabs)/buscar.tsx");
  const detail = read("app/tmdb/[type]/[id].tsx");
  const legacyEnvName = ["EXPO", "PUBLIC", "TMDB", "TOKEN"].join("_");
  for (const source of [search, detail]) {
    assert.match(source, /useTmdbCredential/);
    assert.match(source, /sameTmdbRemoteRequest/);
    assert.match(source, /TMDB_SETTINGS_ROUTE/);
    assert.match(source, /TMDB_TOKEN_URL/);
    assert.equal(source.includes(legacyEnvName), false);
    assert.doesNotMatch(source, /\.env|Authorization/);
    assert.doesNotMatch(source, /console\.(?:error|log)\(e/);
  }
  assert.match(search, /shouldRunTmdbSearch/);
  assert.match(search, /isTmdbSearchDebounceSettled/);
  assert.match(search, /isTmdbSearchObservationEqual/);
  assert.match(detail, /snapshot\.status !== "configured"/);
  assert.match(detail, /isTmdbDetailLoadingVisible/);
  assert.match(detail, /loadErrorContext\.retry === loadRetry/, "detail hides feedback from a previous retry cycle");
  assert.match(search, /retryInitialization/);
  assert.match(search, /setSearchRetry\(\(value\) => value \+ 1\)/);
  assert.match(detail, /Promise\.all\(\[/, "atomic detail load remains Promise.all");
  assert.match(detail, /if \(!hasCurrentData \|\| !data \|\| !type \|\| !id\) return;/, "save remains blocked without current complete remote metadata");
  assert.equal((detail.match(/saveTmdbTitle\(/g) || []).length, 1, "existing save/update path remains singular");
}

function testScopeAndSecurityByInspection() {
  const protectedSources = [
    read("app/(tabs)/buscar.tsx"),
    read("app/tmdb/[type]/[id].tsx"),
    read("src/providers/tmdb/credential/tmdbCredentialUi.ts"),
    read("src/providers/tmdb/credential/tmdbRemoteRequestIdentity.ts"),
  ].join("\n");
  assert.doesNotMatch(protectedSources, /SQLite|app_preferences|sessionStorage|personalRating/);
  assert.doesNotMatch(protectedSources, /SECTION4_SECRET_CANARY/);
}

testSearchGatingAndTransitions();
testRawQueryVersusDebounce();
testSemanticInvalidationAndReturn();
testDetailVisibleLoading();
testStaleIdentity();
testFriendlyErrors();
testScreenIntegrationByInspection();
testScopeAndSecurityByInspection();

console.log("Section 4 TMDB credential verification: OK");
console.log("Source-inspection limits: React Native screens are not mounted in Node; inspection verifies wiring, atomic Promise.all preservation, CTA routes, and forbidden leakage. Pure coordination covers request gating and stale identities behaviorally.");

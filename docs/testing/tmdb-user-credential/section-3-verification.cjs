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
const { TmdbCredentialService } = require("../../../src/providers/tmdb/credential/TmdbCredentialService.ts");
const { TmdbError } = require("../../../src/providers/tmdb/tmdbErrors.ts");
const ui = require("../../../src/providers/tmdb/credential/tmdbCredentialUi.ts");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function memoryStore(initial = null) {
  let value = initial;
  const calls = { get: 0, set: 0, delete: 0 };
  return {
    calls,
    get value() { return value; },
    async get() { calls.get += 1; return value; },
    async set(token) { calls.set += 1; value = token; },
    async delete() { calls.delete += 1; value = null; },
  };
}

function testSettingsPresentations() {
  assert.deepEqual(ui.presentTmdbCredentialStatus({ status: "configured", tokenAvailable: true, generation: 1 }), { label: "Configurado", actionLabel: "Cambiar token" });
  assert.deepEqual(ui.presentTmdbCredentialStatus({ status: "not-configured", tokenAvailable: false, generation: 0 }), { label: "No configurado", actionLabel: "Configurar TMDB" });
  assert.equal(ui.presentTmdbCredentialStatus({ status: "initializing", tokenAvailable: false, generation: 0 }).label, "Comprobando configuración...");
  const storage = ui.presentTmdbCredentialStatus({ status: "storage-error", tokenAvailable: false, generation: 0 });
  assert.equal(storage.label, "No pudimos acceder a la configuración");
  assert.notEqual(storage.label, "No configurado");
}

async function testRetryInitializationUsesServiceOperation() {
  const first = deferred();
  let reads = 0;
  const store = {
    async get() { reads += 1; return reads === 1 ? first.promise : "stored-token"; },
    async set() {},
    async delete() {},
  };
  const service = new TmdbCredentialService(store, async () => {});
  const initial = service.initialize();
  first.reject(new Error("blocked"));
  await assert.rejects(initial);
  const snapshots = await Promise.all([service.retryInitialization(), service.retryInitialization(), service.retryInitialization()]);
  assert.equal(reads, 2, "concurrent retries must share the real service initialization");
  assert.equal(snapshots.every((snapshot) => snapshot.status === "configured"), true);
  assert.equal(snapshots[0].generation, 0);

  const absent = new TmdbCredentialService(memoryStore(null), async () => {});
  assert.equal((await absent.initialize()).status, "not-configured");

  let failures = 0;
  const failing = new TmdbCredentialService({ async get() { failures += 1; throw new Error("blocked"); }, async set() {}, async delete() {} }, async () => {});
  await assert.rejects(() => failing.initialize());
  await assert.rejects(() => failing.retryInitialization());
  assert.equal(failures, 2);
  assert.equal(failing.getSnapshot().status, "storage-error");
}

async function testChangeAndRemoveCoreBehavior() {
  const candidateA = "configured-a";
  const candidateB = "candidate-b";
  const store = memoryStore(candidateA);
  const service = new TmdbCredentialService(store, async (candidate) => {
    if (candidate === candidateB) throw new TmdbError("network");
  });
  await service.initialize();
  const before = service.getSnapshot();
  await assert.rejects(() => service.save(candidateB), (error) => error.kind === "network");
  assert.equal(service.getSnapshot().status, "configured");
  assert.equal(service.getSnapshot().generation, before.generation);
  assert.equal(await service.resolveToken(), candidateA);
  assert.equal(store.calls.set, 0);

  const failureStore = memoryStore(candidateA);
  failureStore.delete = async () => { failureStore.calls.delete += 1; throw new Error("blocked"); };
  const deletionFailure = new TmdbCredentialService(failureStore, async () => {});
  await deletionFailure.initialize();
  await assert.rejects(() => deletionFailure.delete(), (error) => error.kind === "credential-storage-error");
  assert.equal(deletionFailure.getSnapshot().status, "configured");
  assert.equal(await deletionFailure.resolveToken(), candidateA);

  const deletionSuccess = new TmdbCredentialService(memoryStore(candidateA), async () => {});
  await deletionSuccess.initialize();
  assert.equal((await deletionSuccess.delete()).status, "not-configured");
}

function testFriendlyErrors() {
  const kinds = ["credential-invalid", "network", "rate-limited", "http", "invalid-response", "credential-storage-error"];
  for (const kind of kinds) {
    const result = ui.presentTmdbMutationError(new TmdbError(kind));
    assert.equal(typeof result.message, "string");
    assert.equal(result.message.includes(kind), false);
  }
  assert.match(ui.presentTmdbMutationError(new TmdbError("credential-invalid")).message, /no es válido/);
  assert.equal(ui.presentTmdbMutationError(new TmdbError("aborted")).message, null);
}

function testReactNativeSourceContracts() {
  const settings = read("app/(tabs)/ajustes.tsx");
  const screen = read("app/settings/tmdb.tsx");
  const layout = read("app/_layout.tsx");
  const provider = read("src/providers/tmdb/credential/TmdbCredentialProvider.tsx");
  const types = read("src/providers/tmdb/credential/tmdbCredentialTypes.ts");
  const relevantSource = [settings, screen, layout, provider, types].join("\n");

  assert.match(settings, /Exportar biblioteca/);
  assert.match(settings, /Importar biblioteca/);
  assert.match(settings, /retryInitialization/);
  assert.match(settings, /router\.push\(TMDB_SETTINGS_ROUTE\)/);
  assert.equal(ui.TMDB_SETTINGS_ROUTE, "/settings/tmdb");
  assert.match(layout, /name="settings\/tmdb"/);
  assert.match(layout, /name="settings\/tmdb" options=\{\{ title: "Configurar TMDB" \}\}/);
  assert.doesNotMatch(layout, /name="settings\/tmdb"[^\n]*presentation:\s*"modal"/);
  assert.doesNotMatch(layout, /name="settings\/tmdb"[^\n]*headerShown:\s*false/);
  assert.doesNotMatch(screen, /router\.back\(\)/);
  assert.doesNotMatch(screen, /from "expo-router"/);
  assert.doesNotMatch(screen, />\s*Configurar TMDB\s*<\/Text>/, "the Stack header owns the visible title");

  assert.match(screen, /useState\(""\)/, "candidate starts empty");
  assert.match(screen, /secureTextEntry=\{hidden\}/);
  assert.match(screen, /useState\(true\)/, "secure input starts hidden");
  assert.match(screen, /Mostrar token/);
  assert.match(screen, /Ocultar token/);
  assert.match(screen, /candidate\.trim\(\) === ""/);
  assert.match(screen, /tmdbCredentialService\.save\(candidate\)/);
  assert.doesNotMatch(screen, /tmdbCredentialService\.save\(candidate\.trim\(\)\)/);
  assert.match(screen, /editable=\{!operationPending\}/, "candidate input is frozen while an operation is pending");
  assert.match(screen, /if \(operationRef\.current === null\) \{\s*setCandidate\(value\);\s*setFeedback\(null\);\s*setSaveRetryable\(false\)/, "editing clears feedback and retry state owned by the previous candidate");
  assert.match(screen, /const operationRef = useRef<PendingOperation>\(null\)/);
  assert.match(screen, /if \(operationRef\.current !== null\) return false/);
  assert.match(screen, /operationRef\.current = operation/);
  assert.match(screen, /operationRef\.current = null/);
  assert.match(screen, /if \(!beginOperation\("saving"\)\) return/);
  assert.match(screen, /if \(!beginOperation\("retrying-storage"\)\) return/);
  assert.match(screen, /if \(!beginOperation\("opening-link"\)\) return/);
  assert.match(screen, /!beginOperation\("deleting"\)/);
  assert.match(screen, /setCandidate\(""\)/);
  assert.match(screen, /setCandidate\(""\);\s*setSaveRetryable\(false\);\s*setFeedback\(\{ message: "La credencial TMDB fue eliminada\."/, "delete success resets candidate retry state before its own feedback");
  assert.match(screen, /confirmCredentialRemoval/);
  assert.match(screen, /window\.confirm/);
  assert.match(screen, /Alert\.alert/);
  assert.match(screen, /let settled = false/);
  assert.match(screen, /if \(settled\) return/);
  assert.match(screen, /settled = true/);
  assert.match(screen, /onPress: \(\) => settle\(false\)/);
  assert.match(screen, /onPress: \(\) => settle\(true\)/);
  assert.match(screen, /onDismiss: \(\) => settle\(false\)/);
  assert.match(screen, /snapshot\.status === "configured"/);

  assert.match(screen, /useEffect\(\(\) => \{\s*mountedRef\.current = true/);
  assert.match(screen, /return \(\) => \{\s*mountedRef\.current = false/);
  assert.match(settings, /const tmdbMountedRef = useRef\(true\)/);
  assert.match(settings, /tmdbMountedRef\.current = true/);
  assert.match(settings, /tmdbMountedRef\.current = false/);
  assert.match(settings, /if \(tmdbMountedRef\.current\) setTmdbRetrying\(false\)/);
  assert.match(settings, /const tmdbRetryInFlightRef = useRef\(false\)/);
  assert.match(settings, /if \(tmdbRetryInFlightRef\.current\) return/);

  assert.match(screen, /Platform\.OS === "web"/);
  assert.match(ui.TMDB_WEB_STORAGE_WARNING, /localStorage/);
  assert.match(ui.TMDB_WEB_STORAGE_WARNING, /SecureStore/);
  assert.match(ui.TMDB_WEB_STORAGE_WARNING, /Keychain/);
  assert.match(ui.TMDB_WEB_STORAGE_WARNING, /Keystore/);
  assert.match(ui.TMDB_WEB_STORAGE_WARNING, /JavaScript/);
  assert.match(ui.TMDB_WEB_STORAGE_WARNING, /borrar los datos del navegador/);
  assert.equal(ui.TMDB_TOKEN_URL, "https://www.themoviedb.org/settings/api");
  assert.equal(/[?&](token|credential|api_key)=/i.test(ui.TMDB_TOKEN_URL), false);
  assert.match(screen, /Linking\.openURL\(TMDB_TOKEN_URL\)/);

  assert.match(screen, /accessibilityLabel="API Read Access Token de TMDB"/);
  assert.match(screen, /accessibilityLabel=\{hidden \? "Mostrar token" : "Ocultar token"\}/);
  assert.match(screen, /minWidth:\s*0/);
  assert.match(screen, /maxWidth:\s*720/);
  assert.doesNotMatch(provider, /snapshot[^\n]*token\s*:/);
  const snapshotContract = types.match(/TmdbCredentialSnapshot[\s\S]*?}>;/)?.[0] ?? "";
  assert.match(snapshotContract, /tokenAvailable:\s*boolean/);
  assert.doesNotMatch(snapshotContract, /\btoken\s*:/);
  assert.doesNotMatch(screen, /app_preferences|expo-sqlite|SQLite|libraryBackup|savedTitlesRepo/);
  assert.doesNotMatch(relevantSource, /console\.(log|debug|info|warn|error)/);

  const canary = ["SECTION3", "SECRET", "CANARY", "7319"].join("_");
  const visibleValues = [
    ...["initializing", "configured", "not-configured", "storage-error"].map((status) => JSON.stringify(ui.presentTmdbCredentialStatus({ status, tokenAvailable: status === "configured", generation: 0 }))),
    ...["credential-invalid", "network", "rate-limited", "http", "invalid-response", "credential-storage-error", "aborted"].map((kind) => JSON.stringify(ui.presentTmdbMutationError(new TmdbError(kind)))),
    ui.TMDB_WEB_STORAGE_WARNING,
    ui.TMDB_TOKEN_URL,
    relevantSource,
  ];
  assert.equal(visibleValues.some((value) => value.includes(canary)), false);
  assert.equal(/Authorization:\s*Bearer/.test(relevantSource), false);
}

async function main() {
  testSettingsPresentations();
  await testRetryInitializationUsesServiceOperation();
  await testChangeAndRemoveCoreBehavior();
  testFriendlyErrors();
  testReactNativeSourceContracts();
  console.log("Section 3 TMDB settings and credential screen verification passed.");
  console.log("React Native interaction details use focused source inspection because this repo has no Node renderer; visual/manual behavior is not claimed by regex checks.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

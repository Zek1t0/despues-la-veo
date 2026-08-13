const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
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

const secureStoreDouble = {
  async getItemAsync() { return null; },
  async setItemAsync() {},
  async deleteItemAsync() {},
};
const originalLoad = Module._load;
Module._load = function loadWithSecureStoreDouble(request, parent, isMain) {
  if (request === "expo-secure-store") return secureStoreDouble;
  return originalLoad.call(this, request, parent, isMain);
};

const root = path.resolve(__dirname, "../../..");
const fromRoot = (relative) => path.join(root, relative);
const read = (relative) => fs.readFileSync(fromRoot(relative), "utf8");
const { TMDB_CREDENTIAL_STORAGE_KEY } = require("../../../src/providers/tmdb/credential/tmdbCredentialKey.ts");
const { createNativeTmdbCredentialStore } = require("../../../src/providers/tmdb/credential/tmdbCredentialStore.native.ts");
const { createWebTmdbCredentialStore } = require("../../../src/providers/tmdb/credential/tmdbCredentialStore.web.ts");
const { TmdbCredentialService } = require("../../../src/providers/tmdb/credential/TmdbCredentialService.ts");
const { createTmdbCredentialExternalStore } = require("../../../src/providers/tmdb/credential/tmdbCredentialExternalStore.ts");
const { TmdbError } = require("../../../src/providers/tmdb/tmdbErrors.ts");
const { createTmdbClient } = require("../../../src/providers/tmdb/tmdbClient.ts");

function assertTmdbKind(kind) {
  return (error) => error instanceof TmdbError && error.kind === kind;
}

async function testNativeAdapter() {
  const calls = [];
  const boundary = {
    async getItemAsync(...args) { calls.push(["get", ...args]); return "native-token"; },
    async setItemAsync(...args) { calls.push(["set", ...args]); },
    async deleteItemAsync(...args) { calls.push(["delete", ...args]); },
  };
  const store = createNativeTmdbCredentialStore(boundary);
  assert.equal(await store.get(), "native-token");
  await store.set("native-token");
  await store.delete();
  assert.deepEqual(calls, [
    ["get", TMDB_CREDENTIAL_STORAGE_KEY],
    ["set", TMDB_CREDENTIAL_STORAGE_KEY, "native-token"],
    ["delete", TMDB_CREDENTIAL_STORAGE_KEY],
  ]);
  assert.equal(calls.every((call) => call.length <= 3), true, "SecureStore options must be absent");

  for (const operation of ["getItemAsync", "setItemAsync", "deleteItemAsync"]) {
    const failingBoundary = {
      async getItemAsync() { if (operation === "getItemAsync") throw new Error("native failure"); return null; },
      async setItemAsync() { if (operation === "setItemAsync") throw new Error("native failure"); },
      async deleteItemAsync() { if (operation === "deleteItemAsync") throw new Error("native failure"); },
    };
    const failingStore = createNativeTmdbCredentialStore(failingBoundary);
    const action = operation === "getItemAsync" ? () => failingStore.get()
      : operation === "setItemAsync" ? () => failingStore.set("canary") : () => failingStore.delete();
    await assert.rejects(action, /native failure/);
  }
}

function storageDouble(initial = null) {
  let value = initial;
  const calls = [];
  return {
    calls,
    getItem(key) { calls.push(["get", key]); return value; },
    setItem(key, token) { calls.push(["set", key, token]); value = token; },
    removeItem(key) { calls.push(["delete", key]); value = null; },
  };
}

async function testWebAdapter() {
  const storage = storageDouble(null);
  const first = createWebTmdbCredentialStore(() => storage);
  assert.equal(await first.get(), null);
  await first.set("web-token");
  const recreated = createWebTmdbCredentialStore(() => storage);
  assert.equal(await recreated.get(), "web-token");
  await recreated.delete();
  assert.equal(await first.get(), null);
  assert.deepEqual(storage.calls, [
    ["get", TMDB_CREDENTIAL_STORAGE_KEY],
    ["set", TMDB_CREDENTIAL_STORAGE_KEY, "web-token"],
    ["get", TMDB_CREDENTIAL_STORAGE_KEY],
    ["delete", TMDB_CREDENTIAL_STORAGE_KEY],
    ["get", TMDB_CREDENTIAL_STORAGE_KEY],
  ]);

  for (const method of ["getItem", "setItem", "removeItem"]) {
    const blocked = storageDouble();
    blocked[method] = () => { throw new Error(`${method} blocked`); };
    const store = createWebTmdbCredentialStore(() => blocked);
    const action = method === "getItem" ? () => store.get()
      : method === "setItem" ? () => store.set("canary") : () => store.delete();
    await assert.rejects(action, new RegExp(`${method} blocked`));
  }
  const unavailable = createWebTmdbCredentialStore(() => { throw new Error("unavailable"); });
  await assert.rejects(() => unavailable.get(), /unavailable/);
}

async function testStorageErrorMappingAndExternalStore() {
  const canary = "SECTION2_CANARY.secret-END";
  const service = new TmdbCredentialService({
    async get() { throw new Error(canary); },
    async set() { throw new Error(canary); },
    async delete() { throw new Error(canary); },
  }, async () => {});
  const externalStore = createTmdbCredentialExternalStore(service);
  let notifications = 0;
  const unsubscribe = externalStore.subscribe(() => { notifications += 1; });
  await externalStore.initializeSafely();
  assert.deepEqual(externalStore.getSnapshot(), { status: "storage-error", tokenAvailable: false, generation: 0 });
  assert.equal(Object.hasOwn(externalStore.getSnapshot(), "token"), false);
  assert.equal(JSON.stringify(externalStore.getSnapshot()).includes(canary), false);
  assert.equal(notifications, 1);
  unsubscribe();
  await externalStore.retryInitialization().catch(() => {});
  assert.equal(notifications, 1);
}

async function testRuntimeClient() {
  let transports = 0;
  let received;
  const client = createTmdbClient(
    { async resolveToken() { return "runtime-token"; } },
    async (token, requestPath, options) => {
      transports += 1;
      received = { token, requestPath, params: options.params };
      return { ok: true };
    },
  );
  assert.deepEqual(await client("/movie/1", { language: "es-AR" }), { ok: true });
  assert.equal(transports, 1);
  assert.deepEqual(received, { token: "runtime-token", requestPath: "/movie/1", params: { language: "es-AR" } });

  for (const kind of ["credential-not-configured", "credential-storage-error"]) {
    let fetches = 0;
    const unavailable = createTmdbClient(
      { async resolveToken() { throw new TmdbError(kind); } },
      async () => { fetches += 1; },
    );
    await assert.rejects(() => unavailable("/search/multi"), assertTmdbKind(kind));
    assert.equal(fetches, 0);
  }
}

function testCompositionAndBoundaries() {
  const nativeStore = read("src/providers/tmdb/credential/tmdbCredentialStore.native.ts");
  const webStore = read("src/providers/tmdb/credential/tmdbCredentialStore.web.ts");
  const selector = read("src/providers/tmdb/credential/tmdbCredentialStore.ts");
  const runtime = read("src/providers/tmdb/credential/tmdbCredentialRuntime.ts");
  const provider = read("src/providers/tmdb/credential/TmdbCredentialProvider.tsx");
  const client = read("src/providers/tmdb/tmdbClient.ts");
  const validator = read("src/providers/tmdb/credential/tmdbCredentialValidator.ts");
  assert.match(nativeStore, /expo-secure-store/);
  assert.doesNotMatch(nativeStore, /localStorage|window|sessionStorage|sqlite|app_preferences/i);
  assert.match(webStore, /window\.localStorage/);
  assert.doesNotMatch(webStore, /expo-secure-store|sessionStorage|indexedDB|cookie|sqlite|app_preferences/i);
  assert.match(selector, /tmdbCredentialStore\.native/);
  assert.match(runtime, /TmdbCredentialService/);
  assert.match(runtime, /createTmdbCredentialValidator/);
  assert.doesNotMatch(runtime, /React|tmdbClient|tmdbApi|process\.env/);
  assert.match(client, /credentialService\.resolveToken/);
  assert.match(client, /tmdbRequestWithToken/);
  const legacyEnvName = ["EXPO", "PUBLIC", "TMDB", "TOKEN"].join("_");
  assert.doesNotMatch(client, new RegExp(`process\\.env|${legacyEnvName}|Authorization|Bearer`));
  assert.match(provider, /useSyncExternalStore/);
  assert.doesNotMatch(provider, /resolveToken|SecureStore|localStorage|\btoken\b/);
  assert.doesNotMatch(validator, /tmdbCredentialRuntime|tmdbClient|TmdbCredentialService/);
  const firstRuntime = require("../../../src/providers/tmdb/credential/tmdbCredentialRuntime.ts");
  const secondRuntime = require("../../../src/providers/tmdb/credential/tmdbCredentialRuntime.ts");
  assert.equal(firstRuntime.tmdbCredentialService, secondRuntime.tmdbCredentialService);
}

function testNoEnvAndNoLibraryCoupling() {
  const runtimeRoots = ["app", "src", "docs", "package.json", "app.json"];
  const trackedFiles = runtimeRoots.flatMap((relative) => {
    const absolute = fromRoot(relative);
    if (!fs.existsSync(absolute)) return [];
    if (fs.statSync(absolute).isFile()) return [absolute];
    const results = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(child); else results.push(child);
      }
    };
    visit(absolute);
    return results;
  });
  const legacyEnvName = ["EXPO", "PUBLIC", "TMDB", "TOKEN"].join("_");
  for (const filename of trackedFiles) {
    const source = fs.readFileSync(filename, "utf8");
    assert.equal(source.includes(legacyEnvName), false, filename);
  }
  for (const relative of [
    "src/storage/databaseSchema.ts", "src/storage/db.ts", "src/storage/libraryBackupExport.ts",
    "src/storage/libraryBackupMerge.ts", "src/storage/viewPreferencesRepo.ts",
  ]) {
    assert.doesNotMatch(read(relative), /TmdbCredential|SecureStore|localStorage|api-read-access-token/i);
  }
}

async function main() {
  assert.equal(TMDB_CREDENTIAL_STORAGE_KEY, "despues-la-veo.tmdb.api-read-access-token");
  await testNativeAdapter();
  await testWebAdapter();
  await testStorageErrorMappingAndExternalStore();
  await testRuntimeClient();
  testCompositionAndBoundaries();
  testNoEnvAndNoLibraryCoupling();
  console.log("Section 2 TMDB credential adapters, runtime, provider, client, boundaries, and no-leakage verification passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

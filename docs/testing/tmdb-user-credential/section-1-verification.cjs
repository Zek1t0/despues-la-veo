const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

const { TmdbCredentialService } = require("../../../src/providers/tmdb/credential/TmdbCredentialService.ts");
const {
  normalizeTmdbCredential,
  requireNormalizedTmdbCredential,
} = require("../../../src/providers/tmdb/credential/normalizeTmdbCredential.ts");
const {
  createTmdbCredentialValidator,
} = require("../../../src/providers/tmdb/credential/tmdbCredentialValidator.ts");
const { TmdbError } = require("../../../src/providers/tmdb/tmdbErrors.ts");
const {
  TMDB_BASE_URL,
  tmdbRequestWithToken,
} = require("../../../src/providers/tmdb/tmdbTransport.ts");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function assertTmdbKind(kind) {
  return (error) => error instanceof TmdbError && error.kind === kind;
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

function response(status, body) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function testNormalization() {
  assert.equal(normalizeTmdbCredential("  abc.DEF-123_~=  "), "abc.DEF-123_~=");
  assert.equal(normalizeTmdbCredential("\tBearer \n abc.DEF-123_~= \r"), "abc.DEF-123_~=");
  assert.equal(normalizeTmdbCredential("bearer AbC"), "bearer AbC");
  assert.equal(normalizeTmdbCredential("Bearer Bearer AbC"), "Bearer AbC");
  assert.equal(normalizeTmdbCredential("AbC.Def-_~="), "AbC.Def-_~=");
  assert.equal(normalizeTmdbCredential("   "), "");
  assert.throws(() => requireNormalizedTmdbCredential("   "), assertTmdbKind("credential-invalid"));
}

async function testInitialization() {
  const pending = deferred();
  let reads = 0;
  const service = new TmdbCredentialService({
    get() { reads += 1; return pending.promise; },
    async set() {},
    async delete() {},
  }, async () => {});
  const first = service.resolveToken();
  const second = service.resolveToken();
  assert.equal(reads, 1);
  assert.deepEqual(service.getSnapshot(), { status: "initializing", tokenAvailable: false, generation: 0 });
  pending.resolve(" token-A ");
  assert.deepEqual(await Promise.all([first, second]), ["token-A", "token-A"]);
  assert.equal(reads, 1);
  assert.deepEqual(service.getSnapshot(), { status: "configured", tokenAvailable: true, generation: 0 });

  const absentStore = memoryStore(null);
  const absent = new TmdbCredentialService(absentStore, async () => {});
  await assert.rejects(() => absent.resolveToken(), assertTmdbKind("credential-not-configured"));
  assert.equal(absentStore.calls.get, 1);
  assert.deepEqual(absent.getSnapshot(), { status: "not-configured", tokenAvailable: false, generation: 0 });

  let failingReads = 0;
  const failing = new TmdbCredentialService({
    async get() { failingReads += 1; throw new Error("raw read secret must not escape"); },
    async set() {},
    async delete() {},
  }, async () => {});
  await assert.rejects(() => failing.resolveToken(), assertTmdbKind("credential-storage-error"));
  assert.equal(failingReads, 1);
  assert.deepEqual(failing.getSnapshot(), { status: "storage-error", tokenAvailable: false, generation: 0 });
}

async function testRetry() {
  for (const recovered of ["token-R", null]) {
    let reads = 0;
    const store = {
      async get() { reads += 1; if (reads === 1) throw new Error("read failed"); return recovered; },
      async set() {}, async delete() {},
    };
    const service = new TmdbCredentialService(store, async () => {});
    await assert.rejects(() => service.resolveToken(), assertTmdbKind("credential-storage-error"));
    assert.equal(reads, 1);
    await assert.rejects(() => service.resolveToken(), assertTmdbKind("credential-storage-error"));
    await Promise.all([
      assert.rejects(() => service.resolveToken(), assertTmdbKind("credential-storage-error")),
      assert.rejects(() => service.resolveToken(), assertTmdbKind("credential-storage-error")),
    ]);
    assert.equal(reads, 1);
    await service.retryInitialization();
    assert.equal(reads, 2);
    assert.deepEqual(service.getSnapshot(), {
      status: recovered === null ? "not-configured" : "configured",
      tokenAvailable: recovered !== null,
      generation: 0,
    });
  }

  const attempts = [Promise.reject(new Error("one")), Promise.reject(new Error("two")), Promise.resolve("token-3")];
  attempts[0].catch(() => {});
  attempts[1].catch(() => {});
  let reads = 0;
  const retryable = new TmdbCredentialService({
    get() { const result = attempts[reads]; reads += 1; return result; },
    async set() {}, async delete() {},
  }, async () => {});
  await assert.rejects(() => retryable.resolveToken(), assertTmdbKind("credential-storage-error"));
  await assert.rejects(() => retryable.retryInitialization(), assertTmdbKind("credential-storage-error"));
  await retryable.retryInitialization();
  assert.equal(reads, 3);
  assert.equal(await retryable.resolveToken(), "token-3");
  assert.equal(retryable.getSnapshot().generation, 0);

  const pendingRetry = deferred();
  let concurrentReads = 0;
  const concurrent = new TmdbCredentialService({
    get() {
      concurrentReads += 1;
      if (concurrentReads === 1) return Promise.reject(new Error("first"));
      return pendingRetry.promise;
    },
    async set() {}, async delete() {},
  }, async () => {});
  await assert.rejects(() => concurrent.resolveToken(), assertTmdbKind("credential-storage-error"));
  const retryOne = concurrent.retryInitialization();
  const retryTwo = concurrent.retryInitialization();
  let retryFetches = 0;
  const waitingRequest = concurrent.resolveToken().then((token) => {
    retryFetches += 1;
    return token;
  });
  assert.equal(concurrentReads, 2);
  assert.equal(retryFetches, 0);
  pendingRetry.resolve("token-concurrent");
  await Promise.all([retryOne, retryTwo]);
  assert.equal(await waitingRequest, "token-concurrent");
  assert.equal(concurrentReads, 2);
  assert.equal(concurrent.getSnapshot().generation, 0);
}

async function testMutations() {
  const store = memoryStore(null);
  const validated = [];
  const service = new TmdbCredentialService(store, async (token) => validated.push(token));
  await service.initialize();
  await service.save(" Bearer first ");
  assert.equal(store.value, "first");
  assert.deepEqual(service.getSnapshot(), { status: "configured", tokenAvailable: true, generation: 1 });
  await service.save("second");
  assert.equal(await service.resolveToken(), "second");
  assert.equal(service.getSnapshot().generation, 2);
  const generationBeforeNoOp = service.getSnapshot().generation;
  await service.save("second");
  assert.equal(await service.resolveToken(), "second");
  assert.equal(service.getSnapshot().generation, generationBeforeNoOp);
  assert.deepEqual(validated, ["first", "second", "second"]);

  const validationFailure = new TmdbError("credential-invalid");
  const guarded = new TmdbCredentialService(memoryStore("old"), async (token) => {
    if (token === "bad") throw validationFailure;
  });
  await guarded.initialize();
  await assert.rejects(() => guarded.save("bad"), (error) => error === validationFailure);
  assert.equal(await guarded.resolveToken(), "old");
  assert.equal(guarded.getSnapshot().generation, 0);

  const writeStore = memoryStore("old");
  writeStore.set = async () => { writeStore.calls.set += 1; throw new Error("raw write failure"); };
  const writeFailure = new TmdbCredentialService(writeStore, async () => {});
  await writeFailure.initialize();
  await assert.rejects(() => writeFailure.save("new"), assertTmdbKind("credential-storage-error"));
  assert.equal(await writeFailure.resolveToken(), "old");
  assert.deepEqual(writeFailure.getSnapshot(), { status: "configured", tokenAvailable: true, generation: 0 });

  await service.delete();
  assert.equal(store.value, null);
  assert.equal(store.calls.delete, 1);
  assert.deepEqual(service.getSnapshot(), { status: "not-configured", tokenAvailable: false, generation: 3 });
  await assert.rejects(() => service.resolveToken(), assertTmdbKind("credential-not-configured"));

  const deleteStore = memoryStore("kept");
  deleteStore.delete = async () => { deleteStore.calls.delete += 1; throw new Error("raw delete failure"); };
  const deleteFailure = new TmdbCredentialService(deleteStore, async () => {});
  await deleteFailure.initialize();
  await assert.rejects(() => deleteFailure.delete(), assertTmdbKind("credential-storage-error"));
  assert.equal(await deleteFailure.resolveToken(), "kept");
  assert.deepEqual(deleteFailure.getSnapshot(), { status: "configured", tokenAvailable: true, generation: 0 });
}

async function testDeleteRaces() {
  for (const succeeds of [true, false]) {
    const entered = deferred();
    const operation = deferred();
    const store = memoryStore("A");
    store.delete = async () => {
      store.calls.delete += 1;
      entered.resolve();
      await operation.promise;
      if (!succeeds) throw new Error("delete failed");
    };
    const service = new TmdbCredentialService(store, async () => {});
    await service.initialize();
    const before = service.getSnapshot();
    const deletion = service.delete();
    let requestSettled = false;
    let fetches = 0;
    const request = service.resolveToken().then(
      (token) => { requestSettled = true; fetches += 1; return token; },
      (error) => { requestSettled = true; throw error; },
    );
    await entered.promise;
    await Promise.resolve();
    assert.equal(requestSettled, false);
    assert.equal(store.calls.delete, 1);
    assert.equal(service.getSnapshot(), before);
    if (succeeds) {
      operation.resolve();
      await deletion;
      await assert.rejects(() => request, assertTmdbKind("credential-not-configured"));
      assert.equal(fetches, 0);
      assert.deepEqual(service.getSnapshot(), { status: "not-configured", tokenAvailable: false, generation: 1 });
    } else {
      operation.resolve();
      await assert.rejects(() => deletion, assertTmdbKind("credential-storage-error"));
      assert.equal(await request, "A");
      assert.equal(fetches, 1);
      assert.equal(service.getSnapshot(), before);
      assert.equal(service.getSnapshot().generation, 0);
    }
  }

  const operations = [deferred(), deferred()];
  const entered = [deferred(), deferred()];
  let deleteCalls = 0;
  const store = memoryStore("A");
  store.delete = async () => {
    const operation = operations[deleteCalls];
    const currentEntered = entered[deleteCalls];
    deleteCalls += 1;
    currentEntered.resolve();
    await operation.promise;
    throw new Error("controlled consecutive delete failure");
  };
  const service = new TmdbCredentialService(store, async () => {});
  await service.initialize();
  const firstDelete = service.delete();
  const secondDelete = service.delete();
  let requestSettled = false;
  const request = service.resolveToken().then((token) => {
    requestSettled = true;
    return token;
  });
  await entered[0].promise;
  await Promise.resolve();
  assert.equal(requestSettled, false);
  operations[0].resolve();
  await assert.rejects(() => firstDelete, assertTmdbKind("credential-storage-error"));
  await entered[1].promise;
  await Promise.resolve();
  assert.equal(deleteCalls, 2);
  assert.equal(requestSettled, false);
  operations[1].resolve();
  await assert.rejects(() => secondDelete, assertTmdbKind("credential-storage-error"));
  assert.equal(await request, "A");
  assert.equal(service.getSnapshot().generation, 0);
}

async function testSubscriberIsolation() {
  const initializationStore = memoryStore("A");
  const initializationService = new TmdbCredentialService(initializationStore, async () => {});
  const received = [];
  initializationService.subscribe(() => {
    throw new Error("observer initialization failure");
  });
  initializationService.subscribe((snapshot) => received.push(snapshot));
  const initialized = await initializationService.initialize();
  assert.deepEqual(initialized, { status: "configured", tokenAvailable: true, generation: 0 });
  assert.equal(await initializationService.resolveToken(), "A");
  assert.deepEqual(received, [initialized]);
  assert.equal(Object.hasOwn(initialized, "token"), false);
  assert.deepEqual(Object.keys(initialized).sort(), ["generation", "status", "tokenAvailable"]);

  const saveStore = memoryStore("A");
  const saveService = new TmdbCredentialService(saveStore, async () => {});
  await saveService.initialize();
  saveService.subscribe(() => {
    throw new Error("observer save failure");
  });
  const saved = await saveService.save("B");
  assert.equal(saveStore.value, "B");
  assert.equal(await saveService.resolveToken(), "B");
  assert.deepEqual(saved, { status: "configured", tokenAvailable: true, generation: 1 });

  const deleteStore = memoryStore("A");
  const deleteService = new TmdbCredentialService(deleteStore, async () => {});
  await deleteService.initialize();
  let unsubscribedCalls = 0;
  const unsubscribe = deleteService.subscribe(() => {
    unsubscribedCalls += 1;
  });
  unsubscribe();
  deleteService.subscribe(() => {
    throw new Error("observer delete failure");
  });
  const deleted = await deleteService.delete();
  assert.equal(deleteStore.value, null);
  assert.deepEqual(deleted, { status: "not-configured", tokenAvailable: false, generation: 1 });
  await assert.rejects(() => deleteService.resolveToken(), assertTmdbKind("credential-not-configured"));
  assert.equal(unsubscribedCalls, 0);
}

async function testTransport() {
  let captured;
  const ok = await tmdbRequestWithToken("exact.Token", "/movie/1", {
    params: { language: "es-AR" },
    fetchImplementation: async (url, init) => {
      captured = { url, authorization: init.headers.Authorization, signal: init.signal };
      return response(200, '{"id":1}');
    },
    parse(value) {
      if (!value || value.id !== 1) throw new Error("shape");
      return value;
    },
  });
  assert.deepEqual(ok, { id: 1 });
  assert.equal(captured.authorization, "Bearer exact.Token");
  assert.equal(captured.url, `${TMDB_BASE_URL}/movie/1?language=es-AR`);
  assert.equal(captured.url.includes("exact.Token"), false);

  let emptyFetches = 0;
  await assert.rejects(
    () => tmdbRequestWithToken("", "/authentication", { fetchImplementation: async () => { emptyFetches += 1; } }),
    assertTmdbKind("credential-invalid"),
  );
  assert.equal(emptyFetches, 0);

  for (const [status, kind] of [[401, "credential-invalid"], [429, "rate-limited"], [503, "http"]]) {
    await assert.rejects(
      () => tmdbRequestWithToken("token", "/x", {
        fetchImplementation: async () => response(status, '{"status_code":99,"status_message":"raw"}'),
      }),
      (error) => assertTmdbKind(kind)(error) && error.status === status && error.remoteCode === 99,
    );
  }
  await assert.rejects(
    () => tmdbRequestWithToken("token", "/x", { fetchImplementation: async () => { throw new Error("offline"); } }),
    assertTmdbKind("network"),
  );
  await assert.rejects(
    () => tmdbRequestWithToken("token", "/x", { fetchImplementation: async () => { const error = new Error("stop"); error.name = "AbortError"; throw error; } }),
    assertTmdbKind("aborted"),
  );
  await assert.rejects(
    () => tmdbRequestWithToken("token", "/x", { fetchImplementation: async () => response(200, "not-json") }),
    assertTmdbKind("invalid-response"),
  );
  await assert.rejects(
    () => tmdbRequestWithToken("token", "/x", { fetchImplementation: async () => response(200, "{}"), parse() { throw new Error("bad shape"); } }),
    assertTmdbKind("invalid-response"),
  );
}

async function testValidatorOverride() {
  const store = memoryStore("A");
  const service = new TmdbCredentialService(store, async () => {});
  await service.initialize();
  const before = service.getSnapshot();
  const calls = [];
  const validator = createTmdbCredentialValidator(async (token, requestPath, options) => {
    calls.push({ token, requestPath, method: options.method });
    return options.parse({ success: true });
  });
  await validator("B");
  assert.deepEqual(calls, [{ token: "B", requestPath: "/authentication", method: "GET" }]);
  assert.equal(store.calls.get, 1);
  assert.equal(store.calls.set, 0);
  assert.equal(store.calls.delete, 0);
  assert.equal(service.getSnapshot(), before);
  assert.equal(await service.resolveToken(), "A");

  let fetches = 0;
  const emptyValidator = createTmdbCredentialValidator(async () => { fetches += 1; });
  await assert.rejects(() => emptyValidator("   "), assertTmdbKind("credential-invalid"));
  assert.equal(fetches, 0);

  for (const scenario of [
    { candidate: "Bearer Bearer ABC", expected: "Bearer ABC" },
    { candidate: "  Bearer ABC  ", expected: "ABC" },
  ]) {
    const integrationStore = memoryStore(null);
    const validatedTokens = [];
    const integrationValidator = createTmdbCredentialValidator(async (token, requestPath, options) => {
      validatedTokens.push(token);
      assert.equal(requestPath, "/authentication");
      return options.parse({ success: true });
    });
    const integrationService = new TmdbCredentialService(integrationStore, integrationValidator);
    await integrationService.save(scenario.candidate);
    assert.deepEqual(validatedTokens, [scenario.expected]);
    assert.equal(integrationStore.value, scenario.expected);
    assert.equal(validatedTokens[0], integrationStore.value);
    assert.equal(await integrationService.resolveToken(), scenario.expected);
  }
}

async function testNoLeakage() {
  const canary = "CANARY_FULL_7xQ9.secret-END";
  const forbidden = [
    canary,
    "Authorization",
    `Bearer ${canary}`,
    "CANARY_FULL",
    "7xQ9.secret",
    "secret-END",
    canary.slice(0, 8),
    canary.slice(-8),
  ];
  const errors = [];
  let requestedUrl = "";
  const originalLog = console.log;
  const originalError = console.error;
  const logs = [];
  console.log = (...values) => logs.push(values);
  console.error = (...values) => logs.push(values);
  try {
    for (const operation of [
      () => tmdbRequestWithToken(canary, "/authentication", {
        fetchImplementation: async (url) => {
          requestedUrl = String(url);
          return response(401, JSON.stringify({ status_message: `raw ${canary}`, secret: canary }));
        },
      }),
      () => tmdbRequestWithToken(canary, "/authentication", {
        fetchImplementation: async () => { throw new Error(`network ${canary}`); },
      }),
    ]) {
      try { await operation(); } catch (error) { errors.push(error); }
    }
    const storeService = new TmdbCredentialService({
      async get() { throw new Error(`storage ${canary}`); }, async set() {}, async delete() {},
    }, async () => {});
    try { await storeService.resolveToken(); } catch (error) { errors.push(error); }
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  const exposed = JSON.stringify({
    errors: errors.map((error) => ({ name: error.name, message: error.message, kind: error.kind, status: error.status, remoteCode: error.remoteCode })),
    requestedUrl,
    logs,
  });
  for (const fragment of forbidden) assert.equal(exposed.includes(fragment), false, `leak detected: ${fragment}`);
  assert.equal(requestedUrl.includes(canary), false);
}

function testBoundaries() {
  const root = path.resolve(__dirname, "../../..");
  const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
  const client = read("src/providers/tmdb/tmdbClient.ts");
  assert.doesNotMatch(client, new RegExp(["EXPO", "PUBLIC", "TMDB", "TOKEN"].join("_") + "|process\\.env"));
  assert.match(client, /tmdbCredentialRuntime/);
  assert.match(client, /tmdbRequestWithToken/);
  const service = read("src/providers/tmdb/credential/TmdbCredentialService.ts");
  assert.doesNotMatch(service, /tmdbApi|tmdbClient|React|SecureStore|localStorage/);
  const transport = read("src/providers/tmdb/tmdbTransport.ts");
  assert.doesNotMatch(transport, /TmdbCredentialService|CredentialStore|SecureStore|localStorage|React|tmdbApi/);
  const validator = read("src/providers/tmdb/credential/tmdbCredentialValidator.ts");
  assert.doesNotMatch(validator, /tmdbApi|tmdbClient|CredentialStore|SecureStore|localStorage|React/);
  assert.match(validator, /tmdbTransport/);
  assert.doesNotMatch(transport, /tmdbCredentialValidator|TmdbCredentialService/);
}

async function main() {
  testNormalization();
  await testInitialization();
  await testRetry();
  await testMutations();
  await testDeleteRaces();
  await testSubscriberIsolation();
  await testTransport();
  await testValidatorOverride();
  await testNoLeakage();
  testBoundaries();
  console.log("Section 1 TMDB credential service, transport, validator, races, and no-leakage verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

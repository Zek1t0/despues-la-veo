const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "../../..");
const routePath = path.join(root, "app/tmdb/[type]/[id].tsx");
const source = fs.readFileSync(routePath, "utf8");
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = function compile(module, filename) {
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
}

// Executes the actual screen, effects and handlers without a new renderer dependency.
let active;
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  Fragment: "Fragment",
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState(initial) {
    const h = active, i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
    return [h.slots[i], (next) => {
      const value = typeof next === "function" ? next(h.slots[i]) : next;
      if (!Object.is(value, h.slots[i])) { h.slots[i] = value; h.dirty = true; }
    }];
  },
  useRef(initial) { const i = active.cursor++; return active.slots[i] ??= { current: initial }; },
  useMemo(factory, deps) {
    const i = active.cursor++, previous = active.slots[i];
    if (!previous || !sameDeps(previous.deps, deps)) active.slots[i] = { deps, value: factory() };
    return active.slots[i].value;
  },
  useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
  useEffect(effect, deps) {
    const h = active, i = h.cursor++, previous = h.slots[i];
    if (!previous || !sameDeps(previous.deps, deps)) {
      h.slots[i] = { deps, cleanup: previous?.cleanup };
      h.effects.push(() => { h.slots[i].cleanup?.(); h.slots[i].cleanup = effect(); });
    }
  },
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const movie = (id = 77) => ({ id, title: "Movie title", release_date: "2024-01-01",
  poster_path: "/movie.jpg", overview: "Movie overview", vote_average: 8.2,
  genres: [{ id: 1, name: "Drama" }], runtime: 125 });
const tv = (id = 77) => ({ id, name: "TV title", first_air_date: "2020-02-01",
  poster_path: "/tv.jpg", overview: "TV overview", vote_average: 7.3,
  genres: [{ id: 2, name: "Comedy" }], episode_run_time: [42], number_of_seasons: 3 });
const credits = { id: 77, cast: [{ id: 1, name: "Actor", character: "Role", profile_path: "/actor.jpg" }],
  crew: [{ id: 2, name: "Director name", job: "Director" }] };
const country = (name) => ({ link: `https://example.test/${name}`,
  flatrate: [{ provider_id: 1, provider_name: name, logo_path: "/logo.jpg" }],
  rent: [{ provider_id: 2, provider_name: "Rental" }], buy: [{ provider_id: 3, provider_name: "Purchase" }] });
let Screen, repo, mappers, api;
function host(type = "movie", id = "00077", status = "configured") {
  const h = {
    slots: [], effects: [], cursor: 0, dirty: true, tree: null,
    params: { type, id }, credential: { status, generation: 1 },
    requests: [], lookups: [], saves: [], mappings: [], policies: [], navigation: [], alerts: [], links: [],
    responses: { details: type === "movie" ? movie(Number(id)) : tv(Number(id)), credits,
      watch: { id: Number(id), results: { AR: country("Argentina"), US: country("USA") } } },
    request(kind, requestType, requestId) {
      h.requests.push({ kind, type: requestType, id: requestId });
      return h.responses[kind]?.promise ?? Promise.resolve(h.responses[kind]);
    },
    render() {
      active = h; h.cursor = 0; h.dirty = false; h.tree = Screen();
      h.effects.splice(0).forEach((effect) => effect());
    },
    async flush() {
      for (let i = 0; i < 8; i++) { if (h.dirty) h.render(); await new Promise(setImmediate); }
      if (h.dirty) h.render();
    },
    unmount() { for (const slot of h.slots) slot?.cleanup?.(); },
  };
  return h;
}
function nodes(value, result = []) {
  if (Array.isArray(value)) value.forEach((item) => nodes(item, result));
  else if (value && typeof value === "object" && value.props) { result.push(value); nodes(value.props.children, result); }
  return result;
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value?.props) return text(value.props.children);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
const button = (h, label) => nodes(h.tree).find((n) => n.type === "Pressable" && text(n).includes(label));

function sourceBoundaries() {
  const save = source.slice(source.indexOf("async function saveToLibrary"), source.indexOf("function openSavedTitle"));
  assert.doesNotMatch(source, /LegacyTmdbSavedTitleSnapshot|saveTmdbTitle|useState<any>/);
  assert.doesNotMatch(save, /release_date|first_air_date|poster_path|vote_average|\.genres|\.overview|\.title|\.name|yearNum|genreNames/);
  assert.match(save, /mapTmdbMovieDetails\(data as TmdbMovieDetails\)/);
  assert.match(save, /mapTmdbTvDetails\(data as TmdbTvDetails\)/);
  assert.match(save, /createTmdbMaterializationInput\(details, tmdbInitialTags\(data\)\)/);
  assert.match(save, /saveProviderTitle\(input, uuid\)/);
  for (const name of ["getMovieDetails", "getTvDetails"]) assert.equal((source.match(new RegExp(`${name}\\(`, "g")) || []).length, 1);
  assert.match(source, /const \[d, c, w\] = await Promise\.all\(\[/);
  assert.match(source, /getByProviderReference\([\s\S]*createTmdbProviderReference\(type, externalId\)/);
  assert.doesNotMatch(source, /getPortableDetails|ProviderDetailCapability|\/provider\//);
}

async function savingAndPresentation(db) {
  for (const type of ["movie", "tv"]) {
    const h = host(type), dto = h.responses.details;
    await h.flush();
    assert.deepEqual(h.requests, [
      { kind: "details", type, id: 77 }, { kind: "credits", type, id: 77 }, { kind: "watch", type, id: 77 },
    ]);
    assert.deepEqual(h.lookups, [{ provider: "tmdb", resourceNamespace: type, externalId: "77" }]);
    const visible = text(h.tree);
    assert.ok(visible.includes(type === "movie" ? "Movie title" : "TV title"));
    assert.ok(visible.includes(type === "movie" ? "2h 5m" : "42m"));
    assert.ok(visible.includes(type === "tv" ? "3 temp" : "Director name"));
    for (const label of ["Actor", "Argentina", "Rental", "Purchase"]) assert.ok(visible.includes(label));
    const images = nodes(h.tree).filter((n) => n.type === "Image").map((n) => n.props.source.uri);
    assert.ok(images.some((url) => url.endsWith("/actor.jpg")));
    assert.ok(images.some((url) => url.endsWith("/logo.jpg")));
    await button(h, "Ver enlaces").props.onPress();
    assert.deepEqual(h.links, ["https://example.test/Argentina"]);
    await button(h, "Guardar en Biblioteca").props.onPress();
    await h.flush();
    assert.equal(h.mappings.length, 1); assert.equal(h.mappings[0].type, type);
    assert.strictEqual(h.mappings[0].dto, dto, "mapper consumes original fetched DTO");
    assert.strictEqual(h.policies[0], dto, "creation policy consumes same fetched DTO");
    const input = h.saves[0];
    assert.deepEqual(input.reference, h.lookups[0]);
    assert.deepEqual(input.snapshot.genres, type === "movie" ? ["Drama"] : ["Comedy"]);
    assert.deepEqual(input.initialTags, input.snapshot.genres, "current TMDB policy only");
    assert.notStrictEqual(input.initialTags, input.snapshot.genres);
    const created = await repo.getSavedTitleByProviderReferenceWithDb(db, input.reference);
    assert.match(created.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.deepEqual(created.providerReferences, [input.reference]);
    assert.equal(created.status, "planned"); assert.equal(created.notes, null); assert.equal(created.personalRating, null);
    assert.equal(created.createdAt, 1000); assert.equal(created.updatedAt, 1000);
    assert.deepEqual(created.tags, input.initialTags); assert.deepEqual(created.genres, input.snapshot.genres);
    assert.deepEqual(h.navigation, [`/title/${created.id}`]); assert.deepEqual(h.alerts, ["Guardado ✅"]);
    assert.equal(h.requests.length, 3, "saving does not fetch detail again");
    h.unmount();

    await db.withTransactionAsync(async () => {
      await repo.updateSavedTitleMetadataWithDb(db, created.id,
        { status: "watching", tags: ["User tag"], notes: "User note" }, () => 1000);
      await repo.setPersonalRatingWithDb(db, created.id, 87, () => 1000);
    });
    const existing = await repo.getSavedTitleWithReferencesByIdWithDb(db, created.id);
    const refresh = host(type);
    refresh.responses.details = { ...dto, genres: [{ id: 3, name: "New remote genre" }],
      overview: "Refreshed overview", vote_average: 9.4, poster_path: "/new.jpg",
      ...(type === "movie" ? { title: "Refreshed", release_date: "2026-01-01" } : { name: "Refreshed", first_air_date: "2026-01-01" }) };
    await refresh.flush(); await button(refresh, "Actualizar en Biblioteca").props.onPress(); await refresh.flush();
    const saved = await repo.getSavedTitleWithReferencesByIdWithDb(db, created.id);
    for (const key of ["id", "createdAt", "status", "tags", "notes", "personalRating", "providerReferences"]) {
      assert.deepEqual(saved[key], existing[key], `refresh preserves ${key}`);
    }
    assert.equal(saved.updatedAt, existing.updatedAt + 1);
    assert.equal(saved.title, "Refreshed"); assert.equal(saved.year, 2026);
    assert.equal(saved.overview, "Refreshed overview"); assert.equal(saved.voteAverage, 9.4);
    assert.ok(saved.posterUrl.endsWith("/new.jpg")); assert.deepEqual(saved.genres, ["New remote genre"]);
    assert.equal(refresh.requests.length, 3); assert.deepEqual(refresh.navigation, [], "refresh does not auto-navigate");
    button(refresh, "Ir a Biblioteca").props.onPress();
    assert.deepEqual(refresh.navigation, [`/title/${created.id}`]); refresh.unmount();
  }
}

async function remoteLifecycle() {
  const { TmdbError } = require("../../../src/providers/tmdb/tmdbErrors.ts");
  for (const status of ["initializing", "not-configured", "storage-error"]) {
    const h = host("movie", "77", status); await h.flush();
    assert.equal(h.lookups.length, 1); assert.equal(h.requests.length, 0);
    assert.equal(button(h, "Guardar en Biblioteca"), undefined); h.unmount();
  }
  for (const failing of ["details", "credits", "watch"]) {
    const h = host("movie", "777"), pending = { details: deferred(), credits: deferred(), watch: deferred() };
    const responses = h.responses; h.responses = pending; await h.flush();
    for (const kind of ["details", "credits", "watch"]) if (kind !== failing) pending[kind].resolve(responses[kind]);
    await h.flush(); assert.equal(button(h, "Guardar en Biblioteca"), undefined, "no partial success");
    pending[failing].reject(new TmdbError("network")); await h.flush();
    assert.equal(button(h, "Guardar en Biblioteca"), undefined); assert.ok(button(h, "Reintentar"));
    h.responses = responses; button(h, "Reintentar").props.onPress(); await h.flush();
    assert.equal(h.requests.filter((r) => r.kind === "details").length, 2, "one detail request per retry");
    assert.ok(button(h, "Guardar en Biblioteca")); h.unmount();
  }
  for (const invalidation of ["route", "generation", "status", "unmount"]) {
    const h = host("movie", "777"), pending = deferred(); h.responses.details = pending; await h.flush();
    if (invalidation === "unmount") h.unmount();
    else {
      if (invalidation === "route") h.params = { type: "tv", id: "778" };
      if (invalidation === "generation") h.credential = { status: "configured", generation: 2 };
      if (invalidation === "status") h.credential = { status: "not-configured", generation: 2 };
      h.responses.details = invalidation === "route" ? tv(778) : { ...movie(777), title: "Latest generation" };
      h.dirty = true; await h.flush();
    }
    pending.resolve(movie(777)); await h.flush();
    assert.ok(!text(h.tree).includes("Movie title"), "stale detail response is discarded");
    if (invalidation === "route") assert.ok(text(h.tree).includes("TV title"));
    if (invalidation === "generation") assert.ok(text(h.tree).includes("Latest generation"));
    if (invalidation !== "unmount") h.unmount();
  }
  const fallback = host("tv", "779"); fallback.responses.watch.results = { US: country("USA") };
  await fallback.flush(); assert.ok(text(fallback.tree).includes("USA"));
  await button(fallback, "Ver enlaces").props.onPress(); assert.deepEqual(fallback.links, ["https://example.test/USA"]);
  fallback.unmount();

  const staleFailure = host("movie", "881"), oldRequest = deferred();
  staleFailure.responses.details = oldRequest; await staleFailure.flush();
  staleFailure.credential = { status: "configured", generation: 2 };
  staleFailure.responses.details = { ...movie(881), title: "Current success" };
  staleFailure.dirty = true; await staleFailure.flush();
  oldRequest.reject(new TmdbError("credential-invalid")); await staleFailure.flush();
  assert.ok(text(staleFailure.tree).includes("Current success"));
  assert.equal(button(staleFailure, "Cambiar token"), undefined);
  staleFailure.unmount();
}

async function main() {
  sourceBoundaries();
  const sqlite = new DatabaseSync(":memory:");
  const normalize = (args) => args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...args) { return sqlite.prepare(sql).get(...normalize(args)) ?? null; },
    async getAllAsync(sql, ...args) { return sqlite.prepare(sql).all(...normalize(args)); },
    async runAsync(sql, ...args) { return sqlite.prepare(sql).run(...normalize(args)); },
    async withTransactionAsync(task) {
      sqlite.exec("BEGIN");
      try { await task(); sqlite.exec("COMMIT"); } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const originalLoad = Module._load, originalNow = Date.now, originalAlert = global.alert;
  Module._load = function mocked(request, parent, isMain) {
    if (request === "expo-sqlite") return { openDatabaseAsync: async () => db };
    if (request === "./tmdbClient" && parent?.filename.endsWith(`${path.sep}tmdbApi.ts`)) {
      return { tmdbFetch: () => { throw new Error("Unexpected unmocked TMDB request"); } };
    }
    if (parent?.filename === routePath) {
      if (request === "react") return react;
      if (request === "react-native") return {
        ...Object.fromEntries(["ActivityIndicator", "Image", "Pressable", "ScrollView", "Text", "View"].map((n) => [n, n])),
        Platform: { OS: "web" }, Alert: { alert: (...args) => active.alerts.push(args) },
        Linking: { openURL: async (url) => { active.links.push(url); } },
      };
      if (request === "expo-router") return { Stack: { Screen: "Stack.Screen" },
        useLocalSearchParams: () => active.params, useRouter: () => ({ push: (route) => active.navigation.push(route) }) };
      if (request.endsWith("AppThemeProvider")) return { useAppTheme: () => ({ theme: { global: {}, semantic: {} } }) };
      if (request.endsWith("TmdbCredentialProvider")) return { useTmdbCredential: () => ({ snapshot: active.credential, retryInitialization: async () => {} }) };
      if (request.endsWith("tmdbApi")) return {
        ...api,
        getMovieDetails: (id) => active.request("details", "movie", id), getTvDetails: (id) => active.request("details", "tv", id),
        getMovieCredits: (id) => active.request("credits", "movie", id), getTvCredits: (id) => active.request("credits", "tv", id),
        getWatchProviders: (type, id) => active.request("watch", type, id),
      };
      if (request.endsWith("savedTitlesRepo")) return {
        getByProviderReference: async (reference) => { active.lookups.push(reference); return repo.getSavedTitleByProviderReferenceWithDb(db, reference); },
        saveProviderTitle: async (input, generateId) => { active.saves.push(input); return repo.saveProviderTitle(input, generateId); },
      };
      if (request.endsWith("tmdbMappers")) return {
        ...mappers,
        mapTmdbMovieDetails: (dto) => { active.mappings.push({ type: "movie", dto }); return mappers.mapTmdbMovieDetails(dto); },
        mapTmdbTvDetails: (dto) => { active.mappings.push({ type: "tv", dto }); return mappers.mapTmdbTvDetails(dto); },
        tmdbInitialTags: (dto) => { active.policies.push(dto); return active.policyOverride ?? mappers.tmdbInitialTags(dto); },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const schema = require("../../../src/storage/databaseSchema.ts");
    await schema.enableAndVerifyForeignKeys(db); await schema.evolveDatabaseSchema(db, 0);
    repo = require("../../../src/storage/savedTitlesRepo.ts"); mappers = require("../../../src/providers/tmdb/tmdbMappers.ts");
    api = require("../../../src/providers/tmdb/tmdbApi.ts");
    Screen = require(routePath).default; Date.now = () => 1000; global.alert = (message) => active.alerts.push(message);
    await savingAndPresentation(db); await remoteLifecycle();
    // Actual remote-screen re-save uses generic materialization; namespace never replaces known format.
    for (const [externalId, primaryFormat] of [["123", "ova"], ["124", null]]) {
      const reference = { provider: "tmdb", resourceNamespace: "movie", externalId };
      await repo.saveProviderTitleWithDb(db, {
        reference,
        snapshot: { medium: "audiovisual", contentFamily: "anime", primaryFormat, title: "Local anime", year: null, posterUrl: null, overview: null, genres: [], voteAverage: 6 },
        initialTags: ["Personal"],
      }, () => `anime-${externalId}`, 100);
      await repo.updateSavedTitleMetadataWithDb(db, `anime-${externalId}`, { status: "watching", notes: "Keep my note" }, () => 200);
      await repo.setPersonalRatingWithDb(db, `anime-${externalId}`, 90, () => 201);
      const before = await repo.getSavedTitleWithReferencesByIdWithDb(db, `anime-${externalId}`);
      const h = host("movie", externalId); await h.flush();
      await button(h, "Actualizar en Biblioteca").props.onPress(); await h.flush();
      const after = await repo.getSavedTitleWithReferencesByIdWithDb(db, `anime-${externalId}`);
      assert.equal(after.contentFamily, "anime");
      assert.equal(after.primaryFormat, primaryFormat ?? "movie");
      for (const field of ["id", "createdAt", "status", "notes", "personalRating", "tags", "providerReferences"]) assert.deepEqual(after[field], before[field]);
      assert.equal(h.saves[0].reference.resourceNamespace, "movie");
      assert.equal(h.saves[0].snapshot.primaryFormat, "movie");
    }
    const separate = host("movie", "880"); separate.policyOverride = ["Distinct creation policy"];
    await separate.flush(); await button(separate, "Guardar en Biblioteca").props.onPress(); await separate.flush();
    assert.deepEqual(separate.saves[0].snapshot.genres, ["Drama"]);
    assert.deepEqual(separate.saves[0].initialTags, ["Distinct creation policy"]); separate.unmount();
    assert.equal(sqlite.prepare("PRAGMA user_version").get().user_version, 5);
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    console.log("Section 5 actual TMDB screen effects, mapping, SQLite save/re-save and enrichment verification passed.");
    console.log("Hook-host coverage uses mocked UI/network modules; it does not replace browser visual QA.");
  } finally {
    Module._load = originalLoad; Date.now = originalNow; global.alert = originalAlert; sqlite.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

let active, clock = 0, timerId = 0, width = 1000, credentialReads = 0;
const timers = new Map();
const realTimer = global.setTimeout, realClear = global.clearTimeout;
global.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { at: clock + delay, fn }); return id; };
global.clearTimeout = id => timers.delete(id);
const advance = ms => { clock += ms; for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); } };
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState(initial) { const h = active, i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
    return [h.slots[i], next => { h.slots[i] = typeof next === "function" ? next(h.slots[i]) : next; h.dirty = true; }]; },
  useRef(initial) { const i = active.cursor++; return active.slots[i] ??= { current: initial }; },
  useMemo(factory, deps) { const i = active.cursor++, old = active.slots[i]; if (!old || !same(old.deps, deps)) active.slots[i] = { deps, value: factory() }; return active.slots[i].value; },
  useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
  useEffect(effect, deps) { const h = active, i = h.cursor++, old = h.slots[i]; if (!old || !same(old.deps, deps)) {
    h.slots[i] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { h.slots[i].cleanup?.(); h.slots[i].cleanup = effect(); });
  } },
};
function host(render) {
  return { slots: [], cursor: 0, effects: [], dirty: true, tree: null, navigation: [],
    render() { active = this; this.cursor = 0; this.dirty = false; this.tree = render(); this.effects.splice(0).forEach(fn => fn()); },
    async flush() { for (let i = 0; i < 15; i++) { if (this.dirty) this.render(); await new Promise(setImmediate); } assert.equal(this.dirty, false, "hooks settled"); },
    unmount() { this.slots.forEach(slot => slot?.cleanup?.()); },
  };
}
function nodes(value, result = []) { if (Array.isArray(value)) value.forEach(x => nodes(x, result)); else if (value && value.props) { result.push(value); nodes(value.props.children, result); } return result; }
function text(value) { if (Array.isArray(value)) return value.map(text).join(" "); if (value?.props) return text(value.props.children); return typeof value === "string" ? value : ""; }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const result = (namespace, id, provider = "tmdb") => ({ reference: { provider, resourceNamespace: namespace, externalId: id }, displayTitle: `Title ${id}`, releaseLabel: "2020", posterUrl: null, description: "Summary", kindLabel: namespace === "movie" ? "Película" : "Serie" });
const httpCalls = [];
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "react") return react;
  if (request === "react-native") return { ...Object.fromEntries(["ActivityIndicator", "Image", "Pressable", "Text", "TextInput", "View", "FlatList"].map(x => [x, x])),
    Platform: { OS: "web" }, Alert: { alert() {} }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width, height: 800 }), StyleSheet: { create: x => x, absoluteFillObject: {} } };
  if (request === "expo-router") return { useRouter: () => ({ push: route => active.navigation.push(route) }) };
  if (request === "@expo/vector-icons") return { Ionicons: "Ionicons" };
  if (request.endsWith("AppThemeProvider")) return { useAppTheme: () => ({ theme: { global: {}, semantic: {}, structural: {} } }) };
  if (request.endsWith("viewPreferencesRepo")) return { getViewPreference: async () => "detail", setViewPreference: async () => {} };
  if (request.endsWith("TmdbCredentialProvider")) return { useTmdbCredential() { credentialReads++; throw Error("No credential provider mounted in test-only search"); } };
  if (request === "./tmdbClient" && parent.filename.includes("tmdb")) return { tmdbFetch: async (path, params) => {
    httpCalls.push({ path, params }); return { results: [{ id: 77, title: "Movie", name: "TV", release_date: "2020-01-01", first_air_date: "2021-01-01" }] };
  } };
  if (request.endsWith("/components/browsing")) return { TitleGridCard: "TitleGridCard", ViewOptionsPanel: "ViewOptionsPanel" };
  return originalLoad.call(this, request, parent, isMain);
};
const catalog = require("../../../src/components/search/searchCategories.ts");
const { useCategorySearch, sameSearchRequest } = require("../../../src/components/search/useCategorySearch.ts");
const { SearchScreen } = require("../../../app/(tabs)/buscar.tsx");
const { TmdbError } = require("../../../src/providers/tmdb/tmdbErrors.ts");
const adapter = require("../../../src/providers/tmdb/tmdbAdapter.ts");
const category = id => catalog.SEARCH_CATEGORIES.find(x => x.id === id);
function binding(id, search) { const c = category(id); return { category: c, capability: { search }, destination: item => catalog.searchResultDestination(c, item) }; }

async function catalogAndTransport() {
  assert.deepEqual(catalog.SEARCH_CATEGORIES.map(x => x.id), ["movie", "tv", "manga", "manhwa", "manhua"]);
  for (const platform of ["web", "android", "ios"]) {
    const enabled = require("../../../src/providers/mangaupdates/availability.ts").mangaUpdatesAvailability(platform).productionEnabled;
    assert.deepEqual(catalog.productionSearchCategories(platform).map(x => x.id), enabled ? ["movie", "tv", "manga", "manhwa", "manhua"] : ["movie", "tv"]);
    for (const id of ["manga", "manhwa", "manhua", "anime", "evil-provider"]) assert.equal(catalog.resolveProductionSearchCategory(id, platform, { movie: {}, tv: {} }), null);
  }
  assert.deepEqual(catalog.productionSearchCategories("windows"), []);
  assert.equal(catalog.searchResultDestination(category("movie"), result("movie", "77")), "/tmdb/movie/77");
  assert.equal(catalog.searchResultDestination(category("tv"), result("tv", "77")), "/tmdb/tv/77");
  for (const bad of [result("tv", "77"), result("movie", "77", "unknown"), result("movie", "../settings"), result("movie", "077")]) assert.equal(catalog.searchResultDestination(category("movie"), bad), null);
  assert.equal(catalog.searchResultDestination(category("manga"), result("series", "15180124327", "mangaupdates")), "/mangaupdates/series/15180124327");
  assert.equal(catalog.searchResultDestination(category("manga"), result("series", "x/y", "mangaupdates")), null);
  assert.equal(catalog.searchResultDestination({ ...category("manga"), id: "from-backup" }, result("series", "10", "mangaupdates")), null);
  await adapter.tmdbMovieSearchCapability.search("query"); await adapter.tmdbTvSearchCapability.search("query");
  assert.deepEqual(httpCalls.map(x => x.path), ["/search/movie", "/search/tv"]);
  for (const call of httpCalls) assert.deepEqual(call.params, { query: "query", page: "1", include_adult: "false", language: "es-AR" });
  assert.equal((await adapter.createTmdbCategorySearchCapability("movie", async () => ({ results: [{ id: 78, title: "Movie" }] })).search("x"))[0].reference.resourceNamespace, "movie");
}

async function requestRaces() {
  const calls = [];
  const bind = id => binding(id, query => { const d = deferred(); calls.push({ id, query, ...d }); return d.promise; });
  const movie = bind("movie"), tv = bind("tv"), manga = bind("manga");
  const input = { query: "  same  ", selected: movie, ready: true, retry: 0, tmdbGeneration: 1 };
  const h = host(() => useCategorySearch(input)); await h.flush(); advance(349); await h.flush(); assert.equal(calls.length, 0);
  advance(1); await h.flush(); assert.equal(calls.length, 1); assert.equal(calls[0].query, "same"); assert.equal(h.tree.loading, true);
  input.selected = tv; h.render(); assert.equal(h.tree.items.length, 0); assert.equal(h.tree.error, null); await h.flush();
  assert.equal(calls.length, 2); calls[1].resolve([result("tv", "2"), result("tv", "1")]); await h.flush();
  assert.deepEqual(h.tree.items.map(x => x.reference.externalId), ["2", "1"], "single-source ranking unchanged");
  calls[0].resolve([result("movie", "old")]); await h.flush(); assert.equal(h.tree.items[0].reference.externalId, "2");
  input.retry++; h.dirty = true; await h.flush(); assert.equal(calls.length, 3); assert.equal(calls[2].id, "tv"); assert.equal(h.tree.loading, true);
  input.retry++; h.dirty = true; await h.flush(); assert.equal(calls.length, 4);
  calls[3].reject(new Error("current error")); await h.flush(); assert.equal(h.tree.error.message, "current error");
  calls[2].reject(new Error("old error")); await h.flush(); assert.equal(h.tree.error.message, "current error");
  input.selected = movie; h.render(); assert.equal(h.tree.error, null, "switch hides old error synchronously"); await h.flush(); assert.equal(calls.length, 5);
  input.query = ""; h.render(); assert.equal(h.tree.loading, false); await h.flush(); calls[4].resolve([result("movie", "3")]); await h.flush(); assert.equal(h.tree.items.length, 0);
  advance(350); await h.flush(); assert.equal(calls.length, 5, "empty never requests");
  input.query = "same"; input.selected = manga; h.dirty = true; await h.flush(); advance(350); await h.flush(); assert.equal(calls.length, 6);
  assert.equal(Object.hasOwn(h.tree.identity, "configurationGeneration"), false);
  input.tmdbGeneration = 55; h.dirty = true; await h.flush(); assert.equal(calls.length, 6, "TMDB changes do not restart non-TMDB");
  calls[5].resolve([result("series", "10", "mangaupdates")]); await h.flush(); assert.equal(h.tree.items.length, 1);
  input.selected = movie; input.ready = false; h.dirty = true; await h.flush(); assert.equal(calls.length, 6);
  input.ready = true; h.dirty = true; await h.flush(); assert.equal(calls.length, 7); assert.equal(h.tree.identity.configurationGeneration, 55);
  input.tmdbGeneration++; h.render(); assert.equal(h.tree.items.length, 0); await h.flush(); assert.equal(calls.length, 8);
  calls[7].resolve([result("movie", "8")]); await h.flush(); calls[6].resolve([result("movie", "7")]); await h.flush(); assert.equal(h.tree.items[0].reference.externalId, "8");
  assert.equal(sameSearchRequest(h.tree.identity, { ...h.tree.identity, sequence: h.tree.identity.sequence - 1 }), false);
  input.retry++; h.dirty = true; await h.flush(); const beforeUnmount = h.tree; h.unmount(); calls.at(-1).resolve([result("movie", "9")]); await h.flush(); assert.equal(h.tree, beforeUnmount, "unmounted completion ignored");
}

async function screenBehavior() {
  const movieCalls = [], tvCalls = [];
  const movie = binding("movie", query => { const d = deferred(); movieCalls.push({ query, ...d }); return d.promise; });
  const tv = binding("tv", query => { const d = deferred(); tvCalls.push({ query, ...d }); return d.promise; });
  const config = { snapshot: { status: "not-configured", tokenAvailable: false, generation: 1 }, retryInitialization: async () => config.snapshot };
  const props = { categories: catalog.productionSearchCategories("web"), resolveCategory: id => id === "movie" ? movie : id === "tv" ? tv : null, tmdb: config };
  const h = host(() => SearchScreen(props)); await h.flush();
  const input = () => nodes(h.tree).find(x => x.type === "TextInput");
  const list = () => nodes(h.tree).find(x => x.type === "FlatList");
  const controls = () => nodes(h.tree).filter(x => x.type === "Pressable" && ["Películas", "Series"].includes(x.props.accessibilityLabel));
  assert.deepEqual(controls().map(x => x.props.accessibilityLabel), ["Películas", "Series"]); assert.equal(controls()[0].props.accessibilityState.selected, true);
  assert.equal(controls()[0].props["aria-pressed"], true);
  assert.equal(controls()[1].props["aria-pressed"], false);
  input().props.onChangeText("same"); await h.flush(); advance(350); await h.flush(); assert.equal(movieCalls.length, 0);
  assert.ok(text(list().props.ListEmptyComponent).includes("TMDB no está configurado"));
  assert.ok(nodes(list().props.ListEmptyComponent).some(x => x.props.accessibilityLabel === "Configurar TMDB"));
  config.snapshot = { ...config.snapshot, status: "configured", tokenAvailable: true, generation: 2 }; h.dirty = true; await h.flush(); assert.equal(movieCalls.length, 1);
  controls()[1].props.onPress(); await h.flush(); assert.equal(tvCalls.length, 1); assert.equal(controls()[1].props.accessibilityState.selected, true);
  assert.ok(nodes(h.tree).some(x => x.props.accessibilityRole === "progressbar" && x.props.accessibilityLabel === "Buscando en Series"));
  tvCalls[0].resolve([result("tv", "77"), result("movie", "77"), result("tv", "99", "evil")]); await h.flush(); assert.equal(list().props.data.length, 1);
  const row = list().props.renderItem({ item: list().props.data[0] }); assert.equal(row.props.accessibilityRole, "button"); assert.equal(row.props.focusable, true);
  assert.ok(nodes(row).some(x => x.props.importantForAccessibility === "no-hide-descendants" && x.props["aria-hidden"]));
  active = h; row.props.onPress(); assert.equal(h.navigation.at(-1), "/tmdb/tv/77");
  movieCalls[0].resolve([result("movie", "88")]); await h.flush(); assert.equal(list().props.data[0].reference.resourceNamespace, "tv");
  const panel = nodes(h.tree).find(x => x.type === "ViewOptionsPanel"); panel.props.sections[0].onSelect("grid"); width = 390; await h.flush();
  assert.equal(list().props.numColumns, 2); const grid = list().props.renderItem({ item: list().props.data[0] }); assert.equal(grid.type, "TitleGridCard");
  active = h; grid.props.onPress(); assert.equal(h.navigation.at(-1), "/tmdb/tv/77");
  controls()[0].props.onPress(); await h.flush(); movieCalls.at(-1).reject(new TmdbError("credential-invalid")); await h.flush();
  assert.ok(text(list().props.ListEmptyComponent).includes("TMDB rechazó")); assert.ok(nodes(list().props.ListEmptyComponent).some(x => x.props.accessibilityLabel === "Cambiar token"));
  controls()[1].props.onPress(); await h.flush(); tvCalls.at(-1).reject(new TmdbError("network")); await h.flush();
  const retry = nodes(list().props.ListEmptyComponent).find(x => x.props.accessibilityLabel === "Reintentar búsqueda"); retry.props.onPress(); await h.flush(); assert.equal(tvCalls.length, 3);
  tvCalls.at(-1).resolve([]); await h.flush(); assert.ok(text(list().props.ListEmptyComponent).includes("No encontré resultados"));
  config.snapshot = { ...config.snapshot, status: "storage-error" }; h.dirty = true; await h.flush(); assert.ok(text(list().props.ListEmptyComponent).includes("No pudimos acceder"));
  assert.ok(nodes(list().props.ListEmptyComponent).some(x => x.props.accessibilityLabel === "Reintentar acceso")); h.unmount();

  // Synthetic capability lives only in this test. No token or TmdbCredentialProvider.
  const synthetic = binding("manga", async () => [result("series", "10", "mangaupdates")]);
  const s = host(() => SearchScreen({ categories: [category("manga")], resolveCategory: () => synthetic, initialCategory: "manga" }));
  await s.flush(); nodes(s.tree).find(x => x.type === "TextInput").props.onChangeText("test"); await s.flush(); advance(350); await s.flush();
  assert.equal(nodes(s.tree).find(x => x.type === "FlatList").props.data.length, 1); assert.equal(credentialReads, 0); assert.equal(text(s.tree).includes("Configurar TMDB"), false); s.unmount();
  assert.ok(httpCalls.every(x => x.path.startsWith("/search/")), "only TMDB test transport called");
}

async function main() { await catalogAndTransport(); await requestRaces(); await screenBehavior();
  const catalogSource = fs.readFileSync("src/components/search/searchCategories.ts", "utf8");
  assert.doesNotMatch(catalogSource.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""), /fetch\(|api\.mangaupdates|registry|DetailCapability/);
  console.log("Section 4: finite resolution, TMDB endpoints, lifecycle races, credential isolation, real SearchScreen hook-host and accessibility passed.");
  console.log("No actual provider HTTP, production fixture adapter, review DB or native renderer was used.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Module._load = originalLoad; global.setTimeout = realTimer; global.clearTimeout = realClear;
});

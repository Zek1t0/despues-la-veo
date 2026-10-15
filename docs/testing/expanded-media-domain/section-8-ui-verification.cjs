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
const runtimePlatform = { OS: "web" }; let routeParams = { id: "51239621230" }; let saves = []; const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "react") return react;
  if (request === "react-native") return { ...Object.fromEntries(["ActivityIndicator", "Image", "Pressable", "Text", "TextInput", "View", "FlatList", "ScrollView"].map(x => [x, x])),
    Platform: runtimePlatform, Alert: { alert() {} }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width, height: 800 }), StyleSheet: { create: x => x, absoluteFillObject: {} } };
  if (request.endsWith("savedTitlesRepo")) return { getByProviderReference: async () => null, saveProviderTitle: async (input) => { saves.push(input); return "opaque-saved"; } }; if (request === "expo-router") return { Stack: { Screen: "Screen" }, useLocalSearchParams: () => routeParams, useRouter: () => ({ push: route => active.navigation.push(route) }) };
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
const availability = require("../../../src/providers/mangaupdates/availability.ts");
const { useCategorySearch } = require("../../../src/components/search/useCategorySearch.ts");
const { SearchScreen } = require("../../../app/(tabs)/buscar.tsx");
const Detail = require("../../../app/mangaupdates/series/[id].tsx").default;
const { MangaUpdatesError } = require("../../../src/providers/mangaupdates/errors.ts");
const clientModule = require("../../../src/providers/mangaupdates/client.ts");
const { parseSeries } = require("../../../src/providers/mangaupdates/validation.ts");
const fixture = require("./fixtures/mangaupdates-minimal.json");
let detailCalls = [], pendingDetails = [];
clientModule.getMangaUpdatesClient = () => ({ getSeries(id) { const d = deferred(); detailCalls.push(id); pendingDetails.push(d); return d.promise; } });
const originalFetch = global.fetch;
global.fetch = async () => { throw Error("No real network in UI verification"); };
const category = id => catalog.SEARCH_CATEGORIES.find(c => c.id === id);
const bindings = Object.fromEntries(catalog.SEARCH_CATEGORIES.map(c => [c.id, {category:c, capability:{search:async()=>[]},destination:r=>catalog.searchResultDestination(c,r)}]));
async function main() {
  const boundary = availability.MANGAUPDATES_ANDROID_VALIDATED;
  // Test-local branch simulation only; this is not native acceptance.
  availability.MANGAUPDATES_ANDROID_VALIDATED = true;
  let input = {query:"same",selected:bindings.manga,ready:true,retry:0,tmdbGeneration:1};
  const calls = [];
  for (const binding of Object.values(bindings)) binding.capability.search = q => {const d=deferred(); calls.push({category:binding.category.id,q,...d});return d.promise;};
  const h = host(()=>useCategorySearch(input)); await h.flush(); advance(350); await h.flush();
  for (const id of ["manhwa","manhua","manga","movie","manga","tv","manhua"]) {
    const old = calls.at(-1); input.selected=bindings[id]; h.render(); assert.equal(h.tree.items.length,0); assert.equal(h.tree.error,null); await h.flush();
    old.reject(new MangaUpdatesError("network")); await h.flush(); assert.equal(h.tree.error,null); assert.equal(h.tree.loading,true);
    assert.equal(calls.at(-1).category,id);
  }
  const latest=calls.at(-1); latest.resolve([result("series","15180124327","mangaupdates")]); await h.flush(); assert.equal(h.tree.items.length,1);
  input.tmdbGeneration++; h.dirty=true; const count=calls.length; await h.flush(); assert.equal(calls.length,count);
  input.retry++; h.dirty=true; await h.flush(); assert.equal(calls.length,count+1); assert.equal(h.tree.identity.retry,1);
  input.query=""; h.render(); assert.equal(h.tree.loading,false); assert.equal(h.tree.items.length,0); await h.flush(); calls.at(-1).resolve([result("series","42","mangaupdates")]); await h.flush(); assert.equal(h.tree.items.length,0); h.unmount();
  const config={snapshot:{status:"not-configured",generation:1},retryInitialization:async()=>{}};
  const s=host(()=>SearchScreen({categories:catalog.SEARCH_CATEGORIES,resolveCategory:id=>bindings[id],tmdb:config,initialCategory:"manga"})); await s.flush();
  nodes(s.tree).find(n=>n.type==="TextInput").props.onChangeText("test"); await s.flush(); advance(350); await s.flush(); assert.equal(calls.at(-1).category,"manga");
  const list=()=>nodes(s.tree).find(n=>n.type==="FlatList");
  calls.at(-1).reject(new MangaUpdatesError("rate-limited"));await s.flush(); assert.match(text(list().props.ListEmptyComponent),/MangaUpdates/);
  assert.doesNotMatch(text(list().props.ListEmptyComponent),/Configurar TMDB|Obtener token/);
  nodes(list().props.ListEmptyComponent).find(n=>n.props.accessibilityLabel==="Reintentar búsqueda").props.onPress();await s.flush();
  calls.at(-1).resolve([result("series","51239621230","mangaupdates")]);await s.flush();const row=list().props.renderItem({item:list().props.data[0]});active=s;row.props.onPress();assert.equal(s.navigation.at(-1),"/mangaupdates/series/51239621230");
  nodes(s.tree).find(n=>n.props.accessibilityLabel==="Películas").props.onPress();await s.flush();assert.match(text(list().props.ListEmptyComponent),/TMDB no está configurado/);s.unmount();
  for (const p of ["web","ios"]) {runtimePlatform.OS=p;routeParams={id:"51239621230"};const r=host(()=>Detail());await r.flush();assert.match(text(r.tree),/no está habilitado/);assert.equal(detailCalls.length,0);r.unmount();}
  runtimePlatform.OS="android"; routeParams={id:"42\n"};const bad=host(()=>Detail());await bad.flush();assert.match(text(bad.tree),/no es válido/);assert.equal(detailCalls.length,0);bad.unmount();
  routeParams={id:"51239621230"};const r=host(()=>Detail());await r.flush();assert.equal(detailCalls.at(-1),"51239621230");
  const old=pendingDetails.at(-1);routeParams={id:"15180124327"};r.dirty=true;await r.flush();old.resolve(parseSeries({...fixture,series_id:"51239621230"}));await r.flush();assert.doesNotMatch(text(r.tree),/Cuaderno sintético/);
  pendingDetails.at(-1).resolve(parseSeries({...fixture,series_id:"15180124327",type:"Manhwa"}));await r.flush();assert.match(text(r.tree),/Datos: MangaUpdates/);assert.equal(nodes(r.tree).some(n=>typeof n.type==="function"&&n.type.name==="PosterPlaceholder"),true);
  await nodes(r.tree).find(n=>n.props.accessibilityLabel==="Guardar en Biblioteca").props.onPress();await r.flush();assert.equal(saves.length,1);assert.equal(saves[0].snapshot.posterUrl,null);assert.equal(Object.hasOwn(saves[0].snapshot,"voteAverage"),false);assert.deepEqual(saves[0].initialTags,[]);assert.equal(r.navigation.at(-1),"/title/opaque-saved");
  await nodes(r.tree).find(n=>n.props.accessibilityLabel==="Actualizar guardado").props.onPress();await r.flush();assert.equal(saves.length,2);r.unmount();
  availability.MANGAUPDATES_ANDROID_VALIDATED=boundary;
  console.log("Section 8 UI: cross-source/category stale errors/results, retry/empty/config isolation, TMDB missing-token independence, explicit routes, disabled-platform zero detail calls, invalid ID rejection, detail stale fetch, attribution/null cover/generic save passed. Hook host is not native validation.");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;global.setTimeout=realTimer;global.clearTimeout=realClear;global.fetch=originalFetch;});
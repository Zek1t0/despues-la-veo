const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: filename,
}).outputText, filename);

let active, clock = 0, timerId = 0, width = 1000, credentialReads = 0, personalPreferences = 0;
const timers = new Map();
const realTimer = global.setTimeout, realClear = global.clearTimeout;
global.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { at: clock + delay, fn }); return id; };
global.clearTimeout = id => timers.delete(id);
const advance = ms => { clock += ms; for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); } };
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  Fragment: "Fragment", createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
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
  if (request === "react-native") return { ...Object.fromEntries(["ActivityIndicator", "Image", "Pressable", "Text", "TextInput", "View", "FlatList", "ScrollView"].map(x => [x, x])),
    Platform: { OS: "web" }, Alert: { alert() {} }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width, height: 800 }), StyleSheet: { create: x => x, absoluteFillObject: {} } };
  if (request === "expo-router") return { Stack: { Screen: "Stack.Screen" }, useLocalSearchParams: () => ({ id: "1" }), useRouter: () => ({ push: route => active.navigation.push(route) }) };
  if (request === "@expo/vector-icons") return { Ionicons: "Ionicons" };
  if (request.endsWith("AppThemeProvider")) return { useAppTheme: () => ({ theme: { global: {}, semantic: {}, structural: {} } }) };
  if (request.endsWith("viewPreferencesRepo")) return { getViewPreference: async () => { personalPreferences++; throw Error('No personal preferences'); }, setViewPreference: async () => { personalPreferences++; throw Error('No personal preferences'); } };
  if (request.endsWith("savedTitlesRepo")) return { getByProviderReference: async () => { throw Error('No personal DB'); }, saveProviderTitle: async () => { throw Error('No personal write'); } };
  if (request === 'expo-sqlite' || request.endsWith('/db')) throw Error('Personal DB forbidden');
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
const {KitsuAnimeDetail}=require('../../../src/providers/kitsu/AnimeDetail.tsx');
const {KitsuError}=require('../../../src/providers/kitsu/errors.ts');
const {parseAnime}=require('../../../src/providers/kitsu/validation.ts');
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Pressable'&&(n.props.accessibilityLabel===label||text(n).trim()===label));
const record=id=>parseAnime({id,type:'anime',attributes:{canonicalTitle:`TEST Anime ${id}`,subtype:'ONA',startDate:'2020-01-01',synopsis:'Owned synthetic'}});
async function main(){
  const oldFetch=global.fetch;let network=0;global.fetch=()=>{network++;throw Error('No live network');};
  try{
    const calls=[];
    const bind=id=>binding(id,(query,signal)=>{const d=deferred();calls.push({...d,id,query,signal});return d.promise;});
    const anime=bind('anime'),manga=bind('manga'),movie=bind('movie');
    const input={query:'TEST',selected:anime,ready:true,retry:0,tmdbGeneration:1};
    const h=host(()=>useCategorySearch(input));await h.flush();advance(350);await h.flush();assert.equal(calls.length,1);
    input.query='TEST two';h.dirty=true;await h.flush();assert.equal(calls[0].signal.aborted,true);advance(350);await h.flush();
    input.selected=manga;h.render();assert.equal(h.tree.items.length,0);await h.flush();assert.equal(calls[1].signal.aborted,true);
    calls[1].resolve([result('anime','1','kitsu')]);await h.flush();assert.equal(h.tree.items.length,0);
    calls[2].resolve([result('series','2','mangaupdates')]);await h.flush();assert.equal(h.tree.items[0].reference.provider,'mangaupdates');
    input.selected=anime;h.dirty=true;await h.flush();input.tmdbGeneration++;h.dirty=true;await h.flush();assert.equal(calls.length,4,'TMDB credential changes do not reload anime');
    input.retry++;h.dirty=true;await h.flush();calls[3].reject(new KitsuError('network'));calls[4].resolve([result('anime','3','kitsu')]);await h.flush();assert.equal(h.tree.items[0].reference.externalId,'3');
    input.selected=movie;h.dirty=true;await h.flush();h.unmount();calls.at(-1).resolve([result('movie','4')]);await h.flush();
    const scoped=[];const searchBinding=binding('anime',async()=>{const d=deferred();scoped.push(d);return d.promise;});
    const s=host(()=>SearchScreen({categories:[category('anime')],resolveCategory:()=>searchBinding,initialCategory:'anime',bindings:{getViewPreference:async()=> 'detail',setViewPreference:async()=>{},openResult:destination=>s.navigation.push(destination)}}));await s.flush();
    const list=()=>nodes(s.tree).find(n=>n.type==='FlatList');
    assert.ok(text(list().props.ListEmptyComponent).includes('Kitsu'));assert.ok(!text(s.tree).includes('Configurar TMDB'));
    nodes(s.tree).find(n=>n.type==='TextInput').props.onChangeText('TEST');await s.flush();advance(350);await s.flush();
    assert.ok(nodes(s.tree).some(n=>n.props.accessibilityLabel==='Buscando en Anime'));
    scoped[0].reject(new KitsuError('network'));await s.flush();assert.ok(text(list().props.ListEmptyComponent).includes('Kitsu'));assert.ok(!text(list().props.ListEmptyComponent).includes('MangaUpdates'));
    button(list().props.ListEmptyComponent,'Reintentar búsqueda').props.onPress();await s.flush();scoped[1].resolve([]);await s.flush();assert.ok(text(list().props.ListEmptyComponent).includes('No encontré resultados'));
    nodes(s.tree).find(n=>n.type==='TextInput').props.onChangeText('TEST new');await s.flush();advance(350);await s.flush();
    scoped[2].resolve([result('anime','90071992547409939999','kitsu'),result('series','2','kitsu'),result('anime','1','tmdb')]);await s.flush();assert.equal(list().props.data.length,1);
    let row=list().props.renderItem({item:list().props.data[0]});active=s;row.props.onPress();assert.equal(s.navigation.at(-1),'/kitsu/anime/90071992547409939999');
    const panel=nodes(s.tree).find(n=>n.type==='ViewOptionsPanel');panel.props.sections[0].onSelect('grid');width=390;await s.flush();row=list().props.renderItem({item:list().props.data[0]});assert.equal(row.type,'TitleGridCard');assert.equal(row.props.posterUrl,null);s.unmount();
    const loads=[],opens=[],writes=[];let route='1',failSave=false,saveWait=null;
    const services={available:true,load:(id,signal)=>{const d=deferred();loads.push({...d,id,signal});return d.promise;},saved:async()=>null,
      save:async input=>{writes.push(input);if(failSave)throw Error('disk');if(saveWait)await saveWait.promise;return 'local-anime';},open:id=>opens.push(id),source:async()=>{}};
    const detail=host(()=>KitsuAnimeDetail({id:route,services}));await detail.flush();route='2';detail.dirty=true;await detail.flush();assert.equal(loads[0].signal.aborted,true);
    loads[0].resolve(record('1'));await detail.flush();assert.ok(!text(detail.tree).includes('TEST Anime 1'));loads[1].reject(new KitsuError('not-found'));await detail.flush();assert.ok(text(detail.tree).includes('No se encontró'));
    route='3';detail.dirty=true;await detail.flush();loads[2].reject(new KitsuError('server'));await detail.flush();button(detail.tree,'Reintentar Kitsu').props.onPress();await detail.flush();loads[3].resolve(record('3'));await detail.flush();assert.ok(text(detail.tree).includes('TEST Anime 3'));
    assert.equal(nodes(detail.tree).some(n=>n.type==='Image'),false);assert.ok(text(detail.tree).includes('Datos: Kitsu'));
    failSave=true;button(detail.tree,'Guardar en Biblioteca').props.onPress();await detail.flush();assert.ok(text(detail.tree).includes('No se pudo guardar'));assert.equal(opens.length,0);
    failSave=false;saveWait=deferred();const save=button(detail.tree,'Guardar en Biblioteca');save.props.onPress();save.props.onPress();await detail.flush();assert.equal(writes.length,2);saveWait.resolve();await detail.flush();assert.deepEqual(opens,['local-anime']);assert.ok(button(detail.tree,'Abrir en Biblioteca'));
    button(detail.tree,'Actualizar guardado').props.onPress();await detail.flush();assert.equal(writes.length,3);assert.deepEqual(opens,['local-anime'],'re-save does not navigate as a new item');detail.unmount();
    for(const id of ['1','invalid']){let touched=0;const closed=host(()=>KitsuAnimeDetail({id,services:{...services,available:false,load:async()=>{touched++;throw Error();},saved:async()=>{touched++;return null;}}}));await closed.flush();assert.equal(touched,0);assert.equal(nodes(closed.tree).some(n=>n.type==='ActivityIndicator'),false);closed.unmount();}
    assert.equal(credentialReads,0);assert.equal(network,0);assert.equal(httpCalls.length,0);assert.equal(personalPreferences,0);
    console.log('PASS B3 real search/detail hook-host: Anime category, loading/empty/Kitsu errors/retry, list/grid navigation, source/query/retry/credential/route/unmount races and aborts, no art, saved detection/double save/failure, closed detail without personal DB/network.');
  }finally{global.fetch=oldFetch;}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;global.setTimeout=realTimer;global.clearTimeout=realClear;});


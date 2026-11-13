// Screen integration, terminal-only. Hooks, native views and Image events are simulated.
// No React renderer, browser/native decoding, HTTP server or provider artwork is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const originalLoad = Module._load, originalFetch = global.fetch;
const extensions = Object.fromEntries(['.ts', '.tsx'].map(ext => [ext, require.extensions[ext]]));
for (const ext of Object.keys(extensions)) require.extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: f,
}).outputText, f);

let active, networkAttempts = 0, personalAccess = 0;
function forbiddenNetwork() { networkAttempts++; throw Error('No provider/image transport in Section 5'); }
global.fetch = forbiddenNetwork;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  Fragment: 'Fragment',
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState(initial) {
    const h = active, i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[i], next => { if (!h.live) return; h.slots[i] = typeof next === 'function' ? next(h.slots[i]) : next; h.dirty = true; }];
  },
  useRef(initial) { const h = active, i = h.cursor++; return h.slots[i] ??= { current: initial }; },
  useMemo(fn, deps) { const h = active, i = h.cursor++, old = h.slots[i]; if (!old || !same(old.deps, deps)) h.slots[i] = { deps, value: fn() }; return h.slots[i].value; },
  useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
  useEffect(fn, deps) {
    const h = active, i = h.cursor++, old = h.slots[i];
    if (!old || !same(old.deps, deps)) { h.slots[i] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { h.slots[i].cleanup?.(); h.slots[i].cleanup = fn(); }); }
  },
};
const hosts = [];
function host(render) {
  const h = { slots: [], cursor: 0, dirty: true, effects: [], live: true,
    render() {
      // Render-phase state adjustment must settle before committing child elements.
      for (let i = 0; i < 15; i++) { active = this; this.cursor = 0; this.dirty = false; this.tree = render(); if (!this.dirty) break; }
      assert.equal(this.dirty, false, 'render converges');
      this.effects.splice(0).forEach(fn => fn());
      return this.tree;
    },
    async flush() { for (let i = 0; i < 25; i++) { if (this.dirty) this.render(); await new Promise(setImmediate); } assert.equal(this.dirty, false, 'effects settle'); },
    unmount() { this.live = false; this.slots.forEach(slot => slot?.cleanup?.()); },
  };
  hosts.push(h); return h;
}
function nodes(value, out = []) { if (Array.isArray(value)) value.forEach(v => nodes(v, out)); else if (value?.props) { out.push(value); nodes(value.props.children, out); } return out; }
function text(value) { return Array.isArray(value) ? value.map(text).join(' ') : value?.props ? text(value.props.children) : typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
const find = (tree, type) => nodes(tree).find(n => n.type === type);
const button = (tree, label) => nodes(tree).find(n => n.type === 'Pressable' && (n.props.accessibilityLabel === label || text(n).trim() === label));
const flatten = style => Object.assign({}, ...[].concat(style ?? []).flat(Infinity).filter(v => v && typeof v === 'object'));

// Recursively execute the actual row/poster/collage function components. Component hosts
// survive props changes; keys remount them. This deliberately does not model a native list.
function composition() {
  const instances = new Map(); let element;
  function resolve(value, path, seen) {
    if (Array.isArray(value)) return value.map((v, i) => resolve(v, `${path}/${v?.props?.key ?? i}`, seen));
    if (!value?.props) return value;
    if (typeof value.type === 'function') {
      const key = `${path}:${value.type.name}:${value.props.key ?? ''}`; seen.add(key);
      let instance = instances.get(key);
      if (!instance) { instance = { value }; instance.h = host(() => instance.value.type(instance.value.props)); instances.set(key, instance); }
      instance.value = value;
      return resolve(instance.h.render(), key, seen);
    }
    return { ...value, props: { ...value.props, children: resolve(value.props.children, `${path}/${value.type}`, seen) } };
  }
  return {
    set(next) { element = next; return this.render(); },
    render() { const seen = new Set(); this.tree = resolve(element, 'root', seen); for (const [key, instance] of instances) if (!seen.has(key)) { instance.h.unmount(); instances.delete(key); } return this.tree; },
    unmount() { for (const instance of instances.values()) instance.h.unmount(); instances.clear(); },
  };
}

const platform = { OS: 'web' }, navigation = [], writes = [], saves = [], preferences = [];
const router = { push: route => navigation.push(route), back: () => navigation.push('back') };
let route = { id: '42' }, mode = 'detail', focusRevision = 0, libraryItems = [], localItems = new Map();
const theme = { global: {}, semantic: {}, structural: {} };
const repoBoundary = {
  getByProviderReference: async () => null,
  saveProviderTitle: async input => { saves.push(structuredClone(input)); return 'saved-section5'; },
  deleteSavedTitle: async () => { writes.push('delete'); },
  upsertSavedTitle: async item => { writes.push(structuredClone(item)); },
  setPersonalRating: async () => { writes.push('rating'); },
  updateSavedTitleMetadata: async (id, patch) => {
    writes.push({ id, patch: structuredClone(patch) }); const next = { ...localItems.get(id), ...patch }; localItems.set(id, next); return next;
  },
};
Module._load = function(name, parent, main) {
  if (name === 'react') return react;
  if (name === 'react-native') return {
    ...Object.fromEntries(['Image', 'View', 'Text', 'Pressable', 'TextInput', 'FlatList', 'ScrollView', 'ActivityIndicator', 'Modal'].map(x => [x, x])),
    Platform: platform, Alert: { alert() {} }, Linking: { openURL: forbiddenNetwork },
    useWindowDimensions: () => ({ width: 800, height: 900 }), StyleSheet: { create: x => x, absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, hairlineWidth: 1 },
  };
  if (name === 'expo-router') return { Stack: { Screen: 'Stack.Screen' }, Tabs: { Screen: 'Tabs.Screen' }, useLocalSearchParams: () => route, useRouter: () => router };
  if (name === '@react-navigation/native') return { useFocusEffect: fn => react.useEffect(fn, [fn, focusRevision]) };
  if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 0 }) };
  if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
  if (name.endsWith('AppThemeProvider')) return { useAppTheme: () => ({ theme }) };
  if (name.endsWith('savedTitlesRepo')) return repoBoundary;
  if (name.endsWith('manualContentEntries')) return { isManualContentEditable: async id => localItems.get(id)?.manualIdentity === 'manual-test' };
  if (name.endsWith('libraryScreenSnapshot')) return { getLibraryScreenSnapshot: async () => ({ items: libraryItems, pins: [] }) };
  if (name.endsWith('titleDetailPinSnapshot')) return { getTitleDetailPinSnapshot: async id => ({ item: localItems.get(id), context: null, pinnedAt: null }) };
  if (name.endsWith('titlePinsRepo')) return { setTitlePinState: async () => { writes.push('pin'); } };
  if (name.endsWith('viewPreferencesRepo')) return {
    getViewPreference: async key => key.endsWith('sort') ? 'updated-desc' : mode,
    setViewPreference: async (key, value) => { preferences.push({ key, value }); },
  };
  if (name.endsWith('TmdbCredentialProvider')) return { useTmdbCredential: () => ({ snapshot: { status: 'not-configured', generation: 1 } }) };
  if (name === './tmdbClient' && parent.filename.includes('tmdb')) return { tmdbFetch: forbiddenNetwork };
  // Keep the actual browsing exports, except the modal shell (not under test).
  if (name.endsWith('ViewOptionsPanel')) return { ViewOptionsPanel: 'ViewOptionsPanel' };
  if (name === 'expo-sqlite' || name.endsWith('/db')) { personalAccess++; throw Error('No personal database may open'); }
  if (/^(node:)?(https?|net|tls|http2)$/.test(name)) return forbiddenNetwork();
  return originalLoad.call(this, name, parent, main);
};

const { SearchScreen } = require('../../../app/(tabs)/buscar.tsx');
const Library = require('../../../app/(tabs)/libreria.tsx').default;
const Local = require('../../../app/title/[id].tsx').default;
const Remote = require('../../../app/mangaupdates/series/[id].tsx').default;
const { TagCollage } = require('../../../src/components/browsing/TagCollage.tsx');
const catalog = require('../../../src/components/search/searchCategories.ts');
const mapping = require('../../../src/providers/mangaupdates/mapping.ts');
const client = require('../../../src/providers/mangaupdates/client.ts');
const { parseSeries } = require('../../../src/providers/mangaupdates/validation.ts');
const realMaterialize = mapping.mangaUpdatesMaterializationInput;
const originalClient = client.getMangaUpdatesClient;
const assetBytes = fs.readFileSync(__dirname + '/fixtures/developer-poster.svg');
// URLs are keys into this test-only owned-byte registry. Image is not a decoder.
const a = 'https://assets.example.invalid/section5-owned-a.svg';
const b = 'https://assets.example.invalid/section5-owned-b.svg';
const assets = new Map([[a, assetBytes], [b, Buffer.from(assetBytes.toString().replace('#efb554', '#e05a77'))]]);
function eligible(image, url) { assert.ok(image, 'Image is present'); assert.equal(image.props.source.uri, url); assert.ok(assets.get(url)?.length); assert.equal(image.props.resizeMode, 'cover'); assert.equal(image.props.accessible, false); }
const placeholders = tree => nodes(tree).filter(n => n.type === 'Ionicons' && n.props.name === 'image-outline');
function frozen(value) { for (const child of Object.values(value)) if (child && typeof child === 'object') frozen(child); return Object.freeze(value); }
function saved(id, url = a, tmdb = false) { return frozen({ id, title: `Owned ${id}`, medium: tmdb ? 'audiovisual' : 'comic', contentFamily: tmdb ? null : 'manga', primaryFormat: tmdb ? 'movie' : null,
  posterUrl: url, overview: 'Offline local metadata', year: 2026, genres: ['Drama'], voteAverage: tmdb ? 7.8 : null, personalRating: 80, status: 'watching', tags: ['Owned'], notes: 'Local notes', createdAt: 1, updatedAt: 2,
  providerReferences: [{ provider: tmdb ? 'tmdb' : 'mangaupdates', resourceNamespace: tmdb ? 'movie' : 'series', externalId: id }],
}); }
const result = (id, url = a, namespace = 'movie', provider = 'tmdb') => frozen({ reference: { provider, resourceNamespace: namespace, externalId: id }, displayTitle: `Owned ${id}`, releaseLabel: '2026', posterUrl: url, description: 'Owned screen result', kindLabel: provider === 'tmdb' ? 'Película' : 'Manga' });
function panelSelect(screen, value) { const panel = find(screen.tree, 'ViewOptionsPanel'); assert.ok(panel); panel.props.sections.find(s => s.id === 'appearance').onSelect(value); }
function activation(tree) { return nodes(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel?.startsWith('Abrir ') && n.props.accessibilityLabel.includes('Owned')); }

// This matrix starts with actual renderItem outputs, never hand-constructed poster props.
function rowMatrix(label, list, first, second, expectedSize, expectedRoute) {
  const c = composition(), before = JSON.stringify([first, second]), writeCount = writes.length;
  const render = item => c.set(list.props.renderItem({ item }));
  const missing = { ...first, posterUrl: null };
  render(missing); assert.equal(find(c.tree, 'Image'), undefined); assert.equal(placeholders(c.tree).length, 1);
  render(first); const firstImage = find(c.tree, 'Image'); eligible(firstImage, a);
  if (expectedSize) for (const [key, value] of Object.entries(expectedSize)) assert.equal(flatten(firstImage.props.style)[key], value, label + ' layout');
  const open = activation(c.tree); assert.ok(open, label + ' real row activation');
  assert.equal(open.props.accessibilityRole, 'button'); assert.equal(open.props.focusable, true);
  assert.equal(open.props.accessibilityLabel.split(first.title ?? first.displayTitle).length - 1, 1);
  open.props.onPress(); assert.deepEqual(navigation.at(-1), expectedRoute);
  const styleBefore = flatten(firstImage.props.style);
  if (!expectedSize) {
    const cardStyle = flatten(open.props.style({ pressed: false }));
    assert.equal(cardStyle.aspectRatio, 2 / 3); assert.equal(cardStyle.borderRadius, 14);
    assert.ok(cardStyle.width > 0); assert.equal(styleBefore.position, 'absolute');
  }
  for (const error of ['HTTP 404', 'Network request failed', 'Image decode failed', 'Offline, no image available']) {
    find(c.tree, 'Image').props.onError({ nativeEvent: { error } }); c.render();
    assert.equal(find(c.tree, 'Image'), undefined, label + ': ' + error); assert.equal(placeholders(c.tree).length, 1);
    render({ ...first, posterUrl: b }); eligible(find(c.tree, 'Image'), b);
    firstImage.props.onError({ nativeEvent: { error: 'late old URL' } }); c.render(); eligible(find(c.tree, 'Image'), b);
    render(first); eligible(find(c.tree, 'Image'), a);
  }
  const oldA = find(c.tree, 'Image'); oldA.props.onError(); c.render();
  render(second); const oldB = find(c.tree, 'Image'); eligible(oldB, a); // same URL, different identity
  oldA.props.onError(); c.render(); eligible(find(c.tree, 'Image'), a);
  render(first); oldA.props.onError(); oldB.props.onError(); c.render(); eligible(find(c.tree, 'Image'), a);
  assert.deepEqual(flatten(find(c.tree, 'Image').props.style), styleBefore, label + ' recovery keeps crop/layout');
  assert.equal(JSON.stringify([first, second]), before); assert.equal(writes.length, writeCount, label + ' failures never write');
  assert.notEqual(list.props.keyExtractor(first), list.props.keyExtractor(second));
  c.unmount(); console.log(label + ': actual row -> real poster, null/error/URL/identity/ABA/stale callbacks, layout/focus/activation/no writes passed (simulated Image).');
}

async function searchScreens() {
  // Actual search lifecycle and debounce, with a deterministic capability boundary.
  // Manga category is explicitly injected into SearchScreen only, never the production shell.
  const categories = catalog.SEARCH_CATEGORIES;
  for (const categoryId of ['movie', 'tv', 'manga']) {
    const namespace = categoryId === 'manga' ? 'series' : categoryId;
    const provider = categoryId === 'manga' ? 'mangaupdates' : 'tmdb';
    const destination = categoryId === 'manga' ? '/mangaupdates/series/42' : `/tmdb/${namespace}/42`;
    mode = 'detail'; const first = result('42', a, namespace, provider), second = result('43', a, namespace, provider);
    const bindings = Object.fromEntries(categories.map(category => [category.id, { category, capability: { search: async () => [first, second] }, destination: item => catalog.searchResultDestination(category, item) }]));
    const screen = host(() => SearchScreen({ categories, resolveCategory: id => bindings[id], initialCategory: categoryId, tmdb: { snapshot: { status: 'configured', generation: 1 } } }));
    await screen.flush(); find(screen.tree, 'TextInput').props.onChangeText('owned'); await screen.flush();
    await new Promise(resolve => setTimeout(resolve, 380)); await screen.flush();
    let list = find(screen.tree, 'FlatList'); assert.deepEqual(list.props.data, [first, second]);
    rowMatrix('Search Detail ' + categoryId, list, first, second, { width: 80, height: 120, borderRadius: 10 }, destination);
    panelSelect(screen, 'grid'); await screen.flush(); list = find(screen.tree, 'FlatList'); assert.ok(list.props.numColumns > 1);
    rowMatrix('Search Grid ' + categoryId, list, first, second, null, destination);
    screen.unmount();
  }
}
async function libraryScreens() {
  for (const tmdb of [false, true]) {
    mode = 'detail'; libraryItems = [saved('42', a, tmdb), saved('43', a, tmdb)];
    const screen = host(() => Library()); await screen.flush();
    let list = find(screen.tree, 'FlatList'); assert.equal(list.props.data.length, 2);
    rowMatrix('Library Detail ' + (tmdb ? 'TMDB' : 'MangaUpdates'), list, ...libraryItems, { width: 70, height: 105, borderRadius: 12 }, { pathname: '/title/[id]', params: { id: '42', pinContext: 'library' } });
    const row = composition(); row.set(list.props.renderItem({ item: libraryItems[0] }));
    assert.ok(text(row.tree).includes(tmdb ? 'TMDB 7.8/10' : 'Leyendo')); row.unmount();
    panelSelect(screen, 'grid'); await screen.flush(); list = find(screen.tree, 'FlatList'); assert.ok(list.props.numColumns > 1);
    rowMatrix('Library Grid ' + (tmdb ? 'TMDB' : 'MangaUpdates'), list, ...libraryItems, null, { pathname: '/title/[id]', params: { id: '42', pinContext: 'library' } });
    screen.unmount();
  }
}

async function localScreen() {
  platform.OS = 'web'; route = { id: '42' }; localItems = new Map([['42', saved('42')], ['43', saved('43')]]);
  const screen = host(() => Local()); const c = composition();
  const render = async () => { await screen.flush(); c.set(screen.tree); return find(c.tree, 'Image'); };
  const initial = await render(); eligible(initial, a); assert.deepEqual(flatten(initial.props.style), { width: 72, height: 108, borderRadius: 12 });
  assert.equal(nodes(c.tree).some(n => n.type === 'Pressable' && text(n).trim() === 'Editar título'),false,'provider snapshot has no manual editor');
  const snapshot = JSON.stringify([...localItems]), before = writes.length;
  initial.props.onError({ nativeEvent: { error: 'Offline without available image' } }); c.render();
  assert.equal(find(c.tree, 'Image'), undefined); assert.equal(placeholders(c.tree).length, 1);
  for (const expected of ['Offline local metadata', 'Owned', 'Leyendo', 'Tu puntuación']) assert.ok(text(c.tree).includes(expected), expected);
  assert.equal(nodes(c.tree).find(n => n.type === 'TextInput' && n.props.multiline).props.value, 'Local notes');
  assert.equal(JSON.stringify([...localItems]), snapshot); assert.equal(writes.length, before);
  // Editing remains usable offline after the image error; only the explicit edit writes.
  const reading = nodes(c.tree).find(n => n.type === 'Pressable' && text(n).trim() === 'Leyendo');
  assert.ok(reading); reading.props.onPress(); await render(); assert.equal(writes.length, before + 1); assert.equal(writes.at(-1).patch.status, 'watching'); assert.equal(localItems.get('42').posterUrl, a);
  route = { id: '43' }; screen.dirty = true; const oldB = await render(); eligible(oldB, a);
  initial.props.onError(); c.render(); eligible(find(c.tree, 'Image'), a);
  route = { id: '42' }; screen.dirty = true; await render(); initial.props.onError(); oldB.props.onError(); c.render(); eligible(find(c.tree, 'Image'), a);
  // Refresh same local ID via the existing focus lifecycle, not direct LocalPoster props.
  localItems.set('42', saved('42', b)); focusRevision++; screen.dirty = true; await render(); eligible(find(c.tree, 'Image'), b);
  initial.props.onError(); c.render(); eligible(find(c.tree, 'Image'), b);
  localItems.set('42', saved('42', null)); focusRevision++; screen.dirty = true; await render(); assert.equal(find(c.tree, 'Image'), undefined); assert.equal(placeholders(c.tree).length, 1);
  localItems.set('42', {...saved('42',null),providerReferences:[],manualIdentity:'manual-test'});
  focusRevision++; screen.dirty=true; await render();
  const manualEdit=nodes(c.tree).find(n=>n.type==='Pressable'&&text(n).trim()==='Editar título');
  assert.ok(manualEdit);manualEdit.props.onPress();assert.deepEqual(navigation.at(-1),{pathname:'/manual-entry',params:{id:'42'}});
  screen.unmount(); c.unmount(); console.log('Local default screen: offline metadata/editing, focus refresh, URL/null and route ABA preserve saved poster/data (simulated Image).');
}

async function remoteScreen() {
  platform.OS = 'android'; route = { id: '42' }; let url = a, detailCalls = 0;
  client.getMangaUpdatesClient = () => ({ getSeries: async id => { detailCalls++; return parseSeries({ series_id: id, title: 'Owned remote', type: 'Manga', description: 'Owned remote summary' }); } });
  // Test-process composition only. Production passes omit on every call, asserted here.
  mapping.mangaUpdatesMaterializationInput = (record, policy) => { assert.equal(policy, 'omit'); const input = realMaterialize(record, policy); return { ...input, snapshot: { ...input.snapshot, posterUrl: url } }; };
  const screen = host(() => Remote()), c = composition();
  const render = async () => { await screen.flush(); c.set(screen.tree); return find(c.tree, 'Image'); };
  const oldA = await render(); eligible(oldA, a); assert.deepEqual(flatten(oldA.props.style), { width: 96, height: 144, borderRadius: 12 });
  assert.ok(text(c.tree).includes('Datos: MangaUpdates'));
  const count = saves.length, writeCount = writes.length;
  oldA.props.onError({ nativeEvent: { error: 'decode' } }); await render(); assert.equal(find(c.tree, 'Image'), undefined); assert.equal(placeholders(c.tree).length, 1);
  assert.equal(saves.length, count); assert.equal(writes.length, writeCount);
  button(c.tree, 'Guardar en Biblioteca').props.onPress(); await render();
  assert.equal(saves.length, count + 1); assert.equal(saves.at(-1).snapshot.posterUrl, a); assert.equal(Object.hasOwn(saves.at(-1).snapshot, 'voteAverage'), false); assert.deepEqual(navigation.at(-1), '/title/saved-section5');
  url = b; screen.dirty = true; await render(); eligible(find(c.tree, 'Image'), b); oldA.props.onError(); await render(); eligible(find(c.tree, 'Image'), b);
  url = a; route = { id: '43' }; screen.dirty = true; const oldB = await render(); eligible(oldB, a);
  route = { id: '42' }; screen.dirty = true; await render(); oldA.props.onError(); oldB.props.onError(); await render(); eligible(find(c.tree, 'Image'), a);
  url = null; screen.dirty = true; await render(); assert.equal(find(c.tree, 'Image'), undefined); assert.equal(placeholders(c.tree).length, 1);
  assert.equal(detailCalls, 3, 'image failure and URL changes do not refetch metadata');
  screen.unmount(); c.unmount(); mapping.mangaUpdatesMaterializationInput = realMaterialize; client.getMangaUpdatesClient = originalClient;
  console.log('Remote screen: owned test-only input, error -> save/navigation, URL/null and route ABA; Android branch simulation only.');
}

function collage() {
  const c = composition(); const input = [saved('42'), saved('43')], before = JSON.stringify(input), writeCount = writes.length;
  const render = items => c.set(react.createElement(TagCollage, { items, style: { width: 320 } }));
  render(input); const images = nodes(c.tree).filter(n => n.type === 'Image'); assert.equal(images.length, 2); assert.equal(placeholders(c.tree).length, 2);
  const cells = nodes(c.tree).filter(n => flatten(n.props.style).width === '50%'); assert.equal(cells.length, 4); assert.ok(cells.every(n => flatten(n.props.style).height === '50%'));
  assert.equal(flatten(c.tree.props.style).aspectRatio, 16 / 9);
  images[0].props.onError(); c.render(); assert.equal(nodes(c.tree).filter(n => n.type === 'Image').length, 1, 'sibling does not inherit failure');
  render([{ ...input[0], posterUrl: b }, input[1]]); eligible(find(c.tree, 'Image'), b);
  images[0].props.onError(); c.render(); eligible(find(c.tree, 'Image'), b);
  render([input[1], input[0]]); images[0].props.onError(); c.render(); assert.equal(nodes(c.tree).filter(n => n.type === 'Image').length, 2);
  render(input); images[1].props.onError(); c.render(); assert.equal(nodes(c.tree).filter(n => n.type === 'Image').length, 1, 'reordering preserves the still-mounted sibling and its current callback');
  render([saved('44'), saved('45')]); render(input);
  images.forEach(image => image.props.onError()); c.render(); assert.equal(nodes(c.tree).filter(n => n.type === 'Image').length, 2, 'fully remounted ABA cells ignore callbacks from unmounted hosts');
  assert.equal(JSON.stringify(input), before); assert.equal(writes.length, writeCount); c.unmount();
  console.log('Tag collage: actual cell composition, sibling isolation, URL/reorder/ABA remounts and 2x2 crop/layout passed.');
}

async function main() {
  await searchScreens(); await libraryScreens(); await localScreen(); await remoteScreen(); collage();
  assert.equal(networkAttempts, 0); assert.equal(personalAccess, 0);
  assert.ok(preferences.some(p => p.key === 'search.viewMode' && p.value === 'grid'));
  assert.ok(preferences.some(p => p.key === 'library.viewMode' && p.value === 'grid'));
  console.log('Section 5 PASS: executable screen composition; zero transport/personal DB access. Image eligibility/events only, no HTTP/decode/browser/native acceptance.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  hosts.forEach(h => h.unmount()); mapping.mangaUpdatesMaterializationInput = realMaterialize; client.getMangaUpdatesClient = originalClient;
  Module._load = originalLoad; global.fetch = originalFetch; for (const [ext, value] of Object.entries(extensions)) if (value) require.extensions[ext] = value; else delete require.extensions[ext];
});

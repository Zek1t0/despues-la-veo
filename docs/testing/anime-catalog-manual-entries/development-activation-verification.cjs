// Deterministic normal-app wiring test. Never performs live HTTP or opens SQLite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: f,
}).outputText, f);
const oldLoad = Module._load, oldFetch = global.fetch, oldDev = global.__DEV__;
const calls = [], savedInputs = [], navigation = [];
let platform = 'web', savedReads = 0;
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
Module._load = function(request, parent, main) {
  if (request === 'react') return react;
  if (request === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
  if (request === 'react-native') return { Platform: { get OS() { return platform; } }, Linking: { openURL: async () => {} }, StyleSheet: { create: x => x } };
  if (request === 'expo-router') return { Stack: { Screen: 'Screen' }, useLocalSearchParams: () => ({ id: '1' }), useRouter: () => ({ push: route => navigation.push(route) }) };
  if (request.endsWith('AppThemeProvider')) return {};
  if (request.endsWith('savedTitlesRepo')) return {
    getByProviderReference: async ref => { savedReads++; assert.deepEqual(ref, { provider: 'kitsu', resourceNamespace: 'anime', externalId: '1' }); return { id: 'local-synthetic' }; },
    saveProviderTitle: async input => { savedInputs.push(input); return 'local-synthetic'; },
  };
  if (request === 'expo-sqlite' || request.endsWith('/db')) throw Error('No personal DB allowed');
  return oldLoad.call(this, request, parent, main);
};
const record = { type: 'anime', id: '1', attributes: { canonicalTitle: 'Owned synthetic record', subtype: 'ONA', startDate: '2020-01-01', synopsis: 'Synthetic summary' } };
global.fetch = async function(url, options) {
  assert.equal(this, globalThis, 'fetch must receive the global receiver, not client options');
  calls.push({ url, options });
  assert.ok(url.startsWith('https://kitsu.io/api/edge/anime'));
  assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
  assert.deepEqual(options.headers, { Accept: 'application/vnd.api+json' });
  assert.ok(!/poster|averageRating|mappings/.test(url));
  return { ok: true, status: 200, url, redirected: false, text: async () => JSON.stringify({ data: url.includes('/anime/1?') ? record : [record] }) };
};
const { kitsuAvailability } = require('../../../src/providers/kitsu/availability.ts');
const product = require('../../../src/providers/kitsu/product.ts');
const categories = require('../../../src/components/search/searchCategories.ts');
const { kitsuMaterializationInput } = require('../../../src/providers/kitsu/mapping.ts');
const Screen = require('../../../app/kitsu/anime/[id].tsx').default;
const services = () => Screen().props.children.find(child => child?.props?.services).props.services;
async function main() {
  for (const development of [undefined, false, true]) {
    if (development === undefined) delete global.__DEV__; else global.__DEV__ = development;
    for (platform of ['web', 'android', 'ios', 'unknown']) {
      const expected = development === true && ['web', 'android'].includes(platform);
      const state = kitsuAvailability(platform);
      assert.equal(state.enabled, expected); assert.equal(state.developmentEnabled, expected);
      assert.equal(state.productionEnabled, false); assert.equal(state.metadata, 'pending'); assert.equal(state.technical, 'pending'); assert.equal(state.artwork, 'omit');
      assert.equal(categories.productionSearchCategories(platform).some(c => c.id === 'anime'), expected);
      assert.equal(services().available, expected);
      if (!expected) {
        const before = [calls.length, savedReads, savedInputs.length];
        await assert.rejects(product.kitsuProductSearch(() => platform).search('Owned'), e => e.code === 'unavailable');
        await assert.rejects(product.loadKitsuProductDetail('1', platform), e => e.code === 'unavailable');
        await assert.rejects(services().saved({ reference: {} }), e => e.code === 'unavailable');
        await assert.rejects(services().save({}), e => e.code === 'unavailable');
        assert.deepEqual([calls.length, savedReads, savedInputs.length], before);
      }
    }
  }
  global.__DEV__ = true; platform = 'web';
  const capability = product.kitsuProductSearch(() => platform);
  const binding = categories.resolveProductionSearchCategory('anime', platform, {}, undefined, capability);
  assert.ok(binding);
  const results = await binding.capability.search('Owned');
  assert.equal(binding.destination(results[0]), '/kitsu/anime/1');
  // The shared client already exists: a later monitor must still see requests.
  const originalTransport = global.fetch;
  let replacementCalls = 0;
  global.fetch = function(...args) {
    assert.equal(this, globalThis, 'replacement fetch must also receive the global receiver');
    replacementCalls++;
    return Reflect.apply(originalTransport, this, args);
  };
  const detail = await services().load('1', new AbortController().signal);
  assert.equal(replacementCalls, 1, 'shared client must resolve global fetch at request time');
  const input = kitsuMaterializationInput(detail);
  assert.equal(input.snapshot.primaryFormat, 'ona'); assert.equal(input.snapshot.posterUrl, null);
  assert.equal(Object.hasOwn(input.snapshot, 'voteAverage'), false);
  assert.equal(await services().saved(input), 'local-synthetic');
  assert.equal(await services().save(input), 'local-synthetic');
  services().open('local-synthetic');
  assert.deepEqual(navigation, [{ pathname: '/title/[id]', params: { id: 'local-synthetic' } }]);
  assert.deepEqual(savedInputs, [input]);
  assert.equal(product.localKitsuSources([input.reference], platform)[0].sourceUrl, 'https://kitsu.io/api/edge/anime/1');
  assert.equal(product.localKitsuSources([input.reference], platform)[0].destination, '/kitsu/anime/1');
  const { createKitsuClient } = require('../../../src/providers/kitsu/client.ts');
  await assert.rejects(createKitsuClient({ apiBase: 'https://kitsu.io/api/edge', fetchImplementation: async () => ({ ok: true, url: 'https://kitsu.app/api/edge/anime/1', redirected: false }) }).getAnime('1'), e => e.code === 'access-rejected');
  const before = calls.length;
  const { createReviewKitsuClient } = require('../../../src/dev/mediaReview/kitsuFixture.ts');
  assert.equal((await createReviewKitsuClient(false).searchAnime('TEST')).length, 7);
  assert.equal(calls.length, before, 'TEST stays offline even in live-enabled development');
  assert.equal(calls.length, 2, 'only explicit search/detail requests; no background catalog downloads');
  console.log('PASS local development activation: Web/Android normal search + route/save wiring, official io endpoint, no artwork/scores/auth, release/iOS/unknown closed before HTTP/DB, synthetic TEST isolation.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  Module._load = oldLoad; global.fetch = oldFetch;
  if (oldDev === undefined) delete global.__DEV__; else global.__DEV__ = oldDev;
});

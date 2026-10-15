// Deterministic product contracts and real SQLite save/backup. No real HTTP or native claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require.extensions['.ts'] = (m, filename) => m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);
const originalLoad = Module._load, originalFetch = global.fetch;
let platform = 'web', http = 0;
global.fetch = async () => { http++; throw Error('No real HTTP in deterministic verification'); };
Module._load = function(request, parent, main) {
  if (request === 'react-native') return { Platform: { get OS() { return platform; } } };
  if (request === 'expo-sqlite') return {};
  return originalLoad.call(this, request, parent, main);
};
const availability = require('../../../src/providers/mangaupdates/availability.ts');
const catalog = require('../../../src/components/search/searchCategories.ts');
const product = require('../../../src/providers/mangaupdates/product.ts');
const { mangaUpdatesSearchCapabilities } = require('../../../src/components/search/mangaUpdatesSearch.ts');
const { MangaUpdatesError } = require('../../../src/providers/mangaupdates/errors.ts');
const { presentMangaUpdatesError } = require('../../../src/providers/mangaupdates/errorPresentation.ts');
const { parseSeries, parseSearchResponse } = require('../../../src/providers/mangaupdates/validation.ts');
const { mangaUpdatesMaterializationInput } = require('../../../src/providers/mangaupdates/mapping.ts');
const { ensureLibrarySchema } = require('../../../src/storage/databaseSchema.ts');
const repo = require('../../../src/storage/savedTitlesRepo.ts');
const storage = require('../../../src/storage/savedTitleStorage.ts');
const { upsertSavedTitleAndCleanPinsWithDb } = require('../../../src/storage/savedTitleIntegrity.ts');
const { setTitlePinStateWithDb } = require('../../../src/storage/titlePinsRepo.ts');
const { getLibraryBackupExportDataWithDb } = require('../../../src/storage/libraryBackupExport.ts');
const { mergeLibraryBackupWithDb } = require('../../../src/storage/libraryBackupMerge.ts');
const { createLibraryBackupV6 } = require('../../../src/core/libraryBackupV6.ts');
const { parseLibraryBackup } = require('../../../src/core/libraryBackup.ts');
const fixture = require('./fixtures/mangaupdates-minimal.json');
function database() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
  const args = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  return { sqlite, async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...args(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...args(values)); },
    async runAsync(sql, ...values) { return sqlite.prepare(sql).run(...args(values)); },
    async withTransactionAsync(task) { sqlite.exec('BEGIN'); try { await task(); sqlite.exec('COMMIT'); } catch(e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
}
async function main() {
  const originalBoundary = availability.MANGAUPDATES_ANDROID_VALIDATED;
  const caps = Object.fromEntries(catalog.SEARCH_CATEGORIES.map(c => [c.id, { async search() { return []; } }]));
  const tmdb = { movie: caps.movie, tv: caps.tv };
  // Module-local test override only. Never edits or supplies a product activation switch.
  for (const validated of [false, true]) {
    availability.MANGAUPDATES_ANDROID_VALIDATED = validated;
    for (const p of ['web','ios','android']) {
      const enabled = p === 'android' && validated;
      assert.equal(availability.mangaUpdatesAvailability(p).productionEnabled, enabled);
      assert.deepEqual(catalog.productionSearchCategories(p).map(c => c.id), enabled ? ['movie','tv','manga','manhwa','manhua'] : ['movie','tv']);
      for (const id of ['manga','manhwa','manhua']) {
        const binding = catalog.resolveProductionSearchCategory(id, p, tmdb, caps);
        assert.equal(binding?.capability ?? null, enabled ? caps[id] : null);
      }
      platform = p;
      if (!enabled) {
        await assert.rejects(mangaUpdatesSearchCapabilities.manga.search('TEST'), e => e.code === 'platform-unavailable');
        await assert.rejects(product.loadMangaUpdatesProductDetail('51239621230', p, undefined, undefined, { getSeries() { throw Error('Gate failed'); } }), e => e.code === 'platform-unavailable');
      }
    }
  }
  availability.MANGAUPDATES_ANDROID_VALIDATED = originalBoundary;
  assert.equal(http, 0);
  for (const p of ['web','ios']) assert.equal(product.localMangaUpdatesSources([{ provider: 'mangaupdates', resourceNamespace: 'series', externalId: '15180124327' }], p)[0].destination, null);
  assert.deepEqual(product.localMangaUpdatesSources([{ provider: 'unknown', resourceNamespace: 'series', externalId: '42' }], 'web'), []);
  const manga = catalog.SEARCH_CATEGORIES.find(c => c.id === 'manga');
  for (const reference of [ { provider:'unknown',resourceNamespace:'series',externalId:'42' }, {provider:'mangaupdates',resourceNamespace:'movie',externalId:'42'}, {provider:'mangaupdates',resourceNamespace:'series',externalId:'42\n'} ]) assert.equal(catalog.searchResultDestination(manga, { reference }), null);
  for (const code of ['network','timeout','access-rejected','rate-limited','not-found','invalid-response','unsupported-type','platform-unavailable']) {
    const error = presentMangaUpdatesError(new MangaUpdatesError(code)); assert.match(error.message, /MangaUpdates/); assert.doesNotMatch(error.message, /token|TMDB/);
    assert.equal(error.retryable, ['network','timeout','rate-limited'].includes(code));
  }
  const novel = { ...fixture, type:'Novel' };
  assert.throws(() => parseSeries(novel), e => e.code === 'unsupported-type');
  assert.equal(parseSearchResponse({total_hits:2,page:1,per_page:25,results:[{record:fixture},{record:novel}]},'Manga').records.length,1);
  const db = database(), restored = database();
  try {
    await ensureLibrarySchema(db); await ensureLibrarySchema(restored);
    let serial = 0; const generate = () => `local-opaque-${++serial}`;
    for (const [type,id] of [['Manga','51239621230'],['Manhwa','15180124327'],['Manhua','9876543210123']]) {
      const input = mangaUpdatesMaterializationInput(parseSeries({...fixture,type,series_id:id}));
      assert.equal(Object.hasOwn(input.snapshot,'voteAverage'),false); assert.equal(input.snapshot.posterUrl,null); assert.deepEqual(input.initialTags,[]);
      const local = await repo.saveProviderTitle(input,generate,db);
      const initial = await storage.getSavedTitleWithReferencesByIdWithDb(db,local);
      assert.equal(initial.voteAverage,null); assert.equal(initial.primaryFormat,null); assert.equal(initial.status,'planned');
      await repo.updateSavedTitleMetadataWithDb(db,local,{status:'watching',tags:['Personal'],notes:'Keep note'});
      await repo.setPersonalRatingWithDb(db,local,87);
      await setTitlePinStateWithDb(db,local,{contextType:'library',contextKey:''},1234);
      const personal = await storage.getSavedTitleWithReferencesByIdWithDb(db,local);
      await upsertSavedTitleAndCleanPinsWithDb(db,{...personal,primaryFormat:type === 'Manhwa' ? 'webtoon':'one-shot',voteAverage:7.9});
      const refreshedInput = {...input,snapshot:{...input.snapshot,title:'TEST refreshed',genres:['Drama']},initialTags:['Must not replace']};
      assert.equal(await repo.saveProviderTitle(refreshedInput,generate,db),local);
      const refreshed = await storage.getSavedTitleWithReferencesByIdWithDb(db,local);
      assert.equal(refreshed.createdAt,initial.createdAt); assert.equal(refreshed.notes,'Keep note'); assert.deepEqual(refreshed.tags,['Personal']);
      assert.equal(refreshed.personalRating,87); assert.equal(refreshed.status,'watching'); assert.equal(refreshed.voteAverage,7.9);
      assert.equal(refreshed.primaryFormat,type === 'Manhwa' ? 'webtoon':'one-shot'); assert.deepEqual(refreshed.genres,['Drama']);
      assert.ok(refreshed.updatedAt >= personal.updatedAt);
      const before = JSON.stringify(refreshed);
      await assert.rejects(repo.saveProviderTitle({...input,snapshot:{...input.snapshot,medium:'literature',contentFamily:null,primaryFormat:'novel'}},generate,db));
      assert.equal(JSON.stringify(await storage.getSavedTitleWithReferencesByIdWithDb(db,local)),before);
      for (const value of [null,undefined,8]) await assert.rejects(repo.saveProviderTitle({...input,snapshot:{...input.snapshot,voteAverage:value}},generate,db));
      assert.equal(product.localMangaUpdatesSources(refreshed.providerReferences,'web')[0].label,'Datos: MangaUpdates');
    }
    const nullableInput = mangaUpdatesMaterializationInput(parseSeries({...fixture,series_id:'30535847369'}));
    const nullableId = await repo.saveProviderTitle(nullableInput,generate,db);
    await storage.attachProviderReferenceWithDb(db,{provider:'unknown-source',resourceNamespace:'work',externalId:'9007199254740993'},nullableId);
    const nullable = await storage.getSavedTitleWithReferencesByIdWithDb(db,nullableId);
    assert.equal(nullable.primaryFormat,null); assert.equal(nullable.voteAverage,null); assert.equal(nullable.providerReferences.length,2);
    const data = await getLibraryBackupExportDataWithDb(db,{status:'unavailable',reason:'pending'});
    const backup = createLibraryBackupV6(data.items,data.pins,data.appearanceAvailability);
    assert.equal(backup.version,6); assert.equal(backup.pins.length,3);
    const parsed = parseLibraryBackup(JSON.stringify(backup)); assert.equal(parsed.ok,true);
    await restored.withTransactionAsync(() => mergeLibraryBackupWithDb(restored,parsed.payload,()=>'restored-opaque'));
    const roundTrip = await getLibraryBackupExportDataWithDb(restored,{status:'unavailable',reason:'pending'});
    assert.deepEqual(roundTrip.items,data.items); assert.deepEqual(roundTrip.pins,data.pins);
    const restoredNullable = await storage.getSavedTitleWithReferencesByIdWithDb(restored,nullableId);
    assert.equal(restoredNullable.primaryFormat,null); assert.equal(restoredNullable.medium,'comic'); assert.equal(restoredNullable.contentFamily,'manga');
    assert.equal(restoredNullable.providerReferences[0].resourceNamespace,'series');
    for (const handle of [db,restored]) assert.equal(handle.sqlite.prepare('PRAGMA user_version').get().user_version,5);
    assert.equal(http,0,'Local save/provenance/backup/offline reads perform no HTTP');
  } finally { db.sqlite.close(); restored.sqlite.close(); }
  console.log('Section 8 contracts: finite platform gates, destinations, provider errors, unsupported Novel, real SQLite generic save/re-save/personal preservation/null refresh/rating ownership and backup v6 passed. No native claim.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;global.fetch=originalFetch;});

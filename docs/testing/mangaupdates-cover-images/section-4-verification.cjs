// Real application persistence with isolated node:sqlite databases. No artwork or HTTP.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

const originalLoad = Module._load, originalFetch = global.fetch;
const originalTs = require.extensions['.ts'];
let networkAttempts = 0;
function forbiddenNetwork() { networkAttempts++; throw Error('Section 4 forbids provider/image network access'); }
global.fetch = forbiddenNetwork;
require.extensions['.ts'] = (m, filename) => m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);
Module._load = function(request, parent, main) {
  if (request === 'expo-sqlite') return { openDatabaseAsync() { throw Error('Must use an isolated test DB'); } };
  if (/^(node:)?(https?|net|tls|http2)$/.test(request) || /(?:mangaupdates|tmdb)[/\\](?:client|tmdbClient)/.test(request)) {
    forbiddenNetwork();
  }
  return originalLoad.call(this, request, parent, main);
};

const { parseSeries } = require('../../../src/providers/mangaupdates/validation.ts');
const { mangaUpdatesMaterializationInput } = require('../../../src/providers/mangaupdates/mapping.ts');
const { providerReferenceKey } = require('../../../src/core/providerReference.ts');
const { ensureLibrarySchema } = require('../../../src/storage/databaseSchema.ts');
const repo = require('../../../src/storage/savedTitlesRepo.ts');
const storage = require('../../../src/storage/savedTitleStorage.ts');
const { upsertSavedTitleAndCleanPinsWithDb } = require('../../../src/storage/savedTitleIntegrity.ts');
const pins = require('../../../src/storage/titlePinsRepo.ts');
const { createTmdbSavedTitleMaterializationInput, createTmdbProviderReference } = require('../../../src/core/tmdbSavedTitle.ts');
const { getLibraryBackupExportDataWithDb } = require('../../../src/storage/libraryBackupExport.ts');
const { createLibraryBackupV6 } = require('../../../src/core/libraryBackupV6.ts');
const { parseLibraryBackup } = require('../../../src/core/libraryBackup.ts');
const { mergeLibraryBackupWithDb } = require('../../../src/storage/libraryBackupMerge.ts');

const handles = [];
function database(label) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  const args = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = { label, sqlite,
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...args(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...args(values)); },
    async runAsync(sql, ...values) { return sqlite.prepare(sql).run(...args(values)); },
    async withTransactionAsync(task) {
      sqlite.exec('BEGIN');
      try { await task(); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  handles.push(db);
  return db;
}
const urlA = 'https://cdn.mangaupdates.com/TEST-section4-original.png';
const urlB = 'https://cdn.mangaupdates.com/TEST-section4-replacement.png';
const huge = '900719925474099312345678901234567890';
function input(id = huge, posterUrl = urlA, type = 'Manga', policy = 'reference-https') {
  return mangaUpdatesMaterializationInput(parseSeries({ series_id: id, title: `Synthetic ${type}`, type,
    year: '2026', description: 'Developer-controlled metadata', genres: [{genre:'Drama'}],
    image: { url: { original: posterUrl, thumb: null } },
  }), policy);
}
let serial = 0;
const generate = () => `section4-local-${++serial}`;
const read = (db, id) => storage.getSavedTitleWithReferencesByIdWithDb(db, id);
const count = db => db.sqlite.prepare('SELECT count(*) AS n FROM saved_titles').get().n;
const schemaSnapshot = db => JSON.stringify(db.sqlite.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all());
function dataSnapshot(db) {
  return JSON.stringify(['saved_titles','media_provider_references','legacy_saved_title_identities','title_pins','app_preferences']
    .map(table => [table, db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1,2,3`).all()]));
}
function personal(item) {
  return Object.fromEntries(['id','createdAt','status','notes','tags','personalRating','medium','contentFamily','primaryFormat','providerReferences','voteAverage'].map(k => [k,item[k]]));
}

async function sqliteAndResave() {
  const db = database('save-source');
  await ensureLibrarySchema(db);
  const schemaBefore = schemaSnapshot(db);
  const oldInput = input('900719925474099399999', null);
  const oldId = await repo.saveProviderTitle(oldInput, generate, db);
  const oldNull = await read(db, oldId);
  const ids = [];
  for (const [index, type] of ['Manga','Manhwa','Manhua'].entries()) {
    const materialization = input(`${huge}${index}`, urlA, type);
    const reference = {provider:'mangaupdates', resourceNamespace:'series', externalId:`${huge}${index}`};
    assert.deepEqual(materialization.reference, reference);
    assert.equal(providerReferenceKey(reference), `mangaupdates\0series\0${huge}${index}`);
    assert.equal(Object.hasOwn(materialization.snapshot,'voteAverage'), false);
    assert.deepEqual(materialization.initialTags, []);
    const id = await repo.saveProviderTitle(materialization, generate, db);
    ids.push(id);
    const created = await read(db, id);
    assert.equal(created.posterUrl, urlA);
    assert.equal(created.status, 'planned'); assert.deepEqual(created.tags, []);
    assert.equal(created.voteAverage, null); assert.equal(created.personalRating, null);
    assert.deepEqual(created.providerReferences, [reference]);
    const external = db.sqlite.prepare('SELECT external_id, typeof(external_id) AS type FROM media_provider_references WHERE saved_title_id=?').get(id);
    assert.equal(external.external_id, reference.externalId); assert.equal(external.type,'text');
    const neverGenerate = () => { throw Error('Re-save must reuse identity'); };
    await repo.updateSavedTitleMetadataWithDb(db, id, {status:['watching','done','dropped'][index],notes:`Personal note ${index}`,tags:['Keep','Personal']});
    await repo.setPersonalRatingWithDb(db,id,81+index);
    await pins.setTitlePinStateWithDb(db,id,{contextType:'library',contextKey:''},100+index);
    await pins.setTitlePinStateWithDb(db,id,{contextType:'tag',contextKey:'Keep'},200+index);
    // Refine via the generic save path; later less-specific or conflicting input cannot erase it.
    const format = type === 'Manhwa' ? 'webtoon' : 'one-shot';
    await repo.saveProviderTitle({...materialization,snapshot:{...materialization.snapshot,primaryFormat:format}},neverGenerate,db);
    await storage.attachProviderReferenceWithDb(db,{provider:'developer-test',resourceNamespace:'work',externalId:`opaque/${reference.externalId}`},id);
    const preserved = await read(db,id), beforePins = await pins.listAllPinsForBackupV5WithDb(db);
    for (const posterUrl of [urlB, null, urlA]) {
      const next = input(reference.externalId,posterUrl,type);
      assert.equal(await repo.saveProviderTitle({...next,snapshot:{...next.snapshot,title:'Synthetic refreshed',contentFamily:type==='Manga'?'manhua':'manga'},initialTags:[]},neverGenerate,db),id);
      const refreshed = await read(db,id);
      assert.equal(refreshed.posterUrl,posterUrl);
      assert.deepEqual(personal(refreshed),personal(preserved));
      assert.equal(refreshed.createdAt,created.createdAt);
      assert.ok(refreshed.updatedAt>preserved.updatedAt);
      assert.deepEqual(await pins.listAllPinsForBackupV5WithDb(db),beforePins);
    }
    await repo.saveProviderTitle({...materialization,initialTags:['Must not replace personal tags']},neverGenerate,db);
    assert.deepEqual((await read(db,id)).tags,['Keep','Personal']);
    for (const voteAverage of [null,undefined,8.8]) {
      const before = dataSnapshot(db);
      await assert.rejects(repo.saveProviderTitle({...materialization,snapshot:{...materialization.snapshot,voteAverage}},neverGenerate,db),/exclusivamente por TMDB/);
      assert.equal(dataSnapshot(db),before);
    }
    const before = dataSnapshot(db);
    await assert.rejects(repo.saveProviderTitle({...materialization,snapshot:{...materialization.snapshot,medium:'literature',contentFamily:null,primaryFormat:'novel'}},neverGenerate,db),/medio/);
    assert.equal(dataSnapshot(db),before);
    assert.equal((await storage.getSavedTitleByProviderReferenceWithDb(db,reference)).id,id);
  }
  assert.equal(count(db),4,'one old item plus three unique titles after all re-saves');
  // Full reference tuple: same external ID under another namespace/provider has no owner.
  const ref = input(`${huge}0`).reference;
  assert.equal(await storage.getSavedTitleByProviderReferenceWithDb(db,{...ref,provider:'other-test'}),null);
  assert.equal(await storage.getSavedTitleByProviderReferenceWithDb(db,{...ref,resourceNamespace:'other-resource'}),null);
  const tmdb = createTmdbSavedTitleMaterializationInput(createTmdbProviderReference('movie','77'), {
    medium:'audiovisual',contentFamily:null,primaryFormat:'movie',title:'Synthetic TMDB',year:2026,
    posterUrl:'https://developer.example.invalid/tmdb.png',overview:'Synthetic',genres:['Drama'],voteAverage:7.2,
  });
  const tmdbId = await repo.saveProviderTitle(tmdb,generate,db);
  assert.equal((await read(db,tmdbId)).voteAverage,7.2);
  await repo.saveProviderTitle({...tmdb,snapshot:{...tmdb.snapshot,voteAverage:8.4}},()=>{throw Error('TMDB duplicated');},db);
  assert.equal((await read(db,tmdbId)).voteAverage,8.4);
  // Existing legacy rating is preserved by a provider that does not own it.
  const legacy = await read(db,ids[0]);
  await upsertSavedTitleAndCleanPinsWithDb(db,{...legacy,voteAverage:6.1});
  await repo.saveProviderTitle(input(`${huge}0`),generate,db);
  assert.equal((await read(db,ids[0])).voteAverage,6.1);
  assert.equal((await read(db,tmdbId)).voteAverage,8.4);
  await ensureLibrarySchema(db);
  await repo.listSavedTitlesWithDb(db);
  assert.deepEqual(await read(db,oldId),oldNull,'no reads, schema checks or unrelated refresh backfill old null covers');
  const productive = input('90071992547409938888',urlA,'Manga','omit');
  assert.equal(productive.snapshot.posterUrl,null);
  assert.equal(mangaUpdatesMaterializationInput(parseSeries({series_id:'42',title:'Synthetic default',type:'Manga',image:{url:{original:urlA}}})).snapshot.posterUrl,null);
  const productiveId = await repo.saveProviderTitle(productive,generate,db);
  assert.equal((await read(db,productiveId)).posterUrl,null);
  assert.equal(schemaSnapshot(db),schemaBefore);
  assert.equal(db.sqlite.prepare('PRAGMA user_version').get().user_version,6);
  assert.equal(networkAttempts,0);
  console.log('PASS 4.1: real mapper -> serialized saveProviderTitle -> materializer -> SQLite; URL/null refresh, exact large references, no duplicates, personal/classification/pins/rating ownership and no backfill.');
  return {db,ids,oldId};
}

const appearance = {status:'unavailable',reason:'pending'};
async function exportBackup(db) {
  const data = await getLibraryBackupExportDataWithDb(db,appearance);
  return createLibraryBackupV6(data.items,data.pins,data.appearanceAvailability,'2026-11-09T00:00:00.000Z');
}
function parse(value) {
  const result = parseLibraryBackup(JSON.stringify(value));
  assert.equal(result.ok,true);
  assert.deepEqual(result.payload.invalid,[]);
  if (result.payload.invalidPins) assert.deepEqual(result.payload.invalidPins,[]);
  return result.payload;
}
async function merge(db, backup, generateId = generate) {
  let result;
  await db.withTransactionAsync(async () => { result = await mergeLibraryBackupWithDb(db,parse(backup),generateId); });
  return result;
}
function cleanMerge(result) {
  assert.deepEqual(result.failed,[]); assert.deepEqual(result.conflicts,[]);
  assert.deepEqual(result.pins.failed,[]); assert.deepEqual(result.pins.invalid,[]);
}
const sortedBackup = backup => ({...backup,items:[...backup.items].sort((a,b)=>a.id.localeCompare(b.id))});
const one = (item, extraPins = []) => ({version:6,items:[item],pins:extraPins});

async function backupAndMerge(source) {
  const backup = await exportBackup(source.db), sourceBefore = dataSnapshot(source.db);
  assert.equal(backup.version,6);
  assert.deepEqual(Object.keys(backup).sort(),['exportedAt','items','pins','version']);
  const expectedKeys = ['id','medium','contentFamily','primaryFormat','title','year','posterUrl','overview','voteAverage','personalRating','genres','status','tags','notes','createdAt','updatedAt','providerReferences'].sort();
  for (const item of backup.items) {
    assert.deepEqual(Object.keys(item).sort(),expectedKeys,'no binary/image/sentinel/schema fields');
    assert.ok(item.posterUrl===null||typeof item.posterUrl==='string');
    assert.equal(typeof item.providerReferences[0].externalId,'string');
  }
  assert.ok(backup.items.some(item=>item.posterUrl===urlA));
  assert.ok(backup.items.some(item=>item.posterUrl===null));
  assert.doesNotMatch(JSON.stringify(backup),/data:image|base64|"imageData"|"imageBytes"/);
  const restored = database('round-trip'); await ensureLibrarySchema(restored);
  const schemaBefore = schemaSnapshot(restored);
  const first = await merge(restored,backup); cleanMerge(first);
  assert.equal(first.inserted,backup.items.length); assert.equal(first.pins.inserted,backup.pins.length);
  assert.deepEqual(sortedBackup(await exportBackup(restored)),sortedBackup(backup));
  for (const item of backup.items) {
    assert.deepEqual(await read(restored,item.id),item,'complete persisted title and references round-trip');
  }
  const repeated = await merge(restored,backup); cleanMerge(repeated);
  assert.equal(repeated.skipped,backup.items.length); assert.equal(repeated.pins.preserved,backup.pins.length);
  assert.equal(count(restored),backup.items.length);

  const original = backup.items.find(item=>item.id===source.ids[0]);
  const incoming = {...original,id:'foreign-backup-id',posterUrl:null,title:'Imported newer',createdAt:1,
    updatedAt:original.updatedAt+100,contentFamily:'manhua',primaryFormat:'webtoon',
    status:'done',tags:['Imported'],notes:'Imported personal note',personalRating:95};
  const libraryPin = backup.pins.find(p=>p.itemId===original.id&&p.contextType==='library');
  const updated = await merge(restored,one(incoming,[
    {itemId:incoming.id,contextType:'library',contextKey:'',pinnedAt:9999},
    {itemId:incoming.id,contextType:'tag',contextKey:'Imported',pinnedAt:9000},
  ])); cleanMerge(updated); assert.equal(updated.updated,1);
  const after = await read(restored,original.id);
  assert.equal(after.id,original.id); assert.equal(after.createdAt,original.createdAt);
  for (const key of ['posterUrl','title','updatedAt','contentFamily','primaryFormat','status','tags','notes','personalRating']) {
    assert.deepEqual(after[key],incoming[key],`newer backup applies ${key}, unlike provider re-save`);
  }
  assert.deepEqual(after.providerReferences,original.providerReferences);
  assert.equal(await read(restored,incoming.id),null,'portable reference resolves original local ID');
  const afterPins = await pins.listAllPinsForBackupV5WithDb(restored);
  assert.equal(afterPins.find(p=>p.itemId===original.id&&p.contextType==='library').pinnedAt,libraryPin.pinnedAt);
  assert.equal(afterPins.some(p=>p.itemId===original.id&&p.contextKey==='Keep'),false,'removed tag cleans its pin');
  assert.equal(afterPins.find(p=>p.itemId===original.id&&p.contextKey==='Imported').pinnedAt,9000);
  for (const updatedAt of [incoming.updatedAt-1,incoming.updatedAt]) {
    const stable = await read(restored,original.id);
    const result = await merge(restored,one({...incoming,posterUrl:urlB,notes:'Stale note',updatedAt}));
    cleanMerge(result); assert.equal(result.skipped,1); assert.deepEqual(await read(restored,original.id),stable);
  }
  // Generic backup URL contract has no MangaUpdates host allowlist.
  const genericUrl = 'https://developer.example.invalid/retained-poster.png';
  const withUrl = {...incoming,posterUrl:genericUrl,updatedAt:incoming.updatedAt+1};
  cleanMerge(await merge(restored,one(withUrl)));
  assert.equal((await read(restored,original.id)).posterUrl,genericUrl);
  const absent = {...withUrl,updatedAt:withUrl.updatedAt+1}; delete absent.posterUrl;
  assert.deepEqual(parse(one(absent)).items[0].posterUrl,{present:false});
  cleanMerge(await merge(restored,one(absent)));
  assert.equal((await read(restored,original.id)).posterUrl,genericUrl,'absent preserves');
  const explicitNull = {...absent,posterUrl:null,updatedAt:absent.updatedAt+1};
  assert.deepEqual(parse(one(explicitNull)).items[0].posterUrl,{present:true,value:null});
  cleanMerge(await merge(restored,one(explicitNull)));
  assert.equal((await read(restored,original.id)).posterUrl,null,'explicit null clears');
  // Stale compatible input may still attach a free reference without replacing metadata.
  const extra = {provider:'developer-test',resourceNamespace:'portable',externalId:'large/'+huge};
  const staleBefore = await read(restored,original.id);
  const stale = await merge(restored,one({...withUrl,updatedAt:0,providerReferences:[...original.providerReferences,extra]}));
  cleanMerge(stale); assert.equal(stale.skipped,1);
  const staleAfter = await read(restored,original.id);
  assert.equal(staleAfter.posterUrl,staleBefore.posterUrl); assert.equal(staleAfter.notes,staleBefore.notes);
  assert.equal((await storage.getSavedTitleByProviderReferenceWithDb(restored,extra)).id,original.id);

  const collisions = database('id-collision'); await ensureLibrarySchema(collisions);
  const occupant = await repo.saveProviderTitle(input('90071992547409937777',null),()=>original.id,collisions);
  const occupantBefore = await read(collisions,occupant);
  const remapped = await merge(collisions,one(original,backup.pins.filter(p=>p.itemId===original.id)),()=> 'remapped-local');
  cleanMerge(remapped); assert.equal(remapped.inserted,1);
  assert.deepEqual(await read(collisions,occupant),occupantBefore);
  const ownedRef = original.providerReferences.find(ref=>ref.provider==='mangaupdates');
  assert.equal((await storage.getSavedTitleByProviderReferenceWithDb(collisions,ownedRef)).id,'remapped-local');
  assert.deepEqual(await pins.listAllPinsForBackupV5WithDb(collisions),backup.pins.filter(p=>p.itemId===original.id).map(p=>({...p,itemId:'remapped-local'})));
  assert.equal(schemaSnapshot(restored),schemaBefore);
  assert.equal(dataSnapshot(source.db),sourceBefore,'export/import never mutates source');
  console.log('PASS 4.2: real v6 export -> parse -> transactional merge -> re-export; URL/null, full large references, identities/personal data/classification, stale/newer merge, pins and ID remap.');
  return backup;
}

async function rollbackScenarios(backup) {
  const failedSave = database('atomic-save-failure'); await ensureLibrarySchema(failedSave);
  failedSave.sqlite.exec("CREATE TRIGGER fail_reference BEFORE INSERT ON media_provider_references BEGIN SELECT RAISE(ABORT,'section4 reference failure'); END;");
  const before = dataSnapshot(failedSave);
  await assert.rejects(repo.saveProviderTitle(input(),generate,failedSave),/section4 reference failure/);
  assert.equal(dataSnapshot(failedSave),before,'save title + reference rollback atomically');
  failedSave.sqlite.exec('DROP TRIGGER fail_reference');
  const id = await repo.saveProviderTitle(input(),generate,failedSave);
  await pins.setTitlePinStateWithDb(failedSave,id,{contextType:'library',contextKey:''},123);
  failedSave.sqlite.exec("CREATE TRIGGER fail_poster_update BEFORE UPDATE OF poster_url ON saved_titles BEGIN SELECT RAISE(ABORT,'section4 poster failure'); END;");
  const savedBefore = dataSnapshot(failedSave);
  await assert.rejects(repo.saveProviderTitle(input(huge,null),generate,failedSave),/section4 poster failure/);
  assert.equal(dataSnapshot(failedSave),savedBefore,'failed URL -> null refresh preserves all rows and pins');

  const partial = database('partial-import-savepoint'); await ensureLibrarySchema(partial);
  const first = backup.items.find(item=>item.posterUrl===urlA), peer = backup.items.find(item=>item.posterUrl===null);
  const failedExternal = first.providerReferences.find(ref=>ref.provider==='mangaupdates').externalId;
  partial.sqlite.exec(`CREATE TRIGGER fail_reference BEFORE INSERT ON media_provider_references WHEN NEW.external_id='${failedExternal}' BEGIN SELECT RAISE(ABORT,'section4 import failure'); END;`);
  const result = await merge(partial,{version:6,items:[first,peer],pins:[
    {itemId:first.id,contextType:'library',contextKey:'',pinnedAt:1},
    {itemId:peer.id,contextType:'library',contextKey:'',pinnedAt:2},
  ]});
  assert.equal(result.failed.length,1); assert.match(result.failed[0].reason,/section4 import failure/);
  assert.equal(result.inserted,1); assert.equal(result.pins.invalid.length,1); assert.equal(result.pins.inserted,1);
  assert.equal(await read(partial,first.id),null,'failed import leaves no title/reference/pin residue');
  assert.deepEqual(await read(partial,peer.id),peer);
  assert.equal(count(partial),1);
  assert.equal(partial.sqlite.prepare('SELECT count(*) AS n FROM media_provider_references WHERE saved_title_id=?').get(first.id).n,0);

  const atomic = database('outer-import-rollback'); await ensureLibrarySchema(atomic);
  const empty = dataSnapshot(atomic);
  await assert.rejects(atomic.withTransactionAsync(async()=> {
    const merged = await mergeLibraryBackupWithDb(atomic,parse(backup),generate);
    cleanMerge(merged); assert.equal(merged.inserted,backup.items.length);
    throw Error('section4 abort before commit');
  }),/section4 abort before commit/);
  assert.equal(dataSnapshot(atomic),empty,'outer transaction rolls back items, identities and pins');
  cleanMerge(await merge(atomic,backup));
  assert.deepEqual(sortedBackup(await exportBackup(atomic)),sortedBackup(backup),'retry after rollback recovers');
  console.log('PASS 4.2 rollback: real SQLite triggers, save transaction, per-item import savepoint with successful peer and outer import rollback/retry, in separate isolated DBs.');
}

async function historicalImports() {
  // Frozen historical versions support audiovisual records; they must not gain MangaUpdates-specific rules.
  for (const version of [1,2,3,4,5,6]) {
    const db = database(`historical-v${version}`); await ensureLibrarySchema(db);
    const reference = {provider:'tmdb',resourceNamespace:'movie',externalId:'321'};
    const base = {id:`historical-v${version}`,title:'Synthetic historical',posterUrl:'https://developer.example.invalid/historical.png',
      year:2020,overview:'Old overview',voteAverage:7,personalRating:71,status:'watching',tags:['Keep'],notes:'Keep note',genres:['Drama'],createdAt:10,updatedAt:20};
    const current = {...base,medium:'audiovisual',contentFamily:null,primaryFormat:'movie',providerReferences:[reference]};
    const historic = version===6 ? current : version===5 ? {...base,type:'movie',providerReferences:[reference]} : {...base,type:'movie',provider:'tmdb',externalId:'321'};
    const wrap = item => ({version,items:[item],...(version===1?{}:{pins:[]})});
    const inserted = await merge(db,wrap(historic)); cleanMerge(inserted); assert.equal(inserted.inserted,1);
    let local = await storage.getSavedTitleByProviderReferenceWithDb(db,reference);
    assert.equal(local.posterUrl,base.posterUrl); assert.equal(local.personalRating,version<3?null:71); assert.deepEqual(local.tags,['Keep']);
    if (version<3) {
      // v1/v2 did not own personalRating; a later local rating must survive their imports.
      await repo.setPersonalRatingWithDb(db,local.id,71,()=>21);
      local = await read(db,local.id);
    }
    assert.equal(local.notes,'Keep note'); assert.equal(local.status,'watching');
    await pins.setTitlePinStateWithDb(db,local.id,{contextType:'tag',contextKey:'Keep'},55);
    const pinsBefore = await pins.listAllPinsForBackupV5WithDb(db);
    const omitted = {...historic,title:'Absent optional fields',updatedAt:30};
    for (const key of ['posterUrl','notes','tags','status','year','overview','genres','voteAverage']) delete omitted[key];
    if(version<3) delete omitted.personalRating; // v3+ requires explicit personalRating.
    const parsedAbsent = parse(wrap(omitted));
    assert.deepEqual(parsedAbsent.items[0].posterUrl,{present:false});
    const absentResult = await merge(db,wrap(omitted)); cleanMerge(absentResult); assert.equal(absentResult.updated,1);
    const preserved = await read(db,local.id);
    for (const key of ['posterUrl','notes','tags','status','year','overview','genres','voteAverage','personalRating','createdAt']) assert.deepEqual(preserved[key],local[key],`v${version} absent ${key}`);
    assert.deepEqual(await pins.listAllPinsForBackupV5WithDb(db),pinsBefore);
    const nulled = {...omitted,posterUrl:null,notes:null,updatedAt:40};
    const parsedNull = parse(wrap(nulled));
    assert.deepEqual(parsedNull.items[0].posterUrl,{present:true,value:null});
    cleanMerge(await merge(db,wrap(nulled)));
    const cleared = await read(db,local.id);
    assert.equal(cleared.posterUrl,null); assert.equal(cleared.notes,null); assert.deepEqual(cleared.tags,['Keep']);
    assert.equal(cleared.id,local.id); assert.equal(cleared.createdAt,local.createdAt);
    assert.deepEqual(cleared.providerReferences,[reference]);
    assert.deepEqual(await pins.listAllPinsForBackupV5WithDb(db),pinsBefore);
    const roundtrip = await exportBackup(db); assert.equal(roundtrip.version,6);
    const target = database(`historical-v${version}-reimport`); await ensureLibrarySchema(target);
    cleanMerge(await merge(target,roundtrip));
    assert.deepEqual(await read(target,local.id),cleared);
  }
  console.log('PASS 4.2 historical: v1-v6 actual parse/merge and v6 re-export/re-import; absent poster/metadata preserve, explicit null clears, identity/personal fields/pins remain compatible.');
}

async function main() {
  const source = await sqliteAndResave();
  const backup = await backupAndMerge(source);
  await rollbackScenarios(backup);
  await historicalImports();
  for (const db of handles) {
    assert.equal(db.sqlite.prepare('PRAGMA user_version').get().user_version,6,db.label);
    assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(),[],db.label);
  }
  assert.equal(networkAttempts,0);
  console.log(`PASS: ${handles.length} isolated real SQLite databases; user_version=6, historical backup=6, foreign keys valid, zero network attempts.`);
}
main().catch(error => { console.error(error); process.exitCode=1; }).finally(() => {
  for (const db of handles) db.sqlite.close();
  Module._load=originalLoad; global.fetch=originalFetch;
  if (originalTs) require.extensions['.ts']=originalTs; else delete require.extensions['.ts'];
});

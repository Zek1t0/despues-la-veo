const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  return request === 'expo-sqlite' ? {} : originalLoad.call(this, request, parent, main);
};
const schema = require('../../../src/storage/databaseSchema.ts');
const storage = require('../../../src/storage/savedTitleStorage.ts');
const { getLibraryBackupExportDataWithDb: exportData } = require('../../../src/storage/libraryBackupExport.ts');
const { createLibraryBackupV7 } = require('../../../src/core/libraryBackupV7.ts');
const { parseLibraryBackup } = require('../../../src/core/libraryBackup.ts');
const { mergeLibraryBackupWithDb } = require('../../../src/storage/libraryBackupMerge.ts');
const dbModule = require('../../../src/storage/db.ts');
dbModule.initDb = async () => { throw Error('Personal DB initialization forbidden in B2 fixtures'); };
Module._load = originalLoad;

// All SQLite files, WAL sidecars and JSON backups live outside the repository.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlv-b3-synthetic-'));
let serial = 0;
function fixture(file = path.join(root, `${++serial}.sqlite`)) {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys=ON');
  const params = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...params(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...params(values)); },
    async runAsync(sql, ...values) { return sqlite.prepare(sql).run(...params(values)); },
    async withTransactionAsync(task) {
      sqlite.exec('BEGIN');
      try { await task(); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, db, file, close() { sqlite.close(); } };
}
const repo=require('../../../src/storage/savedTitlesRepo.ts');
const {parseAnime}=require('../../../src/providers/kitsu/validation.ts');
const {kitsuMaterializationInput}=require('../../../src/providers/kitsu/mapping.ts');
const {createManualContentWithDb,editManualContentWithDb}=require('../../../src/storage/manualContentEntries.ts');
const {deleteSavedTitleAndPinsWithDb}=require('../../../src/storage/savedTitleIntegrity.ts');
const {setTitlePinStateWithDb}=require('../../../src/storage/titlePinsRepo.ts');
const {matchesLibraryClassification}=require('../../../src/core/libraryView.ts');
const {localKitsuSources}=require('../../../src/providers/kitsu/product.ts');
const resource=(id,subtype='OVA',title='Synthetic same title')=>({id,type:'anime',attributes:{canonicalTitle:title,subtype,startDate:'2000-01-01',synopsis:'TEST owned summary',averageRating:'98',posterImage:{original:'https://invalid.test'}}});
async function main(){
  const f=fixture(),target=fixture();let reopened;
  const oldFetch=global.fetch;let network=0;global.fetch=()=>{network++;throw Error('No remote access');};
  try{
    await schema.evolveDatabaseSchema(f.db,0);await schema.evolveDatabaseSchema(target.db,0);
    const input=kitsuMaterializationInput(parseAnime(resource('90071992547409939999')));
    await f.db.withTransactionAsync(()=>createManualContentWithDb(f.db,{title:input.snapshot.title,medium:'audiovisual',contentFamily:'anime',primaryFormat:'movie',year:null,overview:null},()=> 'manual-local',()=> 'manual-token',100));
    const tmdb={...input,metadata:undefined,reference:{provider:'tmdb',resourceNamespace:'movie',externalId:'77'},snapshot:{...input.snapshot,contentFamily:null,primaryFormat:'movie',voteAverage:8.5}};
    await repo.saveProviderTitle(tmdb,()=> 'tmdb-local',f.db);
    // B4: equal external IDs and titles across every source/namespace are not identity.
    await repo.saveProviderTitle({...tmdb,reference:{...tmdb.reference,resourceNamespace:'tv'},snapshot:{...tmdb.snapshot,primaryFormat:'tv'}},()=> 'tmdb-tv-local',f.db);
    await repo.saveProviderTitle({...input,metadata:undefined,reference:{provider:'mangaupdates',resourceNamespace:'series',externalId:input.reference.externalId},snapshot:{...input.snapshot,medium:'comic',contentFamily:'manga',primaryFormat:null}},()=> 'mu-local',f.db);
    let generated=0;const id=await repo.saveProviderTitle(input,()=> {generated++;return 'anime-local';},f.db);assert.equal(id,'anime-local');
    const first=await repo.getSavedTitleByIdWithDb(f.db,id);
    assert.equal(first.voteAverage,null);assert.equal(first.posterUrl,null);assert.equal(first.status,'planned');assertLegacyEqual(first.tags,[]);
    assert.equal(first.manualIdentity,undefined);assertLegacyEqual(first.providerReferences,[input.reference]);assert.equal(first.primaryFormat,'ova');
    await f.db.withTransactionAsync(async()=>{
      await repo.updateSavedTitleMetadataWithDb(f.db,id,{status:'watching',tags:['Owned'],notes:'Keep notes'});
      await repo.setPersonalRatingWithDb(f.db,id,91);
      await setTitlePinStateWithDb(f.db,id,{contextType:'library',contextKey:''},123);
      await setTitlePinStateWithDb(f.db,id,{contextType:'tag',contextKey:'Owned'},124);
    });
    const before=await repo.getSavedTitleByIdWithDb(f.db,id);
    const repeated=kitsuMaterializationInput(parseAnime(resource(input.reference.externalId,'unknown','Updated synthetic')));
    assert.equal(await repo.saveProviderTitle(repeated,()=> {generated++;return 'wrong-id';},f.db),id);assert.equal(generated,1);
    const after=await repo.getSavedTitleByIdWithDb(f.db,id);
    for(const field of ['id','createdAt','status','tags','notes','personalRating','providerReferences','manualIdentity','primaryFormat']) assertLegacyEqual(after[field],before[field],field);
    assert.equal(after.title,'Updated synthetic');assert.equal(after.updatedAt,before.updatedAt);assert.equal(after.voteAverage,null);
    assert.equal((await repo.listSavedTitlesWithDb(f.db)).length,5,'same titles and external IDs do not merge across providers/namespaces');
    assert.equal(localKitsuSources(after.providerReferences,'web')[0].label,'Datos: Kitsu');assert.equal(localKitsuSources(after.providerReferences,'web')[0].destination,null);
    assert.ok(matchesLibraryClassification(after,'anime'));assert.ok(matchesLibraryClassification({...after,primaryFormat:'movie'},'movie'));
    const appearance={status:'unavailable',reason:'pending'},data=await exportData(f.db,appearance),backup=createLibraryBackupV7(data.items,data.pins,appearance);
    const parsed=parseLibraryBackup(JSON.stringify(backup));assert.equal(parsed.ok,true);assert.equal(parsed.payload.version,7);
    await target.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(target.db,parsed.payload,()=> 'collision-remap'));
    assertLegacyEqual((await exportData(target.db,appearance)).items,data.items);assertLegacyEqual((await exportData(target.db,appearance)).pins,data.pins);
    await target.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(target.db,parsed.payload,()=> 'must-not-duplicate'));
    assert.equal((await repo.listSavedTitlesWithDb(target.db)).length,5);
    // Restore the mixed library into an occupied manual ID, then edit/delete only
    // the remapped manual. This bridges B1 remap and B2 mutations with B3 sources.
    const occupied=fixture();
    try {
      await schema.evolveDatabaseSchema(occupied.db,0);
      await occupied.db.withTransactionAsync(()=>createManualContentWithDb(occupied.db,{title:'Unrelated occupant',medium:'comic',contentFamily:null,primaryFormat:null,year:null,overview:null},()=> 'manual-local',()=> 'occupant-token',50));
      const occupantBefore=await repo.getSavedTitleByIdWithDb(occupied.db,'manual-local');
      for(let i=0;i<2;i++) await occupied.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(occupied.db,parsed.payload,()=> 'manual-remapped'));
      assert.equal((await repo.listSavedTitlesWithDb(occupied.db)).length,6);
      const restored=await repo.getSavedTitleByIdWithDb(occupied.db,'manual-remapped');
      assertLegacyEqual(restored,{...await repo.getSavedTitleByIdWithDb(f.db,'manual-local'),id:'manual-remapped'});
      const providerRows=(await repo.listSavedTitlesWithDb(occupied.db)).filter(x=>x.providerReferences.length);
      await occupied.db.withTransactionAsync(()=>editManualContentWithDb(occupied.db,restored.id,{title:'Corrected offline',medium:'audiovisual',contentFamily:'anime',primaryFormat:'ona',year:2024,overview:'Owned correction'},200));
      const edited=await repo.getSavedTitleByIdWithDb(occupied.db,restored.id);
      assert.equal(edited.manualIdentity,restored.manualIdentity);assert.equal(edited.createdAt,restored.createdAt);assert.equal(edited.primaryFormat,'ona');
      const editedData=await exportData(occupied.db,appearance);
      const editedParsed=parseLibraryBackup(JSON.stringify(createLibraryBackupV7(editedData.items,editedData.pins,appearance)));
      assert.equal(editedParsed.ok,true);
      await occupied.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(occupied.db,editedParsed.payload,()=>{throw Error('Reimport must resolve existing identities');}));
      assertLegacyEqual(await repo.getSavedTitleByIdWithDb(occupied.db,restored.id),edited);
      await occupied.db.withTransactionAsync(()=>deleteSavedTitleAndPinsWithDb(occupied.db,restored.id));
      assertLegacyEqual((await repo.listSavedTitlesWithDb(occupied.db)).filter(x=>x.providerReferences.length),providerRows);
      assertLegacyEqual(await repo.getSavedTitleByIdWithDb(occupied.db,'manual-local'),occupantBefore);
      assert.equal(occupied.sqlite.prepare('SELECT count(*) n FROM manual_entry_identities WHERE portable_id=?').get(restored.manualIdentity).n,0);
      assertLegacyEqual(occupied.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
    } finally {occupied.close();}
    const path=f.file;f.close();reopened=fixture(path);await schema.evolveDatabaseSchema(reopened.db,6);
    assertLegacyEqual(await repo.getSavedTitleByIdWithDb(reopened.db,id),after,'offline reopen preserves snapshot/personal/reference');
    assertLegacyEqual(reopened.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(network,0);
    console.log('PASS B3/B4 actual SQLite6: manual/TMDB movie+tv/MangaUpdates/Kitsu coexistence, exact large references, save/re-save preservation, mixed v7 remap/reimport/edit/delete isolation, offline reopen and no network/personal DB.');
  }finally{if(reopened)reopened.close();else{try{f.close();}catch{}}target.close();global.fetch=oldFetch;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

// These historical-contract assertions compare every original field. New v8 sidecars
// are verified separately by section-2-backups/storage, and have no authority in v1-v7.
function legacyShape(value) {
  if (Array.isArray(value)) return value.map(legacyShape);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['metadataState','localAliases'].includes(key)).map(([key,entry]) => [key,legacyShape(entry)]));
  return value;
}
function assertLegacyEqual(actual, expected, message) { assert.deepEqual(legacyShape(actual),legacyShape(expected),message); }

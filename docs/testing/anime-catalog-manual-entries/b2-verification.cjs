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
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlv-b2-synthetic-'));
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
const manual = require('../../../src/storage/manualContentEntries.ts');
const { validateManualContent, manualDuplicateCandidates } = require('../../../src/core/manualContentEntry.ts');
const { matchesLibraryClassification, selectVisibleLibraryTitles } = require('../../../src/core/libraryView.ts');
const { deleteSavedTitleAndPinsWithDb } = require('../../../src/storage/savedTitleIntegrity.ts');
const {updateSavedTitleMetadataWithDb,setPersonalRatingWithDb}=require('../../../src/storage/savedTitlesRepo.ts');
const {setTitlePinStateWithDb}=require('../../../src/storage/titlePinsRepo.ts');
const base = {title:'  Árbol   azul ',medium:'audiovisual',contentFamily:null,primaryFormat:null,year:null,overview:null};
const dump = f => JSON.stringify(['saved_titles','manual_entry_identities','media_provider_references','legacy_saved_title_identities','title_pins'].map(t => f.sqlite.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()));
const txCreate = (f, input=base, id='manual', token='portable') => f.db.withTransactionAsync(() => manual.createManualContentWithDb(f.db,input,()=>id,()=>token,100));
async function main() {
  let network=0; const previousFetch=global.fetch; global.fetch=()=>{network++;throw Error('offline');};
  const f=fixture(); let reopened;
  try {
    await schema.evolveDatabaseSchema(f.db,0);
    for(const patch of [{title:' '},{medium:null},{medium:'comic',contentFamily:'anime'}, {primaryFormat:'novel'},
      {year:0},{year:10000},{year:1.5},{year:NaN},{year:'2000'},{overview:42}]) {
      const before=dump(f); await assert.rejects(txCreate(f,{...base,...patch})); assert.equal(dump(f),before);
    }
    await txCreate(f);
    let item=await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'manual');
    assert.equal(item.title,'Árbol   azul'); assert.equal(item.manualIdentity,'portable');
    assert.equal(item.status,'planned'); assert.equal(item.personalRating,null); assertLegacyEqual(item.tags,[]);
    assert.equal(item.notes,null); assert.equal(item.posterUrl,null); assert.equal(item.voteAverage,null);
    assertLegacyEqual(item.providerReferences,[]); assert.equal(item.createdAt,100);
    const full={...base, title:'Complete',contentFamily:'anime',primaryFormat:'movie',year:9999,overview:'Plain <text>\nsummary'};
    await txCreate(f,full,'full','full-token');
    assert.equal((await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'full')).overview,full.overview);
    let attempts=0; await f.db.withTransactionAsync(()=>manual.createManualContentWithDb(f.db,base,()=>++attempts===1?'manual':'collision-free',()=> 'collision-token',101));
    assert.equal(attempts,2);
    let identityAttempts=0; await f.db.withTransactionAsync(()=>manual.createManualContentWithDb(f.db,base,()=> 'identity-retry',()=> ++identityAttempts===1?'portable':'identity-free',101));
    assert.equal(identityAttempts,2);
    for(const [id,token] of [['manual','unused'],['unused','portable']]) {
      const before=dump(f); await assert.rejects(txCreate(f,base,id,token),/25/); assert.equal(dump(f),before);
    }
    const beforeFailure=dump(f);
    f.sqlite.exec("CREATE TRIGGER fail_identity BEFORE INSERT ON manual_entry_identities WHEN NEW.saved_title_id='failed' BEGIN SELECT RAISE(ABORT,'injected'); END");
    await assert.rejects(txCreate(f,base,'failed','failed-token'),/injected/); assert.equal(dump(f),beforeFailure);
    f.sqlite.exec('DROP TRIGGER fail_identity');
    f.sqlite.exec("UPDATE saved_titles SET genres_json='[\"Drama\"]',poster_url='local-kept' WHERE id='manual';");
    await f.db.withTransactionAsync(async()=>{
      await updateSavedTitleMetadataWithDb(f.db,'manual',{status:'watching',tags:['Keep'],notes:'note'},()=>100);
      await setPersonalRatingWithDb(f.db,'manual',86,()=>100);
      await setTitlePinStateWithDb(f.db,'manual',{contextType:'library',contextKey:''},111);
      await setTitlePinStateWithDb(f.db,'manual',{contextType:'tag',contextKey:'Keep'},112);
    });
    const beforeEdit=await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'manual');
    const pinsBefore=f.sqlite.prepare('SELECT * FROM title_pins').all();
    const patch={...full,title:'Edited',year:1,primaryFormat:'ova',id:'ATTACK',status:'done',manualIdentity:'ATTACK',notes:'ATTACK'};
    await f.db.withTransactionAsync(()=>manual.editManualContentWithDb(f.db,'manual',patch,1));
    item=await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'manual');
    for(const key of ['id','createdAt','personalRating','status','tags','notes','genres','posterUrl','manualIdentity','providerReferences']) assertLegacyEqual(item[key],beforeEdit[key],key);
    assert.equal(item.updatedAt,beforeEdit.updatedAt+1); assert.equal(item.title,'Edited'); assert.equal(item.primaryFormat,'ova');
    assertLegacyEqual(f.sqlite.prepare('SELECT * FROM title_pins').all(),pinsBefore);
    f.sqlite.exec("INSERT INTO media_provider_references VALUES ('tmdb','movie','123','full');");
    assert.equal(await manual.isManualContentEditableWithDb(f.db,'full'),false);
    const beforeProvider=dump(f); await assert.rejects(f.db.withTransactionAsync(()=>manual.editManualContentWithDb(f.db,'full',base)),/edición/); assert.equal(dump(f),beforeProvider);
    await txCreate(f,base,'legacy','remove-me'); f.sqlite.exec("DELETE FROM manual_entry_identities WHERE saved_title_id='legacy'; INSERT INTO legacy_saved_title_identities VALUES ('library-backup-v1-v4','manual',' exact historical ','legacy');");
    assert.equal(await manual.isManualContentEditableWithDb(f.db,'legacy'),true);
    await f.db.withTransactionAsync(()=>manual.editManualContentWithDb(f.db,'legacy',{...base,medium:'comic',contentFamily:'manga'},200));
    assert.equal(f.sqlite.prepare("SELECT legacy_external_id FROM legacy_saved_title_identities WHERE saved_title_id='legacy'").get().legacy_external_id,' exact historical ');
    await txCreate(f,base,'invalid-local','remove-too'); f.sqlite.exec("DELETE FROM manual_entry_identities WHERE saved_title_id='invalid-local'");
    assert.equal(await manual.isManualContentEditableWithDb(f.db,'invalid-local'),false);
    const beforeUpdateFailure=dump(f); f.sqlite.exec("CREATE TRIGGER fail_edit BEFORE UPDATE ON saved_titles BEGIN SELECT RAISE(ABORT,'edit failed'); END");
    await assert.rejects(f.db.withTransactionAsync(()=>manual.editManualContentWithDb(f.db,'manual',base)),/edit failed/); assert.equal(dump(f),beforeUpdateFailure); f.sqlite.exec('DROP TRIGGER fail_edit');
    // Exercise public serialization/transaction wrapper and a real deferred COMMIT failure.
    f.sqlite.exec(`CREATE TABLE deferred_failure (owner TEXT REFERENCES saved_titles(id) DEFERRABLE INITIALLY DEFERRED);
      CREATE TRIGGER commit_failure AFTER INSERT ON saved_titles WHEN NEW.title='Commit fail'
      BEGIN INSERT INTO deferred_failure VALUES ('missing-owner'); END;`);
    const beforeCommit=dump(f);
    await assert.rejects(manual.saveManualContent({...base,title:'Commit fail'},undefined,f.db),/FOREIGN KEY/);
    assert.equal(dump(f),beforeCommit);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM deferred_failure').get().n,0);
    f.sqlite.exec('DROP TRIGGER commit_failure; DROP TABLE deferred_failure;');
    const publicIds=await Promise.all([manual.saveManualContent({...base,title:'Public one'},undefined,f.db),manual.saveManualContent({...base,title:'Public two'},undefined,f.db)]);
    assert.notEqual(publicIds[0],publicIds[1]);
    // Missing identity fixture is deliberately ineligible for backup; delete it first.
    await f.db.withTransactionAsync(()=>deleteSavedTitleAndPinsWithDb(f.db,'invalid-local'));
    const all=await storage.listSavedTitlesWithReferencesWithDb(f.db);
    for(const query of ['edited','keep']) assertLegacyEqual(selectVisibleLibraryTitles({items:all,pinnedAtById:new Map([['manual',111]]),query,sort:'title-asc',statusFilter:'watching',classificationFilter:'anime'}).map(x=>x.id),['manual']);
    const candidates=manualDuplicateCandidates(all,' arbol azul ',null,'collision-free');
    assert.ok(candidates.some(x=>x.id==='identity-retry')); assert.ok(!candidates.some(x=>x.id==='collision-free'));
    assert.ok(manualDuplicateCandidates(all,'complete',null).some(x=>x.id==='full'),'provider-backed candidate');
    assert.equal(manualDuplicateCandidates(all,'complete',2000).length,0);
    const anime=all.find(x=>x.id==='full'); assert.ok(matchesLibraryClassification(anime,'anime')); assert.ok(matchesLibraryClassification(anime,'movie'));
    for(const family of ['manga','manhwa','manhua']) assert.ok(matchesLibraryClassification({...anime,medium:'comic',contentFamily:family,primaryFormat:null},family));
    assert.ok(matchesLibraryClassification({...anime,contentFamily:null,primaryFormat:null},'all'));
    const appearance={status:'unavailable'};
    const data=await exportData(f.db,appearance); const backup=createLibraryBackupV7(data.items,data.pins,appearance);
    const parsed=parseLibraryBackup(JSON.stringify(backup)); assert.equal(parsed.ok,true);
    const target=fixture(); try {
      await schema.evolveDatabaseSchema(target.db,0);
      await target.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(target.db,parsed.payload,()=> 'remapped'));
      const after=await exportData(target.db,appearance); assertLegacyEqual(after.items,data.items); assertLegacyEqual(after.pins,data.pins);
    } finally {target.close();}
    const file=f.file; const persisted=dump(f); f.close(); reopened=fixture(file); await schema.evolveDatabaseSchema(reopened.db,6); assert.equal(dump(reopened),persisted);
    await reopened.db.withTransactionAsync(()=>deleteSavedTitleAndPinsWithDb(reopened.db,'manual'));
    assert.equal(await storage.getSavedTitleWithReferencesByIdWithDb(reopened.db,'manual'),null);
    assert.equal(reopened.sqlite.prepare("SELECT count(*) n FROM manual_entry_identities WHERE saved_title_id='manual'").get().n,0);
    assert.equal(reopened.sqlite.prepare("SELECT count(*) n FROM title_pins WHERE saved_title_id='manual'").get().n,0);
    assertLegacyEqual(reopened.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(network,0);
    console.log('PASS B2 validation/defaults/full creation, collisions/exhaustion, atomic rollback, limited edits/preservation, provider rejection, historical identity, duplicates, filters, v7 round-trip, reopen/delete cascade; zero network/personal DB');
  } finally { if(reopened) reopened.close(); else {try{f.close();}catch{}} global.fetch=previousFetch; }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

// Preserve all v7 contract fields; v8 metadata sidecars are tested by section-2 suites.
function legacyShape(value) {
  if (Array.isArray(value)) return value.map(legacyShape);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['metadataState','localAliases'].includes(key)).map(([key,entry]) => [key,legacyShape(entry)]));
  return value;
}
function assertLegacyEqual(actual, expected, message) { assert.deepEqual(legacyShape(actual),legacyShape(expected),message); }

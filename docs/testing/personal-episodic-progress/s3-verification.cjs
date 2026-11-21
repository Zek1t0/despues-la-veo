const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,createV6}=require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema=require('../../../src/storage/databaseSchema.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {createLibraryBackupV10}=require('../../../src/core/libraryBackupV10.ts');
const {createLibraryBackupV9}=require('../../../src/core/libraryBackupV9.ts');
const {getLibraryBackupExportData}=require('../../../src/storage/libraryBackupExport.ts');
const {mergeLibraryBackup}=require('../../../src/storage/savedTitlesRepo.ts');
const progress=require('../../../src/storage/personalProgressRepo.ts');
const importer=require('../../../src/storage/personalProgressBackupImport.ts');
const {getSavedTitleWithReferencesByIdWithDb:readTitle}=require('../../../src/storage/savedTitleStorage.ts');
const {createManualContentWithDb}=require('../../../src/storage/manualContentEntries.ts');
const {subscribeLibraryInvalidation}=require('../../../src/storage/libraryInvalidation.ts');
require('../../../src/storage/db.ts').initDb=async()=>{throw Error('TEST prohibits personal DB')};
let requests=0;global.fetch=()=>{requests++;throw Error('TEST prohibits network')};
const clock=Date.now;Date.now=()=>1000;
const files=[],results=[];let serial=0,signals=[];
const stop=subscribeLibraryInvalidation(change=>signals.push(change));
async function fresh(seed=false){const f=fixture();files.push(f);if(seed)createV6(f);await schema.evolveDatabaseSchema(f.db,seed?6:0);return f}
const appearance={status:'known-default',preference:require('../../../src/theme/appearancePreference.ts').DEFAULT_APPEARANCE_PREFERENCE};
async function exported(f){const data=await getLibraryBackupExportData(appearance,f.db);return createLibraryBackupV10(data.items,data.pins,appearance,'2026-11-21T12:00:00.000Z',data)}
function parsed(raw){const result=parseLibraryBackup(JSON.stringify(raw));assert.equal(result.ok,true,JSON.stringify(result));return result.payload}
const gen=()=>`TEST-generated-${++serial}`;
const merge=(f,raw)=>mergeLibraryBackup(parsed(raw),gen,f.db);
async function set(f,id,position,now=100){const title=await readTitle(f.db,id);return progress.setPersonalProgress({itemId:id,position,expected:await progress.getPersonalProgressWithDb(f.db,id),expectedClassification:title},f.db,now)}
function snapshot(f){return Object.fromEntries(f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,f.sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all()]))}
const stable=value=>JSON.parse(JSON.stringify(value));
function normalized(raw){const sort=v=>Array.isArray(v)?v.map(sort).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sort(v)])):v;return sort(raw)}
function failSql(f,predicate){const original=f.db.runAsync;f.db.runAsync=async(sql,...args)=>{if(predicate(sql,args))throw Error('TEST injected SQL failure');return original(sql,...args)};return()=>f.db.runAsync=original}
function failCommit(f){const original=f.db.withTransactionAsync;f.db.withTransactionAsync=task=>original(async()=>{await task();throw Error('TEST commit failure')});return()=>f.db.withTransactionAsync=original}
async function test(name,run){await run();results.push({name,status:'PASS'});console.log('PASS',name)}
(async()=>{try{
 const a=await fresh(true);
 await a.db.withTransactionAsync(async()=>{
  for(const id of ['special','reset','none'])await createManualContentWithDb(a.db,{title:`TEST ${id}`,medium:'comic',contentFamily:'manga',primaryFormat:null,year:null,overview:null},()=>id,()=>`TEST-portable-${id}`,10);
  await a.db.runAsync("INSERT INTO personal_collections VALUES ('TEST-c','TEST collection','TEST description',1,2)");
  await a.db.runAsync("INSERT INTO personal_collections VALUES ('TEST-empty','TEST empty',NULL,1,2)");
  await a.db.runAsync("INSERT INTO collection_memberships VALUES ('TEST-c','manual',3,4)");
  await a.db.runAsync(`INSERT INTO recommendation_inbox (id,original_capture_json,capture_kind,name,person,comment,status,linked_saved_title_id,created_at,updated_at)
   VALUES ('TEST-r','{"name":"TEST recommendation"}','name','TEST recommendation','TEST person','TEST context','incorporated','manual',5,6)`);
  await a.db.runAsync("UPDATE saved_titles SET status='watching',personal_rating=85,notes='TEST notes',tags_json='[\"TEST tag\"]' WHERE id='tmdb'");
  await a.db.runAsync("INSERT INTO library_activity_events VALUES ('TEST-event','tmdb',900,'notes','personal','[\"notes\"]','TEST-operation')");
  await a.db.runAsync("DELETE FROM manual_entry_identities WHERE saved_title_id='manual'");
  await a.db.runAsync("INSERT INTO legacy_saved_title_identities VALUES ('library-backup-v1-v4','manual','TEST-legacy','manual')");
  for(const status of ['pending','discarded'])await a.db.runAsync(`INSERT INTO recommendation_inbox (id,original_capture_json,capture_kind,name,status,created_at,updated_at) VALUES (?,?,'name',?,?,5,6)`, `TEST-${status}`,JSON.stringify({name:`TEST ${status}`}),`TEST ${status}`,status);
 });
 await set(a,'tmdb',{mode:'season-episode',season:3,episode:7});await set(a,'kitsu',{mode:'episode',episode:245});await set(a,'mu',{mode:'chapter',chapter:'128.5'});
 await set(a,'special',{mode:'special',label:'序章 🐱 · Prólogo'});await set(a,'reset',null);
 await require('../../../src/storage/mediaPreferencesRepo.ts').setMediaLanguages(['ja','es'],500,a.db);
 const raw=await exported(a);
 await test('v10 parser, strict payloads, mandatory envelope and duplicate origins',async()=>{
  assert.equal(raw.version,10);assert.equal(raw.progress.length,5);assert.equal(parsed(raw).progress.length,5);
  for(const change of [{version:11},{progress:undefined},{progress:null},{progress:{} }])assert.equal(parseLibraryBackup(JSON.stringify({...raw,...change})).ok,false);
  for(const text of ['{','null','[]'])assert.equal(parseLibraryBackup(text).ok,false);
  const base=raw.progress[0];
  for(const value of [{...base,position:{mode:'chapter',chapter:1.5}},{...base,updatedAt:-1},{...base,version:2},{...base,position:{mode:'chapter',chapter:'01.5'}},{...base,position:{mode:'episode',episode:1,season:2}}]){
   const p=parsed({...raw,progress:[value]});assert.equal(p.progress.length,0);assert.equal(p.progressIssues.length,1);
  }
  assert.equal(parsed({...raw,progress:[base,base]}).progress.length,1);
  assert.equal(parsed({...raw,progress:[base,{...base,updatedAt:base.updatedAt+1}]}).progress.length,0);
  assert.throws(()=>createLibraryBackupV10([],[],appearance,undefined,{collections:[],collectionMemberships:[],progress:[base]}));
 });
 await test('full SQLite A -> v10 -> empty B -> v10 semantic round trip, reimport and offline reopen',async()=>{
  const b=await fresh();const result=await merge(b,raw);assert.equal(result.progress.inserted,5);assert.deepEqual(result.progress.conflicts,[]);
  const output=await exported(b);assert.deepEqual(normalized(output),normalized(raw));
  const before=snapshot(b);for(let n=0;n<3;n++){const result=await merge(b,raw);assert.equal(result.progress.preservedEqual,5);assert.equal(result.progress.inserted,0)}assert.deepEqual(snapshot(b),before);
  const file=b.file;b.close();b.closed=true;const reopened=fixture(file);files.push(reopened);await schema.evolveDatabaseSchema(reopened.db,9);assert.deepEqual(normalized(await exported(reopened)),normalized(raw));
 });
 await test('local corrections/reset preserved for older/equal/newer timestamps; equality preserves exact local clock',async()=>{
  const b=await fresh();await merge(b,raw);const base=await progress.getPersonalProgressWithDb(b.db,'tmdb');
  for(const updatedAt of [0,base.updatedAt,9000])for(const position of [{mode:'season-episode',season:3,episode:2},{mode:'season-episode',season:3,episode:10},null]){
   const result=await merge(b,{...raw,progress:[{...base,updatedAt,position}]});assert.equal(result.progress.conflicts.length,1);assert.deepEqual(await progress.getPersonalProgressWithDb(b.db,'tmdb'),base);
  }
  assert.equal((await merge(b,{...raw,progress:[{...base,updatedAt:9000}]})).progress.preservedEqual,1);assert.deepEqual(await progress.getPersonalProgressWithDb(b.db,'tmdb'),base);
  const reset=await progress.getPersonalProgressWithDb(b.db,'reset');assert.equal((await merge(b,{...raw,progress:[{...reset,position:{mode:'chapter',chapter:'1'}}]})).progress.conflicts.length,1);
  const state=snapshot(b);await merge(b,{...raw,progress:[]});assert.deepEqual(snapshot(b),state);
 });
 await test('portable remap for manual/providers, ID collision and fresher local title; no casual-owner fallback',async()=>{
  const b=await fresh();const shifted={...raw,items:raw.items.map(item=>({...item,id:`B-${item.id}`})),progress:[],pins:[],collections:[],collectionMemberships:[],recommendations:[],activity:[]};await merge(b,shifted);
  const result=await merge(b,raw);assert.equal(result.progress.inserted,5);assert.equal((await progress.getPersonalProgressWithDb(b.db,'B-tmdb')).position.episode,7);assert.equal(await progress.getPersonalProgressWithDb(b.db,'tmdb'),null);
  assert.equal((await b.db.getFirstAsync("SELECT saved_title_id FROM collection_memberships WHERE collection_id='TEST-c'")).saved_title_id,'B-manual');
  const r=await b.db.getFirstAsync("SELECT linked_saved_title_id FROM recommendation_inbox WHERE id='TEST-r'");assert.equal(r.linked_saved_title_id,'B-manual');
  const multi=await merge(b,{...raw,progress:[{version:1,itemId:'multi',position:{mode:'episode',episode:0},updatedAt:123}]});assert.equal(multi.progress.inserted,1);assert.deepEqual((await progress.getPersonalProgressWithDb(b.db,'B-multi')).position,{mode:'episode',episode:0});
  const collision=await fresh();await collision.db.withTransactionAsync(()=>createManualContentWithDb(collision.db,{title:'TEST occupying different work',medium:'comic',contentFamily:'manga',primaryFormat:null,year:null,overview:null},()=> 'tmdb',()=> 'TEST-unrelated',10));
  await merge(collision,raw);assert.equal(await progress.getPersonalProgressWithDb(collision.db,'tmdb'),null);assert.equal((await readTitle(collision.db,'tmdb')).title,'TEST occupying different work');
  const invalid=await merge(collision,{...raw,items:[],progress:[raw.progress.find(p=>p.itemId==='tmdb')]});assert.equal(invalid.progress.invalid.length,1);
 });
 await test('post-remap contradictory destinations excluded, exact aliases idempotent and identity conflicts isolated',async()=>{
  const b=await fresh();await merge(b,raw);await b.db.runAsync("INSERT INTO media_provider_references (provider,resource_namespace,external_id,saved_title_id) VALUES ('kitsu','anime','999','tmdb')");
  const source=raw.items.find(v=>v.id==='tmdb');const aliases=[{...source,id:'alias-one'},{...source,id:'alias-two',metadataState:undefined,providerReferences:[{provider:'kitsu',resourceNamespace:'anime',externalId:'999'}]}];
  const one={version:1,itemId:'alias-one',position:{mode:'episode',episode:1},updatedAt:10},two={...one,itemId:'alias-two',position:{mode:'episode',episode:2}};
  const result=await merge(b,{...raw,items:aliases,progress:[one,two],pins:[],collections:[],collectionMemberships:[],recommendations:[],activity:[]});assert.equal(result.progress.invalid.length,1);assert.equal(result.progress.conflicts.length,0);
  const exact=await merge(b,{...raw,items:aliases,progress:[one,{...one,itemId:'alias-two'}],pins:[],collections:[],collectionMemberships:[],recommendations:[],activity:[]});assert.equal(exact.progress.conflicts.length,1);
 });
 await test('explicit resolution CAS, clocks, rollback and reimport equality without other personal writes',async()=>{
  const b=await fresh();await merge(b,raw);const incoming=raw.progress.find(p=>p.itemId==='tmdb');const result=await merge(b,{...raw,progress:[{...incoming,position:{mode:'episode',episode:10},updatedAt:9000}]});const candidate=result.progress.conflicts[0];
  const before=snapshot(b),priorSignals=signals.length;const undo=failCommit(b);await assert.rejects(()=>importer.applyProgressImportConflict(candidate,b.db));undo();assert.deepEqual(snapshot(b),before);assert.equal(signals.length,priorSignals);
  const confirmed=await importer.applyProgressImportConflict(candidate,b.db,1000);assert.equal(confirmed.updatedAt,9001);assert.deepEqual(snapshot(b).saved_titles,before.saved_titles);assert.deepEqual(snapshot(b).library_activity_events,before.library_activity_events);assert.equal(signals.length,priorSignals+1);
  await assert.rejects(()=>importer.applyProgressImportConflict(candidate,b.db),/cambi/);
  assert.equal((await merge(b,{...raw,progress:[candidate.incoming]})).progress.preservedEqual,1);
  const next=(await merge(b,raw)).progress.conflicts.find(c=>c.itemId==='tmdb');await b.db.runAsync("UPDATE saved_titles SET primary_format='movie' WHERE id='tmdb'");await assert.rejects(()=>importer.applyProgressImportConflict(next,b.db),/cambi/);
  await b.db.runAsync("DELETE FROM saved_titles WHERE id='tmdb'");await assert.rejects(()=>importer.applyProgressImportConflict(next,b.db));assert.equal(await progress.getPersonalProgressWithDb(b.db,'tmdb'),null);
 });
 await test('per-record failure isolation and full mixed import rollback, postcommit invalidation and safe retries',async()=>{
  const b=await fresh(),before=snapshot(b),prior=signals.length;let undo=failCommit(b);await assert.rejects(()=>merge(b,raw));undo();assert.deepEqual(snapshot(b),before);assert.equal(signals.length,prior);
  undo=failSql(b,(sql,args)=>sql.includes('INSERT INTO personal_title_progress')&&args[0]==='tmdb');const partial=await merge(b,raw);undo();assert.equal(partial.progress.failed.length,1);assert.equal(partial.progress.inserted,4);assert.equal(await progress.getPersonalProgressWithDb(b.db,'tmdb'),null);
  assert.equal((await merge(b,raw)).progress.inserted,1);assert.deepEqual(normalized(await exported(b)),normalized(raw));
  const unsubscribe=subscribeLibraryInvalidation(()=>{throw Error('TEST observer failure')});const conflict=(await merge(b,{...raw,progress:[{...raw.progress[0],position:null}]})).progress.conflicts[0];assert.ok(conflict);await importer.applyProgressImportConflict(conflict,b.db);unsubscribe();
 });
 await test('historical v9 is untouched by injected progress; export failure leaves SQLite unchanged',async()=>{
  const b=await fresh();await merge(b,raw);const before=snapshot(b);const data=await getLibraryBackupExportData(appearance,a.db);const v9=createLibraryBackupV9(data.items,data.pins,appearance,raw.exportedAt,data);await merge(b,{...v9,progress:raw.progress.map(p=>({...p,position:null,updatedAt:9999}))});assert.deepEqual(snapshot(b),before);
  const read=b.db.getAllAsync;b.db.getAllAsync=async(sql,...args)=>{if(sql.includes('FROM personal_title_progress'))throw Error('TEST export read failed');return read(sql,...args)};await assert.rejects(()=>exported(b),/export read/);b.db.getAllAsync=read;assert.deepEqual(snapshot(b),before);assert.equal((await exported(b)).progress.length,5);
 });
 await test('v1-v8 imports ignore injected progress; identity failure and exhausted clocks do not overwrite',async()=>{
  const b=await fresh();await merge(b,raw);const before=await progress.getPersonalProgressWithDb(b.db,'tmdb');
  for(let version=1;version<=8;version++){
   const result=await merge(b,{version,exportedAt:raw.exportedAt,items:[],pins:[],progress:[{...before,position:null,updatedAt:99999}]});assert.equal(result.progress,undefined);assert.deepEqual(await progress.getPersonalProgressWithDb(b.db,'tmdb'),before);
  }
  const conflict=(await merge(b,{...raw,progress:[{...before,position:null,updatedAt:Number.MAX_SAFE_INTEGER}]})).progress.conflicts[0];const state=snapshot(b);await assert.rejects(()=>importer.applyProgressImportConflict(conflict,b.db));assert.deepEqual(snapshot(b),state);
  const c=(await merge(b,{...raw,progress:[{...before,position:null}]})).progress.conflicts[0];await b.db.runAsync("INSERT INTO media_provider_references VALUES ('kitsu','anime','99999','tmdb')");await assert.rejects(()=>importer.applyProgressImportConflict(c,b.db),/cambi/);assert.deepEqual(await progress.getPersonalProgressWithDb(b.db,'tmdb'),before);
 });
 await test('title restore failure isolates its progress; incompatible cursor exports without coercion',async()=>{
  const b=await fresh();const undo=failSql(b,(sql,args)=>sql.includes('INSERT INTO saved_titles')&&args.flat().includes('tmdb'));
  const result=await merge(b,raw);undo();assert.ok(result.failed.length>0);assert.ok(result.progress.invalid.some(v=>v.reference==='tmdb'));assert.equal(await progress.getPersonalProgressWithDb(b.db,'tmdb'),null);
  await merge(b,raw);const position={mode:'episode',episode:17};
  const freshDb=await fresh();const data={...raw,progress:[{version:1,itemId:'mu',position,updatedAt:77}]};assert.equal((await merge(freshDb,data)).progress.warnings.length,1);
  assert.deepEqual((await exported(freshDb)).progress.find(p=>p.itemId==='mu').position,position);
  const broken=await fresh(),read=broken.db.getFirstAsync;
  broken.db.getFirstAsync=async(sql,...args)=>{if(sql.includes('WHERE provider = ?')&&args.flat().includes('tmdb'))throw Error('TEST identity resolution failure');return read(sql,...args)};
  const skipped=await merge(broken,raw);broken.db.getFirstAsync=read;assert.ok(skipped.failed.length>0);assert.equal(await progress.getPersonalProgressWithDb(broken.db,'tmdb'),null);assert.ok(skipped.progress.invalid.some(p=>p.reference==='tmdb'));
  assert.equal((await merge(broken,raw)).progress.inserted,1);
 });
 assert.equal(requests,0);fs.writeFileSync(__dirname+'/s3-results.json',JSON.stringify({status:'PASS',networkRequests:requests,results},null,2)+'\n');
}finally{Date.now=clock;stop();for(const f of files)if(!f.closed)f.close()}})().catch(error=>{console.error(error);process.exitCode=1});

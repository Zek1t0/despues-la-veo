const assert=require('node:assert/strict');const {fixture,createV6}=require('./sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {createMetadataRefreshRepository}=require('../../../src/storage/metadataRefreshRepo.ts');
const {createMetadataRefreshCoordinator}=require('../../../src/application/metadataRefreshCoordinator.ts');
const {createAutomaticMetadataRefresh,metadataIsStale,METADATA_DAY_MS:DAY}=require('../../../src/application/automaticMetadataRefresh.ts');
const {DEFAULT_MEDIA_PREFERENCES,parseMediaPreferences}=require('../../../src/core/mediaPreferences.ts');
const {setMediaAutoRefresh,setMediaLanguages,readMediaPreferencesWithDb,subscribeMediaPreferences}=require('../../../src/storage/mediaPreferencesRepo.ts');
const {selectMetadataSource}=require('../../../src/storage/mediaMetadataRepo.ts');
const {RefreshError}=require('../../../src/application/metadataRefreshError.ts');
const {providerReferenceKey}=require('../../../src/core/providerReference.ts');
const tick=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};
(async()=>{const f=fixture();try{createV6(f);await evolveDatabaseSchema(f.db,6);let clock=100*DAY,mono=0,calls=0,fail=null,delay=null;
const repository=createMetadataRefreshRepository(f.db),bindings={};
const cap={fields:[],scope:()=> '1',eligibility:()=>({enabled:true}),load:async item=>{calls++;if(delay)await delay;if(fail)throw fail;const reference=item.metadataState?.selection.reference??item.providerReferences[0];return {metadata:{version:1,provenance:{reference,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{canonicalTitle:'Fresh'}},diagnostics:[]}}};
for(const p of ['kitsu','tmdb','mangaupdates'])bindings[p]=cap;
let coordinator=createMetadataRefreshCoordinator({repository,bindings,now:()=>clock});
let open=createAutomaticMetadataRefresh({coordinator,repository,preferences:()=>readMediaPreferencesWithDb(f.db),now:()=>clock,monotonicNow:()=>mono});
const signal=()=>new AbortController().signal,advance=ms=>{clock+=ms;mono+=ms;};
assert.deepEqual((await readMediaPreferencesWithDb(f.db)).value.autoRefresh,{enabled:true,intervalDays:7});
assert.equal((await open('kitsu',signal())).status,'changed');assert.equal(calls,1);assert.equal(await open('kitsu',signal()),null);advance(7*DAY-1);assert.equal(await open('kitsu',signal()),null);advance(1);assert.equal((await open('kitsu',signal())).status,'unchanged');
// Personal edits do not establish freshness; custom interval and disabled survive preference reads.
await setMediaLanguages(['ja','es'],clock,f.db);await setMediaAutoRefresh({enabled:false,intervalDays:2.5},clock,f.db);advance(20*DAY);assert.equal(await open('kitsu',signal()),null);let prefs=await readMediaPreferencesWithDb(f.db);assert.deepEqual(prefs.value.languages,['ja','es']);assert.deepEqual(prefs.value.autoRefresh,{enabled:false,intervalDays:2.5});assert.deepEqual(parseMediaPreferences(JSON.parse(JSON.stringify(prefs))),prefs);
await setMediaAutoRefresh({enabled:true,intervalDays:2.5},clock,f.db);let release;delay=new Promise(r=>release=r);const before=calls;const first=open('kitsu',signal()),second=open('kitsu',signal());await tick();assert.equal(calls,before+1);release();await Promise.all([first,second]);delay=null;
// Failure cooldown starts when the response fails; repeated openings and restart cannot loop.
advance(2.5*DAY);fail=new RefreshError('server');const result=await open('kitsu',signal());assert.equal(result.code,'server');const failedCount=calls;assert.equal(await open('kitsu',signal()),null);
coordinator=createMetadataRefreshCoordinator({repository,bindings,now:()=>clock});open=createAutomaticMetadataRefresh({coordinator,repository,preferences:()=>readMediaPreferencesWithDb(f.db),now:()=>clock,monotonicNow:()=>mono});
advance(15*60000-1);assert.equal(await open('kitsu',signal()),null);assert.equal(calls,failedCount);advance(1);fail=null;assert.equal((await open('kitsu',signal())).status,'unchanged');
// A manual retry can run before the automatic cooldown, while known provider wait is authoritative.
advance(3*DAY);fail=new RefreshError('timeout');await open('kitsu',signal());fail=null;assert.equal((await coordinator.refresh('kitsu')).status,'unchanged');
advance(3*DAY);fail=new RefreshError('rate-limited',60*60000);await open('kitsu',signal());const blockedCalls=calls;advance(15*60000);assert.equal(await open('kitsu',signal()),null);assert.equal((await coordinator.refresh('kitsu')).status,'skipped');assert.equal(calls,blockedCalls);advance(45*60000);fail=null;assert.equal((await open('kitsu',signal())).status,'unchanged');
// Short provider wait does not turn into an invented 15-minute manual HTTP block.
advance(3*DAY);fail=new RefreshError('rate-limited',60000);await open('kitsu',signal());advance(60000);assert.equal(await open('kitsu',signal()),null);fail=null;assert.equal((await coordinator.refresh('kitsu')).status,'unchanged');
// The failure completion clock, not request start, anchors cooldown; local monotonic time resists clock jumps.
advance(3*DAY);fail=new RefreshError('server');let finishFailure;delay=new Promise(r=>finishFailure=r);const waitingFailure=open('kitsu',signal());await tick();advance(30*60000);finishFailure();await waitingFailure;delay=null;const failureClock=clock;
clock-=DAY;assert.equal(await open('kitsu',signal()),null);clock=failureClock;advance(15*60000-1);assert.equal(await open('kitsu',signal()),null);advance(1);fail=null;assert.ok(await open('kitsu',signal()));
// Failure cooldown still applies locally if saving the operational error itself fails.
advance(3*DAY);fail=new RefreshError('server');const brokenRepo={...repository,fail:async()=>{throw Error('operational write failed')}};
const brokenCoordinator=createMetadataRefreshCoordinator({repository:brokenRepo,bindings,now:()=>clock});
const safeOpen=createAutomaticMetadataRefresh({repository:brokenRepo,coordinator:brokenCoordinator,preferences:()=>readMediaPreferencesWithDb(f.db),now:()=>clock,monotonicNow:()=>mono});
await safeOpen('kitsu',signal());const brokenCount=calls;assert.equal(await safeOpen('kitsu',signal()),null);assert.equal(calls,brokenCount);advance(15*60000);fail=null;assert.ok(await safeOpen('kitsu',signal()));
// Future/imported checkedAt is stale, but its stored evidence is not mutated by evaluation.
f.sqlite.prepare('UPDATE media_metadata SET document_json=json_set(document_json,\'$.metadata.provenance.checkedAt\',?) WHERE saved_title_id=?').run(clock+100*DAY,'kitsu');
const futureBefore=await repository.read('kitsu');assert.equal(metadataIsStale(clock+100*DAY,7,clock),true);await open('kitsu',signal());assert.equal(futureBefore.metadataState.documents[0].metadata.provenance.checkedAt,clock+100*DAY);
for(const bad of [null,undefined,NaN,Infinity,-1,'123'])assert.equal(metadataIsStale(bad,7,clock),true);
// An opening evaluated against an old read cannot launch a second HTTP after a very fast success.
advance(3*DAY);const oldInspection=await coordinator.inspect('kitsu');await coordinator.refresh('kitsu');const afterFast=calls;
const oldReadOpen=createAutomaticMetadataRefresh({coordinator:{...coordinator,inspect:async()=>oldInspection},preferences:()=>readMediaPreferencesWithDb(f.db),now:()=>clock,monotonicNow:()=>mono});assert.equal((await oldReadOpen('kitsu',signal())).status,'skipped');assert.equal(calls,afterFast);
const staleRepo={...repository,read:async()=>oldInspection.item};const staleCoordinator=createMetadataRefreshCoordinator({repository:staleRepo,bindings,now:()=>clock});assert.equal((await staleCoordinator.refresh('kitsu',{automatic:true,automaticIntervalDays:2.5})).status,'skipped');assert.equal(calls,afterFast,'transaction rechecks freshness even when the coordinator read is old');
// Source is selected explicitly; no automatic matching, no global bootstrap, manual zero HTTP.
let count=calls;assert.equal(await open('manual',signal()),null);assert.equal(await open('multi',signal()),null);assert.equal(calls,count);
await selectMetadataSource('multi',{provider:'kitsu',resourceNamespace:'anime',externalId:'2'},clock++,f.db);assert.ok(await open('multi',signal()));await selectMetadataSource('multi',{provider:'tmdb',resourceNamespace:'tv',externalId:'2'},clock++,f.db);assert.ok(await open('multi',signal()));assert.equal(calls,count+2);
const originalData=await f.db.getAllAsync('SELECT id,notes,personal_rating,status,tags_json,created_at,updated_at FROM saved_titles ORDER BY id');
assert.ok(originalData.every(row=>row.updated_at===20||row.updated_at===21));
let notifications=0;const stop=subscribeMediaPreferences(()=>notifications++);const old=await readMediaPreferencesWithDb(f.db);await assert.rejects(setMediaAutoRefresh({enabled:true,intervalDays:0},clock,f.db));assert.deepEqual(await readMediaPreferencesWithDb(f.db),old);assert.equal(notifications,0);stop();
// Actual backup v8 export/parse/import into another SQLite file, not a synthetic preference-only check.
await setMediaAutoRefresh({enabled:false,intervalDays:4.25},clock+100,f.db);
const {getLibraryBackupExportDataWithDb}=require('../../../src/storage/libraryBackupExport.ts');
const {createLibraryBackupV8}=require('../../../src/core/libraryBackupV8.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {mergeLibraryBackupWithDb}=require('../../../src/storage/libraryBackupMerge.ts');
const data=await getLibraryBackupExportDataWithDb(f.db,{status:'unavailable'}),backup=createLibraryBackupV8(data.items,data.pins,data.appearanceAvailability,undefined,{preferences:data.preferences,activity:data.activity});
const parsed= parseLibraryBackup(JSON.stringify(backup));assert.equal(parsed.ok,true);assert.equal(parsed.payload.invalid.length,0);
let restored=fixture();await evolveDatabaseSchema(restored.db,0);await restored.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(restored.db,parsed.payload,()=> 'unexpected-remap'));
assert.deepEqual((await readMediaPreferencesWithDb(restored.db)).value.autoRefresh,{enabled:false,intervalDays:4.25});assert.deepEqual((await readMediaPreferencesWithDb(restored.db)).value.languages,['ja','es']);
const restoredRepo=createMetadataRefreshRepository(restored.db),restoredCoordinator=createMetadataRefreshCoordinator({repository:restoredRepo,bindings,now:()=>clock});
const restoredOpen=createAutomaticMetadataRefresh({repository:restoredRepo,coordinator:restoredCoordinator,preferences:()=>readMediaPreferencesWithDb(restored.db),now:()=>clock,monotonicNow:()=>mono});
count=calls;assert.equal(await restoredOpen('kitsu',signal()),null);assert.equal(calls,count);assert.equal((await restoredRepo.read('kitsu')).updatedAt,20);
const file=restored.file;restored.close();restored=fixture(file);assert.equal((await readMediaPreferencesWithDb(restored.db)).value.autoRefresh.intervalDays,4.25);restored.close();
console.log('PASS 5.6 real SQLite/clock: defaults, first/recent/exact/custom/disabled, concurrent openings, failure completion cooldown/restart/exact expiry, manual retry, longer HTTP wait, future clocks, explicit source change, manuals/ambiguity, personal preservation, atomic prefs, actual v8 export/import and SQLite reopen. No global startup.');
}finally{f.close();}})().catch(e=>{console.error(e);process.exitCode=1});

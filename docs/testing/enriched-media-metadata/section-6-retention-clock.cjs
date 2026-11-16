const assert=require('node:assert/strict');
const {fixture,createV6}=require('./sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {recordActivityWithDb,readActivityPageWithDb}=require('../../../src/storage/libraryActivityRepo.ts');
const {updateMediaMetadataWithDb}=require('../../../src/storage/mediaMetadataRepo.ts');
const {pinTitleWithDb,setTitlePinStateWithDb}=require('../../../src/storage/titlePinsRepo.ts');
const {subscribeLibraryActivity}=require('../../../src/storage/libraryActivitySignals.ts');
const {runSerializedStorageMutation}=require('../../../src/storage/storageMutationQueue.ts');
const {getLibraryBackupExportDataWithDb}=require('../../../src/storage/libraryBackupExport.ts');
const {createLibraryBackupV8}=require('../../../src/core/libraryBackupV8.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {mergeLibraryBackupWithDb}=require('../../../src/storage/libraryBackupMerge.ts');
const DAY=86400000,retentionNow=Date.UTC(2026,10,16,12),realNow=Date.now;
Date.now=()=>retentionNow;
const ref={provider:'kitsu',resourceNamespace:'anime',externalId:'1'},context={contextType:'library',contextKey:''};
const doc={version:1,provenance:{reference:ref,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{canonicalTitle:'Historical provider change'}};
const writers={
 personal:{write:(f,time)=>recordActivityWithDb(f.db,'kitsu','notes',['notes'],time,'writer-operation'),eventTime:time=>time},
 metadata:{write:(f,time)=>updateMediaMetadataWithDb(f.db,'kitsu',doc,time,undefined,'zz-metadata'),eventTime:time=>time},
 pin:{write:(f,time)=>pinTitleWithDb(f.db,'kitsu',context,time),eventTime:time=>time},
 'pin-state':{write:(f,time)=>setTitlePinStateWithDb(f.db,'kitsu',context,time),eventTime:()=>retentionNow},
};
const tx=(f,task)=>runSerializedStorageMutation(()=>f.db.withTransactionAsync(task));
const events=f=>f.sqlite.prepare('SELECT * FROM library_activity_events ORDER BY occurred_at DESC,id DESC').all();
const personals=f=>f.sqlite.prepare('SELECT id,notes,tags_json,status,personal_rating,created_at,updated_at FROM saved_titles ORDER BY id').all();
const add=(f,id,time)=>f.sqlite.prepare("INSERT INTO library_activity_events VALUES (?,'kitsu',?,'notes','personal','[\"notes\"]',?)").run(id,time,id);
async function setup(){const f=fixture();createV6(f);await evolveDatabaseSchema(f.db,6);return f;}
function seed(f){add(f,'expired-120',retentionNow-120*DAY);add(f,'before-boundary',retentionNow-90*DAY-1);add(f,'exact-90',retentionNow-90*DAY);add(f,'recent-60',retentionNow-60*DAY);}
(async()=>{let groups=0;
for(const [name,writer]of Object.entries(writers))for(const [label,time]of [['historical-60',retentionNow-60*DAY],['future-30',retentionNow+30*DAY],['exact-90',retentionNow-90*DAY]]){
 const f=await setup();try{
  seed(f);const originalPersonals=personals(f);let notifications=0;const stop=subscribeLibraryActivity(()=>notifications++);
  await tx(f,()=>writer.write(f,time));
  // Inspect raw SQL first: the writer itself must have pruned, without a feed read hiding the bug.
  const rows=events(f);assert.equal(rows.length,3,`${name}/${label}`);assert.ok(!rows.some(e=>e.id==='expired-120'||e.id==='before-boundary'),`${name} prunes against current retention clock`);
  assert.ok(rows.some(e=>e.id==='exact-90'));assert.ok(rows.some(e=>e.id==='recent-60'));
  const written=rows.find(e=>!['exact-90','recent-60'].includes(e.id));assert.equal(written.occurred_at,writer.eventTime(time),'original event clock is preserved');
  assert.deepEqual(personals(f),originalPersonals,'retention never changes personal values or clocks');assert.equal(notifications,1);stop();
  if(name==='pin'||name==='pin-state')assert.equal(f.sqlite.prepare("SELECT pinned_at FROM title_pins WHERE saved_title_id='kitsu' AND context_type='library'").get().pinned_at,time,'pin clock is preserved independently');
  if(name==='metadata')assert.equal(f.sqlite.prepare("SELECT metadata_changed_at FROM media_metadata WHERE saved_title_id='kitsu'").get().metadata_changed_at,time,'provider change clock remains historical/future');
  groups++;
 }finally{f.close();}
}
for(const [name,writer]of Object.entries(writers)){
 const f=await setup();try{
  seed(f);const before=events(f),beforePersonals=personals(f),beforePins=f.sqlite.prepare('SELECT * FROM title_pins ORDER BY 1,2,3').all();let notifications=0;const stop=subscribeLibraryActivity(()=>notifications++);
  await assert.rejects(tx(f,async()=>{await writer.write(f,retentionNow-60*DAY);assert.ok(!events(f).some(e=>e.id==='expired-120'));throw Error('rollback after pruning');}),/rollback/);
  assert.deepEqual(events(f),before,`${name}: pruning is rolled back atomically`);assert.deepEqual(personals(f),beforePersonals);assert.deepEqual(f.sqlite.prepare('SELECT * FROM title_pins ORDER BY 1,2,3').all(),beforePins);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM media_metadata').get().n,0);assert.equal(notifications,0);
  await runSerializedStorageMutation(async()=>assert.deepEqual(events(f),before));assert.equal(notifications,0,'a rolled-back marker cannot notify on a later read');stop();groups++;
 }finally{f.close();}
}
for(const [name,writer]of Object.entries(writers)){
 const f=await setup();try{
  add(f,'expired-120',retentionNow-120*DAY);for(let i=0;i<2001;i++)add(f,'aaa-'+String(i).padStart(4,'0'),retentionNow);
  const before=personals(f);await tx(f,()=>writer.write(f,retentionNow));const rows=events(f);assert.equal(rows.length,2000,`${name}: max 2000`);assert.ok(!rows.some(e=>['expired-120','aaa-0000','aaa-0001'].includes(e.id)));
  assert.deepEqual(rows.map(e=>e.id),rows.map(e=>e.id).sort().reverse(),'equal clocks retain deterministic descending IDs');assert.deepEqual(personals(f),before);groups++;
 }finally{f.close();}
}
// Reads and export already use current time. Export filters old rows without changing event identity.
const source=await setup(),target=await setup();try{
 seed(source);const before=personals(source);const data=await getLibraryBackupExportDataWithDb(source.db,{status:'unavailable'});assert.deepEqual(new Set(data.activity.map(e=>e.id)),new Set(['exact-90','recent-60']));assert.equal(events(source).length,4,'export retains its existing non-mutating filtering behavior');
 const backup=createLibraryBackupV8(data.items,data.pins,data.appearanceAvailability,undefined,{preferences:data.preferences,activity:[...data.activity,{id:'import-expired',itemId:'kitsu',occurredAt:retentionNow-120*DAY,kind:'notes',origin:'personal',fields:['notes'],operationKey:'import-expired'}]});
 const parsed=parseLibraryBackup(JSON.stringify(backup));assert.equal(parsed.ok,true);assert.equal(parsed.payload.invalid.length,0);assert.equal(parsed.payload.invalidActivity.length,0);
 add(target,'target-expired',retentionNow-120*DAY);const targetPersonals=personals(target);await tx(target,()=>mergeLibraryBackupWithDb(target.db,parsed.payload,()=> 'unexpected-remap'));
 assert.deepEqual(new Set(events(target).map(e=>e.id)),new Set(['exact-90','recent-60']));assert.equal(events(target).find(e=>e.id==='recent-60').occurred_at,retentionNow-60*DAY);assert.deepEqual(personals(target),targetPersonals);
 await tx(target,()=>mergeLibraryBackupWithDb(target.db,parsed.payload,()=> 'unexpected-remap'));assert.equal(events(target).length,2,'v8 reimport stays deduplicated');
 const page=await readActivityPageWithDb(source.db,'all');assert.equal(events(source).length,2,'read-time pruning also uses current retention time');assert.equal(page.events.length,2);assert.equal(page.events.find(e=>e.id==='exact-90').occurredAt,retentionNow-90*DAY);assert.deepEqual(personals(source),before);groups++;
}finally{source.close();target.close();}
console.log(`PASS S6 retention clock correction: ${groups} groups; real isolated SQLite, fixed current retention clock, 120d/60d/future/exact90d, metadata and both pin writers, raw post-write pruning, 2000/tie ordering, atomic rollback/no false notifications, unchanged personal/pin/metadata clocks, read/export/import v8 compatibility. No HTTP/UI.`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>Date.now=realNow);

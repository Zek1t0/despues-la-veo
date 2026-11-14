const assert = require('node:assert/strict');
const { fixture, createV6 } = require('./sqlite-fixtures.cjs');
const { evolveDatabaseSchema } = require('../../../src/storage/databaseSchema.ts');
const { getLibraryBackupExportDataWithDb: exportData } = require('../../../src/storage/libraryBackupExport.ts');
const { createLibraryBackupV8 } = require('../../../src/core/libraryBackupV8.ts');
const { createLibraryBackupV7 } = require('../../../src/core/libraryBackupV7.ts');
const { parseLibraryBackup } = require('../../../src/core/libraryBackup.ts');
const { mergeLibraryBackupWithDb } = require('../../../src/storage/libraryBackupMerge.ts');
const { mergeLibraryBackup } = require('../../../src/storage/savedTitlesRepo.ts');
const { getSavedTitleWithReferencesByIdWithDb: read } = require('../../../src/storage/savedTitleStorage.ts');
const { updateMediaMetadata, readMetadataStateWithDb } = require('../../../src/storage/mediaMetadataRepo.ts');
const { subscribeMediaPreferences, setMediaPreferences, readMediaPreferencesWithDb } = require('../../../src/storage/mediaPreferencesRepo.ts');
const { subscribeLibraryInvalidation } = require('../../../src/storage/libraryInvalidation.ts');
const ref = {provider:'kitsu',resourceNamespace:'anime',externalId:'1'};
const doc = fields => ({version:1,provenance:{reference:ref,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields});
function parsed(value) { const result=parseLibraryBackup(JSON.stringify(value)); assert.equal(result.ok,true); return result.payload; }
async function exported(f) { const data=await exportData(f.db,{status:'unavailable'}); return createLibraryBackupV8(data.items,data.pins,data.appearanceAvailability,undefined,{preferences:data.preferences,activity:data.activity}); }
let remapSerial=0;
async function merge(f,payload) { let result; await f.db.withTransactionAsync(async()=>{result=await mergeLibraryBackupWithDb(f.db,payload,()=>`remap-${++remapSerial}`);});return result; }
(async()=>{
  const source=fixture();createV6(source);await evolveDatabaseSchema(source.db,6);
  const oldData=await exportData(source.db,{status:'unavailable'});
  const historical=createLibraryBackupV7(oldData.items,oldData.pins,oldData.appearanceAvailability);
  const now=1_800_000_000_000;
  Date.now=()=>now;
  await updateMediaMetadata('kitsu',doc({canonicalTitle:'Latest Kitsu',startDate:'2020-01-01',publicRating:{provider:'kitsu',originalValue:'82.28',originalScale:{min:0,max:100}},
    titles:[{value:'TEST Alternate',language:'en',script:null,kind:'localized'}],posterImages:[{variant:'small',url:'https://images.example.test/x'}]}),now,undefined,source.db);
  await setMediaPreferences({version:1,languages:['en','es'],autoRefresh:{enabled:false,intervalDays:30},hideSensitive:false},now,source.db);
  const backup=await exported(source);assert.equal(backup.version,8);assert.ok(backup.items.find(i=>i.id==='kitsu').metadataState);
  assert.ok(JSON.stringify(backup).includes('82.28'));assert.ok(!JSON.stringify(backup).includes('backoff_until'));assert.equal(backup.activity.length,1);
  const target=fixture();await evolveDatabaseSchema(target.db,0);
  const result=await merge(target,parsed(backup));assert.equal(result.inserted,5);
  let restored=await read(target.db,'kitsu');assert.equal(restored.title,'Latest Kitsu');assert.equal(restored.updatedAt,20);assert.equal(restored.personalRating,85);
  assert.deepEqual(restored.localAliases,['TEST Alternate']);assert.equal(restored.posterUrl,null,'no artwork gate opened');
  assert.deepEqual((await readMediaPreferencesWithDb(target.db)).value,backup.preferences.value);
  assert.equal((await merge(target,parsed(backup))).inserted,0);assert.equal(target.sqlite.prepare('SELECT count(*) n FROM library_activity_events').get().n,1);
  // An old snapshot can supply a historically eligible personal edit without degrading remote fields.
  const old=structuredClone(historical);old.items.find(i=>i.id==='kitsu').updatedAt=30;old.items.find(i=>i.id==='kitsu').notes='Old backup eligible note';
  await merge(target,parsed(old));restored=await read(target.db,'kitsu');assert.equal(restored.title,'Latest Kitsu');assert.equal(restored.notes,'Old backup eligible note');assert.equal(restored.updatedAt,30);
  assert.equal((await exported(target)).items.find(i=>i.id==='kitsu').title,'Latest Kitsu');
  const conflicting=structuredClone(backup);conflicting.items.find(i=>i.id==='kitsu').title='Contradiction';
  assert.ok(parsed(conflicting).invalid.some(e=>e.message.includes('contradictoria')));
  const missingRef=structuredClone(backup);missingRef.items.find(i=>i.id==='kitsu').metadataState.selection.reference={...ref,externalId:'999'};
  assert.ok(parsed(missingRef).invalid.length);
  // Newer checkedAt cannot grant authority to an older document.
  const older=structuredClone(backup), olderItem=older.items.find(i=>i.id==='kitsu');
  olderItem.metadataState.documents[0].changedAt=1;
  olderItem.metadataState.documents[0].metadata.provenance.checkedAt=now+50000;
  olderItem.metadataState.documents[0].metadata.fields.canonicalTitle='Older remote';olderItem.title='Older remote';
  await merge(target,parsed(older));assert.equal((await read(target.db,'kitsu')).title,'Latest Kitsu');
  // Same timestamp, different content fails only that item's savepoint.
  const tied=structuredClone(backup), tiedItem=tied.items.find(i=>i.id==='kitsu');
  tiedItem.metadataState.documents[0].metadata.fields.canonicalTitle='Tied conflict';tiedItem.title='Tied conflict';
  const tiedResult=await merge(target,parsed(tied));assert.ok(tiedResult.failed.length||tiedResult.conflicts.length);
  assert.equal((await read(target.db,'kitsu')).title,'Latest Kitsu');
  // Colliding local-only ID is remapped by the incoming portable identity, pins/events follow the remap.
  const collision=fixture();createV6(collision);await evolveDatabaseSchema(collision.db,6);
  collision.sqlite.exec("DELETE FROM saved_titles WHERE id!='manual'");
  const collisionBackup=structuredClone(backup);collisionBackup.items=collisionBackup.items.filter(i=>i.id==='manual');
  collisionBackup.items[0].manualIdentity='another-portable-manual';collisionBackup.pins=[{itemId:'manual',contextType:'library',contextKey:'',pinnedAt:now}];
  collisionBackup.activity=[{id:'portable-remap-event',itemId:'manual',occurredAt:now,kind:'added',origin:'personal',fields:['title'],operationKey:'portable-remap-op'}];
  const collisionResult=await merge(collision,parsed(collisionBackup));assert.equal(collisionResult.inserted,1);
  const event=collision.sqlite.prepare("SELECT saved_title_id FROM library_activity_events WHERE id='portable-remap-event'").get();assert.notEqual(event.saved_title_id,'manual');
  assert.equal((await merge(collision,parsed(collisionBackup))).inserted,0);
  // Preferences are published only after COMMIT, invalid preferences preserve local settings.
  let published=0,invalidated=0;const stop=subscribeMediaPreferences(()=>published++),stopUI=subscribeLibraryInvalidation(()=>invalidated++);
  const preferenceBackup=structuredClone(backup);preferenceBackup.preferences.updatedAt=now+1;preferenceBackup.preferences.value.hideSensitive=true;
  const broken={...target.db,withTransactionAsync:async task=>target.db.withTransactionAsync(async()=>{await task();throw Error('commit rejected');})};
  await assert.rejects(mergeLibraryBackup(parsed(preferenceBackup),()=> 'unused',broken),/commit rejected/);assert.equal(published,0);assert.equal(invalidated,0);
  await mergeLibraryBackup(parsed(preferenceBackup),()=> 'unused',target.db);assert.equal(published,1);
  const badPreferences=structuredClone(backup);badPreferences.preferences.value.languages=['en','en'];
  assert.equal(parsed(badPreferences).preferenceIssues.length,1);await merge(target,parsed(badPreferences));assert.equal((await readMediaPreferencesWithDb(target.db)).value.hideSensitive,true);
  assert.equal(parseLibraryBackup(JSON.stringify({...backup,version:9})).ok,false);
  for(const f of [source,target,collision]){assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);f.close();}
  stop();stopUI();console.log('PASS 2.5/2.6/2.7: v8 round-trip, v7 preservation, per-source clocks, same-time conflict, remap, repeat, savepoints, preferences and commit rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});

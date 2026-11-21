const assert = require('node:assert/strict');
const fs = require('node:fs');
const {fixture,createV6} = require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema = require('../../../src/storage/databaseSchema.ts');
const {createMetadataSchemaWithDb,backfillMetadataBaselinesWithDb}=require('../../../src/storage/mediaMetadataSchema.ts');
const repo=require('../../../src/storage/collectionsRepo.ts');
const {subscribeOrganization}=require('../../../src/storage/organizationInvalidation.ts');
const {getLibraryBackupExportDataWithDb}=require('../../../src/storage/libraryBackupExport.ts');
const {createLibraryBackupV9}=require('../../../src/core/libraryBackupV9.ts');
const {createLibraryBackupV8}=require('../../../src/core/libraryBackupV8.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {mergeLibraryBackupWithDb}=require('../../../src/storage/libraryBackupMerge.ts');
const {mergeLibraryBackup}=require('../../../src/storage/savedTitlesRepo.ts');
const {savedContentVisible}=require('../../../src/core/sensitiveContent.ts');
const databases=[];
const fresh=()=>{const f=fixture();databases.push(f);return f;};
async function v7(f){createV6(f);await f.db.withTransactionAsync(async()=>{await createMetadataSchemaWithDb(f.db);await backfillMetadataBaselinesWithDb(f.db);await f.db.execAsync('PRAGMA user_version=7;');});}
function snapshot(f){return Object.fromEntries(f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,f.sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all()]));}
async function exportV9(f){const d=await getLibraryBackupExportDataWithDb(f.db,{status:'unavailable'});return createLibraryBackupV9(d.items,d.pins,d.appearanceAvailability,undefined,{preferences:d.preferences,activity:d.activity,collections:d.collections,collectionMemberships:d.collectionMemberships,recommendations:d.recommendations});}
const parsed=b=>{const r=parseLibraryBackup(JSON.stringify(b));assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.payload.invalid.length,0);return r.payload;};
(async()=>{
 const source=fresh();await v7(source);const before=snapshot(source);
 for(const hook of ['afterV8TablesCreated','beforeVersion8Published','afterVersion8Published']){
  const failed=fresh();await v7(failed);const old=snapshot(failed);
  await assert.rejects(schema.evolveDatabaseSchema(failed.db,7,{[hook]:()=>{throw Error('TEST migration failure')}}));
  assert.deepEqual(snapshot(failed),old);assert.equal((await schema.readUserVersion(failed.db)),7);
 }
 await schema.evolveDatabaseSchema(source.db,7);assert.equal(await schema.readUserVersion(source.db),schema.DATABASE_SCHEMA_VERSION);
 const after=snapshot(source);for(const [name,rows] of Object.entries(before))assert.deepEqual(after[name],rows,name);
 await schema.evolveDatabaseSchema(source.db,schema.DATABASE_SCHEMA_VERSION);assert.deepEqual(snapshot(source),after);
 await assert.rejects(schema.evolveDatabaseSchema(source.db,schema.DATABASE_SCHEMA_VERSION+1));
 let changes=0;const stop=subscribeOrganization(()=>changes++);
 await repo.mutateCollections(db=>repo.createCollectionWithDb(db,'c1','TEST larga colección 日本語','Descripción TEST',100),source.db);
 assert.equal(changes,1);
 await repo.mutateCollections(db=>repo.createCollectionWithDb(db,'c1','TEST larga colección 日本語','Descripción TEST',100),source.db);assert.equal(changes,1);
 await assert.rejects(repo.mutateCollections(db=>repo.createCollectionWithDb(db,'bad','  ',null),source.db));assert.equal(changes,1);
 await repo.mutateCollections(db=>repo.createCollectionWithDb(db,'empty','TEST vacía',null,100),source.db);
 await repo.mutateCollections(db=>repo.createCollectionWithDb(db,'c2','TEST segunda',null,100),source.db);
 await source.db.withTransactionAsync(async()=>{
  assert.equal(await repo.setCollectionMemberWithDb(source.db,'c1','kitsu',true,101),true);
  assert.equal(await repo.setCollectionMemberWithDb(source.db,'c1','kitsu',true,102),false);
  await repo.setCollectionMemberWithDb(source.db,'c2','kitsu',true,103);
  await repo.setCollectionMemberWithDb(source.db,'c1','manual',true,104);
 });
 assert.equal(source.sqlite.prepare('SELECT count(*) n FROM collection_memberships').get().n,3);
 const stable=snapshot(source);const notified=changes;
 await assert.rejects(repo.mutateCollections(async db=>{await repo.editCollectionWithDb(db,'c1','Should roll back',null);throw Error('TEST write');},source.db));
 assert.deepEqual(snapshot(source),stable);assert.equal(changes,notified);
 await assert.rejects(repo.mutateCollections(db=>repo.setCollectionMemberWithDb(db,'c1','missing',true),source.db));
 // Two independently identified recommendations share the same strong reference and link.
 for(const id of ['r1','r2'])await source.db.runAsync(`INSERT INTO recommendation_inbox (id,original_capture_json,capture_kind,name,provider,resource_namespace,external_id,person,comment,status,linked_saved_title_id,created_at,updated_at) VALUES (?,?,'reference','TEST','kitsu','anime','1',?,?,'incorporated','kitsu',1,2)`,id,JSON.stringify({name:'TEST',reference:{provider:'kitsu',resourceNamespace:'anime',externalId:'1'},person:id,comment:'TEST comment'}),id,'TEST comment');
 const cloned=source.sqlite.prepare("SELECT * FROM recommendation_inbox ORDER BY id").all();
 await assert.rejects(source.db.runAsync("UPDATE recommendation_inbox SET original_capture_json='{}' WHERE id='r1'"));
 await assert.rejects(source.db.runAsync("UPDATE recommendation_inbox SET linked_saved_title_id=NULL WHERE id='r1'"));
 await source.db.withTransactionAsync(()=>source.db.runAsync("DELETE FROM saved_titles WHERE id='kitsu'"));
 const reopened=source.sqlite.prepare('SELECT * FROM recommendation_inbox ORDER BY id').all();
 for(let i=0;i<2;i++){assert.equal(reopened[i].status,'pending');assert.equal(reopened[i].linked_saved_title_id,null);for(const field of ['name','person','comment','original_capture_json','provider','external_id'])assert.equal(reopened[i][field],cloned[i][field]);}
 assert.equal(source.sqlite.prepare("SELECT count(*) n FROM collection_memberships WHERE saved_title_id='kitsu'").get().n,0);
 // S2 now exports valid Inbox records while preserving the S1 collections regression.
 const backup=await exportV9(source),payload=parsed(backup);assert.equal(backup.version,9);assert.equal(backup.recommendations.length,2);
 assert.ok(backup.collections.some(c=>c.id==='empty'));assert.equal(payload.collectionMemberships.length,1);
 const dest=fresh();await schema.evolveDatabaseSchema(dest.db,0);
 let result;await dest.db.withTransactionAsync(async()=>{result=await mergeLibraryBackupWithDb(dest.db,payload,()=> 'remapped');});
 assert.equal(result.organization.collections.inserted,3);assert.equal(result.organization.memberships.inserted,1);
 const roundtrip=await exportV9(dest);assert.deepEqual(roundtrip.collections,backup.collections);assert.deepEqual(roundtrip.collectionMemberships,backup.collectionMemberships);
 const once=snapshot(dest);await dest.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(dest.db,payload,()=> 'unused'));assert.deepEqual(snapshot(dest),once);
 // Occupied local ID must not receive a membership belonging to a different portable item.
 const conflict=fresh();await schema.evolveDatabaseSchema(conflict.db,0);
 await conflict.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(conflict.db,parsed(backup),()=> 'unused'));
 await conflict.db.runAsync("UPDATE manual_entry_identities SET portable_id='other-identity' WHERE saved_title_id='manual'");
 let seq=0;await conflict.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(conflict.db,payload,()=>`mapped-${++seq}`));
 const mapped=conflict.sqlite.prepare("SELECT saved_title_id FROM manual_entry_identities WHERE portable_id='TEST-portable-manual'").get().saved_title_id;
 assert.notEqual(mapped,'manual');assert.ok(conflict.sqlite.prepare('SELECT 1 FROM collection_memberships WHERE collection_id=? AND saved_title_id=?').get('c1',mapped));
 // Strict freshness and absence are non-destructive.
 const older=structuredClone(backup);older.collections[0].name='old';older.collections[0].updatedAt=99;
 await dest.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(dest.db,parsed(older),()=> 'unused'));assert.deepEqual(snapshot(dest),once);
 const equal=structuredClone(backup);equal.collections[0].name='equal';
 await dest.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(dest.db,parsed(equal),()=> 'unused'));assert.deepEqual(snapshot(dest),once);
 const newer=structuredClone(backup);newer.collections[0].name='new';newer.collections[0].updatedAt=200;
 await dest.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(dest.db,parsed(newer),()=> 'unused'));assert.equal((await repo.listCollectionsWithDb(dest.db)).find(c=>c.id===newer.collections[0].id).name,'new');
 const absent=structuredClone(backup);absent.collections=[];absent.collectionMemberships=[];const retained=snapshot(dest);
 await dest.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(dest.db,parsed(absent),()=> 'unused'));assert.deepEqual(snapshot(dest),retained);
 const invalid=structuredClone(backup);invalid.collections.push({id:'bad',name:' ',createdAt:1,updatedAt:2});invalid.collectionMemberships.push({collectionId:'c1',itemId:'missing',addedAt:1,updatedAt:2});
 const ip=parsed(invalid);assert.ok(ip.organizationIssues.length);await dest.db.withTransactionAsync(async()=>{result=await mergeLibraryBackupWithDb(dest.db,ip,()=> 'unused');});assert.ok(result.organization.memberships.issues.length);
 for(const bad of [{...backup,version:100},{...backup,collections:{}},{...backup,recommendations:{}}])assert.equal(parseLibraryBackup(JSON.stringify(bad)).ok,false);
 // Historical v8 remains fully operational and ignores organization fields.
 const d=await getLibraryBackupExportDataWithDb(source.db,{status:'unavailable'});
 const historical=createLibraryBackupV8(d.items,d.pins,d.appearanceAvailability,undefined,{preferences:d.preferences,activity:d.activity});
 const hp=parsed({...historical,collections:[{invalid:'ignored'}]});assert.equal(hp.version,8);
 await dest.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(dest.db,hp,()=> 'unused'));
 // Commit failure must suppress publication and roll back all writes.
 const fail=fresh();await schema.evolveDatabaseSchema(fail.db,0);const original=fail.db.withTransactionAsync;
 fail.db.withTransactionAsync=task=>original(async()=>{await task();throw Error('TEST commit failure');});const countBefore=changes;
 await assert.rejects(mergeLibraryBackup(payload,()=> 'unused',fail.db));assert.equal(changes,countBefore);assert.equal(fail.sqlite.prepare('SELECT count(*) n FROM saved_titles').get().n,0);assert.equal(fail.sqlite.prepare('SELECT count(*) n FROM personal_collections').get().n,0);
 // Per-record savepoint failure leaves unrelated collections intact.
 const partial=fresh();await schema.evolveDatabaseSchema(partial.db,0);partial.sqlite.exec("CREATE TRIGGER test_failure BEFORE INSERT ON personal_collections WHEN NEW.id='c1' BEGIN SELECT RAISE(ABORT,'TEST record'); END;");
 await partial.db.withTransactionAsync(async()=>{result=await mergeLibraryBackupWithDb(partial.db,payload,()=> 'unused');});assert.equal(result.organization.collections.inserted,2);assert.equal(result.organization.collections.issues.length,1);assert.equal(partial.sqlite.prepare('SELECT count(*) n FROM collection_memberships').get().n,0);
 // Collection removal cannot touch titles, and file reopen preserves all data.
 const titleBefore=dest.sqlite.prepare('SELECT * FROM saved_titles ORDER BY id').all();await repo.mutateCollections(db=>repo.deleteCollectionWithDb(db,'c1'),dest.db);assert.deepEqual(dest.sqlite.prepare('SELECT * FROM saved_titles ORDER BY id').all(),titleBefore);
 for(const f of databases)assert.deepEqual(await f.db.getAllAsync('PRAGMA foreign_key_check'),[]);
 const file=dest.file;const saved=snapshot(dest);dest.close();databases.splice(databases.indexOf(dest),1);const reopenedDb=fixture(file);databases.push(reopenedDb);await schema.evolveDatabaseSchema(reopenedDb.db,8);assert.deepEqual(snapshot(reopenedDb),saved);
 // Sensitive filtering must never reduce export or restore membership data.
 const sensitive=fresh();await v7(sensitive);await schema.evolveDatabaseSchema(sensitive.db,7);
 const {updateMediaMetadataWithDb}=require('../../../src/storage/mediaMetadataRepo.ts');
 await sensitive.db.withTransactionAsync(async()=>{
  await repo.createCollectionWithDb(sensitive.db,'sensitive-collection','TEST sensibles',null,100);
  await repo.setCollectionMemberWithDb(sensitive.db,'sensitive-collection','kitsu',true,101);
  await updateMediaMetadataWithDb(sensitive.db,'kitsu',{version:1,provenance:{reference:{provider:'kitsu',resourceNamespace:'anime',externalId:'1'},normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{sensitive:true}},1000);
  await require('../../../src/storage/mediaPreferencesRepo.ts').mergeMediaPreferencesWithDb(sensitive.db,{value:{...require('../../../src/core/mediaPreferences.ts').DEFAULT_MEDIA_PREFERENCES,hideSensitive:true},updatedAt:100});
 });
 const sd=await getLibraryBackupExportDataWithDb(sensitive.db,{status:'unavailable'});assert.equal(savedContentVisible(sd.items.find(i=>i.id==='kitsu'),true),false);
 const sb=await exportV9(sensitive);assert.ok(sb.items.some(i=>i.id==='kitsu'));assert.ok(sb.collectionMemberships.some(m=>m.itemId==='kitsu'));
 const sensitiveDest=fresh();await schema.evolveDatabaseSchema(sensitiveDest.db,0);await sensitiveDest.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(sensitiveDest.db,parsed(sb),()=> 'unused'));
 assert.equal(sensitiveDest.sqlite.prepare('SELECT count(*) n FROM collection_memberships').get().n,1);
 // Focused historical imports exercise all dispatch branches without reinterpreting v9 fields.
 const history=fresh();await schema.evolveDatabaseSchema(history.db,0);
 for(let version=1;version<=8;version++){
  const id=`historical-${version}`,common={id,title:`TEST history ${version}`,status:'watching',notes:'TEST personal',tags:['TEST'],genres:[],year:null,posterUrl:null,overview:null,voteAverage:null,personalRating:80,createdAt:1,updatedAt:2};
  const item=version<5?{...common,type:'movie',provider:'manual',externalId:id}:version===5?{...common,type:'movie',providerReferences:[{provider:'tmdb',resourceNamespace:'movie',externalId:String(9000+version)}]}:{...common,medium:'audiovisual',contentFamily:null,primaryFormat:'movie',providerReferences:[{provider:'tmdb',resourceNamespace:'movie',externalId:String(9000+version)}]};
  const incoming={version,items:[item],...(version>1?{pins:[]}:{}),collections:[{invalid:'must be ignored'}]};
  const hp=parsed(incoming);let out;await history.db.withTransactionAsync(async()=>{out=await mergeLibraryBackupWithDb(history.db,hp,()=>id)});assert.equal(out.inserted,1,`historical v${version}`);
  await history.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(history.db,hp,()=>id));
  assert.equal(history.sqlite.prepare('SELECT count(*) n FROM saved_titles').get().n,version);
 }
 assert.equal(history.sqlite.prepare('SELECT count(*) n FROM personal_collections').get().n,0);
 for(const f of databases)assert.deepEqual(await f.db.getAllAsync('PRAGMA foreign_key_check'),[]);
 stop();console.log('PASS S1: migration v7→v8 preservation/rollback/reopen/future version; CRUD/idempotence/FKs/cascades; shared Inbox references/schema only; v9 real round trip empty/conflicting DB; remap/freshness/ties/absence/reimport; v1–v8 focused imports; sensitive full backup; partial errors and commit rollback; post-commit invalidation. TEST databases only.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{for(const f of databases){try{f.close();}catch{}}});

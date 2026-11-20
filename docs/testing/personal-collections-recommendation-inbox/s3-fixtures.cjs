const assert=require('node:assert/strict');
const {fixture,createV6}=require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema=require('../../../src/storage/databaseSchema.ts');
const metadataSchema=require('../../../src/storage/mediaMetadataSchema.ts');
const collections=require('../../../src/storage/collectionsRepo.ts');
const inbox=require('../../../src/storage/recommendationInboxRepo.ts');
const {getLibraryBackupExportDataWithDb}=require('../../../src/storage/libraryBackupExport.ts');
const {createLibraryBackupV9}=require('../../../src/core/libraryBackupV9.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {mergeLibraryBackupWithDb}=require('../../../src/storage/libraryBackupMerge.ts');
const databases=[];let serial=0;
const fresh=()=>{const f=fixture();databases.push(f);return f};
const snapshot=f=>Object.fromEntries(f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,f.sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all()]));
async function v7(f){createV6(f);await f.db.withTransactionAsync(async()=>{
 await metadataSchema.createMetadataSchemaWithDb(f.db);await metadataSchema.backfillMetadataBaselinesWithDb(f.db);
 await require('../../../src/storage/mediaMetadataRepo.ts').updateMediaMetadataWithDb(f.db,'kitsu',{version:1,provenance:{reference:{provider:'kitsu',resourceNamespace:'anime',externalId:'1'},normalizerVersion:1,fetchedAt:30,checkedAt:30,sourceUpdatedAt:null},fields:{canonicalTitle:'TEST kitsu',sensitive:false}},50);
 await f.db.runAsync('INSERT INTO library_activity_events VALUES (?,?,?,?,?,?,?)','TEST-migration-event','kitsu',Date.now(),'notes','personal','["notes"]','TEST-migration-operation');
 await f.db.execAsync('PRAGMA user_version=7');
 });}
async function empty(){const f=fresh();await schema.evolveDatabaseSchema(f.db,0);return f}
const capture=overrides=>require('../../../src/core/recommendationInbox.ts').parseRecommendationCapture({name:'TEST sugerencia',person:'TEST Ana',origin:'TEST Discord',comment:'TEST comentario original',...overrides},true);
async function representative(){const f=fresh();await v7(f);await schema.evolveDatabaseSchema(f.db,7);await f.db.withTransactionAsync(async()=>{
 for(const id of ['c1','c2','empty'])await collections.createCollectionWithDb(f.db,id,'TEST '+id,'TEST descripción',100);
 for(const [c,t]of [['c1','manual'],['c1','multi'],['c1','kitsu'],['c2','multi']])await collections.setCollectionMemberWithDb(f.db,c,t,true,110);
 for(const [id,status,linked,person]of [['pending','pending',null,'Ana'],['discarded','discarded',null,'Eva'],['linked1','incorporated','multi','Ana'],['linked2','incorporated','multi','Luis'],['manual-rec','incorporated','manual','Sol']]){
  await inbox.createRecommendationWithDb(f.db,id,capture({person,url:'https://themoviedb.org/tv/2'}),100);
  if(status!=='pending')await inbox.setRecommendationStateWithDb(f.db,id,status,linked,120);
 }
 await inbox.editRecommendationWithDb(f.db,'pending',capture({name:'TEST editado',comment:'TEST comentario actual'}),130);
 await require('../../../src/storage/mediaMetadataRepo.ts').updateMediaMetadataWithDb(f.db,'kitsu',{version:1,provenance:{reference:{provider:'kitsu',resourceNamespace:'anime',externalId:'1'},normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{sensitive:true}},1000);
 await require('../../../src/storage/mediaPreferencesRepo.ts').mergeMediaPreferencesWithDb(f.db,{value:{...require('../../../src/core/mediaPreferences.ts').DEFAULT_MEDIA_PREFERENCES,hideSensitive:true},updatedAt:100});
 await f.db.runAsync('INSERT INTO library_activity_events VALUES (?,?,?,?,?,?,?)','TEST-event','multi',Date.now(),'notes','personal','["notes"]','TEST-operation');
 await f.db.runAsync('INSERT INTO app_preferences VALUES (?,?,?)','TEST-secret','TEST-DO-NOT-EXPORT',1);
 });return f}
const appearance={status:'confirmed',preference:{scheme:'dark',palette:'original'}};
async function exported(f){let data;await f.db.withTransactionAsync(async()=>{data=await getLibraryBackupExportDataWithDb(f.db,appearance)});return createLibraryBackupV9(data.items,data.pins,appearance,'2026-11-20T12:00:00.000Z',data)}
function parsed(value){const r=parseLibraryBackup(typeof value==='string'?value:JSON.stringify(value));assert.equal(r.ok,true,JSON.stringify(r));return r.payload}
async function merge(f,backup){let result;await f.db.withTransactionAsync(async()=>{result=await mergeLibraryBackupWithDb(f.db,parsed(backup),()=>`TEST-remap-${++serial}`)});return result}
function semantic(backup){const value=structuredClone(backup);delete value.exportedAt;
 const keys=new Map(value.items.map(item=>[item.id,JSON.stringify([item.manualIdentity??null,item.legacyIdentity??null,[...item.providerReferences].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))])]));
 value.items=value.items.map(v=>({...v,id:keys.get(v.id)}));
 value.pins=value.pins.map(v=>({...v,itemId:keys.get(v.itemId)}));
 value.collectionMemberships=value.collectionMemberships.map(v=>({...v,itemId:keys.get(v.itemId)}));
 value.recommendations=value.recommendations?.map(v=>({...v,linkedItemId:v.linkedItemId?keys.get(v.linkedItemId):null}));
 for(const event of value.activity??[])event.itemId=keys.get(event.itemId);
 for(const key of ['items','pins','collections','collectionMemberships','recommendations','activity'])if(value[key])value[key].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return value;
}
async function integrity(){for(const f of databases){assert.deepEqual(await f.db.getAllAsync('PRAGMA foreign_key_check'),[]);assert.equal(f.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok')}}
const close=()=>{for(const f of databases)f.close()};
module.exports={assert,schema,collections,inbox,databases,fresh,snapshot,v7,empty,capture,representative,exported,parsed,merge,semantic,integrity,close};

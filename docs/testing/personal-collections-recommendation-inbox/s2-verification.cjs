const assert=require('node:assert/strict');
const {fixture,createV6}=require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema=require('../../../src/storage/databaseSchema.ts');
const {createMetadataSchemaWithDb,backfillMetadataBaselinesWithDb}=require('../../../src/storage/mediaMetadataSchema.ts');
const inbox=require('../../../src/storage/recommendationInboxRepo.ts');
const {incorporateRecommendationWithDb,incorporateProviderRecommendation}=require('../../../src/storage/recommendationIncorporation.ts');
const core=require('../../../src/core/recommendationInbox.ts');
const {localRecommendationCandidates}=require('../../../src/core/recommendationResolution.ts');
const {getLibraryBackupExportDataWithDb}=require('../../../src/storage/libraryBackupExport.ts');
const {createLibraryBackupV9}=require('../../../src/core/libraryBackupV9.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {mergeLibraryBackupWithDb}=require('../../../src/storage/libraryBackupMerge.ts');
const {listSavedTitlesWithReferencesWithDb}=require('../../../src/storage/savedTitleStorage.ts');
const collections=require('../../../src/storage/collectionsRepo.ts');
const {subscribeOrganization}=require('../../../src/storage/organizationInvalidation.ts');
const all=[];const fresh=()=>{const f=fixture();all.push(f);return f};
const capture=overrides=>core.parseRecommendationCapture({name:'TEST recomendación',person:'TEST Ana',origin:'TEST charla',comment:'TEST contexto original',...overrides},true);
const snap=f=>Object.fromEntries(f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,f.sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all()]));
const titles=f=>Object.fromEntries(Object.entries(snap(f)).filter(([name])=>!['recommendation_inbox','personal_collections','collection_memberships'].includes(name)));
// The existing metadata importer advances its internal optimistic-write revision on merge.
// Compare every portable/personal field, while exact snapshots above still protect linking.
const importedSnapshot=f=>{const value=snap(f);for(const row of value.media_metadata??[])delete row.revision;return value};
const parsed=b=>{const p=parseLibraryBackup(JSON.stringify(b));assert.equal(p.ok,true,JSON.stringify(p));return p.payload};
async function exported(f){let d;await f.db.withTransactionAsync(async()=>{d=await getLibraryBackupExportDataWithDb(f.db,{status:'unavailable'})});return createLibraryBackupV9(d.items,d.pins,d.appearanceAvailability,undefined,d)}
async function restore(f,b){let r;await f.db.withTransactionAsync(async()=>{r=await mergeLibraryBackupWithDb(f.db,parsed(b),()=>`TEST-remapped-${++serial}`)});return r}
let serial=0,requests=0;global.fetch=()=>{requests++;throw Error('No network permitted in TEST')};
(async()=>{
 const f=fresh();createV6(f);await f.db.withTransactionAsync(async()=>{await createMetadataSchemaWithDb(f.db);await backfillMetadataBaselinesWithDb(f.db);await f.db.execAsync('PRAGMA user_version=7')});await schema.evolveDatabaseSchema(f.db,7);
 const before=titles(f);
 for(const url of ['https://example.test/a?x=1','http://example.test','https://www.mangaupdates.com/series.html?id=123'])assert.equal(core.recognizeRecommendationUrl(url),null);
 for(const url of ['javascript:alert(1)','file:///TEST','not a URL','https://user:secret@example.test','https://example.test/\nfoo'])assert.throws(()=>capture({name:null,url}));
 assert.deepEqual(core.recognizeRecommendationUrl('https://www.themoviedb.org/movie/1-test'),{provider:'tmdb',resourceNamespace:'movie',externalId:'1'});
 assert.notDeepEqual(core.recognizeRecommendationUrl('https://themoviedb.org/tv/1'),core.recognizeRecommendationUrl('https://themoviedb.org/movie/1'));
 assert.equal(core.recognizeRecommendationUrl('https://themoviedb.org.evil.test/movie/1'),null);
 assert.equal(core.recognizeRecommendationUrl('https://themoviedb.org/movie/999999999999999999999999999999'),null);
 assert.throws(()=>capture({name:null}));assert.throws(()=>capture({name:null,reference:{provider:'kitsu',resourceNamespace:'manga',externalId:'1'}}));
 const original=capture({url:'https://kitsu.app/anime/1'});
 for(const id of ['r1','r2'])await inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,id,{...original,person:id},100),f.db);
 await inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,'url',capture({name:null,url:'https://example.test/a'}),100),f.db);
 await inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,'name',capture({name:'TEST name only'}),100),f.db);
 await inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,'reference',capture({name:null,reference:original.reference}),100),f.db);
 const initial=snap(f);await inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,'r1',{...original,person:'r1'},101),f.db);assert.deepEqual(snap(f),initial);
 await assert.rejects(inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,'r1',capture({name:'other capture'}),102),f.db));
 await inbox.mutateInbox(db=>inbox.editRecommendationWithDb(db,'r1',{...original,name:'TEST editado',comment:'TEST nuevo comentario'},110),f.db);
 let rec=await inbox.getRecommendationWithDb(f.db,'r1');assert.equal(rec.originalCapture.person,'r1');assert.equal(rec.originalCapture.comment,'TEST contexto original');assert.equal(rec.comment,'TEST nuevo comentario');
 await assert.rejects(f.db.runAsync("UPDATE recommendation_inbox SET original_capture_json='{}' WHERE id='r1'"));
 await inbox.mutateInbox(db=>inbox.setRecommendationStateWithDb(db,'r1','discarded',null,120),f.db);
 await assert.rejects(inbox.mutateInbox(db=>inbox.setRecommendationStateWithDb(db,'r1','incorporated','kitsu',121),f.db));
 await inbox.mutateInbox(db=>inbox.setRecommendationStateWithDb(db,'r1','pending',null,122),f.db);
 assert.deepEqual(titles(f),before,'capture/edit/state never mutate library');assert.equal(requests,0);
 const items=await listSavedTitlesWithReferencesWithDb(f.db);
 const ambiguous=localRecommendationCandidates(capture({name:'TEST'}),items);assert.ok(ambiguous.length>1);assert.equal((await inbox.getRecommendationWithDb(f.db,'name')).linkedItemId,null);
 assert.equal(localRecommendationCandidates(original,items,'nonmatching')[0].id,'kitsu');
 for(const id of ['r1','r2'])await inbox.mutateInbox(db=>inbox.setRecommendationStateWithDb(db,id,'incorporated','kitsu',130),f.db);
 assert.deepEqual(titles(f),before,'link preserves every title, reference, personal, pin, metadata, preference and activity row');
 await inbox.mutateInbox(db=>inbox.setRecommendationStateWithDb(db,'reference','pending',null,140),f.db);
 const provider={reference:original.reference,snapshot:{medium:'audiovisual',contentFamily:'anime',primaryFormat:'movie',title:'SHOULD NEVER REFRESH',year:2025,posterUrl:null,overview:'never overwrite',genres:['new']},initialTags:['never']};
 await f.db.withTransactionAsync(async()=>assert.equal(await incorporateRecommendationWithDb(f.db,'reference',{provider,generateId:()=>{throw Error('must reuse')},allowed:()=>false},150),'kitsu'));
 assert.deepEqual(titles(f),before,'existing strong identity bypasses refresh even with provider gate closed');
 const newInput={...provider,reference:{provider:'tmdb',resourceNamespace:'movie',externalId:'999'},snapshot:{...provider.snapshot,contentFamily:null}};
 await inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,'new',capture({name:'TEST new'}),160),f.db);
 const closed=snap(f);await assert.rejects(f.db.withTransactionAsync(()=>incorporateRecommendationWithDb(f.db,'new',{provider:newInput,generateId:()=> 'new-title',allowed:()=>false},170)));assert.deepEqual(snap(f),closed);
 let calls=0;const ids=await Promise.all([1,2].map(()=>incorporateProviderRecommendation('new',newInput,()=>{calls++;return 'new-title'},()=>true,f.db)));assert.deepEqual(ids,['new-title','new-title']);assert.equal(calls,1);
 await incorporateProviderRecommendation('new',newInput,()=>{throw Error('retry created a duplicate')},()=>true,f.db);
 await assert.rejects(incorporateProviderRecommendation('new',{...newInput,reference:{...newInput.reference,externalId:'997'}},()=>{throw Error('must reopen')},()=>true,f.db),/Reabrila/);
 await inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,'manual',capture({name:'TEST manual'}),180),f.db);
 let manual;await f.db.withTransactionAsync(async()=>{manual=await incorporateRecommendationWithDb(f.db,'manual',{manual:{title:'TEST manual new',medium:'literature',contentFamily:null,primaryFormat:'novel',year:null,overview:null}},190)});
 await f.db.withTransactionAsync(async()=>assert.equal(await incorporateRecommendationWithDb(f.db,'manual',{manual:{title:'TEST ignored on retry',medium:'literature',contentFamily:null,primaryFormat:'novel',year:null,overview:null}},200),manual));
 // A failed link rolls back the newly created item, identity, metadata and activity together.
 await inbox.mutateInbox(db=>inbox.createRecommendationWithDb(db,'failure',capture({name:'TEST failure'}),210),f.db);
 f.sqlite.exec("CREATE TRIGGER TEST_fail_link BEFORE UPDATE ON recommendation_inbox WHEN NEW.id='failure' AND NEW.status='incorporated' BEGIN SELECT RAISE(ABORT,'TEST link failure'); END;");
 const stable=snap(f);await assert.rejects(f.db.withTransactionAsync(()=>incorporateRecommendationWithDb(f.db,'failure',{provider:{...newInput,reference:{...newInput.reference,externalId:'998'}},generateId:()=> 'rolled-back',allowed:()=>true},220)));assert.deepEqual(snap(f),stable);f.sqlite.exec('DROP TRIGGER TEST_fail_link');
 let notifications=0;const stop=subscribeOrganization(()=>notifications++);const transaction=f.db.withTransactionAsync;
 f.db.withTransactionAsync=task=>transaction(async()=>{await task();throw Error('TEST commit failure')});
 await assert.rejects(inbox.mutateInbox(db=>inbox.editRecommendationWithDb(db,'failure',capture({name:'TEST rollback'}),230),f.db));assert.equal(notifications,0);assert.deepEqual(snap(f),stable);f.db.withTransactionAsync=transaction;stop();
 // Keep linked rows for backup, including two distinct IDs sharing a reference.
 await f.db.withTransactionAsync(async()=>{await collections.createCollectionWithDb(f.db,'collection','TEST colección',null,100);await collections.createCollectionWithDb(f.db,'empty','TEST vacía',null,100);await collections.setCollectionMemberWithDb(f.db,'collection','kitsu',true,101);await inbox.setRecommendationStateWithDb(f.db,'name','discarded',null,240)});
 await f.db.withTransactionAsync(async()=>{
  await require('../../../src/storage/mediaMetadataRepo.ts').updateMediaMetadataWithDb(f.db,'kitsu',{version:1,provenance:{reference:original.reference,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{sensitive:true}},1000);
  await require('../../../src/storage/mediaPreferencesRepo.ts').mergeMediaPreferencesWithDb(f.db,{value:{...require('../../../src/core/mediaPreferences.ts').DEFAULT_MEDIA_PREFERENCES,hideSensitive:true},updatedAt:100});
 });
 const backup=await exported(f);assert.equal(backup.version,9);assert.equal(backup.recommendations.length,8);assert.equal(backup.recommendations.filter(r=>r.linkedItemId==='kitsu').length,3);assert.ok(backup.items.some(v=>v.id==='kitsu'),'sensitive title and all links remain portable');
 const dest=fresh();await schema.evolveDatabaseSchema(dest.db,0);let result=await restore(dest,backup);assert.equal(result.organization.recommendations.inserted,8);assert.equal(result.organization.recommendations.issues.length,0);
 const roundtrip=await exported(dest);assert.deepEqual(roundtrip.recommendations,backup.recommendations);assert.deepEqual(roundtrip.collections,backup.collections);assert.deepEqual(roundtrip.collectionMemberships,backup.collectionMemberships);
 const restored=importedSnapshot(dest);result=await restore(dest,backup);assert.deepEqual(importedSnapshot(dest),restored);assert.equal(result.organization.recommendations.preserved,8);
 const s1=structuredClone(backup);delete s1.recommendations;await restore(dest,s1);assert.deepEqual(importedSnapshot(dest),restored);
 const equal=structuredClone(backup);equal.recommendations[0].comment='TEST equal ignored';await restore(dest,equal);assert.deepEqual(importedSnapshot(dest),restored);
 const newer=structuredClone(backup);newer.recommendations[0].comment='TEST newer';newer.recommendations[0].updatedAt+=100;await restore(dest,newer);assert.equal((await inbox.getRecommendationWithDb(dest.db,newer.recommendations[0].id)).comment,'TEST newer');
 const conflict=structuredClone(newer);conflict.recommendations[0].originalCapture.name='TEST contradictory';conflict.recommendations[0].updatedAt+=100;result=await restore(dest,conflict);assert.ok(result.organization.recommendations.issues.some(v=>v.includes('captura original')));
 const occupied=fresh();await schema.evolveDatabaseSchema(occupied.db,0);await restore(occupied,backup);await occupied.db.runAsync("UPDATE manual_entry_identities SET portable_id='TEST unrelated identity' WHERE saved_title_id=?",manual);await restore(occupied,backup);
 const remapped=occupied.sqlite.prepare('SELECT saved_title_id FROM manual_entry_identities WHERE portable_id=?').get(f.sqlite.prepare('SELECT portable_id FROM manual_entry_identities WHERE saved_title_id=?').get(manual).portable_id).saved_title_id;
 assert.notEqual(remapped,manual); // equal timestamp keeps existing recommendation local, then a newer record remaps correctly.
 const remapBackup=structuredClone(backup);remapBackup.recommendations.find(r=>r.id==='manual').updatedAt+=500;await restore(occupied,remapBackup);assert.equal((await inbox.getRecommendationWithDb(occupied.db,'manual')).linkedItemId,remapped);
 const orphan=structuredClone(backup);orphan.recommendations=[{...orphan.recommendations.find(r=>r.id==='r1'),id:'TEST orphan',linkedItemId:'TEST absent'}];result=await restore(dest,orphan);assert.equal(result.organization.recommendations.degraded,1);assert.equal((await inbox.getRecommendationWithDb(dest.db,'TEST orphan')).status,'pending');
 const malformed=structuredClone(backup);malformed.recommendations={};assert.equal(parseLibraryBackup(JSON.stringify(malformed)).ok,false);
 const badRecord=structuredClone(backup);badRecord.recommendations.push({id:'invalid'});assert.equal(parsed(badRecord).recommendationIssues.length,1);
 const linkedBefore=(await inbox.listRecommendationsWithDb(f.db)).filter(r=>r.linkedItemId==='kitsu');await f.db.withTransactionAsync(()=>f.db.runAsync("DELETE FROM saved_titles WHERE id='kitsu'"));
 for(const previous of linkedBefore){const current=await inbox.getRecommendationWithDb(f.db,previous.id);assert.equal(current.status,'pending');assert.equal(current.linkedItemId,null);assert.deepEqual(current.originalCapture,previous.originalCapture);for(const key of ['name','url','person','origin','comment'])assert.equal(current[key],previous[key])}
 for(const db of all)assert.deepEqual(await db.db.getAllAsync('PRAGMA foreign_key_check'),[]);
 const saved=snap(f),file=f.file;f.close();all.splice(all.indexOf(f),1);const reopened=fixture(file);all.push(reopened);await schema.evolveDatabaseSchema(reopened.db,8);assert.deepEqual(snap(reopened),saved);assert.equal(requests,0);
 console.log('PASS S2 SQLite TEST: offline capture/URL allowlist/immutable context; states and duplicate references; manual-confirmed candidates; exact preservation on existing links; provider gates; atomic new/manual incorporation, serialized double submission and retries; injected link/commit rollback and postcommit notification; all linked recommendations reopen on title deletion; v9 collections+Inbox round trip, S1 compatibility, stable-ID conflicts, portable remap, orphan recovery and idempotence; FK integrity and reopen. No personal DB or network.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{for(const f of all)f.close()});

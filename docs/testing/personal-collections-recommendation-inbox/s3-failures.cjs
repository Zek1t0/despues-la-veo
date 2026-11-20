const {assert,schema,collections,inbox,snapshot,empty,capture,representative,exported,parsed,merge,integrity,close}=require('./s3-fixtures.cjs');
const titles=require('../../../src/storage/savedTitlesRepo.ts');
const incorporation=require('../../../src/storage/recommendationIncorporation.ts');
const dbModule=require('../../../src/storage/db.ts');const originalInit=dbModule.initDb;
const events=[];let transactionOpen=false;
const stops=[require('../../../src/storage/organizationInvalidation.ts').subscribeOrganization(()=>events.push(['organization',transactionOpen])),require('../../../src/storage/libraryInvalidation.ts').subscribeLibraryInvalidation(()=>events.push(['library',transactionOpen])),require('../../../src/storage/mediaPreferencesRepo.ts').subscribeMediaPreferences(()=>events.push(['preferences',transactionOpen])),require('../../../src/storage/libraryActivitySignals.ts').subscribeLibraryActivity(()=>events.push(['activity',transactionOpen]))];
function monitor(f,failCommit=false){const original=f.db.withTransactionAsync;let active=0,max=0,count=0;
 f.db.withTransactionAsync=async task=>{assert.equal(active,0,'no nested/overlapping transaction');active++;count++;max=Math.max(max,active);transactionOpen=true;try{await original(async()=>{await task();if(failCommit)throw Error('TEST commit failure')})}finally{active--;transactionOpen=false}};
 return{restore(){f.db.withTransactionAsync=original},counts:()=>({count,max})};
}
function failTrigger(f,name,sql){f.sqlite.exec(`CREATE TRIGGER ${name} ${sql}`);return()=>f.sqlite.exec(`DROP TRIGGER ${name}`)}
async function rejectWithoutChange(f,operation){const before=snapshot(f);events.length=0;await assert.rejects(operation);assert.deepEqual(snapshot(f),before);assert.deepEqual(events,[],'failed transaction must not publish any invalidation')}
(async()=>{
 const f=await representative(),backup=await exported(f);dbModule.initDb=async()=>f.db;
 let drop=failTrigger(f,'TEST_collection',"AFTER INSERT ON personal_collections BEGIN SELECT RAISE(ABORT,'TEST collection'); END;");await rejectWithoutChange(f,()=>collections.mutateCollections(db=>collections.createCollectionWithDb(db,'new','TEST new',null,200),f.db));drop();
 drop=failTrigger(f,'TEST_member',"AFTER INSERT ON collection_memberships BEGIN SELECT RAISE(ABORT,'TEST membership'); END;");await rejectWithoutChange(f,()=>collections.mutateCollections(db=>collections.setCollectionMemberWithDb(db,'empty','tmdb',true,200),f.db));drop();
 drop=failTrigger(f,'TEST_link',"AFTER UPDATE ON recommendation_inbox WHEN NEW.id='pending' AND NEW.status='incorporated' BEGIN SELECT RAISE(ABORT,'TEST link'); END;");await rejectWithoutChange(f,()=>inbox.mutateInbox(db=>inbox.setRecommendationStateWithDb(db,'pending','incorporated','multi',200),f.db));
 const provider={reference:{provider:'tmdb',resourceNamespace:'movie',externalId:'987654'},snapshot:{medium:'audiovisual',contentFamily:null,primaryFormat:'movie',title:'TEST new title',year:2020,posterUrl:null,overview:'TEST',genres:[]},initialTags:[]};
 await rejectWithoutChange(f,()=>incorporation.incorporateProviderRecommendation('pending',provider,()=> 'TEST partial-title',()=>true,f.db));drop();
 // Deletion cascades and recommendation reset must roll back together if any later step fails.
 drop=failTrigger(f,'TEST_delete',"AFTER DELETE ON saved_titles BEGIN SELECT RAISE(ABORT,'TEST deletion'); END;");await rejectWithoutChange(f,()=>titles.deleteSavedTitle('multi'));drop();
 const beforeLinked=(await inbox.listRecommendationsWithDb(f.db)).filter(r=>r.linkedItemId==='multi');events.length=0;let monitored=monitor(f);await titles.deleteSavedTitle('multi');assert.ok(events.length);assert.ok(events.every(([,inside])=>!inside));assert.equal(monitored.counts().count,1);monitored.restore();
 for(const previous of beforeLinked){const current=await inbox.getRecommendationWithDb(f.db,previous.id);assert.equal(current.status,'pending');assert.equal(current.linkedItemId,null);assert.deepEqual(current.originalCapture,previous.originalCapture)}assert.ok(!(await collections.listMembershipsWithDb(f.db)).some(v=>v.itemId==='multi'));assert.ok((await collections.listCollectionsWithDb(f.db)).some(v=>v.id==='c2'));
 // Commit failures for imports and composition publish nothing and restore every table.
 for(const operation of [db=>collections.mutateCollections(d=>collections.createCollectionWithDb(d,'fail','TEST',null,1),db),db=>inbox.mutateInbox(d=>inbox.editRecommendationWithDb(d,'pending',capture({name:'TEST rolled back'}),500),db),db=>incorporation.incorporateProviderRecommendation('pending',provider,()=> 'TEST commit-title',()=>true,db)]){
  monitored=monitor(f,true);await rejectWithoutChange(f,()=>operation(f.db));monitored.restore();
 }
 const commitDest=await empty();monitored=monitor(commitDest,true);await rejectWithoutChange(commitDest,()=>titles.mergeLibraryBackup(parsed(backup),()=> 'TEST remap',commitDest.db));monitored.restore();
 // Local failures restore only their savepoint; valid unrelated units commit and counters remain real.
 for(const [table,condition,expected]of [['saved_titles',"NEW.id='multi'",'title'],['personal_collections',"NEW.id='c1'",'collection'],['collection_memberships',"NEW.collection_id='c1' AND NEW.saved_title_id='manual'",'membership'],['recommendation_inbox',"NEW.id='linked1'",'recommendation']]){
  const target=await empty();failTrigger(target,'TEST_record',`AFTER INSERT ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT,'TEST record ${expected}'); END;`);const result=await merge(target,backup);
  if(expected==='title'){assert.equal(result.inserted,4);assert.equal(result.failed.length,1);assert.equal((await inbox.getRecommendationWithDb(target.db,'linked1')).status,'pending');assert.ok(!(await collections.listMembershipsWithDb(target.db)).some(v=>v.itemId==='multi'))}
  if(expected==='collection'){assert.equal(result.organization.collections.inserted,2);assert.equal(result.organization.collections.issues.length,1);assert.equal(result.organization.memberships.inserted,1)}
  if(expected==='membership'){assert.equal(result.organization.memberships.inserted,3);assert.equal(result.organization.memberships.issues.length,1)}
  if(expected==='recommendation'){assert.equal(result.organization.recommendations.inserted,4);assert.equal(result.organization.recommendations.issues.length,1);assert.equal(await inbox.getRecommendationWithDb(target.db,'linked1'),null);assert.equal((await inbox.getRecommendationWithDb(target.db,'linked2')).linkedItemId,'multi')}
 }
 // Real public queue serializes simultaneous imports, membership mutations and incorporation.
 const concurrent=await empty();events.length=0;monitored=monitor(concurrent);await Promise.all([1,2,3].map(()=>titles.mergeLibraryBackup(parsed(backup),()=> 'TEST remap',concurrent.db)));assert.equal(monitored.counts().max,1);assert.equal(concurrent.sqlite.prepare('SELECT count(*) n FROM saved_titles').get().n,5);assert.equal(concurrent.sqlite.prepare('SELECT count(*) n FROM recommendation_inbox').get().n,5);assert.ok(events.every(([,inside])=>!inside));
 await Promise.all([1,2,3].map(()=>collections.mutateCollections(db=>collections.setCollectionMemberWithDb(db,'empty','tmdb',true,500),concurrent.db)));assert.equal(concurrent.sqlite.prepare("SELECT count(*) n FROM collection_memberships WHERE collection_id='empty'").get().n,1);
 const ids=await Promise.all([1,2,3].map(()=>incorporation.incorporateProviderRecommendation('pending',provider,()=> 'TEST concurrent-title',()=>true,concurrent.db)));assert.deepEqual(ids,['TEST concurrent-title','TEST concurrent-title','TEST concurrent-title']);monitored.restore();
 // Schema integrity guards: CHECKs, PKs, indexes, trigger immutability and future checks remain real SQL.
 assert.equal(concurrent.sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
 assert.equal(concurrent.sqlite.prepare("PRAGMA index_list('recommendation_inbox')").all().find(v=>v.name==='idx_recommendation_reference').unique,0);
 assert.equal(concurrent.sqlite.prepare("PRAGMA index_list('collection_memberships')").all().find(v=>v.origin==='pk').unique,1);
 await assert.rejects(concurrent.db.runAsync("UPDATE recommendation_inbox SET status='incorporated',linked_saved_title_id=NULL WHERE id='pending'"));await assert.rejects(concurrent.db.runAsync("UPDATE recommendation_inbox SET original_capture_json='{}' WHERE id='pending'"));
 const beforeReopen=snapshot(concurrent);await schema.evolveDatabaseSchema(concurrent.db,8);assert.deepEqual(snapshot(concurrent),beforeReopen);await integrity();
 console.log('PASS S3 failures: SQL injected creation/member/link/incorporation/delete/commit rollback; per-record title/collection/member/recommendation savepoints and exact counters; no precommit/failed invalidations; public serialization/concurrent retries without nested transactions; CHECKs/PKs/indexes/triggers/FKs. TEST only.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{dbModule.initDb=originalInit;stops.forEach(stop=>stop());close()});

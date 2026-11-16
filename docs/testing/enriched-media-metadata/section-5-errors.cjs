const assert=require('node:assert/strict');const {fixture,createV6}=require('./sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {createMetadataRefreshRepository}=require('../../../src/storage/metadataRefreshRepo.ts');
const {createMetadataRefreshCoordinator}=require('../../../src/application/metadataRefreshCoordinator.ts');
const {RefreshError}=require('../../../src/application/metadataRefreshError.ts');
const {selectMetadataSource}=require('../../../src/storage/mediaMetadataRepo.ts');
(async()=>{const f=fixture();try{createV6(f);await evolveDatabaseSchema(f.db,6);const repository=createMetadataRefreshRepository(f.db);let clock=1000,calls=0;
for(const code of ['offline','timeout','not-found','access-rejected','rate-limited','server','invalid-response']){
 const cap={fields:[],scope:()=> 'test',eligibility:()=>({enabled:true}),load:async()=>{calls++;throw new RefreshError(code,code==='rate-limited'?60000:undefined)}};
 const c=createMetadataRefreshCoordinator({repository,bindings:{kitsu:cap,tmdb:cap,mangaupdates:cap},now:()=>clock});
 const before=await repository.read('kitsu');const result=await c.refresh('kitsu',{automatic:true});assert.equal(result.code,code);const after=await repository.read('kitsu');assert.deepEqual(after,before,'errors preserve every local and personal field');
 const operational=await repository.operational('kitsu',before.providerReferences[0]);assert.equal(operational.lastAttemptAt,clock);assert.equal(operational.errorCode,'auto/'+code+'@'+clock);
 if(code==='access-rejected'||code==='rate-limited'){
 await selectMetadataSource('multi',{provider:'kitsu',resourceNamespace:'anime',externalId:'2'},clock++,f.db);const count=calls;assert.equal((await c.refresh('multi')).status,'skipped');assert.equal(calls,count,'provider blocked across titles');
 if(code==='rate-limited'){const restarted=createMetadataRefreshCoordinator({repository,bindings:{kitsu:cap,tmdb:cap,mangaupdates:cap},now:()=>clock});assert.equal((await restarted.refresh('multi')).status,'skipped');assert.equal(calls,count,'provider wait survives coordinator recreation on another title');}
 }
 clock+=120000;
}
console.log('PASS 5.5 SQLite failure matrix: typed recoverable results, no 404 deletion, all local metadata/personal data preserved, attempt/error persistence, provider-wide access/rate blocks.');
}finally{f.close();}})().catch(e=>{console.error(e);process.exitCode=1});

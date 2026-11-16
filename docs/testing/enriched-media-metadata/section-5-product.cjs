const assert=require('node:assert/strict'),Module=require('node:module');const {fixture,createV6}=require('./sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
(async()=>{const f=fixture(),original=Module._load;try{createV6(f);await evolveDatabaseSchema(f.db,6);let status='storage-error',initializations=0,calls=[],credentialListener=null;
Module._load=function(r,p,m){
 if(r==='react-native')return {Platform:{OS:'android'}};
 if(r.endsWith('/db'))return {initDb:async()=>f.db};
 if(r.endsWith('tmdbCredentialRuntime'))return {tmdbCredentialService:{initialize:async()=>{initializations++;throw Error('storage unavailable')},getSnapshot:()=>({status,generation:1}),subscribe:listener=>{credentialListener=listener;return()=>{credentialListener=null;}}}};
 if(r.endsWith('tmdbClient'))return {tmdbFetch:async(path,params,signal)=>{calls.push({provider:'tmdb',path,params,signal});return {id:1,name:'Fresh TV',vote_average:0,overview:null}}};
 if(r==='./product'&&p.filename.endsWith('kitsu\\metadataRefresh.ts'))return {loadKitsuProductDetail:async(id,platform,signal)=>{calls.push({provider:'kitsu',id,platform,signal});return require('../../../src/providers/kitsu/validation.ts').parseAnime({id,type:'anime',attributes:{canonicalTitle:'Fresh Anime'}});}};
 if(r==='./client'&&p.filename.endsWith('mangaupdates\\product.ts'))return {getMangaUpdatesClient:()=>({getSeries:async(id,type,signal,fresh)=>{calls.push({provider:'mu',id,type,signal,fresh});return require('../../../src/providers/mangaupdates/validation.ts').parseSeries({series_id:1,title:'Fresh Manga',type:'Manga'});}})};
 return original.call(this,r,p,m);
};global.__DEV__=true;
const {getProductMetadataRefresh}=require('../../../src/application/productMetadataRefresh.ts');const a=await getProductMetadataRefresh(),b=await getProductMetadataRefresh();assert.equal(a,b);assert.equal(initializations,1);assert.equal(calls.length,0,'bootstrap initializes services without HTTP or global runs');assert.equal(a.runs.getActive(),null);assert.equal(await a.runs.latest(),null);
assert.equal((await a.service.inspect('tmdb')).enabled,false);assert.equal((await a.service.refresh('kitsu',new AbortController().signal)).status,'changed','credential storage failure cannot block Kitsu');
let reads=0;const stop=a.service.subscribe(()=>reads++,'tmdb');status='configured';credentialListener();assert.equal(reads,1);assert.equal(calls.length,1,'credential change performs no HTTP');stop();assert.equal(credentialListener,null);assert.equal((await a.service.refresh('tmdb',new AbortController().signal)).status,'changed');assert.equal((await a.service.refresh('mu',new AbortController().signal)).status,'changed');assert.equal(calls.length,3);
assert.equal(calls.find(c=>c.provider==='tmdb').path,'/tv/1');assert.equal(calls.find(c=>c.provider==='mu').fresh,true);assert.equal(calls.find(c=>c.provider==='mu').type,'Manga');assert.ok(calls.every(c=>c.signal instanceof AbortSignal));assert.equal((await a.repository.read('tmdb')).voteAverage,0);assert.equal((await a.repository.read('tmdb')).updatedAt,20);
console.log('PASS 5 product wiring: shared lazy runtime, no HTTP/global startup, credential failure isolated, exact minimal TMDB detail, MU fresh selectedType and serial client binding, gated Kitsu normalized load, neutral/legacy zero and unchanged personal clock. Injected clients + real SQLite.');
}finally{Module._load=original;f.close();}})().catch(e=>{console.error(e);process.exitCode=1});

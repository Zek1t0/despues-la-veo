const assert=require('node:assert/strict'),Module=require('node:module');
require('./sqlite-fixtures.cjs');
const original=Module._load;Module._load=function(r,p,m){if(r==='react-native')return {Platform:{OS:'android'}};if(r.endsWith('tmdbCredentialRuntime'))return {tmdbCredentialService:{resolveToken:async()=> 'test'}};return original.call(this,r,p,m)};
const {tmdbRequestWithToken}=require('../../../src/providers/tmdb/tmdbTransport.ts');
const {createTmdbClient}=require('../../../src/providers/tmdb/tmdbClient.ts');
const {createMangaUpdatesClient}=require('../../../src/providers/mangaupdates/client.ts');
const {createKitsuClient,kitsuRetryAfter}=require('../../../src/providers/kitsu/client.ts');
const {httpRetryAfter}=require('../../../src/providers/httpRetryAfter.ts');
const {refreshError}=require('../../../src/application/metadataRefreshError.ts');
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate)};
const response=(status,header=null,body={})=>new Response(JSON.stringify(body),{status,headers:header===null?{}:{'Retry-After':header}});
(async()=>{
let now=Date.UTC(2026,0,1),calls=0;
for(const parse of [httpRetryAfter,kitsuRetryAfter]){assert.equal(parse('120',now),120000);assert.equal(parse(new Date(now+90000).toUTCString(),now),90000);for(const bad of [null,'','no','-1','9999999999999999999999'])assert.equal(parse(bad,now),null);}
for(const header of ['120',new Date(now+90000).toUTCString(),null,'invalid']){
const expected=httpRetryAfter(header,now);await assert.rejects(tmdbRequestWithToken('not-a-real-token','/movie/1',{now:()=>now,fetchImplementation:async()=>{calls++;return response(429,header)}}),e=>e.kind==='rate-limited'&&e.retryAfterMs===(expected??undefined));}
for(const [status,code]of [[401,'access-rejected'],[403,'access-rejected'],[404,'not-found'],[500,'server']])await assert.rejects(tmdbRequestWithToken('test','/movie/1',{fetchImplementation:async()=>response(status)}),e=>refreshError(e).code===code);
await assert.rejects(tmdbRequestWithToken('test','/tv/1',{fetchImplementation:async()=>{throw new TypeError('offline')}}),e=>refreshError(e).code==='offline');
await assert.rejects(tmdbRequestWithToken('test','/tv/1',{fetchImplementation:async()=>new Response('{')}),e=>e.kind==='invalid-response');
let tmdbTimeout;const timed=tmdbRequestWithToken('test','/tv/1',{setTimer:fn=>{tmdbTimeout=fn;return 1},clearTimer:()=>{},fetchImplementation:()=>new Promise(()=>{})});await tick();tmdbTimeout();await assert.rejects(timed,e=>refreshError(e).code==='timeout');
const abort=new AbortController();const pending=tmdbRequestWithToken('test','/tv/1',{signal:abort.signal,fetchImplementation:()=>new Promise(()=>{})});abort.abort();await assert.rejects(pending,e=>e.kind==='aborted');
let token='first',requests=0;const client=createTmdbClient({resolveToken:async()=>token},(t,p,o)=>tmdbRequestWithToken(t,p,{...o,now:()=>now,fetchImplementation:async()=>{requests++;return response(429,'120')}}),()=>now);
await assert.rejects(client('/movie/1'));await assert.rejects(client('/tv/2'));assert.equal(requests,1);now+=120000;await assert.rejects(client('/tv/2'));assert.equal(requests,2);token='second';await assert.rejects(client('/movie/1'));assert.equal(requests,3);
// Provider-local serial throttles, valid waits, conservative unknown waits and cancellation in wait.
for(const provider of ['kitsu','mu'])for(const header of ['2',new Date(now+60000).toUTCString(),null,'invalid']){
 let hits=0,clock=now;const waits=[];const timing={now:()=>clock,wait:async(ms,signal)=>{assert.ok(!signal?.aborted);waits.push(ms);clock+=ms;}};
 const options={timing,fetchImplementation:async()=>{hits++;return response(429,header)}};
 const c=provider==='kitsu'?createKitsuClient(options):createMangaUpdatesClient(options);
 const get=(id,signal)=>provider==='kitsu'?c.getAnime(id,signal):c.getSeries(id,'Manga',signal,true);
 await assert.rejects(get('1'));const first=hits;await assert.rejects(get('2'));assert.equal(hits,first);
 assert.ok(hits<=2);if(provider==='mu'&&header==='2'){assert.equal(hits,2);assert.ok(waits.includes(2000));}else assert.equal(hits,1);
}
for(const provider of ['kitsu','mu']){
 let hits=0,waiting=false,clock=now;
 const timing={now:()=>clock,wait:(ms,signal)=>new Promise((resolve,reject)=>{waiting=true;signal.addEventListener('abort',()=>reject(Object.assign(Error(),{code:'cancelled'})),{once:true})})};
 const c=provider==='kitsu'?createKitsuClient({timing,fetchImplementation:async()=>{hits++;return response(404)}}):createMangaUpdatesClient({timing,fetchImplementation:async()=>{hits++;return response(404)}});
 const get=(id,signal)=>provider==='kitsu'?c.getAnime(id,signal):c.getSeries(id,'Manga',signal,true);
 await assert.rejects(get('1'));const ac=new AbortController();const wait=get('2',ac.signal);await tick();assert.equal(waiting,true);ac.abort();await assert.rejects(wait);assert.equal(hits,1);
 let timeout;const opts={setTimer:fn=>{timeout=fn;return 1},clearTimer:()=>{},fetchImplementation:()=>new Promise(()=>{})};
 const hanging=provider==='kitsu'?createKitsuClient(opts):createMangaUpdatesClient(opts);const hung=provider==='kitsu'?hanging.getAnime('1'):hanging.getSeries('1','Manga');await tick();timeout();await assert.rejects(hung,e=>e.code==='timeout');
}
// A cancelled Retry-After wait must remain a shared provider block.
let waitStarted=false,rateHits=0,rateClock=now;
const rateClient=createMangaUpdatesClient({timing:{now:()=>rateClock,wait:(ms,signal)=>new Promise((resolve,reject)=>{waitStarted=true;signal.addEventListener('abort',()=>reject(Object.assign(Error(),{code:'cancelled'})),{once:true})})},fetchImplementation:async()=>{rateHits++;return response(429,'20')}});
const rateAbort=new AbortController(),ratePending=rateClient.getSeries('1','Manga',rateAbort.signal,true);await tick();assert.equal(waitStarted,true);rateAbort.abort();await assert.rejects(ratePending);await assert.rejects(rateClient.getSeries('2','Manga',undefined,true));assert.equal(rateHits,1,'aborting a wait cannot erase Retry-After');
// Refresh bypasses MU detail TTL while keeping the same serial queue.
let hits=0,clock=0;const mu=createMangaUpdatesClient({timing:{now:()=>clock,wait:async ms=>{clock+=ms}},fetchImplementation:async()=>{hits++;return response(200,null,{series_id:1,title:'Manga',type:'Manga'})}});
await mu.getSeries('1','Manga');await mu.getSeries('1','Manga');assert.equal(hits,1);await mu.getSeries('1','Manga',undefined,true);assert.equal(hits,2);
Module._load=original;console.log('PASS 5.5 HTTP: seconds/date/unknown Retry-After, shared blocks, finite retries, serial waits/cancel, 401/403/404/5xx/offline/invalid, ignored abort timeout, fresh MU on shared queue; synthetic transports only.');
})().catch(e=>{console.error(e);process.exitCode=1});

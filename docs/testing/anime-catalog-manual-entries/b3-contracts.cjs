const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createKitsuClient,kitsuRetryAfter}=require('../../../src/providers/kitsu/client.ts');
const {parseAnime,parseAnimeDetail,parseAnimeSearch}=require('../../../src/providers/kitsu/validation.ts');
const {canonicalAnimeId,assertKitsuReference}=require('../../../src/providers/kitsu/identity.ts');
const {mapKitsuDetails,mapKitsuSearchResult,kitsuMaterializationInput,animeYear}=require('../../../src/providers/kitsu/mapping.ts');
const {kitsuAvailability}=require('../../../src/providers/kitsu/availability.ts');
const {kitsuProductSearch,loadKitsuProductDetail,localKitsuSources}=require('../../../src/providers/kitsu/product.ts');
const {presentKitsuError}=require('../../../src/providers/kitsu/errors.ts');
const payload=(id='99999999999999999999',subtype='TV')=>({type:'anime',id,attributes:{canonicalTitle:'TEST Original Anime',subtype,startDate:'2004-02-29',synopsis:'<script>bad()</script><p>Safe &amp; [text](https://invalid.test)</p>',averageRating:'99',posterImage:{original:'https://invalid.test/image'}},relationships:{mappings:{data:[{type:'mappings',id:'1'}]}}});
const response=(value,status=200,retry=null)=>({ok:status===200,status,url:'https://kitsu.app/api/edge/anime',redirected:false,headers:{get:()=>retry},text:async()=>JSON.stringify(value)});
const code=expected=>error=>error.code===expected;
async function main(){
  for(const [subtype,format] of [['TV','tv'],['movie','movie'],['OVA','ova'],['ONA','ona'],['special','special'],['music','music'],['new',null],[null,null],['tv',null],['toString',null]]) {
    const record=parseAnime(payload(undefined,subtype)), input=kitsuMaterializationInput(record), result=mapKitsuSearchResult(record);
    assert.equal(input.snapshot.primaryFormat,format);assert.equal(input.snapshot.medium,'audiovisual');assert.equal(input.snapshot.contentFamily,'anime');
    assert.equal(input.snapshot.posterUrl,null);assert.equal(result.posterUrl,null);assert.equal(Object.hasOwn(input.snapshot,'voteAverage'),false);
    assert.deepEqual(input.initialTags,[]);assert.deepEqual(input.snapshot.genres,[]);assert.equal(input.snapshot.year,2004);
    assert.ok(!input.snapshot.overview.includes('bad()'));assert.ok(!input.snapshot.overview.includes('https://'));assert.equal(input.reference.externalId,'99999999999999999999');
  }
  for(const value of [null,{},[],{...payload(),id:1},{...payload(),type:'manga'},{...payload(),attributes:{}},{...payload(),attributes:{canonicalTitle:'bad\u0000title'}},{...payload(),id:'01'}])assert.throws(()=>parseAnime(value));
  assert.equal(parseAnime({...payload(),attributes:{titles:{en_jp:'Fallback'}}}).title,'Fallback');
  for(const id of ['',0,1,'0','01','-1','1.0',' 1','1/2','1?x',null])assert.throws(()=>canonicalAnimeId(id));
  for(const r of [{provider:'tmdb',resourceNamespace:'anime',externalId:'1'},{provider:'kitsu',resourceNamespace:'manga',externalId:'1'}])assert.throws(()=>assertKitsuReference(r));
  assert.throws(()=>parseAnimeDetail({data:payload('2')},'1'));assert.throws(()=>parseAnimeSearch({data:{}}));assert.throws(()=>parseAnimeSearch({data:[payload('1'),payload('1')]}));
  for(const date of [null,'2001','2001-02-29','0000-01-01','2020-13-01','2020-04-31','bad'])assert.equal(animeYear(date),null);
  assert.equal(animeYear('0001-01-01'),1);assert.equal(animeYear('9999-12-31'),9999);
  let now=0,calls=[],active=0,max=0;
  const timing={now:()=>now,wait:async(ms,signal)=>{if(signal?.aborted)throw Object.assign(Error(),{code:'cancelled'});now+=ms;}};
  const client=createKitsuClient({timing,fetchImplementation:async(url,options)=>{calls.push({url,options,time:now});active++;max=Math.max(max,active);await Promise.resolve();active--;return response(url.includes('/anime/1?')?{data:payload('1')}:{data:[payload()]});}});
  await Promise.all([client.searchAnime('TEST'),client.getAnime('1'),client.searchAnime('TEST',20)]);
  assert.equal(max,1);assert.deepEqual(calls.map(c=>c.time),[0,1000,2000]);assert.ok(calls[2].url.includes('page%5Boffset%5D=20'));
  let release,queuedCalls=0;now=0;
  const bounded=createKitsuClient({timing,fetchImplementation:async()=>++queuedCalls===1?new Promise(resolve=>{release=resolve;}):response({data:payload('1')})});
  const queued=Array.from({length:16},()=>bounded.getAnime('1'));
  await assert.rejects(bounded.getAnime('1'),code('rate-limited'));
  release(response({data:payload('1')}));await Promise.all(queued);assert.equal(queuedCalls,16);
  assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');assert.equal(Object.hasOwn(calls[0].options.headers,'Authorization'),false);
  assert.ok(!calls[0].url.includes('mappings'));assert.ok(!calls[0].url.includes('poster'));await client.searchAnime('TEST');assert.equal(calls.length,4,'no unapproved cache');
  const related={...payload('1'),relationships:{categories:{data:[{type:'categories',id:'a'},{type:'categories',id:'b'}]}}};
  const withGenres=parseAnimeDetail({data:related,included:[{type:'categories',id:'a',attributes:{title:'Drama'}},{type:'categories',id:'b',attributes:{title:'Shounen'}},{type:'categories',id:'unrelated',attributes:{title:'Horror'}}]},'1');
  assert.deepEqual(mapKitsuDetails(withGenres).snapshot.genres,['Drama']);
  for(const [status,expected] of [[404,'not-found'],[403,'access-rejected'],[401,'access-rejected'],[500,'server']]) {
    const c=createKitsuClient({fetchImplementation:async()=>response({},status)});await assert.rejects(c.getAnime('1'),code(expected));
  }
  await assert.rejects(createKitsuClient({fetchImplementation:async()=>{throw Error('offline');}}).getAnime('1'),code('network'));
  await assert.rejects(createKitsuClient({fetchImplementation:async()=>({...response({}),text:async()=>'<html>'})}).getAnime('1'),code('invalid-response'));
  await assert.rejects(createKitsuClient({fetchImplementation:async()=>({...response({}),redirected:true})}).getAnime('1'),code('access-rejected'));
  await assert.rejects(client.searchAnime('x',-1),code('invalid-request'));
  let timer;
  const timed=createKitsuClient({fetchImplementation:()=>new Promise(()=>{}),setTimer:fn=>{timer=fn;return 1;},clearTimer:()=>{}});
  const timedPromise=timed.getAnime('1');await Promise.resolve();timer();await assert.rejects(timedPromise,code('timeout'));
  const abort=new AbortController(),cancelled=timed.getAnime('1',abort.signal);await Promise.resolve();abort.abort();await assert.rejects(cancelled,code('cancelled'));
  abort.abort();await assert.rejects(client.getAnime('1',abort.signal),code('cancelled'));
  assert.equal(kitsuRetryAfter('2',0),2000);assert.equal(kitsuRetryAfter('Thu, 01 Jan 1970 00:00:03 GMT',0),3000);assert.equal(kitsuRetryAfter('invalid',0),null);assert.equal(kitsuRetryAfter('99999999999999999999999',0),null);
  for(const header of ['2','999999',null,'bad']) {
    now=0;let requests=0;
    const c=createKitsuClient({timing,fetchImplementation:async()=>{requests++;return response({},429,header);}});
    await assert.rejects(c.getAnime('1'),code('rate-limited'));assert.equal(requests,1,'no automatic retry');
    await assert.rejects(c.getAnime('1'),code('rate-limited'));assert.equal(requests,1,'cannot bypass cooldown');
    now=2000;
    await assert.rejects(c.getAnime('1'),code('rate-limited'));assert.equal(requests,header==='2'?2:1,'never truncate long wait');
  }
  assert.equal(presentKitsuError(Object.assign(Error(),{code:'no'})).title,'No pudimos consultar Kitsu');
  const oldFetch=global.fetch;let network=0;global.fetch=()=>{network++;throw Error('forbidden');};
  try{
    const {createReviewKitsuClient}=require('../../../src/dev/mediaReview/kitsuFixture.ts');
    assert.equal((await createReviewKitsuClient(false).searchAnime('TEST')).length,7);
    assert.equal((await createReviewKitsuClient(false).getAnime('3')).subtype,'OVA');
    await assert.rejects(createReviewKitsuClient(true).getAnime('1'),code('network'));
    for(const platform of ['web','android','ios','unknown']){assert.equal(kitsuAvailability(platform).productionEnabled,false);await assert.rejects(kitsuProductSearch(()=>platform).search('x'),code('unavailable'));await assert.rejects(loadKitsuProductDetail('1',platform),code('unavailable'));assert.equal(localKitsuSources([{provider:'kitsu',resourceNamespace:'anime',externalId:'1'}],platform)[0].destination,null);}
    assert.equal(network,0);
  }finally{global.fetch=oldFetch;}
  console.log('PASS B3 contracts: six subtypes+unknown, string IDs, malformed/missing data, plain text/year, no score/art/mappings, queue/spacing/pagination/no cache, 404/429/5xx/network/timeout/abort, Retry-After and closed product gates on every platform.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={payload};

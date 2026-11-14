const assert=require('node:assert/strict');
require('./sqlite-fixtures.cjs');
const {observeLibraryProjection,publishLibraryInvalidation}=require('../../../src/storage/libraryInvalidation.ts');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  let reads=0, apply=[], release;
  const stop=observeLibraryProjection(async()=>{reads++;return reads===1?new Promise(resolve=>{release=resolve;}):'current';},value=>apply.push(value),ids=>ids.includes('item'));
  publishLibraryInvalidation(['other']);await tick();assert.equal(reads,0);
  publishLibraryInvalidation(['item']);
  for(let i=0;i<20;i++)publishLibraryInvalidation(['item']);
  release('obsolete');await tick();await tick();assert.equal(reads,2);assert.deepEqual(apply,['current']);
  stop();publishLibraryInvalidation(['item']);await tick();assert.equal(reads,2);
  let lateRelease,lateApply=0;
  const unmount=observeLibraryProjection(()=>new Promise(resolve=>{lateRelease=resolve;}),()=>lateApply++);
  publishLibraryInvalidation(['item']);unmount();lateRelease('late');await tick();assert.equal(lateApply,0);
  let errors=0;const end=observeLibraryProjection(async()=>{throw Error('read error');},()=>assert.fail('bad read published'),()=>true,()=>errors++);
  publishLibraryInvalidation(['item']);await tick();assert.equal(errors,1);end();
  console.log('PASS 2.8: affected IDs, coalesced reads, stale result discarded, unsubscribe/unmount and read errors.');
})().catch(e=>{console.error(e);process.exitCode=1;});

const {assert,collections,inbox,empty,capture,representative,exported,parsed,merge,semantic,integrity,close}=require('./s3-fixtures.cjs');
const now=Date.now();Date.now=()=>now;
(async()=>{
 const source=await representative(),backup=await exported(source);
 // Independent clocks: newer wins, equality/older preserve local, createdAt local is immutable.
 for(const [label,stamp,wins]of [['older',99,false],['equal',100,false],['newer',101,true]]){
  const f=await empty();await merge(f,backup);const incoming=structuredClone(backup),c=incoming.collections.find(v=>v.id==='c1');c.name='TEST remote '+label;c.description='TEST changed description';c.createdAt=0;c.updatedAt=stamp;
  await merge(f,incoming);const actual=(await collections.listCollectionsWithDb(f.db)).find(v=>v.id==='c1');assert.equal(actual.name,wins?c.name:'TEST c1');assert.equal(actual.createdAt,100);
 }
 for(const [label,stamp,wins]of [['older',109,false],['equal',110,false],['newer',111,true]]){
  const f=await empty();await merge(f,backup);const incoming=structuredClone(backup),m=incoming.collectionMemberships.find(v=>v.collectionId==='c1'&&v.itemId==='manual');m.addedAt=55;m.updatedAt=stamp;
  await merge(f,incoming);const actual=(await collections.listMembershipsWithDb(f.db)).find(v=>v.collectionId==='c1'&&v.itemId==='manual');assert.equal(actual.addedAt,wins?55:110,label);assert.equal((await collections.listCollectionsWithDb(f.db)).find(v=>v.id==='c1').updatedAt,100);
 }
 for(const state of ['pending','incorporated','discarded'])for(const [stamp,wins]of [[129,false],[130,false],[131,true]]){
  const f=await empty();await merge(f,backup);const incoming=structuredClone(backup),r=incoming.recommendations.find(v=>v.id==='pending');r.person='TEST remote';r.comment='TEST remote comment';r.status=state;r.linkedItemId=state==='incorporated'?'multi':null;r.createdAt=0;r.updatedAt=stamp;
  await merge(f,incoming);const actual=await inbox.getRecommendationWithDb(f.db,'pending');assert.equal(actual.person,wins?'TEST remote':'TEST Ana');assert.equal(actual.status,wins?state:'pending');assert.deepEqual(actual.originalCapture,backup.recommendations.find(v=>v.id==='pending').originalCapture);assert.equal(actual.createdAt,100);
 }
 const f=await empty();await merge(f,backup);const stable=semantic(await exported(f));
 const contradictory=structuredClone(backup);const r=contradictory.recommendations[0];r.originalCapture.comment='different capture';r.updatedAt=999;let result=await merge(f,contradictory);assert.ok(result.organization.recommendations.issues.some(v=>v.includes('captura original')));assert.deepEqual(semantic(await exported(f)),stable);
 // Identical duplicates processed once; contradictory ID/pair invalidates the whole unit, independent of order.
 for(const reverse of [false,true]){
  const incoming=structuredClone(backup);incoming.collections.push({...incoming.collections.find(v=>v.id==='c1'),name:'TEST conflicting'});incoming.collectionMemberships.push({...incoming.collectionMemberships[0],addedAt:99});incoming.recommendations.push({...incoming.recommendations[0],comment:'TEST contradicts'});if(reverse){incoming.collections.reverse();incoming.collectionMemberships.reverse();incoming.recommendations.reverse()}
  const p=parsed(incoming);assert.ok(p.organizationIssues.length>=2);assert.equal(p.recommendations.length,4);const dest=await empty();result=await merge(dest,incoming);assert.ok(!(await collections.listCollectionsWithDb(dest.db)).some(v=>v.id==='c1'));assert.equal((await inbox.listRecommendationsWithDb(dest.db)).length,4);
 }
 const duplicates=structuredClone(backup);duplicates.collections.push(duplicates.collections[0]);duplicates.collectionMemberships.push(duplicates.collectionMemberships[0]);duplicates.recommendations.push(duplicates.recommendations[0]);const d=await empty();result=await merge(d,duplicates);assert.equal(result.organization.collections.inserted,3);assert.equal(result.organization.memberships.inserted,4);assert.equal(result.organization.recommendations.inserted,5);
 // Deleted memberships/collections are legitimately recovered by an older backup without tombstones.
 await collections.mutateCollections(db=>collections.setCollectionMemberWithDb(db,'c1','manual',false,500),f.db);await collections.mutateCollections(db=>collections.deleteCollectionWithDb(db,'empty'),f.db);await merge(f,backup);assert.deepEqual(semantic(await exported(f)),stable);
 // Two file items with disjoint references can resolve to one locally multi-referenced work.
 // They must result in one effective pair, not duplicate writes or array-order winners.
 for(const order of [[110,120],[120,110],[120,120]]){
  const dest=await representative();await dest.db.runAsync("DELETE FROM collection_memberships WHERE collection_id='c2'");const incoming=structuredClone(backup);incoming.items=incoming.items.filter(v=>v.id==='multi');const first=incoming.items[0];first.providerReferences=[{provider:'tmdb',resourceNamespace:'tv',externalId:'2'}];delete first.metadataState;const second={...first,id:'same-work-other-id',providerReferences:[{provider:'kitsu',resourceNamespace:'anime',externalId:'2'}]};incoming.items.push(second);incoming.pins=[];incoming.activity=[];incoming.recommendations=[];incoming.collectionMemberships=[{collectionId:'c2',itemId:'multi',addedAt:10,updatedAt:order[0]},{collectionId:'c2',itemId:second.id,addedAt:20,updatedAt:order[1]}];
  result=await merge(dest,incoming);const members=(await collections.listMembershipsWithDb(dest.db)).filter(v=>v.collectionId==='c2');
  if(order[0]===order[1]){assert.equal(members.length,0,'ambiguous effective membership cannot choose an array-order winner');assert.ok(result.organization.memberships.issues.length)}
  else{assert.equal(members.length,1);assert.equal(members[0].addedAt,order[0]>order[1]?10:20);assert.equal(result.organization.memberships.inserted,1);assert.equal(result.organization.memberships.updated,0,'one effective pair is one import unit')}
 }
 await integrity();console.log('PASS S3 conflict matrix: all clocks/ties/createdAt, states/context, duplicates and contradictory units, absence/deleted recovery, reference-sharing Inbox, effective post-remap membership merge independent of array order. TEST only.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(close);

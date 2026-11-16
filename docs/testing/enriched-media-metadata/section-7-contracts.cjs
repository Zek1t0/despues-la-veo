const assert=require('node:assert/strict');require('./sqlite-fixtures.cjs');
const {parseKitsuEnrichedMetadata}=require('../../../src/providers/kitsu/enrichedMetadata.ts');
const {sensitiveSignal,savedSensitiveSignal,savedContentVisible,remoteContentVisible}=require('../../../src/core/sensitiveContent.ts');
const {initialMetadataState}=require('../../../src/core/mediaMetadataState.ts');const {editorialRows}=require('../../../src/core/editorialPresentation.ts');
const ref={provider:'kitsu',resourceNamespace:'anime',externalId:'1'};
const base={id:'local',title:'R explicit words adult',medium:'audiovisual',contentFamily:'anime',primaryFormat:'tv',year:null,posterUrl:null,overview:null,genres:[],voteAverage:null,personalRating:null,status:'planned',tags:[],notes:null,createdAt:1,updatedAt:2,providerReferences:[ref]};
const doc=value=>parseKitsuEnrichedMetadata('1',{canonicalTitle:'A',...value},undefined,undefined).metadata;
for(const [raw,expected] of [[true,true],[false,false],[null,null],[undefined,null],['true',null],[1,null]]){const metadata=doc(raw===undefined?{}:{nsfw:raw});assert.equal(sensitiveSignal(metadata),expected);const item={...base,metadataState:{...initialMetadataState(base,[ref]),documents:[{metadata,changedAt:1}]}};assert.equal(savedSensitiveSignal(item),expected);assert.equal(savedContentVisible(item,true),expected!==true);assert.equal(savedContentVisible(item,false),true);assert.equal(remoteContentVisible({reference:ref,metadata},true),expected!==true);}
assert.equal(sensitiveSignal(doc({ageRating:'R',ageRatingGuide:'Known guide',categories:['Adult']})),null);
const metadata=doc({nsfw:true,ageRating:'R'}),other={provider:'tmdb',resourceNamespace:'movie',externalId:'2'};
const multi={...base,providerReferences:[ref,other],metadataState:{...initialMetadataState(base,[ref,other]),selection:{reference:other,updatedAt:2},documents:[{metadata,changedAt:1}]}};
assert.equal(savedSensitiveSignal(multi),null);assert.equal(savedSensitiveSignal({...multi,metadataState:{...multi.metadataState,selection:{reference:null,updatedAt:3}}}),null);assert.equal(savedSensitiveSignal({...base,manualIdentity:'manual'}),null);assert.equal(savedSensitiveSignal(base),null);
assert.equal(sensitiveSignal({...metadata,provenance:{...metadata.provenance,reference:other}}),null);assert.equal(remoteContentVisible({reference:other,metadata},true),true);
const rows=editorialRows(metadata);assert.ok(rows.some(r=>r.label.includes('NSFW')&&r.source==='Kitsu'));assert.ok(rows.some(r=>r.label.includes('edad')&&r.value.includes('R')));assert.ok(!rows.some(r=>r.value.includes('Argentina')));
console.log('PASS S7.1: Kitsu true/false/null/omitted/invalid, R alone unknown, exact provenance, active/inactive/ambiguous docs, manual/legacy unknown, reversible shared visibility and distinct attributed editorial labels. Synthetic only.');

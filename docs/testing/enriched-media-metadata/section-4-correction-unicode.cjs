const assert=require('node:assert/strict');
const {fixture,createV6}=require('./sqlite-fixtures.cjs');
const {normalizeMediaSearch,matchesLocalMediaQuery,presentSavedTitle}=require('../../../src/core/mediaViewProjection.ts');
const {selectVisibleLibraryTitles}=require('../../../src/core/libraryView.ts');
const {selectVisibleTagTitles}=require('../../../src/core/tagView.ts');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {updateMediaMetadata,selectMetadataSource}=require('../../../src/storage/mediaMetadataRepo.ts');
const {getSavedTitleWithReferencesByIdWithDb:read}=require('../../../src/storage/savedTitleStorage.ts');
for(const [a,b] of [['ÁRBOL','arbol'],['CANCIÓN','cancio\u0301n'],['Pokémon','POKEMON'],['English TITLE','english title'],['が','か\u3099'],['ぱ','は\u309a'],['ガ','カ\u3099'],['パ','ハ\u309a']])assert.equal(normalizeMediaSearch(a),normalizeMediaSearch(b));
for(const [a,b] of [['が','か'],['ぱ','は'],['ガ','カ'],['パ','ハ'],['が','ガ'],['ぱ','パ'],['Áが','Aか'],['क़','क']])assert.notEqual(normalizeMediaSearch(a),normalizeMediaSearch(b));
const k={provider:'kitsu',resourceNamespace:'anime',externalId:'2'},t={provider:'tmdb',resourceNamespace:'tv',externalId:'2'};
const title=(value,language)=>({value,language,script:null,kind:'localized'});
const doc=(reference,canonicalTitle,titles)=>({version:1,provenance:{reference,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{canonicalTitle,titles}});
(async()=>{const f=fixture(),oldFetch=global.fetch;global.fetch=()=>{throw Error('Local search must not perform HTTP');};try{
 createV6(f);await evolveDatabaseSchema(f.db,6);
 await updateMediaMetadata('multi',doc(k,'Inactive source',[title('Canción del árbol','es'),title('がく','ja'),title('ガク','ja')]),1000,undefined,f.db);
 await updateMediaMetadata('multi',doc(t,'Active source',[title('Pokémon English TITLE','en'),title('ぱん','ja'),title('パン','ja')]),1001,undefined,f.db);
 await selectMetadataSource('multi',t,1002,f.db);
 const saved=await read(f.db,'multi'),before=JSON.stringify(saved);
 const aliasesBefore=f.sqlite.prepare("SELECT * FROM media_title_aliases ORDER BY provider,value").all();
 const display=presentSavedTitle(saved,['de']);assert.equal(display.title,'Active source');
 for(const query of ['CANCION DEL ARBOL','pokemon english title','がく','か\u3099く','ガク','カ\u3099ク','ぱん','は\u309aん','パン','ハ\u309aン']){
  assert.ok(matchesLocalMediaQuery(display,query),query);
  assert.equal(selectVisibleLibraryTitles({items:[display,display],pinnedAtById:new Map(),query,sort:'title-asc',statusFilter:'all',classificationFilter:'all'}).length,1,query);
  assert.equal(selectVisibleTagTitles([display,display],new Map(),query).length,1,query);
 }
 for(const query of ['かく','カク','はん','ハン']){
  assert.equal(matchesLocalMediaQuery(display,query),false,query);
  assert.equal(selectVisibleLibraryTitles({items:[display],pinnedAtById:new Map(),query,sort:'title-asc',statusFilter:'all',classificationFilter:'all'}).length,0,query);
  assert.equal(selectVisibleTagTitles([display],new Map(),query).length,0,query);
 }
 assert.equal(JSON.stringify(saved),before);assert.deepEqual(await read(f.db,'multi'),saved);
 assert.deepEqual(f.sqlite.prepare("SELECT * FROM media_title_aliases ORDER BY provider,value").all(),aliasesBefore);
 console.log('PASS correction A: Latin accents/case, canonical Unicode equivalence, hiragana/katakana dakuten/handakuten distinctions, other-script marks, active/inactive SQLite aliases in Library/Tags, deduplication, unchanged stored strings/IDs, no HTTP.');
}finally{global.fetch=oldFetch;f.close();}})().catch(e=>{console.error(e);process.exitCode=1});

const assert=require('node:assert/strict');
const {fixture,createV6}=require('./sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {updateMediaMetadata}=require('../../../src/storage/mediaMetadataRepo.ts');
const {getLibraryBackupExportDataWithDb}=require('../../../src/storage/libraryBackupExport.ts');
const {createLibraryBackupV8}=require('../../../src/core/libraryBackupV8.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {mergeLibraryBackupWithDb}=require('../../../src/storage/libraryBackupMerge.ts');
const {getSavedTitleWithReferencesByIdWithDb:read}=require('../../../src/storage/savedTitleStorage.ts');
const {savedMediaPresentation}=require('../../../src/core/mediaPresentation.ts');
const {providerImagePolicy,selectImageVariant,admittedImageUrl}=require('../../../src/core/mediaImagePresentation.ts');
(async()=>{
 const source=fixture(),target=fixture();try{
 createV6(source);await evolveDatabaseSchema(source.db,6);await evolveDatabaseSchema(target.db,0);
 const reference={provider:'kitsu',resourceNamespace:'anime',externalId:'1'};
 await updateMediaMetadata('kitsu',{version:1,provenance:{reference,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},
  fields:{posterImages:[{variant:'small',width:284,url:'https://media.kitsu.app/anime/poster_images/1/small.jpg'}],
  bannerImages:[{variant:'tiny',width:840,url:'https://media.kitsu.app/anime/1/cover_image/tiny-1f92cfe65c1b31d8b47e36f025d32b35.jpeg'}],
  publicRating:{provider:'kitsu',originalValue:'82.28',originalScale:{min:0,max:100}}}},1000,undefined,source.db);
 const data=await getLibraryBackupExportDataWithDb(source.db,{status:'unavailable'});
 const backup=createLibraryBackupV8(data.items,data.pins,data.appearanceAvailability);
 const parsed=parseLibraryBackup(JSON.stringify(backup));assert.equal(parsed.ok,true);assert.equal(parsed.payload.invalid.length,0);
 await target.db.withTransactionAsync(()=>mergeLibraryBackupWithDb(target.db,parsed.payload,()=> 'unused'));
 const restored=await read(target.db,'kitsu'),view=savedMediaPresentation(restored),policy=providerImagePolicy(view.imageProvider,{platform:'web',development:true});
 assert.equal(selectImageVariant(view.metadata.fields.posterImages,policy,'list'),backup.items.find(i=>i.id==='kitsu').metadataState.documents[0].metadata.fields.posterImages[0].url);
 assert.equal(view.rating.originalValue,'82.28');assert.equal(restored.personalRating,85);assert.deepEqual(restored.tags,['mine']);assert.equal(restored.notes,'TEST note');
 const unreviewed=structuredClone(backup);unreviewed.items.find(i=>i.id==='kitsu').metadataState.documents[0].metadata.fields.posterImages[0].url='https://unreviewed.example.test/image';
 const unknown=parseLibraryBackup(JSON.stringify(unreviewed));assert.equal(unknown.ok,true);assert.equal(unknown.payload.invalid.length,0,'safe syntax may be retained without renderer authorization');
 const unknownView=savedMediaPresentation({...restored,metadataState:unknown.payload.items.find(i=>i.id.value==='kitsu').metadataState});
 assert.equal(selectImageVariant(unknownView.metadata.fields.posterImages,policy,'list'),null);
 const invalid=structuredClone(backup);invalid.items.find(i=>i.id==='kitsu').metadataState.documents[0].metadata.fields.posterImages[0].url='https://127.0.0.1/x';
 const bad=parseLibraryBackup(JSON.stringify(invalid));assert.equal(bad.ok,true);assert.ok(bad.payload.invalid.length);assert.ok(bad.payload.items.some(i=>i.id.value==='manual'),'existing partial item rejection leaves unrelated items intact');
 assert.equal(admittedImageUrl('https://127.0.0.1/legacy',providerImagePolicy('tmdb',{platform:'web',development:true})),null);
 console.log('PASS section 3 backup v8 SQLite round-trip: active images and score, original scale, notes/tags/personal rating, retained unreviewed host -> placeholder, private document -> existing partial import rejection, legacy renderer rejection.');
 }finally{source.close();target.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

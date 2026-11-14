const assert=require('node:assert/strict');
const {fixture,createV6}=require('./sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {mergeLibraryBackupWithDb}=require('../../../src/storage/libraryBackupMerge.ts');
const {getSavedTitleWithReferencesByIdWithDb}=require('../../../src/storage/savedTitleStorage.ts');
const {getLibraryBackupExportData}=require('../../../src/storage/libraryBackupExport.ts');
const {setMediaPreferences}=require('../../../src/storage/mediaPreferencesRepo.ts');
(async()=>{
  for(let version=1;version<=7;version++){
    const f=fixture();await evolveDatabaseSchema(f.db,0);
    let item={id:'incoming',title:'TEST Historical',year:2001,posterUrl:null,overview:'Historical summary',voteAverage:7,personalRating:85,
      status:'watching',tags:['mine'],notes:'Historical note',createdAt:10,updatedAt:20};
    if(version<=4)item={...item,type:'movie',provider:'tmdb',externalId:'321'};
    else if(version===5)item={...item,type:'movie',providerReferences:[{provider:'tmdb',resourceNamespace:'movie',externalId:'321'}]};
    else item={...item,medium:'audiovisual',contentFamily:null,primaryFormat:'movie',providerReferences:[{provider:'tmdb',resourceNamespace:'movie',externalId:'321'}]};
    const parsed=parseLibraryBackup(JSON.stringify({version,items:[item],...(version>1?{pins:[]}:{} )}));
    assert.equal(parsed.ok,true,`v${version}`);assert.equal(parsed.payload.invalid.length,0,`v${version}`);
    let result;await f.db.withTransactionAsync(async()=>{result=await mergeLibraryBackupWithDb(f.db,parsed.payload,()=> 'restored');});
    assert.equal(result.inserted,1,`v${version}`);
    const row=f.sqlite.prepare('SELECT id FROM saved_titles').get();const restored=await getSavedTitleWithReferencesByIdWithDb(f.db,row.id);
    for(const key of ['title','notes','tags','personalRating','createdAt','updatedAt','status'])assert.deepEqual(restored[key],key==='personalRating'&&version<3?null:item[key],`v${version}/${key}`);
    assert.equal(restored.providerReferences[0].externalId,'321');assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);f.close();
  }
  const source=fixture();createV6(source);await evolveDatabaseSchema(source.db,6);
  const prefs={version:1,languages:['en'],autoRefresh:{enabled:false,intervalDays:7},hideSensitive:false};
  await setMediaPreferences(prefs,100,source.db);
  const other=fixture(source.file);let mutated=false;
  const hooked={...source.db,getAllAsync:async(sql,...args)=>{
    const rows=await source.db.getAllAsync(sql,...args);
    if(!mutated&&sql==='SELECT * FROM saved_titles ORDER BY created_at DESC;'){
      mutated=true;
      other.sqlite.exec("UPDATE saved_titles SET notes='Concurrent outside export' WHERE id='tmdb'");
      other.sqlite.prepare("UPDATE app_preferences SET value=?,updated_at=200 WHERE key='metadata.preferences'").run(JSON.stringify({...prefs,hideSensitive:true}));
    }
    return rows;
  }};
  const data=await getLibraryBackupExportData({status:'unavailable'},hooked);
  assert.equal(data.items.find(item=>item.id==='tmdb').notes,'TEST note');assert.equal(data.preferences.value.hideSensitive,false);
  assert.equal(other.sqlite.prepare("SELECT notes FROM saved_titles WHERE id='tmdb'").get().notes,'Concurrent outside export');
  other.close();source.close();console.log('PASS 2.5-2.7: imports1-7 preserve original personal fields/identity; WAL concurrent writer cannot tear export items/preferences snapshot.');
})().catch(e=>{console.error(e);process.exitCode=1;});

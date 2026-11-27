const assert=require('node:assert/strict'), {randomUUID}=require('node:crypto');
const {fixture,createV6}=require('../enriched-media-metadata/sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {createLibraryBackupV11}=require('../../../src/core/libraryBackupV11.ts');
const {parseLibraryBackup}=require('../../../src/core/libraryBackup.ts');
const {getLibraryBackupExportData}=require('../../../src/storage/libraryBackupExport.ts');
const {mergeLibraryBackup}=require('../../../src/storage/savedTitlesRepo.ts');
const {applyGranularConflict,readGranularBackup}=require('../../../src/storage/granularBackup.ts');
const {setGranularEnabled,saveGranularGroup,saveGranularUnit,listGranularUnits,setGranularDecisions,retireGranularUnit}=require('../../../src/storage/granularRepo.ts');
const {downloadGranularGuide,readGranularGuide,GUIDE_VALIDITY_MS}=require('../../../src/storage/granularInventory.ts');
const {readGranularScreen}=require('../../../src/storage/granularPresentationRepo.ts');
const {libraryPresentationRevision}=require('../../../src/storage/libraryInvalidation.ts');
require('../../../src/storage/db.ts').initDb=async()=>{throw Error('Solo SQLite TEST');};
global.fetch=()=>{throw Error('TEST sin red');};
const appearance={status:'unavailable',reason:'pending'};
const now=new Date(2026,10,26,12).valueOf();
async function snapshot(db) {
 const data=await getLibraryBackupExportData(appearance,db);
 return createLibraryBackupV11(data.items,data.pins,appearance,'2026-11-26T12:00:00Z',data);
}
function parsed(raw){const result=parseLibraryBackup(JSON.stringify(raw));assert.equal(result.ok,true,JSON.stringify(result.error));return result.payload;}
const merge=(raw,db)=>mergeLibraryBackup(parsed(raw),randomUUID,db);
const position=(chapter)=>({mode:'chapter',chapter});
async function seed(db,owner,coordinate,groupId=null){
 const id=randomUUID(), page=await listGranularUnits(owner,1,null,db);
 await saveGranularUnit({id,ownerId:owner,groupId,coordinate,label:null},page.revision,db);
 return id;
}
async function cachedRestoration() {
 const local=fixture();
 const scope={ownerId:'tmdb',seriesId:'1',language:'es-AR',season:1};
 const reference=(parentId,namespace,externalId)=>({provider:'tmdb',parentNamespace:'tv',parentId,namespace,externalId});
 const group=(parentId,externalId,label)=>({id:randomUUID(),itemId:'tmdb',kind:'season',label,references:[reference(parentId,'season',externalId)]});
 const episode=(group,season,number,externalId)=>({id:randomUUID(),itemId:'tmdb',groupId:group.id,retired:false,label:null,
  coordinate:{mode:'season-episode',season,episode:number},references:[reference(group.references[0].parentId,'episode',externalId)]});
 try{
  createV6(local);await evolveDatabaseSchema(local.db,6);
  await local.db.runAsync("INSERT INTO media_provider_references VALUES ('tmdb','tv','9','tmdb')");
  await downloadGranularGuide(scope,new AbortController().signal,{db:local.db,validatedContract:true,now:()=>now,fetch:async path=>path==='/tv/1'?
   {id:1,seasons:[{id:501,season_number:1,episode_count:12}]}:
   {id:501,season_number:1,episodes:Array.from({length:12},(_,i)=>({id:601+i,season_number:1,episode_number:i+1,air_date:'2024-01-02',overview:'Caché TEST'}))}});
  const base=await snapshot(local.db);
  const read=async(s=scope,time=now)=>(await readGranularScreen('tmdb',s,local.db,time)).guide;
  assert.equal((await read()).coverage.percent,0);
  assert.equal((await merge(base,local.db)).granular.issues.length,0);
  assert.equal((await read()).coverage.denominator,12);
  assert.equal((await read(scope,now+GUIDE_VALIDITY_MS)).mode,'stale');
  const t1=base.granular.groups.find(g=>g.references[0]?.externalId==='501');
  const t2=group('1','502','Temporada 2'), other=group('9','901','Otra serie');
  const extra=[13,14,15].map(n=>episode(t1,1,n,String(700+n)));
  const newSeason=episode(t2,2,1,'801'), otherEpisode=episode(other,1,1,'904');
  const added={...base,granular:{...base.granular,groups:[...base.granular.groups,t2,other],units:[...base.granular.units,...extra,newSeason,otherEpisode],
   decisions:extra.slice(0,2).map((u,i)=>({itemId:'tmdb',unitId:u.id,marked:i===0,consumedOn:i===0?'2024-02-29':null,updatedAt:12}))}};
  assert.equal((await merge(added,local.db)).granular.inserted,2);
  const index=await readGranularGuide(scope,local.db,now);
  assert.deepEqual(index.index.map(e=>[e.number,e.count]),[[1,12],[2,null]]);
  const first=await read(), second=await read({...scope,season:2}), foreign=await read({...scope,seriesId:'9'});
  assert.equal(first.members.length,15);
  assert.equal(first.coverage.percent,null);
  assert.match(first.coverage.label,/1 marcados · 15 conocidos/);
  assert.equal(first.members[0].overview,'Caché TEST');
  assert.equal(first.members[0].airDate,'2024-01-02');
  assert.deepEqual(first.members.slice(12).map(e=>e.airDate),[null,null,null]);
  assert.deepEqual(second.members.map(e=>e.unitId),[newSeason.id]);
  assert.deepEqual(foreign.members.map(e=>e.unitId),[otherEpisode.id]);
  const filter={source:'tmdb',seriesId:'1',season:1,group:first.group};
  for(const [status,expected] of [['active',15],['marked',1],['pending',14]]){
   const page=await listGranularUnits('tmdb',25,null,local.db,{...filter,status});
   assert.equal(page.rows.length,expected);
   if(status==='active'){
    assert.deepEqual(page.rows.map(row=>row.id),first.members.map(e=>e.unitId));
    assert.deepEqual(page.rows.slice(12).map(e=>[e.marked,e.consumed_on]),[[1,'2024-02-29'],[0,null],[null,null]]);
   }
  }
  const after=await snapshot(local.db);
  for(let i=0;i<3;i++)assert.equal((await merge(added,local.db)).granular.inserted,0);
  assert.deepEqual((await snapshot(local.db)).granular,after.granular);
  const conflicting=group('1','503','Otra referencia T1');
  await merge({...base,granular:{...base.granular,groups:[conflicting],units:[episode(conflicting,1,1,'905')],decisions:[]}},local.db);
  const ambiguous=await readGranularGuide(scope,local.db,now);
  assert.deepEqual(ambiguous.seasonConflicts,[1]);
  assert.equal((await read()).members.length,15);
  assert.equal((await read({...scope,seriesId:'9'})).members.length,1);
 }finally{local.close();}
}
async function main(){
 const a=fixture(), b=fixture(), collision=fixture();
 try{
  createV6(a);await evolveDatabaseSchema(a.db,6);await evolveDatabaseSchema(b.db,0);await evolveDatabaseSchema(collision.db,0);
  const empty=await snapshot(b.db);
  assert.equal(empty.version,11);assert.deepEqual(empty.granular,{enabled:[],groups:[],units:[],decisions:[]});
  for(const bad of [{...empty,granular:undefined},{...empty,granular:[]},{...empty,version:12}])assert.equal(parseLibraryBackup(JSON.stringify(bad)).ok,false);
  assert.equal(parseLibraryBackup('{').ok,false);
  const invalid={...empty,granular:{...empty.granular,decisions:[null]}};
  assert.equal(parsed(invalid).granularIssues.length,1);
  assert.deepEqual(parsed({...empty,version:10,granular:{decisions:[{marked:true}]}}).granular,undefined);

  await setGranularEnabled('mu',0,true,a.db);
  const group=randomUUID();
  await saveGranularGroup({ownerId:'mu',id:group,kind:'volume',label:'Tomo TEST'},1,a.db);
  const u12=await seed(a.db,'mu',position('12'),group), u125=await seed(a.db,'mu',position('12.5'),group);
  const u15=await seed(a.db,'mu',position('15'),group);
  const special=await seed(a.db,'mu',{mode:'special',label:'番外編 🐈'},group);
  let page=await listGranularUnits('mu',5,null,a.db);
  await setGranularDecisions('mu',page.revision,[
   {unitId:u12,marked:true,consumedOn:'2024-02-29',expectedRevision:null},
   {unitId:u125,marked:false,consumedOn:null,expectedRevision:null},
   {unitId:special,marked:true,consumedOn:null,expectedRevision:null}
  ],a.db,now);
  page=await listGranularUnits('mu',5,null,a.db);
  await retireGranularUnit('mu',special,true,page.revision,a.db);
  for(const [season,groupId] of [[0,500],[1,501]])await downloadGranularGuide({ownerId:'tmdb',seriesId:'1',language:'es-AR',season},new AbortController().signal,{
   db:a.db,validatedContract:true,now:()=>now,fetch:async path=>path==='/tv/1'?{id:1,seasons:[{id:500,season_number:0,episode_count:1},{id:501,season_number:1,episode_count:1}]}:
   {id:groupId,season_number:season,episodes:[{id:600+season,season_number:season,episode_number:2,air_date:'2024-01-02',overview:'TEST caché excluida'}]}
  });
  await a.db.runAsync("INSERT INTO personal_title_progress VALUES ('tmdb',1,'season-episode',3,10,NULL,NULL,42),('mu',1,NULL,NULL,NULL,NULL,NULL,43)");
  await a.db.runAsync("INSERT INTO personal_collections VALUES ('TEST-col','TEST','Grupo',1,2)");
  await a.db.runAsync("INSERT INTO collection_memberships VALUES ('TEST-col','mu',3,4)");
  await a.db.runAsync(`INSERT INTO recommendation_inbox (id,original_capture_json,capture_kind,name,status,linked_saved_title_id,created_at,updated_at)
    VALUES ('TEST-in','{"name":"TEST"}','name','TEST','incorporated','mu',5,6)`);
  await setGranularEnabled('manual',0,true,a.db);
  const manualId=await seed(a.db,'manual',{mode:'episode',episode:5});
  await require('../../../src/storage/mediaMetadataRepo.ts').updateMediaMetadata('kitsu',{
   version:1,provenance:{reference:{provider:'kitsu',resourceNamespace:'anime',externalId:'1'},normalizerVersion:1,
    fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{sensitive:true,episodeCount:12,canonicalTitle:'TEST sensible'}
  },now,undefined,a.db);
  await require('../../../src/storage/mediaPreferencesRepo.ts').setMediaHideSensitive(true,now,a.db);
  const raw=await snapshot(a.db);
  assert.ok(!JSON.stringify(raw).includes('TEST caché excluida'));
  assert.equal(raw.granular.units.find(unit=>unit.id===u15).coordinate.chapter,'15');
  assert.equal(raw.granular.units.find(unit=>unit.id===special).retired,true);
  assert.equal(raw.granular.groups.some(group=>group.references[0]?.externalId==='500'),true);
  const initial=await merge(raw,b.db);
  assert.equal(initial.granular.inserted,3);assert.deepEqual(initial.granular.issues,[]);
  assert.equal(b.sqlite.prepare('SELECT count(*) AS n FROM granular_guide_snapshots').get().n,0);
  const reexport=await snapshot(b.db);
  assert.deepEqual(reexport.granular,raw.granular);
  assert.deepEqual(reexport.progress,raw.progress);
  assert.deepEqual(reexport.collections,raw.collections);
  assert.deepEqual(reexport.recommendations,raw.recommendations);
  assert.deepEqual(reexport.pins,raw.pins);
  assert.deepEqual(reexport.preferences,raw.preferences);
  assert.deepEqual(reexport.items,raw.items);
  const remapDb=fixture();
  try{
    createV6(remapDb);
    remapDb.sqlite.exec("DELETE FROM manual_entry_identities WHERE saved_title_id='manual'; UPDATE saved_titles SET id='manual-local' WHERE id='manual'; INSERT INTO manual_entry_identities VALUES ('TEST-portable-manual','manual-local');");
    await evolveDatabaseSchema(remapDb.db,6);
    const portable=(await merge(raw,remapDb.db)).granular;
    assert.equal(portable.issues.length,0);
    assert.equal(remapDb.sqlite.prepare("SELECT owner_id FROM granular_units WHERE id=?").get(manualId).owner_id,'manual-local');
    assert.equal(remapDb.sqlite.prepare("SELECT enabled FROM granular_title_state WHERE owner_id='manual-local'").get().enabled,1);
  }finally{remapDb.close();}
  for(let index=0;index<3;index++){
   const repeated=await merge(raw,b.db);
   assert.deepEqual(repeated.granular.changedIds,[]);
   assert.equal(repeated.granular.preservedEqual,3);
  }
  const durable=await readGranularBackup(b.db);
  await merge({...raw,version:10,granular:{...raw.granular,decisions:raw.granular.decisions.map(d=>({...d,marked:false}))}},b.db);
  assert.deepEqual(await readGranularBackup(b.db),durable);
  for(let version=1;version<=10;version++){
   const historical={...empty,version,granular:{decisions:[{marked:false}]}};
   assert.equal(parsed(historical).granular,undefined);
   await merge(historical,b.db);assert.deepEqual(await readGranularBackup(b.db),durable);
  }
  const restoredGuide=await require("../../../src/storage/granularPresentationRepo.ts").readGranularScreen("tmdb",{ownerId:"tmdb",seriesId:"1",season:1,language:"es-AR"},b.db,now);
  assert.equal(restoredGuide.guide.mode,"partial");assert.equal(restoredGuide.guide.members.length,1);assert.equal(restoredGuide.guide.coverage.percent,null);
  const originalUnit=raw.granular.units.find(unit=>unit.id===u12);
  const conflicts={...raw,granular:{...raw.granular,decisions:raw.granular.decisions.map(d=>d.unitId===u12?{...d,marked:false,consumedOn:null}:
    d.unitId===u125?{...d,marked:true,consumedOn:'2024-03-01'}:d)}};
  let report=(await merge(conflicts,b.db)).granular;
  assert.equal(report.conflicts.length,2);
  assert.deepEqual(await readGranularBackup(b.db),durable);
  const selected=report.conflicts.find(c=>c.unitId===u12);
  const unchanged=libraryPresentationRevision();
  const transaction=b.db.withTransactionAsync;
  b.db.withTransactionAsync=callback=>transaction(async()=>{await callback();throw Error('TEST commit explícito');});
  try{await assert.rejects(applyGranularConflict(selected,b.db,100),/commit explícito/);}finally{b.db.withTransactionAsync=transaction;}
  assert.equal(libraryPresentationRevision(),unchanged);
  assert.deepEqual(await readGranularBackup(b.db),durable);
  assert.equal((await applyGranularConflict(selected,b.db,100)).marked,false);
  await assert.rejects(applyGranularConflict(selected,b.db,100),/cambió/);
  report=(await merge(conflicts,b.db)).granular;
  assert.equal(report.conflicts.length,1);
  const applied=await applyGranularConflict(report.conflicts[0],b.db,100);
  assert.equal(applied.consumedOn,'2024-03-01');
  assert.equal((await merge(conflicts,b.db)).granular.conflicts.length,0);

  const date=(value)=>({...raw,granular:{...raw.granular,decisions:[{...raw.granular.decisions.find(d=>d.unitId===u12),consumedOn:value}]}});
  assert.equal((await merge(date(null),a.db)).granular.conflicts.length,1);
  assert.equal((await merge(date('2024-03-15'),a.db)).granular.conflicts.length,1);
  assert.equal((await merge({...raw,granular:{...raw.granular,decisions:raw.granular.decisions.map(d=>({...d,updatedAt:d.updatedAt+100}))}},a.db)).granular.preservedEqual,3);
  const scopeBefore=a.sqlite.prepare('SELECT status,revision FROM granular_guide_snapshots ORDER BY season').all();
  await merge(raw,a.db);
  assert.deepEqual(a.sqlite.prepare('SELECT status,revision FROM granular_guide_snapshots ORDER BY season').all(),scopeBefore);

  const sample=raw.granular.units.find(unit=>unit.references[0]?.externalId==='601');
  const remapped=randomUUID();
  const incoming={...raw,granular:{...raw.granular,units:raw.granular.units.map(unit=>unit.id===sample.id?{...unit,id:remapped}:unit),
    decisions:[{itemId:'tmdb',unitId:remapped,marked:true,consumedOn:null,updatedAt:10}]}};
  assert.equal((await merge(incoming,a.db)).granular.inserted,1);
  assert.equal(a.sqlite.prepare('SELECT unit_id FROM granular_decisions WHERE owner_id=?').get('tmdb').unit_id,sample.id);
  assert.deepEqual(a.sqlite.prepare('SELECT status,revision FROM granular_guide_snapshots ORDER BY season').all(),scopeBefore);
  const broken={...raw,granular:{...raw.granular,units:raw.granular.units.map(unit=>unit.id===u12?{...unit,groupId:randomUUID()}:unit)}};
  const omitted=(await merge(broken,a.db)).granular;
  assert.ok(omitted.issues.some(issue=>issue.reason.includes('Grupo sin destino')));
  assert.ok(omitted.issues.some(issue=>issue.reason.includes('Unidad sin destino')));
  assert.deepEqual(raw.granular.units.find(unit=>unit.id===u12),originalUnit);
  const collidingUnit={...sample,id:u12};
  const ownerCollision={...raw,granular:{...raw.granular,units:[collidingUnit],
    decisions:[{itemId:'tmdb',unitId:u12,marked:true,consumedOn:null,updatedAt:10}]}};
  assert.ok((await merge(ownerCollision,a.db)).granular.issues.some(issue=>issue.reason.includes('otro título')));
  const conflictingAlias={...incoming,granular:{...incoming.granular,units:[sample,{...sample,id:remapped}],
    decisions:[...incoming.granular.decisions,{...incoming.granular.decisions[0],unitId:sample.id,marked:false}]}};
  let alias=(await merge(conflictingAlias,a.db)).granular;
  assert.ok(alias.issues.some(issue=>issue.reason.includes('Decisiones contradictorias')));
  assert.equal(alias.conflicts.length,0);
  a.sqlite.exec(`INSERT INTO granular_guide_snapshots SELECT owner_id,series_id,'en-US',season,revision,checked_at,status,payload,issues
    FROM granular_guide_snapshots WHERE language='es-AR' AND season=1`);
  const addId=randomUUID();
  const changedGuide={...raw,granular:{...raw.granular,units:[...raw.granular.units,{...sample,id:addId,
    references:[{...sample.references[0],externalId:'999'}],coordinate:{mode:'season-episode',season:1,episode:8}}]}};
  const aRun=a.db.runAsync;
  a.db.runAsync=(sql,...params)=>{if(sql.includes('UPDATE granular_guide_snapshots'))throw Error('TEST reevaluación');return aRun(sql,...params)};
  try{assert.ok((await merge(changedGuide,a.db)).granular.issues.some(issue=>issue.reason==='TEST reevaluación'));}finally{a.db.runAsync=aRun;}
  assert.equal(a.sqlite.prepare('SELECT id FROM granular_units WHERE id=?').get(addId),undefined);
  assert.equal(a.sqlite.prepare("SELECT COUNT(*) n FROM granular_guide_snapshots WHERE season=1 AND status='accredited'").get().n,2);
  assert.equal((await merge(changedGuide,a.db)).granular.issues.length,0);
  assert.equal(a.sqlite.prepare("SELECT COUNT(*) n FROM granular_guide_snapshots WHERE season=1 AND status='stale'").get().n,2);
  assert.equal(a.sqlite.prepare("SELECT status FROM granular_guide_snapshots WHERE season=0").get().status,'accredited');
  const beforeCommit=libraryPresentationRevision();
  const tx=collision.db.withTransactionAsync;
  collision.db.withTransactionAsync=callback=>tx(async()=>{await callback();throw Error('TEST commit global');});
  try{await assert.rejects(merge(raw,collision.db),/commit global/);}finally{collision.db.withTransactionAsync=tx;}
  assert.deepEqual((await snapshot(collision.db)).granular,empty.granular);
  assert.equal(libraryPresentationRevision(),beforeCommit);
  assert.equal((await merge(raw,collision.db)).granular.inserted,3);

  // Savepoint failures omit their dependency chain and can be retried.
  for(const [table,needle] of [['groups','INSERT INTO granular_groups'],['units','INSERT INTO granular_units'],['references','INSERT INTO granular_unit_references'],['decisions','INSERT INTO granular_decisions']]){
   const trial=fixture();
   try {
    await evolveDatabaseSchema(trial.db,0);
    const run=trial.db.runAsync;
    trial.db.runAsync=(sql,...params)=>{if(sql.includes(needle))throw Error('TEST '+table);return run(sql,...params);};
    const failed=(await merge(raw,trial.db)).granular;
    assert.ok(failed.issues.some(issue=>issue.reason==='TEST '+table),table);
    trial.db.runAsync=run;
    assert.equal((await merge(raw,trial.db)).granular.issues.length,0);
    assert.deepEqual((await snapshot(trial.db)).granular,raw.granular);
   }finally{trial.close();}
  }
  const reopened=fixture(b.file);
  try{await evolveDatabaseSchema(reopened.db,10);assert.deepEqual(await readGranularBackup(reopened.db),await readGranularBackup(b.db));}finally{reopened.close();}
  console.log('PASS S4 v11: integridad, round trip, remapeo de referencias, conflictos y rollback.');
 }finally{a.close();b.close();collision.close();}
}
main().then(cachedRestoration).then(()=>console.log("PASS S4 revisión: caché, 15 unidades, T2, filtros, decisiones y referencias aisladas.")).catch(error=>{console.error(error);process.exitCode=1;});

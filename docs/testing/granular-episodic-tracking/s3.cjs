const assert=require('node:assert/strict');
const {fixture,createV6}=require('../enriched-media-metadata/sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {listGranularUnits,setGranularDecisions}=require('../../../src/storage/granularRepo.ts');
const {listGranularCountsWithDb,readGranularScreen}=require('../../../src/storage/granularPresentationRepo.ts');
const {localCivilDay,scopeCoverage,unitAvailability,partitionGranularSelection}=require('../../../src/core/granularCoverage.ts');
require('../../../src/storage/db.ts').initDb=async()=>{throw Error('Solo bases TEST');};
global.fetch=()=>{throw Error('TEST sin red');};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const today=localCivilDay(new Date(2026,10,26,12));
assert.equal(today,'2026-11-26');
for(const [date,retired,state] of [['2026-11-25',false,'Estrenado'],[today,false,'Hoy · hora desconocida'],['2026-11-27',false,'Anunciado'],[null,false,'Desconocido'],[today,true,'Retirado']]){
  assert.equal(unitAvailability(date,retired,today),state);
}
const known=Array.from({length:12},(_,i)=>({marked:i<4,special:false,availability:'Estrenado'}));
assert.equal(scopeCoverage(known,'accredited').percent,33);
assert.equal(scopeCoverage([...known,{marked:true,special:true,availability:'Estrenado'}],'accredited').percent,33);
assert.equal(scopeCoverage([...known,{marked:false,special:false,availability:'Anunciado'}],'accredited').label,'4 de 12 estrenados');
for(const mode of ['manual','partial','stale'])assert.equal(scopeCoverage(known,mode).percent,null);
for(const availability of ['Desconocido','Hoy · hora desconocida'])assert.equal(scopeCoverage([...known,{marked:false,special:false,availability}],'accredited').percent,null);
assert.equal(scopeCoverage([],'accredited').percent,null);

function reviewedFreshnessAndCounts() {
 const {GUIDE_VALIDITY_MS,editorialClock,visibleGuideCoverage,civilDateLabel}=require('../../../src/core/granularCoverage.ts');
 const index=new Date(2026,10,19,13,30).valueOf(), snapshot=index+60_000;
 const boundary=index+GUIDE_VALIDITY_MS;
 const before=editorialClock(new Date(boundary-1),index,snapshot);
 const exact=editorialClock(new Date(boundary),index,snapshot);
 assert.equal(before.current,true);
 assert.equal(before.delay,1);
 assert.equal(exact.current,false);
 assert.equal(before.day,exact.day);
 // Samples used on foreground/focus can immediately suppress a stale or future-dated snapshot.
 const reentry=editorialClock(new Date(boundary+90_000),index,snapshot);
 assert.equal(reentry.current,false);
 assert.equal(editorialClock(new Date(snapshot-1),index,snapshot).current,false);
 assert.equal(editorialClock(new Date(snapshot-1),index,snapshot).day,editorialClock(new Date(snapshot),index,snapshot).day);
 assert.equal(editorialClock(new Date(snapshot),index,snapshot).current,true);
 assert.equal(editorialClock(new Date(snapshot+GUIDE_VALIDITY_MS),snapshot,snapshot).current,false);
 const {execFileSync}=require('node:child_process');
 const clockDays=['America/Argentina/Buenos_Aires','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,[
   '-e','require("./docs/testing/enriched-media-metadata/sqlite-fixtures.cjs");const {editorialClock}=require("./src/core/granularCoverage.ts");console.log(editorialClock(new Date("2026-11-26T02:00:00Z")).day);'
 ],{env:{...process.env,TZ},encoding:'utf8'}).trim());
 assert.deepEqual(clockDays,['2026-11-25','2026-11-26']);
 assert.equal(civilDateLabel('2024-02-29'),'29/02/2024');
 const guide={structuralMode:'accredited',checkedAt:snapshot,members:[
   {number:1,marked:true,retired:false,airDate:'2026-11-01'},
   {number:2,marked:false,retired:false,airDate:'2026-11-01'},
   {number:0,marked:true,retired:false,airDate:'2026-11-01'},
   {number:3,marked:true,retired:false,airDate:'2099-11-01'},
   {number:4,marked:true,retired:true,airDate:'2026-11-01'}
 ]};
 const accredited=visibleGuideCoverage(guide,1,before);
 assert.deepEqual([accredited.counted,accredited.denominator,accredited.percent],[1,2,50]);
 const stale=visibleGuideCoverage(guide,1,exact);
 assert.deepEqual([stale.counted,stale.denominator,stale.percent],[3,null,null]);
 assert.match(stale.label,/3 marcados · 4 conocidos · Guía desactualizada/);
 const partial=visibleGuideCoverage({...guide,structuralMode:'partial'},1,before);
 assert.equal(partial.percent,null);
 assert.equal(guide.members.filter(member=>member.marked).length-accredited.counted,3);
}
async function coverageFromDurableMembership() {
 const f=fixture();
 try {
  createV6(f);await evolveDatabaseSchema(f.db,6);
  const {downloadGranularGuide}=require('../../../src/storage/granularInventory.ts');
  const scope={ownerId:'tmdb',seriesId:'1',language:'es-AR',season:1};
  const now=new Date(2026,10,26,12).valueOf();
  await downloadGranularGuide(scope,new AbortController().signal,{db:f.db,validatedContract:true,now:()=>now,fetch:async route=>
    route==='/tv/1'?{id:1,seasons:[{id:2,season_number:1,episode_count:12}]}:
    {id:2,season_number:1,episodes:Array.from({length:12},(_,i)=>({id:i+20,season_number:1,episode_number:i+1,air_date:'2020-02-18'}))}
  });
  const page=await listGranularUnits('tmdb',40,null,f.db);
  const ids=page.rows.slice(0,4).map(row=>row.id);
  await setGranularDecisions('tmdb',page.revision,ids.map(unitId=>({unitId,marked:true,consumedOn:null,expectedRevision:null})),f.db,now);
  const view=await readGranularScreen('tmdb',scope,f.db,now);
  assert.equal(view.guide.coverage.percent,33);
  f.sqlite.prepare('UPDATE granular_units SET retired=1 WHERE id=?').run(ids[0]);
  const changed=await readGranularScreen('tmdb',scope,f.db,now);
  assert.equal(changed.guide.mode,'stale');
  assert.equal(changed.guide.coverage.percent,null);
  assert.equal(changed.marked,4);
 }finally{f.close();}
}
async function reviewedDatesAndRaces() {
 const {consumptionIntent,requestGeneration,readKey,selectionUnitLabel}=require('../../../src/core/granularInteraction.ts');
 const revisions=requestGeneration();
 let resume, visible=null;
 const pending=new Promise(resolve=>{resume=resolve;});
 const ticket=revisions.begin();
 const complete=pending.then(value=>{if(revisions.current(ticket))visible=value;});
 revisions.invalidate();
 resume('resultado del editor anterior');await complete;
 assert.equal(visible,null);
 assert.equal(readKey('grupo B',{key:'grupo A',data:['fila anterior']}),null);
 assert.notEqual(selectionUnitLabel('Ep. 1','Grupo A',id(1)),selectionUnitLabel('Ep. 1','Grupo B',id(1)));

 const f=fixture();
 try {
  createV6(f);await evolveDatabaseSchema(f.db,6);
  const db=f.db, clock=new Date(2026,10,26,12).valueOf();
  await db.runAsync("INSERT INTO personal_title_progress VALUES ('tmdb',1,'episode',NULL,10,NULL,NULL,15)");
  const cursor=f.sqlite.prepare("SELECT * FROM personal_title_progress").get();
  for (let n=1;n<=4;n++) await db.runAsync("INSERT INTO granular_units VALUES(?,'tmdb',NULL,?,NULL,0,0,?,'000000',0)",id(n),JSON.stringify({mode:'episode',episode:n}),n);
  await setGranularDecisions('tmdb',0,[
   {unitId:id(2),marked:true,consumedOn:'2024-02-29',expectedRevision:null},
   {unitId:id(3),marked:true,consumedOn:null,expectedRevision:null},
   {unitId:id(4),marked:false,consumedOn:null,expectedRevision:null}
  ],db,clock);
  const page=await listGranularUnits('tmdb',4,null,db);
  const mixed=page.rows.map(row=>({unitId:row.id,marked:true,expectedRevision:row.revision??null,
   consumedOn:consumptionIntent(true,'none',row,today,'')}));
  await setGranularDecisions('tmdb',page.revision,mixed,db,clock+1);
  const actual=await listGranularUnits('tmdb',4,null,db);
  assert.deepEqual(actual.rows.map(row=>[row.marked,row.consumed_on,row.revision]),[[1,null,1],[1,'2024-02-29',1],[1,null,1],[1,null,2]]);
  assert.equal(actual.rows[1].updated_at,clock);
  assert.equal(consumptionIntent(true,'clear',actual.rows[1],today,''),null);
  assert.equal(consumptionIntent(true,'date',actual.rows[1],today,'2023-01-01'),'2023-01-01');
  assert.equal(consumptionIntent(true,'today',actual.rows[1],today,''),today);
  assert.equal(consumptionIntent(false,'today',actual.rows[1],today,''),null);
  assert.deepEqual(await listGranularCountsWithDb(db,['tmdb','multi']),{tmdb:4});
  await setGranularDecisions('tmdb',actual.revision,[
   {unitId:id(2),marked:true,consumedOn:consumptionIntent(true,'clear',actual.rows[1],today,''),expectedRevision:1},
   {unitId:id(4),marked:false,consumedOn:consumptionIntent(false,'none',actual.rows[3],today,''),expectedRevision:2}
  ],db,clock+2);
  const after=await listGranularUnits('tmdb',4,null,db);
  assert.deepEqual([after.rows[1].consumed_on,after.rows[1].revision,after.rows[3].marked],[null,2,0]);
  assert.deepEqual(await listGranularCountsWithDb(db,['tmdb','multi']),{tmdb:3});
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM personal_title_progress").get(),cursor);
 }finally{f.close();}
}
(async()=>{
 reviewedFreshnessAndCounts();
 await coverageFromDurableMembership();
 await reviewedDatesAndRaces();
 for(const size of [12,100,1000,5000]){
  const f=fixture();
  try{
   createV6(f);await evolveDatabaseSchema(f.db,6);
   f.sqlite.prepare(`WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n<?)
      INSERT INTO granular_units SELECT printf('00000000-0000-4000-8000-%012d',n),'tmdb',NULL,
        printf('{"mode":"episode","episode":%d}',n),NULL,0,0,n,'000000',0 FROM seq`).run(size);
   let queries=0;
   for(const key of ['getAllAsync','getFirstAsync']){ const original=f.db[key];f.db[key]=(...args)=>{queries++;return original(...args);}; }
   let cursor=null, count=0;
   do{
    const page=await listGranularUnits('tmdb',40,cursor,f.db,{source:'manual',status:'active'});
    for(const row of page.rows)assert.equal(row.id,id(++count));
    cursor=page.next;
   }while(cursor);
   assert.equal(count,size);assert.equal(queries,2*Math.ceil(size/40));
   const perPage=queries;queries=0;
   assert.deepEqual(await listGranularCountsWithDb(f.db,['tmdb','multi','mu']),{});
   assert.equal(queries,1);
   if(size>=501){
    const selection=Array.from({length:501},(_,i)=>({unitId:id(i+1),marked:true,consumedOn:null,expectedRevision:null}));
    const [first,last]=partitionGranularSelection(selection);
    assert.deepEqual([first.length,last.length],[500,1]);
    await setGranularDecisions('tmdb',0,first,f.db,10);
    await assert.rejects(setGranularDecisions('tmdb',1,last,f.db,10,async()=>{throw Error('cambió la fecha');}),/cambió la fecha/);
    assert.deepEqual(await listGranularCountsWithDb(f.db,['tmdb','mu']),{tmdb:500});
    assert.equal((await listGranularUnits('tmdb',40,null,f.db,{status:'pending'})).rows[0].id,id(501));
   }
   console.log(`${size} unidades: ${perPage} consultas de paginación, 1 consulta agregada para tres títulos.`);
  }finally{f.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

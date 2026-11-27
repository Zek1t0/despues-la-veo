const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fixture, createV6 } = require('../enriched-media-metadata/sqlite-fixtures.cjs');
const { evolveDatabaseSchema } = require('../../../src/storage/databaseSchema.ts');
const { setGranularEnabled, setGranularDecisions, listGranularUnits, retireGranularUnit } = require('../../../src/storage/granularRepo.ts');
const { downloadGranularGuide, downloadGranularGuideIndex, readGranularGuide, GUIDE_VALIDITY_MS } = require('../../../src/storage/granularInventory.ts');
const { previewManualRange, confirmManualRange } = require('../../../src/storage/granularManualInventory.ts');
const { parseSeasonIndex, parseSeasonGuide } = require('../../../src/providers/tmdb/tmdbGuide.ts');
const { TmdbError } = require('../../../src/providers/tmdb/tmdbErrors.ts');
const { libraryPresentationRevision } = require('../../../src/storage/libraryInvalidation.ts');
require('../../../src/storage/db.ts').initDb = async () => { throw Error('Solo bases TEST'); };
global.fetch = () => { throw Error('TEST sin red'); };

async function reviewSnapshots() {
  const f = fixture();
  const {db,sqlite} = f;
  const scope = {ownerId:'tmdb',seriesId:'1',language:'es-AR',season:0};
  const en = {...scope,language:'en-US'};
  const es1 = {...scope,season:1}, en1 = {...en,season:1};
  const rows = sql => sqlite.prepare(sql).all();
  const decisions = () => rows('SELECT * FROM granular_decisions ORDER BY unit_id');
  const ep = (id,season,number) => ({id,season_number:season,episode_number:number});
  let time = 100, seasons = [[ep(90,0,1),ep(91,0,2)],[ep(92,1,1)]], fail = false;
  const load = (target, tested = false) => downloadGranularGuide(target,new AbortController().signal,{
    db, now:()=>time, ...(tested ? {validatedContract:true} : {}),
    fetch:async path => {
      if (path==='/tv/1') return {id:1,seasons:seasons.map((episodes,n)=>({id:80+n,season_number:n,episode_count:episodes.length}))};
      if (fail) throw new TmdbError('rate-limited',{status:429});
      return {id:80+target.season,season_number:target.season,episodes:seasons[target.season].map(
        episode=>({...episode,name:target.language+' '+episode.id}))};
    }
  });
  const read = (target=scope) => readGranularGuide(target,db,time);
  try {
    createV6(f);
    await evolveDatabaseSchema(db,6);
    await load(scope);
    const first = await read();
    assert.equal(first.status,'partial');
    const revision = (await listGranularUnits(scope.ownerId,5,null,db)).revision;
    await setGranularDecisions(scope.ownerId,revision,first.snapshot.members.map((m,i)=>({
      unitId:m.unitId,expectedRevision:null,marked:i===0,consumedOn:null
    })),db,time);
    const marks = decisions();
    fail = true;
    await assert.rejects(load(scope),e=>e.status===429);
    assert.equal((await read()).status,'stale');
    fail = false;
    time++;
    seasons[0].push(ep(93,0,3));
    await load(scope);
    const recovered = await read();
    assert.equal(recovered.status,'partial');
    assert.equal(recovered.checkedAt,time);
    assert.deepEqual(recovered.snapshot.members.map(m=>m.id),['90','91','93']);
    assert.deepEqual(recovered.snapshot.members.slice(0,2),first.snapshot.members);
    assert.deepEqual(decisions(),marks);
    time++;
    seasons[0].push(ep(94,0,2));
    await load(scope);
    const contradiction = await read();
    assert.deepEqual(contradiction.snapshot,recovered.snapshot);
    assert.equal(contradiction.checkedAt,recovered.checkedAt);
    assert.ok(contradiction.issues.length>0);
    seasons[0].pop();

    time+=GUIDE_VALIDITY_MS;
    await load(scope,true);
    await load(en,true);
    await load(es1,true);
    await load(en1,true);
    const english = await read(en);
    assert.equal(english.status,'accredited');
    assert.equal((await read()).status,'accredited'); // Only the translated labels changed.

    seasons[0].push(ep(94,0,4));
    await load(scope); // Partial data can add a unit but cannot accredit it.
    const obsolete = await read(en);
    assert.equal(obsolete.status,'stale');
    assert.equal(obsolete.revision,english.revision+1);
    assert.deepEqual(obsolete.snapshot,english.snapshot);
    assert.equal((await read(en1)).status,'accredited');

    time+=GUIDE_VALIDITY_MS;
    await load(scope,true); await load(en,true);
    await load(es1,true); await load(en1,true);
    const oldSnapshots = rows('SELECT * FROM granular_guide_snapshots ORDER BY language,season');
    const oldUnits = rows('SELECT * FROM granular_units ORDER BY id');
    const oldNotice = libraryPresentationRevision();
    seasons[0].shift();
    seasons[1].push(ep(90,1,2));
    time+=GUIDE_VALIDITY_MS;
    const run = db.runAsync;
    db.runAsync = (sql,...args) => {
      if (sql.startsWith('INSERT INTO granular_guide_snapshots')) throw Error('TEST rollback idiomas');
      return run(sql,...args);
    };
    try { await assert.rejects(load(es1,true),/rollback idiomas/); } finally { db.runAsync = run; }
    assert.deepEqual(rows('SELECT * FROM granular_guide_snapshots ORDER BY language,season'),oldSnapshots);
    assert.deepEqual(rows('SELECT * FROM granular_units ORDER BY id'),oldUnits);
    assert.equal(libraryPresentationRevision(),oldNotice);
    await load(es1,true);
    assert.equal((await read(es1)).snapshot.members[1].unitId,first.snapshot.members[0].unitId);
    for (const [target,language,season] of [[scope,'es-AR',0],[en,'en-US',0],[en1,'en-US',1]]) {
      assert.equal((await read(target)).status,'stale');
      assert.equal(sqlite.prepare('SELECT status FROM granular_guide_snapshots WHERE language=? AND season=?').get(language,season).status,'stale');
    }
    await load(en1,true);
    assert.equal((await read(es1)).status,'accredited'); // Same membership in English.
    seasons[1].shift();
    time+=GUIDE_VALIDITY_MS;
    await load(es1,true);
    assert.equal(sqlite.prepare("SELECT status FROM granular_guide_snapshots WHERE language='en-US' AND season=1").get().status,'stale');
    assert.equal((await read(en1)).snapshot.members.length,2);
    assert.equal(sqlite.prepare("SELECT retired FROM granular_units WHERE id=?").get(
      oldUnits.find(unit=>JSON.parse(unit.coordinate).season===1).id).retired,1);
    assert.deepEqual(decisions(),marks);
    console.log('PASS S2 revisión: recuperación parcial, coherencia entre idiomas y rollback.');
  } finally { f.close(); }
}
async function main() {
  const f = fixture();
  const { sqlite, db } = f;
  const query = (sql,...params) => sqlite.prepare(sql).all(...params);
  const dump = (filter = '1') => Object.fromEntries(query(`SELECT name FROM sqlite_master WHERE type='table' AND ${filter}`)
    .map(({name})=>[name,query(`SELECT * FROM ${name} ORDER BY 1`)]));
  try {
    createV6(f);
    await evolveDatabaseSchema(db,6);
    await db.runAsync("INSERT INTO personal_title_progress VALUES ('tmdb',1,'season-episode',3,10,NULL,NULL,15)");
    const historical = dump("name NOT GLOB 'granular_*'");
    const t0={ownerId:'tmdb',seriesId:'1',language:'es-AR',season:0}, t1={...t0,season:1};
    let clock=100, calls=[], airDate='2024-02-29', indexCount=2, error=null, suspend=null;
    let zero=[{id:70,show_id:1,episode_number:1,season_number:0,air_date:airDate},
      {id:71,show_id:1,episode_number:2,season_number:0,overview:'TEST',runtime:20,still_path:'/unit.jpg'}];
    let one=[{id:72,season_number:1,episode_number:1}];
    const fetch = async route => {
      calls.push(route);
      if (route==='/tv/1') return {id:1,seasons:[{id:40,season_number:0,episode_count:indexCount},{id:41,season_number:1,episode_count:one.length}]};
      if(error) throw error;
      if(suspend) await suspend;
      const season=Number(route.split('/').at(-1));
      return {id:40+season,season_number:season,episodes:season===0?zero:one};
    };
    const options={db,fetch,validatedContract:true,now:()=>clock};
    const signal=()=>new AbortController().signal;
    const load=(scope=t0,aborted=signal())=>downloadGranularGuide(scope,aborted,options);
    const read=(scope=t0,now=clock)=>readGranularGuide(scope,db,now);
    assert.throws(()=>parseSeasonIndex({id:1,seasons:[{id:0,season_number:0}]},'1'));
    for(const invalid of [{...zero[0],id:0},{...zero[0],show_id:2},{...zero[0],season_number:1}]) {
      assert.equal(parseSeasonGuide({id:40,season_number:0,episodes:[invalid]},'1',0).issues.length,1);
    }
    await Promise.all([load(),load()]);
    assert.deepEqual(calls,['/tv/1','/tv/1/season/0']);
    let first=await read();
    assert.equal(first.status,'accredited');
    assert.equal(first.snapshot.members[0].airDate,airDate);
    assert.equal(first.snapshot.members[0].runtime,null);
    assert.equal(first.snapshot.members[1].image,'/unit.jpg');
    const [a,b]=first.snapshot.members.map(x=>x.unitId);
    const revision=async()=> (await listGranularUnits('tmdb',1,null,db)).revision;
    await setGranularDecisions('tmdb',await revision(),[{unitId:a,expectedRevision:null,marked:true,consumedOn:null},
      {unitId:b,expectedRevision:null,marked:false,consumedOn:null}],db,100);
    const marks=query('SELECT * FROM granular_decisions ORDER BY unit_id');
    const notice=libraryPresentationRevision();
    await load();
    assert.equal(libraryPresentationRevision(),notice);
    assert.equal((await read()).revision,first.revision);
    assert.equal((await read(t0,99)).status,'stale');
    assert.equal((await read(t0,100+GUIDE_VALIDITY_MS)).status,'stale');

    error=new TmdbError('rate-limited',{status:429,retryAfterMs:1000});
    await assert.rejects(load(),e=>e.status===429);
    assert.equal((await read()).status,'stale');
    assert.deepEqual((await read()).snapshot,first.snapshot);
    error=null;
    const baseZero=zero;
    zero=[zero[0],{...zero[1],episode_number:1}];
    await load();
    assert.equal((await read()).status,'partial');
    assert.equal(query('SELECT * FROM granular_units WHERE retired=1').length,0);
    zero=[{...baseZero[0],episode_number:3},baseZero[1]];
    await load();
    assert.equal((await read()).snapshot.members[0].unitId,a);
    assert.equal((await read()).snapshot.members[0].number,3);
    error=new TmdbError('http',{status:404});
    await assert.rejects(load(),e=>e.status===404);
    assert.equal((await read()).status,'stale');
    assert.equal(query('SELECT * FROM granular_units WHERE retired=1').length,0);
    error=null;
    assert.match(parseSeasonGuide({id:40,season_number:0,episodes:zero,total_pages:2},'1',0).issues[0],/paginada/);
    assert.deepEqual(query('SELECT * FROM granular_decisions ORDER BY unit_id'),marks);

    clock+=GUIDE_VALIDITY_MS;
    zero=[zero[0]]; indexCount=1;
    one=[{id:71,season_number:1,episode_number:1},{id:72,season_number:1,episode_number:2}];
    await load(t1);
    assert.equal((await read(t1)).snapshot.members[0].unitId,b);
    assert.equal((await read()).status,'stale');
    await load();
    assert.equal((await read()).status,'accredited');
    assert.equal(query('SELECT retired FROM granular_units WHERE id=?',b)[0].retired,0);

    clock+=GUIDE_VALIDITY_MS;
    indexCount=0; zero=[];
    const before=dump(), beforeNotice=libraryPresentationRevision();
    const run=db.runAsync;
    db.runAsync=(sql,...args)=>{ if(sql.startsWith('INSERT INTO granular_guide_snapshots')) throw Error('TEST rollback inventario'); return run(sql,...args); };
    try { await assert.rejects(load(),/rollback inventario/); } finally { db.runAsync=run; }
    assert.deepEqual(dump(),before);
    assert.equal(libraryPresentationRevision(),beforeNotice);
    await load();
    assert.equal(query('SELECT retired FROM granular_units WHERE id=?',a)[0].retired,1);
    assert.deepEqual(query('SELECT * FROM granular_decisions ORDER BY unit_id'),marks);

    let resume;
    suspend=new Promise(resolve=>{resume=resolve;});
    const controller=new AbortController();
    calls=[];
    const aborted=load(t1,controller.signal);
    while(calls.length===0) await new Promise(resolve=>setImmediate(resolve));
    await assert.rejects(load(t0),/descarga activa/);
    const beforeCancel=dump();
    controller.abort();resume();
    await assert.rejects(aborted,e=>e.kind==='aborted');
    assert.deepEqual(dump(),beforeCancel);
    suspend=new Promise(resolve=>{resume=resolve;});
    calls=[];
    const stale=load(t1);
    while(calls.length===0) await new Promise(resolve=>setImmediate(resolve));
    sqlite.exec("DELETE FROM media_provider_references WHERE saved_title_id='tmdb'");
    resume();
    await assert.rejects(stale,/referencia TMDB/);
    assert.equal((await read(t1)).status,'stale');
    sqlite.exec("INSERT INTO media_provider_references VALUES ('tmdb','tv','1','tmdb')");
    const selection = historical.media_metadata_selection?.find(row=>row.saved_title_id==='tmdb');
    // Removing a reference also cascades the existing metadata selection. Reinsert the fixture row.
    if (selection) {
      const columns = Object.keys(selection);
      await db.runAsync(`INSERT INTO media_metadata_selection (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,...Object.values(selection));
    }
    suspend=null;

    const priorUnits = query('SELECT * FROM granular_units ORDER BY id');
    const fixtureCollision = {...t1,language:'fr-FR'};
    const oldOne=one;
    one=[...one,{id:73,season_number:1,episode_number:3}];
    await assert.rejects(downloadGranularGuide(fixtureCollision,signal(),{
      ...options, uuid:()=>a
    }),/identidad o revisión/);
    assert.deepEqual(query('SELECT * FROM granular_units ORDER BY id'),priorUnits);
    const fallback=await read(fixtureCollision);
    assert.equal(fallback.snapshot,null);assert.equal(fallback.indexCheckedAt,null);assert.equal(fallback.status,"partial");
    assert.ok(fallback.index.every(entry=>entry.count===null));
    one=oldOne;

    // A cached guide can be read and marked after expiry without a remote call.
    const activeMember=(await read(t1)).snapshot.members.find(member=>member.id==='72').unitId;
    const requestsBeforeOffline=calls.length;
    await setGranularDecisions('tmdb',await revision(),[{unitId:activeMember,expectedRevision:null,marked:true,consumedOn:null}],db,clock+GUIDE_VALIDITY_MS);
    assert.equal(calls.length,requestsBeforeOffline);

    const uncached={...t1,language:'en-US'};
    calls=[];
    await downloadGranularGuideIndex(uncached,signal(),options);
    await downloadGranularGuide(uncached,signal(),{...options,validatedContract:false});
    assert.deepEqual(calls,['/tv/1','/tv/1/season/1']);
    assert.equal((await read(uncached)).status,'partial');

    await setGranularEnabled('mu',0,true,db);
    const range={ownerId:'mu',groupId:null,mode:'chapter',first:1,last:200};
    await assert.rejects(previewManualRange({...range,last:201},db),/200/);
    const initial=await previewManualRange(range,db);
    assert.equal(initial.newCount,200);
    const ids=await confirmManualRange(initial,false,db,randomUUID);
    assert.equal(ids.length,200);
    assert.equal(query("SELECT * FROM granular_decisions WHERE owner_id='mu'").length,0);
    const overlapping={...range,first:199,last:202};
    const old=await previewManualRange(overlapping,db);
    assert.equal(old.newCount,2);
    await retireGranularUnit('mu',ids[199],true,old.revision,db);
    await assert.rejects(confirmManualRange(old,true,db),/cambió/);
    const overlap=await previewManualRange(overlapping,db);
    assert.equal(overlap.entries[1].matches[0].retired,1);
    await assert.rejects(confirmManualRange(overlap,false,db),/omitir/);
    let sequence=0;
    const beforeRange=dump(), rangeNotice=libraryPresentationRevision();
    await assert.rejects(confirmManualRange(overlap,true,db,()=> ++sequence===2 ? ids[0] : randomUUID()),/UNIQUE/);
    assert.deepEqual(dump(),beforeRange);
    assert.equal(libraryPresentationRevision(),rangeNotice);
    assert.equal((await confirmManualRange(overlap,true,db)).length,2);
    assert.equal(query('SELECT retired FROM granular_units WHERE id=?',ids[199])[0].retired,1);
    assert.deepEqual(dump("name NOT GLOB 'granular_*'"),historical);
    assert.deepEqual(query('PRAGMA foreign_key_check'),[]);
    // An intermediate S1-style v10 is not silently repaired.
    sqlite.exec('DROP TABLE granular_guide_snapshots; DROP TABLE granular_guide_indices;');
    await assert.rejects(evolveDatabaseSchema(db,10),/no coincide con SQLite v10/);
    assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version,10);
    console.log('PASS S2: inventario TMDB simulado, revisión y retiro, admisión, cancelación, rollback y rangos manuales.');
  } finally { f.close(); }
}
main().then(reviewSnapshots).catch(error=>{console.error(error);process.exitCode=1;});

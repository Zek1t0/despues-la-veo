const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {fixture, createV6} = require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema = require('../../../src/storage/databaseSchema.ts');
const metadataSchema = require('../../../src/storage/mediaMetadataSchema.ts');
const organizationSchema = require('../../../src/storage/organizationSchema.ts');
const domain = require('../../../src/core/personalProgress.ts');
const repo = require('../../../src/storage/personalProgressRepo.ts');
const manual = require('../../../src/storage/manualContentEntries.ts');
const {getSavedTitleWithReferencesByIdWithDb: readTitle} = require('../../../src/storage/savedTitleStorage.ts');
const {subscribeLibraryInvalidation} = require('../../../src/storage/libraryInvalidation.ts');
const {getLibraryScreenSnapshot} = require('../../../src/storage/libraryScreenSnapshot.ts');
const {getTitleDetailPinSnapshot} = require('../../../src/storage/titleDetailPinSnapshot.ts');
const {getOrganizationSnapshot} = require('../../../src/storage/organizationSnapshot.ts');
const {deleteSavedTitle} = require('../../../src/storage/savedTitlesRepo.ts');
const dbModule = require('../../../src/storage/db.ts');
dbModule.initDb = async () => { throw Error('TEST forbids personal database initialization'); };
global.fetch = () => { throw Error('TEST forbids network'); };
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'TEST-dlv-progress-S1-'));
const files = [], results = []; let serial = 0;
function fresh(file = path.join(root, `TEST-${++serial}.sqlite`)) { const f=fixture(file);files.push(f);return f; }
function snapshot(f) { return Object.fromEntries(f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,f.sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all()])); }
const withoutProgress = f => { const value=snapshot(f);delete value.personal_title_progress;return value; };
const classification = title => ({medium:title.medium,contentFamily:title.contentFamily,primaryFormat:title.primaryFormat});
async function intent(f,id,position) { return {itemId:id,expected:await repo.getPersonalProgressWithDb(f.db,id),expectedClassification:classification(await readTitle(f.db,id)),position}; }
async function set(f,id,position,now=100) { return repo.setPersonalProgress(await intent(f,id,position),f.db,now); }
async function v8(f) {
  createV6(f);
  await f.db.withTransactionAsync(async()=>{
    await metadataSchema.createMetadataSchemaWithDb(f.db);await metadataSchema.backfillMetadataBaselinesWithDb(f.db);
    await organizationSchema.createOrganizationSchemaWithDb(f.db);
    await f.db.runAsync("INSERT INTO personal_collections VALUES ('TEST-c','TEST collection','TEST desc',1,2)");
    await f.db.runAsync("INSERT INTO collection_memberships VALUES ('TEST-c','manual',3,4)");
    await f.db.runAsync(`INSERT INTO recommendation_inbox (id,original_capture_json,capture_kind,name,person,comment,status,linked_saved_title_id,created_at,updated_at)
      VALUES ('TEST-r','{"name":"TEST recommendation"}','name','TEST recommendation','TEST person','TEST context','incorporated','manual',5,6)`);
    await f.db.execAsync('PRAGMA user_version=8');
  });
}
async function test(name,run) { await run();results.push({name,status:'PASS'});console.log('PASS',name); }
function failCommit(f) { const tx=f.db.withTransactionAsync; f.db.withTransactionAsync=task=>tx(async()=>{await task();throw Error('TEST commit failure');}); return ()=>{f.db.withTransactionAsync=tx}; }
(async()=>{
 try {
  await test('domain: variants, exact decimals, bounds, Unicode and invalid shapes',async()=>{
    for(const [input,output] of [['042,500','42.5'],['000','0'],['999999.999999','999999.999999'],['0.000001','0.000001'],[' 001.0200 ','1.02']]) assert.equal(domain.canonicalChapter(input),output);
    for(const input of ['',1,null,'-1','+1','1e3','1.0000000','1000000','1,234.5','1 000','NaN','Infinity','0.0000001']) assert.throws(()=>domain.canonicalChapter(input));
    for(const value of [{mode:'episode',episode:0},{mode:'episode',episode:999999},{mode:'season-episode',season:0,episode:0},{mode:'season-episode',season:9999,episode:999999},{mode:'chapter',chapter:'42.5'},{mode:'special',label:'日本語 🐱'},{mode:'special',label:'🐱'.repeat(120)},null]) assert.deepEqual(domain.parseProgressPosition(value),value);
    for(const value of [undefined,[],{}, {mode:'episode',episode:1,season:2},{mode:'episode',episode:NaN},{mode:'episode',episode:Infinity},{mode:'episode',episode:1.5},{mode:'season-episode',episode:2},{mode:'chapter',chapter:42.5},{mode:'chapter',chapter:'042.5'},{mode:'chapter',chapter:'42.50'},{mode:'special',label:'x'.repeat(121)},{mode:'special',label:' a'},{mode:'special',label:'a\u0085b'},{mode:'special',label:'a\u2028b'},{mode:'special',label:'\ud800'},{mode:'special',label:'a\0b'}]) assert.throws(()=>domain.parseProgressPosition(value));
    for(const updatedAt of [-1,Infinity,NaN,1.5,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>domain.parsePersonalProgress({version:1,itemId:'TEST',position:null,updatedAt}));
    assert.throws(()=>domain.parsePersonalProgress({version:1,itemId:' ',position:null,updatedAt:1}));
    assert.throws(()=>domain.parsePersonalProgress({version:2,itemId:'TEST',position:null,updatedAt:1}));
    assert.deepEqual(domain.nextProgressEpisode({mode:'season-episode',season:2,episode:12}),{mode:'season-episode',season:2,episode:13});
    for(const p of [null,{mode:'chapter',chapter:'42.5'},{mode:'special',label:'TEST'},{mode:'episode',episode:999999}])assert.equal(domain.nextProgressEpisode(p),null);
    for(const [c,expected] of [[{medium:'audiovisual',contentFamily:null,primaryFormat:'tv'},'offered'],[{medium:'audiovisual',contentFamily:'anime',primaryFormat:'ova'},'explicit'],[{medium:'audiovisual',contentFamily:'anime',primaryFormat:'movie'},'none'],[{medium:'comic',contentFamily:'manga',primaryFormat:null},'explicit'],[{medium:'comic',contentFamily:'manhwa',primaryFormat:'webtoon'},'offered'],[{medium:'comic',contentFamily:'manhua',primaryFormat:'one-shot'},'none'],[{medium:'literature',contentFamily:null,primaryFormat:'novel'},'none']])assert.equal(domain.progressEligibility(c),expected);
  });
  let copied;
  await test('migration: actual mixed v8 backup copy, v9 preservation and reopen',async()=>{
    const source=fresh();await v8(source);const before=snapshot(source);
    source.sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)');source.close();source.closed=true;
    copied=path.join(root,'TEST-v8-before-migration.sqlite');fs.copyFileSync(source.file,copied);
    results.push({name:'isolated v8 backup',file:copied,sha256:crypto.createHash('sha256').update(fs.readFileSync(copied)).digest('hex')});
    const f=fresh(source.file);await schema.evolveDatabaseSchema(f.db,8);
    assert.equal(await schema.readUserVersion(f.db),9);assert.deepEqual(withoutProgress(f),before);
    assert.deepEqual(snapshot(f).personal_title_progress,[]);
    const stable=snapshot(f);await schema.evolveDatabaseSchema(f.db,9);assert.deepEqual(snapshot(f),stable);
    const saved=await set(f,'mu',{mode:'chapter',chapter:'42.5'});f.close();f.closed=true;
    const reopened=fresh(f.file);await schema.evolveDatabaseSchema(reopened.db,9);assert.deepEqual(await repo.getPersonalProgressWithDb(reopened.db,'mu'),saved);
    assert.deepEqual(withoutProgress(reopened),before);
  });
  await test('migration: empty, v3/v4/v6 chain, future and corrupted schema',async()=>{
    const empty=fresh();await schema.evolveDatabaseSchema(empty.db,0);assert.equal(await schema.readUserVersion(empty.db),9);
    const six=fresh();createV6(six);const before=snapshot(six);await schema.evolveDatabaseSchema(six.db,6);for(const [name,rows]of Object.entries(before))assert.deepEqual(snapshot(six)[name],rows,name);
    for(const version of [3,4]) {
      const old=fresh();
      if(version===3)old.sqlite.exec(schema.LIBRARY_SCHEMA_SQL);
      else old.sqlite.exec(schema.SAVED_TITLES_V4_TABLE_SQL);
      old.sqlite.exec(schema.APP_PREFERENCES_TABLE_SQL+schema.TITLE_PINS_TABLE_SQL+schema.TITLE_PINS_CONTEXT_INDEX_SQL);
      if(version===4)old.sqlite.exec(schema.MEDIA_PROVIDER_REFERENCES_TABLE_SQL+schema.MEDIA_PROVIDER_REFERENCES_SAVED_TITLE_INDEX_SQL+schema.LEGACY_SAVED_TITLE_IDENTITIES_TABLE_SQL+schema.LEGACY_SAVED_TITLE_IDENTITIES_SAVED_TITLE_INDEX_SQL);
      if(version===3)old.sqlite.prepare('INSERT INTO saved_titles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('TEST-old','tmdb','23','tv','TEST historical',2000,null,'TEST overview',8,85,'["Drama"]','watching','["mine"]','TEST notes',10,20);
      else {old.sqlite.prepare('INSERT INTO saved_titles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('TEST-old','tv','TEST historical',2000,null,'TEST overview',8,85,'["Drama"]','watching','["mine"]','TEST notes',10,20);old.sqlite.exec("INSERT INTO media_provider_references VALUES ('tmdb','tv','23','TEST-old')");}
      old.sqlite.exec(`PRAGMA user_version=${version}`);await schema.evolveDatabaseSchema(old.db,version);
      const title=await readTitle(old.db,'TEST-old');assert.equal(title.notes,'TEST notes');assert.equal(title.updatedAt,20);assert.equal(title.status,'watching');assert.equal(title.personalRating,85);assert.equal(title.providerReferences[0].externalId,'23');assert.equal(await repo.getPersonalProgressWithDb(old.db,'TEST-old'),null);
    }
    const future=fresh();future.sqlite.exec('PRAGMA user_version=10');const beforeFuture=snapshot(future);await assert.rejects(schema.evolveDatabaseSchema(future.db,10));assert.deepEqual(snapshot(future),beforeFuture);assert.equal(await schema.readUserVersion(future.db),10);
    empty.sqlite.exec('DROP TABLE personal_title_progress');await assert.rejects(schema.evolveDatabaseSchema(empty.db,9));
  });
  await test('migration: all v9 failure hooks and final commit roll back exact data/schema',async()=>{
    for(const hook of ['afterV9TableCreated','beforeVersion9Published','afterVersion9Published','commit']) {
      const f=fresh();await v8(f);const before=snapshot(f),definition=f.sqlite.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all();
      const restore=hook==='commit'?failCommit(f):()=>{};
      await assert.rejects(schema.evolveDatabaseSchema(f.db,8,hook==='commit'?{}:{[hook]:()=>{throw Error('TEST injected')}}));restore();
      assert.deepEqual(snapshot(f),before);assert.deepEqual(f.sqlite.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all(),definition);assert.equal(await schema.readUserVersion(f.db),8);
    }
  });
  const f=fresh();await v8(f);await schema.evolveDatabaseSchema(f.db,8);
  await test('repository: corrections, reset, zero, own clock and no incidental changes',async()=>{
    const before=withoutProgress(f);assert.equal(await repo.getPersonalProgressWithDb(f.db,'manual'),null);
    let p=await set(f,'manual',{mode:'episode',episode:20},100);assert.equal(p.updatedAt,100);
    p=await set(f,'manual',{mode:'episode',episode:8},10);assert.equal(p.updatedAt,101);
    p=await set(f,'manual',{mode:'episode',episode:0},10);assert.equal(p.position.episode,0);
    p=await set(f,'manual',{mode:'season-episode',season:0,episode:9},10);
    assert.deepEqual((await repo.getPersonalProgressWithDb(f.db,'manual')).position,{mode:'season-episode',season:0,episode:9});
    assert.equal(f.sqlite.prepare("SELECT season FROM personal_title_progress WHERE saved_title_id='manual'").get().season,0);
    p=await set(f,'manual',{mode:'special',label:'日本語 🐱'},10);
    assert.equal(f.sqlite.prepare("SELECT label FROM personal_title_progress WHERE saved_title_id='manual'").get().label,'日本語 🐱');
    p=await set(f,'manual',null,10);assert.equal(p.position,null);
    assert.deepEqual(await set(f,'manual',null,500),p);
    const freshReset=await set(f,'tmdb',null,50);assert.ok(freshReset);assert.equal(freshReset.position,null);
    await set(f,'mu',{mode:'chapter',chapter:'999999.999999'});assert.deepEqual(withoutProgress(f),before);
    assert.equal(f.sqlite.prepare("SELECT typeof(chapter) type,chapter FROM personal_title_progress WHERE saved_title_id='mu'").get().type,'text');
    await assert.rejects(set(f,'mu',{mode:'episode',episode:1}));
  });
  await test('concurrency: same intent twice, competing targets, stale bases/classification, clocks',async()=>{
    let notices=[];const stop=subscribeLibraryInvalidation(v=>notices.push(v));
    const command=await intent(f,'kitsu',{mode:'episode',episode:1});const [a,b]=await Promise.all([repo.setPersonalProgress(command,f.db,100),repo.setPersonalProgress(command,f.db,100)]);assert.deepEqual(a,b);assert.equal(notices.length,1);
    const base=await intent(f,'kitsu',{mode:'episode',episode:2});const race=await Promise.allSettled([repo.setPersonalProgress(base,f.db,101),repo.setPersonalProgress({...base,position:{mode:'episode',episode:9}},f.db,102)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected').length,1);
    await assert.rejects(repo.setPersonalProgress({...base,position:{mode:'episode',episode:0}},f.db));
    const stale=await intent(f,'kitsu',{mode:'episode',episode:3});f.sqlite.exec("UPDATE saved_titles SET primary_format='ova' WHERE id='kitsu'");await assert.rejects(repo.setPersonalProgress(stale,f.db),repo.ProgressConflict);f.sqlite.exec("UPDATE saved_titles SET primary_format='tv' WHERE id='kitsu'");
    const current=await repo.getPersonalProgressWithDb(f.db,'kitsu');await assert.rejects(repo.setPersonalProgress({...await intent(f,'kitsu',{mode:'episode',episode:3}),expected:{...current,updatedAt:0}},f.db));
    await set(f,'multi',{mode:'episode',episode:1},Number.MAX_SAFE_INTEGER);await assert.rejects(set(f,'multi',{mode:'episode',episode:2},0));assert.equal((await repo.getPersonalProgressWithDb(f.db,'multi')).position.episode,1);
    const before=snapshot(f),n=notices.length,restore=failCommit(f);await assert.rejects(set(f,'kitsu',{mode:'episode',episode:3}));restore();assert.deepEqual(snapshot(f),before);assert.equal(notices.length,n);
    const run=f.db.runAsync;f.db.runAsync=async()=>{throw Error('TEST write failure')};await assert.rejects(set(f,'kitsu',{mode:'episode',episode:3}));f.db.runAsync=run;assert.deepEqual(snapshot(f),before);assert.equal(notices.length,n);stop();
  });
  await test('snapshots: atomic read transaction, batch queries, unknown read distinguished',async()=>{
    const calls=[];const all=f.db.getAllAsync,tx=f.db.withTransactionAsync;let inside=false;
    f.db.withTransactionAsync=task=>tx(async()=>{assert.equal(inside,false);inside=true;try{return await task()}finally{inside=false}});
    f.db.getAllAsync=async(sql,...params)=>{if(sql.includes('FROM personal_title_progress')){assert.ok(inside);calls.push(sql)}return all(sql,...params)};
    const library=await getLibraryScreenSnapshot(f.db),organization=await getOrganizationSnapshot(f.db),detail=await getTitleDetailPinSnapshot('kitsu',{},f.db);
    assert.equal(calls.length,2);assert.deepEqual(library.progressById.kitsu,detail.progress);assert.deepEqual(organization.progressById,library.progressById);assert.equal(detail.progressReadError,null);
    f.db.getAllAsync=all;f.db.withTransactionAsync=tx;
    let queries=0;const readDb={...f.db,getAllAsync:async(...args)=>{queries++;return all(...args)}};
    const ids=Array.from({length:1001},(_,i)=>`TEST-missing-${i}`);ids.push('kitsu');const values=await repo.listPersonalProgressWithDb(readDb,ids);assert.equal(queries,3);assert.equal(values.kitsu.itemId,'kitsu');await repo.listPersonalProgressWithDb(readDb,[]);assert.equal(queries,3);
    const first=f.db.getFirstAsync;f.db.getFirstAsync=async(sql,...params)=>{if(sql.includes('FROM personal_title_progress'))throw Error('TEST read failure');return first(sql,...params)};
    const failed=await getTitleDetailPinSnapshot('kitsu',{},f.db);assert.equal(failed.progress,null);assert.ok(failed.progressReadError);assert.ok(failed.item);f.db.getFirstAsync=first;
    f.db.getAllAsync=async(sql,...params)=>{if(sql.includes('FROM personal_title_progress'))throw Error('TEST read failure');return all(sql,...params)};
    for(const result of [await getLibraryScreenSnapshot(f.db),await getOrganizationSnapshot(f.db)]){assert.equal(result.progressById,null);assert.ok(result.progressReadError);assert.ok(result.items.length)}f.db.getAllAsync=all;
  });
  await test('manual: compatible preserve, incompatible require/cancel/preserve/reset, stale/rollback',async()=>{
    let p=await set(f,'manual',{mode:'episode',episode:12},200);const title=await readTitle(f.db,'manual');
    const input={title:title.title,medium:title.medium,contentFamily:title.contentFamily,primaryFormat:'tv',year:title.year,overview:title.overview};
    await manual.saveManualContent(input,'manual',f.db);assert.deepEqual(await repo.getPersonalProgressWithDb(f.db,'manual'),p);
    const comic={...input,medium:'comic',contentFamily:'manga',primaryFormat:null};const before=snapshot(f);
    await assert.rejects(manual.saveManualContent(comic,'manual',f.db),manual.ManualProgressDecisionRequired);assert.deepEqual(snapshot(f),before);
    const decision={expected:p,expectedClassification:classification(await readTitle(f.db,'manual')),action:'cancel'};
    await assert.rejects(manual.saveManualContent(comic,'manual',f.db,decision));assert.deepEqual(snapshot(f),before);
    await manual.saveManualContent(comic,'manual',f.db,{...decision,action:'preserve'});assert.deepEqual(await repo.getPersonalProgressWithDb(f.db,'manual'),p);assert.equal((await readTitle(f.db,'manual')).medium,'comic');
    await assert.rejects(manual.saveManualContent(comic,'manual',f.db,{...decision,action:'reset'}),repo.ProgressConflict);
    const reset={expected:p,expectedClassification:classification(await readTitle(f.db,'manual')),action:'reset'};
    const beforeFail=snapshot(f),restore=failCommit(f);await assert.rejects(manual.saveManualContent(comic,'manual',f.db,reset));restore();assert.deepEqual(snapshot(f),beforeFail);
    await manual.saveManualContent(comic,'manual',f.db,reset);const cleared=await repo.getPersonalProgressWithDb(f.db,'manual');assert.equal(cleared.position,null);assert.ok(cleared.updatedAt>p.updatedAt);
    const after=await readTitle(f.db,'manual');for(const key of ['id','manualIdentity','createdAt','status','notes','tags','personalRating'])assert.deepEqual(after[key],title[key],key);
  });
  await test('delete: progress/member cascade and Inbox original context survives; stale write fails',async()=>{
    const title=await readTitle(f.db,'manual'),request=await intent(f,'manual',{mode:'chapter',chapter:'1'}),original=f.sqlite.prepare("SELECT * FROM recommendation_inbox WHERE id='TEST-r'").get();
    const dbModule=require('../../../src/storage/db.ts');const oldInit=dbModule.initDb;dbModule.initDb=async()=>f.db;
    try {await deleteSavedTitle(title.id)}finally{dbModule.initDb=oldInit}
    assert.equal(await repo.getPersonalProgressWithDb(f.db,title.id),null);assert.equal(f.sqlite.prepare("SELECT * FROM collection_memberships WHERE saved_title_id='manual'").get(),undefined);
    const reopened=f.sqlite.prepare("SELECT * FROM recommendation_inbox WHERE id='TEST-r'").get();assert.equal(reopened.status,'pending');assert.equal(reopened.linked_saved_title_id,null);for(const key of ['original_capture_json','person','comment','name'])assert.equal(reopened[key],original[key]);assert.equal(f.sqlite.prepare("SELECT name FROM personal_collections WHERE id='TEST-c'").get().name,'TEST collection');
    await assert.rejects(repo.setPersonalProgress(request,f.db));assert.equal(await readTitle(f.db,'manual'),null);
  });
  await test('SQL defense: invalid union, range, orphan and corrupt canonical rows rejected',async()=>{
    for(const values of [['TEST-orphan',1,null,null,null,null,null,1],['kitsu',1,'episode',null,null,null,null,1],['kitsu',1,'episode',1,1,null,null,1],['kitsu',1,'chapter',null,null,'01',null,1],['kitsu',1,'episode',null,-1,null,null,1],['kitsu',1,'chapter',null,null,'1.0000001',null,1]])assert.throws(()=>f.sqlite.prepare('INSERT OR REPLACE INTO personal_title_progress VALUES (?,?,?,?,?,?,?,?)').run(...values));
    f.sqlite.exec("PRAGMA ignore_check_constraints=ON; UPDATE personal_title_progress SET label='bad' WHERE saved_title_id='kitsu'; PRAGMA ignore_check_constraints=OFF;");await assert.rejects(schema.evolveDatabaseSchema(f.db,9));f.sqlite.exec("UPDATE personal_title_progress SET label=NULL WHERE saved_title_id='kitsu'");
    for(const item of files)if(!item.closed)assert.deepEqual(await item.db.getAllAsync('PRAGMA foreign_key_check'),[]);
  });
  fs.writeFileSync(path.join(__dirname,'s1-results.json'),JSON.stringify({status:'PASS',sqlite:process.versions.sqlite,node:process.version,testRoot:root,results},null,2)+'\n');
 } finally {for(const f of files)if(!f.closed)f.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fixture, createV6, originalTables } = require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema = require('../../../src/storage/databaseSchema.ts');
const repo = require('../../../src/storage/granularRepo.ts');
const domain = require('../../../src/core/granularTracking.ts');
const progress = require('../../../src/storage/personalProgressRepo.ts');
const { libraryPresentationRevision } = require('../../../src/storage/libraryInvalidation.ts');
require('../../../src/storage/db.ts').initDb = async () => { throw Error('Solo bases TEST'); };
global.fetch = () => { throw Error('TEST sin red'); };
const fixtures = new Set();
function open(file) { const f = fixture(file); fixtures.add(f); return f; }
const evolve = (f, hooks) => schema.readUserVersion(f.db).then(v => schema.evolveDatabaseSchema(f.db, v, hooks));
const inspect = (f, sql, ...params) => f.sqlite.prepare(sql).all(...params);
const catalog = f => inspect(f, 'SELECT * FROM sqlite_master ORDER BY name');
const rows = f => Object.fromEntries(inspect(f, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB 'granular_*' ORDER BY name")
  .map(({name}) => [name, inspect(f, `SELECT * FROM ${name} ORDER BY 1`)]));
const season = episode => ({ mode:'season-episode', season:3, episode });
const chapter = chapter => ({ mode:'chapter', chapter });
const revision = async (f, owner) => (await repo.listGranularUnits(owner, 1, null, f.db)).revision;
async function add(f, ownerId, coordinate, extra = {}) {
  return repo.saveGranularUnit({ ownerId, id:randomUUID(), coordinate, groupId:null, label:null, ...extra }, await revision(f,ownerId), f.db);
}

async function verifyDatedRetry(f, unitId) {
  const read = () => inspect(f,'SELECT * FROM granular_decisions WHERE unit_id=?',unitId);
  const before = read();
  const listRevision = await revision(f,'tmdb');
  const invalidation = libraryPresentationRevision();
  const earlier = new Date(2024,1,28,12).valueOf();
  const retry = {unitId,expectedRevision:1,marked:true,consumedOn:'2024-02-29'};
  const run = f.db.runAsync;
  f.db.runAsync = () => { throw Error('TEST: a dated retry must not write'); };
  try {
    await repo.setGranularDecisions('tmdb',listRevision-1,[retry],f.db,earlier);
    await assert.rejects(repo.setGranularDecisions('tmdb',listRevision,
      [{...retry,expectedRevision:before[0].revision,consumedOn:'2024-03-01'}],f.db,earlier),/futura/);
    await assert.rejects(repo.setGranularDecisions('tmdb',listRevision,
      [{...retry,expectedRevision:before[0].revision,consumedOn:'2025-02-29'}],f.db,earlier),/inválida/);
  } finally { f.db.runAsync = run; }
  assert.deepEqual(read(),before);
  assert.equal(await revision(f,'tmdb'),listRevision);
  assert.equal(libraryPresentationRevision(),invalidation);
}

async function verifyBatchBoundary(f) {
  const owner = 'multi';
  const ids = Array.from({length:501},()=>randomUUID());
  for (const [episode,id] of ids.entries()) await add(f,owner,season(episode),{id});
  const initialRevision = await revision(f,owner);
  const initialNotice = libraryPresentationRevision();
  const all = ids.map(unitId=>({unitId,expectedRevision:null,marked:true,consumedOn:null}));
  const batch = all.slice(0,500);
  const read = () => inspect(f,'SELECT * FROM granular_decisions WHERE owner_id=? ORDER BY unit_id',owner);
  const tx = f.db.withTransactionAsync;
  const run = f.db.runAsync;
  let commits = 0;
  let writes = 0;
  let failAt = null;
  let beforeCommit = () => {};
  f.db.withTransactionAsync = async task => {
    await tx(async()=>{ await task(); beforeCommit(); });
    commits++;
  };
  f.db.runAsync = (sql,...params) => {
    if (sql.includes('INSERT INTO granular_decisions') && ++writes===failAt) throw Error('TEST fallo 250');
    return run(sql,...params);
  };
  try {
    beforeCommit = () => assert.fail('Un lote inválido no debe confirmar');
    await assert.rejects(repo.setGranularDecisions(owner,initialRevision,all,f.db,100),/Selección inválida/);
    assert.equal(writes,0);
    assert.deepEqual(read(),[]);

    beforeCommit = () => {
      assert.equal(read().length,500);
      assert.equal(libraryPresentationRevision(),initialNotice);
    };
    await repo.setGranularDecisions(owner,initialRevision,batch,f.db,100);
    assert.equal(commits,1);
    assert.equal(writes,500);
    assert.equal(libraryPresentationRevision(),initialNotice+1);
    const marked = read();
    assert.deepEqual(marked.map(row=>row.unit_id),ids.slice(0,500).sort());
    assert.ok(marked.every(row=>row.marked===1 && row.revision===1 && row.updated_at===100));

    const markedRevision = f.sqlite.prepare('SELECT revision FROM granular_title_state WHERE owner_id=?').get(owner).revision;
    beforeCommit = () => assert.equal(libraryPresentationRevision(),initialNotice+1);
    await repo.setGranularDecisions(owner,initialRevision,batch,f.db,200);
    assert.equal(writes,500);
    assert.deepEqual(read(),marked);
    assert.equal(libraryPresentationRevision(),initialNotice+1);

    const unmarks = batch.map(intent=>({...intent,expectedRevision:1,marked:false}));
    failAt = writes+250;
    await assert.rejects(repo.setGranularDecisions(owner,markedRevision,unmarks,f.db,300),/TEST fallo 250/);
    assert.deepEqual(read(),marked);
    assert.equal(libraryPresentationRevision(),initialNotice+1);
    assert.equal(f.sqlite.prepare('SELECT revision FROM granular_title_state WHERE owner_id=?').get(owner).revision,markedRevision);

    failAt = null;
    const priorCommits = commits;
    beforeCommit = () => {
      assert.equal(read().filter(row=>row.marked===0).length,500);
      assert.equal(libraryPresentationRevision(),initialNotice+1);
    };
    await repo.setGranularDecisions(owner,markedRevision,unmarks,f.db,300);
    assert.equal(commits,priorCommits+1);
    assert.equal(libraryPresentationRevision(),initialNotice+2);
    assert.ok(read().every(row=>row.marked===0 && row.revision===2 && row.updated_at===300 && row.consumed_on===null));
  } finally {
    f.db.withTransactionAsync = tx;
    f.db.runAsync = run;
  }
  console.log('PASS S1 revisión: lote 500, reintento, desmarcado, límite 501, rollback e invalidación.');
}

async function main() {
  const empty = open();
  await evolve(empty);
  assert.equal(await schema.readUserVersion(empty.db),10);
  const future = open();
  future.sqlite.exec('PRAGMA user_version=11');
  await assert.rejects(evolve(future), /no soportada/);

  const historical = open();
  createV6(historical);
  const legacy = originalTables(historical);
  await evolve(historical);
  assert.deepEqual(originalTables(historical),legacy);

  // Reconstruct the v9 checkpoint: the v10 migration is additive.
  const f = historical;
  f.sqlite.exec(`DROP TABLE granular_decisions; DROP TABLE granular_unit_references;
    DROP TABLE granular_group_references; DROP TABLE granular_units; DROP TABLE granular_groups;
    DROP TABLE granular_title_state; DROP TABLE granular_guide_indices; DROP TABLE granular_guide_snapshots; PRAGMA user_version=9;`);
  await f.db.runAsync("INSERT INTO personal_collections VALUES ('TEST-c','TEST','TEST summary',1,2)");
  await f.db.runAsync("INSERT INTO collection_memberships VALUES ('TEST-c','tmdb',3,4)");
  await f.db.runAsync(`INSERT INTO recommendation_inbox (id,original_capture_json,capture_kind,name,status,linked_saved_title_id,created_at,updated_at)
    VALUES ('TEST-r','{"name":"TEST"}','name','TEST','incorporated','tmdb',5,6)`);
  const classification = await progress.getProgressClassificationWithDb(f.db,'tmdb');
  await progress.setPersonalProgress({ itemId:'tmdb', expected:null, expectedClassification:classification, position:season(10) }, f.db, 100);
  const before = rows(f), oldCatalog = catalog(f);
  await assert.rejects(evolve(f,{afterVersion10Published:()=>{throw Error('TEST rollback');}}), /TEST rollback/);
  assert.equal(await schema.readUserVersion(f.db),9);
  assert.deepEqual(catalog(f),oldCatalog);
  assert.deepEqual(rows(f),before);
  await evolve(f);
  assert.deepEqual(rows(f),before);
  assert.deepEqual(inspect(f,'SELECT * FROM granular_units'),[]);
  assert.deepEqual(inspect(f,'SELECT * FROM granular_decisions'),[]);
  const newCatalog = catalog(f);
  await evolve(f);
  assert.deepEqual(catalog(f),newCatalog);
  assert.ok(inspect(f,"PRAGMA index_info(granular_units_group_order)").some(row=>row.name==='sort_fraction'));

  const group = randomUUID();
  await repo.saveGranularGroup({ownerId:'tmdb',id:group,kind:'season',label:'T0'},0,f.db);
  await add(f,'tmdb',{mode:'season-episode',season:0,episode:1},{groupId:group});
  await assert.rejects(add(f,'multi',season(1),{groupId:group}));
  await assert.rejects(f.db.runAsync("UPDATE granular_units SET owner_id='multi' WHERE group_id=?",group),/FOREIGN KEY/);
  const ref={provider:'tmdb',parentNamespace:'tv',parentId:'1',namespace:'episode',externalId:'45'};
  const e1=await add(f,'tmdb',season(1),{reference:ref});
  const e2=await add(f,'tmdb',season(2));
  const e5=await add(f,'tmdb',season(5));
  const e10=await add(f,'tmdb',season(10));
  await assert.rejects(add(f,'tmdb',season(3),{reference:ref}));
  await assert.rejects(add(f,'multi',season(3),{id:e1}));
  await assert.rejects(add(f,'multi',season(3),{reference:ref}));
  assert.deepEqual(inspect(f,'SELECT * FROM granular_decisions'),[]);

  const mark = unitId => ({unitId,expectedRevision:null,marked:true,consumedOn:null});
  const rev = await revision(f,'tmdb'), invalidation = libraryPresentationRevision();
  const batch = [e1,e2,e5,e10].map(mark);
  await Promise.all([repo.setGranularDecisions('tmdb',rev,batch,f.db,200),repo.setGranularDecisions('tmdb',rev,batch,f.db,201)]);
  assert.equal(libraryPresentationRevision(),invalidation+1);
  assert.ok(inspect(f,'SELECT * FROM granular_decisions').every(d=>d.revision===1 && d.updated_at===200 && d.consumed_on===null));
  const unmark = {unitId:e10,expectedRevision:1,marked:false,consumedOn:null};
  await assert.rejects(repo.setGranularDecisions('tmdb',rev,[unmark],f.db,199));
  await repo.setGranularDecisions('tmdb',await revision(f,'tmdb'),[unmark],f.db,199);
  assert.equal(inspect(f,'SELECT * FROM granular_decisions WHERE marked=1').length,3);
  assert.deepEqual({...inspect(f,'SELECT * FROM granular_decisions WHERE marked=0')[0]},{
    owner_id:'tmdb',unit_id:e10,marked:0,consumed_on:null,revision:2,updated_at:201
  });
  assert.deepEqual(rows(f),before);
  assert.deepEqual((await progress.getPersonalProgressWithDb(f.db,'tmdb')).position,season(10));

  await repo.saveGranularUnit({ownerId:'tmdb', reference:ref, coordinate:season(11),groupId:null,label:null},await revision(f,'tmdb'),f.db);
  assert.equal(inspect(f,'SELECT coordinate FROM granular_units WHERE id=?',e1)[0].coordinate,JSON.stringify(season(11)));
  assert.equal(inspect(f,'SELECT marked FROM granular_decisions WHERE unit_id=?',e1)[0].marked,1);
  await repo.retireGranularUnit('tmdb',e1,true,await revision(f,'tmdb'),f.db);
  assert.equal(inspect(f,'SELECT marked FROM granular_decisions WHERE unit_id=?',e1)[0].marked,1);
  await repo.retireGranularUnit('tmdb',e1,false,await revision(f,'tmdb'),f.db);

  const failRev = await revision(f,'tmdb'), failInvalidation = libraryPresentationRevision();
  const run = f.db.runAsync;
  f.db.runAsync = (sql,...params) => {
    if (sql.includes('INSERT INTO granular_decisions') && params[1]===e2) throw Error('TEST decisión');
    return run(sql,...params);
  };
  try {
    await assert.rejects(repo.setGranularDecisions('tmdb',failRev,[e1,e2].map(unitId=>({...unmark,unitId})),f.db,300),/TEST decisión/);
  } finally { f.db.runAsync = run; }
  assert.equal(await revision(f,'tmdb'),failRev);
  assert.equal(libraryPresentationRevision(),failInvalidation);
  assert.equal(inspect(f,'SELECT * FROM granular_decisions WHERE marked=1').length,3);
  assert.throws(()=>domain.civilConsumptionDate('2025-02-29'));
  assert.throws(()=>domain.civilConsumptionDate('2099-02-28',new Date(2026,0,1)));
  await repo.setGranularDecisions('tmdb',await revision(f,'tmdb'),[{...mark(e1),expectedRevision:1,consumedOn:'2024-02-29'}],f.db,Date.UTC(2026,0,1));
  assert.equal(inspect(f,'SELECT consumed_on FROM granular_decisions WHERE unit_id=?',e1)[0].consumed_on,'2024-02-29');
  await verifyDatedRetry(f,e1);
  console.log('PASS S1 revisión: fecha civil, retroceso de reloj y reintento sin escrituras.');

  await repo.setGranularEnabled('mu',0,true,f.db);
  for(const number of ['15','12.5','12','12.000001','12.05','999999.999999','12.5']) await add(f,'mu',chapter(number));
  for(const invalid of ['12.50','1000000','1.0000001']) await assert.rejects(add(f,'mu',chapter(invalid)));
  const paged = [];
  let page = await repo.listGranularUnits('mu',2,null,f.db);
  const oldPage = page.next;
  for (;;) {
    paged.push(...page.rows);
    if (!page.next) break;
    page = await repo.listGranularUnits('mu',2,page.next,f.db);
  }
  assert.deepEqual(paged.map(row=>JSON.parse(row.coordinate).chapter),['12','12.000001','12.05','12.5','12.5','15','999999.999999']);
  assert.ok(paged[3].id < paged[4].id);
  await add(f,'mu',{mode:'special',label:'番外編'});
  await assert.rejects(repo.listGranularUnits('mu',2,oldPage,f.db));
  assert.equal(domain.granularCompatible({medium:'literature',primaryFormat:'novel',contentFamily:null},chapter('1'),false),false);
  assert.equal(domain.granularCompatible({medium:'literature',primaryFormat:'novel',contentFamily:null},chapter('1'),true),true);
  assert.equal(domain.granularCompatible({medium:'comic',primaryFormat:'one-shot',contentFamily:'manga'},chapter('1'),true),false);

  await assert.rejects(f.db.runAsync("DELETE FROM granular_groups WHERE id=?",group), /FOREIGN KEY/);
  await add(f,'tmdb',{mode:'episode',episode:999999});
  await assert.rejects(add(f,'tmdb',{mode:'episode',episode:1000000}));
  const excessive = Array.from({length:501},()=>mark(randomUUID()));
  await assert.rejects(repo.setGranularDecisions('tmdb',await revision(f,'tmdb'),excessive,f.db),/Selección inválida/);
  const tx = f.db.withTransactionAsync;
  const beforeCommitFailure = libraryPresentationRevision();
  const decisionBefore = inspect(f,'SELECT * FROM granular_decisions ORDER BY unit_id');
  const triedRevision = await revision(f,'tmdb');
  f.db.withTransactionAsync = task => tx(async()=>{await task();throw Error('TEST commit granular');});
  try {
    await assert.rejects(repo.setGranularDecisions('tmdb',triedRevision,[{...unmark,unitId:e2}],f.db,300),/TEST commit granular/);
  } finally { f.db.withTransactionAsync = tx; }
  assert.equal(libraryPresentationRevision(),beforeCommitFailure);
  assert.deepEqual(inspect(f,'SELECT * FROM granular_decisions ORDER BY unit_id'),decisionBefore);
  f.close();
  fixtures.delete(f);
  const reopened = open(f.file);
  await evolve(reopened);
  assert.equal(inspect(reopened,'SELECT marked FROM granular_decisions WHERE unit_id=?',e10)[0].marked,0);
  assert.deepEqual(rows(reopened),before);
  reopened.sqlite.exec("DELETE FROM saved_titles WHERE id='tmdb'");
  for(const table of ['groups','units','group_references','unit_references','decisions','title_state']) {
    assert.deepEqual(inspect(reopened,`SELECT * FROM granular_${table} WHERE owner_id='tmdb'`),[]);
  }
  assert.equal(inspect(reopened,"SELECT * FROM granular_units WHERE owner_id='mu'").length,8);
  assert.deepEqual(inspect(reopened,'PRAGMA foreign_key_check'),[]);
  await verifyBatchBoundary(reopened);
  console.log('PASS S1: migración nueva/histórica/v9, rollback, identidad, orden, concurrencia, offline y aislamiento.');
}
main().catch(error=>{ console.error(error); process.exitCode=1; }).finally(()=>{ for(const f of fixtures) f.close(); });

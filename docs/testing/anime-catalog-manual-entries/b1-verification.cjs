const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  return request === 'expo-sqlite' ? {} : originalLoad.call(this, request, parent, main);
};
const schema = require('../../../src/storage/databaseSchema.ts');
const identities = require('../../../src/storage/manualEntryIdentities.ts');
const { parseManualEntryIdentity, generateManualEntryIdentity } = require('../../../src/core/manualEntryIdentity.ts');
const storage = require('../../../src/storage/savedTitleStorage.ts');
const { getLibraryBackupExportDataWithDb: exportData } = require('../../../src/storage/libraryBackupExport.ts');
const { createLibraryBackupV7 } = require('../../../src/core/libraryBackupV7.ts');
const { parseLibraryBackup } = require('../../../src/core/libraryBackup.ts');
const { mergeLibraryBackupWithDb } = require('../../../src/storage/libraryBackupMerge.ts');
const { upsertSavedTitleAndCleanPinsWithDb: upsert } = require('../../../src/storage/savedTitleIntegrity.ts');
const dbModule = require('../../../src/storage/db.ts');
const { mergeLibraryBackup: publicMerge } = require('../../../src/storage/savedTitlesRepo.ts');
const { AppearanceCoordinator } = require('../../../src/theme/appearanceCoordinator.ts');
Module._load = originalLoad;

// All SQLite files, WAL sidecars and JSON backups live outside the repository.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlv-b1-synthetic-'));
let serial = 0;
function fixture(file = path.join(root, `${++serial}.sqlite`)) {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys=ON');
  const params = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...params(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...params(values)); },
    async runAsync(sql, ...values) { return sqlite.prepare(sql).run(...params(values)); },
    async withTransactionAsync(task) {
      sqlite.exec('BEGIN');
      try { await task(); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, db, file, close() { sqlite.close(); } };
}
const tables = ['saved_titles', 'media_provider_references', 'legacy_saved_title_identities', 'title_pins', 'app_preferences'];
function records(f, names = tables) { return names.map(name => f.sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all()); }
function snapshot(f) {
  const names = f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  return JSON.stringify({ schema: f.sqlite.prepare('SELECT * FROM sqlite_master ORDER BY name').all(), records: records(f, names), version: f.sqlite.prepare('PRAGMA user_version').get(), fk: f.sqlite.prepare('PRAGMA foreign_key_check').all() });
}
function seedV5(f) {
  for (const sql of [schema.SAVED_TITLES_V5_TABLE_SQL, schema.APP_PREFERENCES_TABLE_SQL,
    schema.MEDIA_PROVIDER_REFERENCES_TABLE_SQL, schema.MEDIA_PROVIDER_REFERENCES_SAVED_TITLE_INDEX_SQL,
    schema.LEGACY_SAVED_TITLE_IDENTITIES_TABLE_SQL, schema.LEGACY_SAVED_TITLE_IDENTITIES_SAVED_TITLE_INDEX_SQL,
    schema.TITLE_PINS_TABLE_SQL, schema.TITLE_PINS_CONTEXT_INDEX_SQL]) f.sqlite.exec(sql);
  for (const [id, medium, family, format] of [['movie','audiovisual','anime','ova'], ['tv','audiovisual',null,'tv'],
    ['mu','comic','manhwa','webtoon'], ['legacy','literature',null,'novel'], ['local','comic','manga',null], ['local2','audiovisual',null,null]]) {
    f.sqlite.prepare('INSERT INTO saved_titles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      id, medium, family, format, 'Synthetic shared title', 2001, null, 'overview', null, 89, '["Drama"]', 'watching', '["Keep","Á"]', 'notes', 111, 222);
  }
  f.sqlite.exec(`INSERT INTO media_provider_references VALUES ('tmdb','movie','77','movie'),('tmdb','tv','77','tv'),('mangaupdates','series','999999999999999999','mu'),('other','work','opaque','movie');
    INSERT INTO legacy_saved_title_identities VALUES ('library-backup-v1-v4','manual',' exact legacy ','legacy');
    INSERT INTO title_pins VALUES ('movie','library','',333),('local','tag','Keep',444),('legacy','library','',555);
    INSERT INTO app_preferences VALUES ('appearance.palette','lavender',666),('library.view','grid',667);
    UPDATE saved_titles SET genres_json=NULL, overview=NULL WHERE id='legacy';
    PRAGMA user_version=5;`);
}
const item = (id, manualIdentity, extra = {}) => ({ id, title: 'Synthetic shared title', medium: 'audiovisual', contentFamily: 'anime', primaryFormat: 'ova',
  providerReferences: [], ...(manualIdentity === undefined ? {} : { manualIdentity }), year: 2000, posterUrl: null, overview: 'overview', voteAverage: null,
  personalRating: 85, genres: ['Drama'], status: 'watching', tags: ['Keep'], notes: 'notes', createdAt: 10, updatedAt: 20, ...extra });
function parsed(items, pins = [], version = 7, extra = {}) {
  const result = parseLibraryBackup(JSON.stringify({ version, items, pins, ...extra }));
  assert.equal(result.ok, true); return result.payload;
}
async function merge(f, payload, generate = () => `remapped-${++serial}`) {
  let result; await f.db.withTransactionAsync(async () => { result = await mergeLibraryBackupWithDb(f.db, payload, generate); }); return result;
}
async function add(f, value) {
  await f.db.withTransactionAsync(async () => {
    await upsert(f.db, value);
    for (const ref of value.providerReferences) await storage.attachProviderReferenceWithDb(f.db, ref, value.id);
    if (value.manualIdentity !== undefined) await identities.attachManualIdentityWithDb(f.db, value.manualIdentity, value.id);
  });
}
const pin = (itemId, contextType = 'library', contextKey = '', pinnedAt = 30) => ({ itemId, contextType, contextKey, pinnedAt });
const appearance = { status: 'available', preference: { version: 1, scheme: 'dark', palette: 'lavender' } };
async function backup(f) { const data = await exportData(f.db, appearance); return createLibraryBackupV7(data.items, data.pins, data.appearanceAvailability, '2026-11-12T00:00:00.000Z'); }

async function migrationAndRecovery() {
  const source = fixture(); seedV5(source); const baseline = snapshot(source), rows = records(source);
  // Closed database with checkpointed WAL: copy only after all connections are closed.
  source.sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA wal_checkpoint(TRUNCATE);');
  const file = source.file; source.close();
  const copy = path.join(root, 'consistent-pre-v6.sqlite'); fs.copyFileSync(file, copy);
  const f = fixture(file);
  try {
    let n = 0;
    await schema.evolveDatabaseSchema(f.db, 5, { generateManualIdentity: () => `portable-${++n}` });
    assert.equal(await schema.readUserVersion(f.db), 7); assertLegacyEqual(records(f), rows);
    assertLegacyEqual(f.sqlite.prepare('SELECT * FROM manual_entry_identities ORDER BY saved_title_id').all().map(r => [r.portable_id,r.saved_title_id]), [['portable-1','local'],['portable-2','local2']]);
    await schema.verifyV6Schema(f.db); const migrated = snapshot(f);
    await schema.evolveDatabaseSchema(f.db, 6, { generateManualIdentity() { throw Error('must not regenerate'); } });
    assert.equal(snapshot(f), migrated);
    const v7 = await backup(f); const json = path.join(root, 'mixed-v7.json'); fs.writeFileSync(json, JSON.stringify(v7));
    const target = fixture(); try {
      await schema.evolveDatabaseSchema(target.db, 0);
      const result = await merge(target, parseLibraryBackup(fs.readFileSync(json,'utf8')).payload);
      assert.equal(result.inserted, 6); assert.equal(result.pins.inserted, 3);
      // Export is a canonical logical comparison; raw nullable genres intentionally materializes to [].
      assertLegacyEqual(await backup(target), v7);
      assertLegacyEqual(records(target, ['media_provider_references','legacy_saved_title_identities','title_pins','manual_entry_identities']), records(f, ['media_provider_references','legacy_saved_title_identities','title_pins','manual_entry_identities']));
      assert.equal((await merge(target, parsed(v7.items,v7.pins))).skipped, 6);
    } finally { target.close(); }
  } finally { f.close(); }
  const reopen = fixture(file); try { await schema.evolveDatabaseSchema(reopen.db, 6); assert.equal(await identities.manualIdentityForItemWithDb(reopen.db,'local'), 'portable-1'); } finally { reopen.close(); }
  const recovered = fixture(copy); try { assert.equal(snapshot(recovered), baseline); assertLegacyEqual(records(recovered), rows); } finally { recovered.close(); }

  for (const hook of ['afterV6TableCreated','afterV6IdentitiesAssigned','beforeV6Verification','beforeVersion6Published','afterVersion6Published','commit']) {
    const f = fixture(); try {
      seedV5(f); const before = snapshot(f);
      if (hook === 'commit') {
        const run = f.db.withTransactionAsync;
        f.db.withTransactionAsync = task => run(async () => { await task(); throw Error('Injected commit'); });
      }
      await assert.rejects(schema.evolveDatabaseSchema(f.db,5, hook === 'commit' ? {} : { [hook]() { throw Error(`Injected ${hook}`); } }), /Injected/);
      assert.equal(snapshot(f),before,hook);
    } finally { f.close(); }
  }
  for (const corrupt of [f => f.sqlite.exec("UPDATE saved_titles SET notes='corrupt' WHERE id='movie'"),
    f => f.sqlite.exec("DELETE FROM manual_entry_identities WHERE saved_title_id='local'"),
    f => f.sqlite.exec('DROP TABLE manual_entry_identities')]) {
    const f = fixture(); try {
      seedV5(f); const before = snapshot(f);
      await assert.rejects(schema.evolveDatabaseSchema(f.db,5,{ beforeV6Verification: () => corrupt(f) })); assert.equal(snapshot(f),before);
    } finally { f.close(); }
  }
  for (const generator of [() => '', () => 'duplicate']) {
    const f = fixture(); try { seedV5(f); const before = snapshot(f); await assert.rejects(schema.evolveDatabaseSchema(f.db,5,{ generateManualIdentity: generator })); assert.equal(snapshot(f),before); } finally { f.close(); }
  }
  // A deferred FK makes SQLite's actual COMMIT fail, after all migration checks/publication.
  const commitFailure = fixture(); try {
    seedV5(commitFailure); const before = snapshot(commitFailure);
    await assert.rejects(schema.evolveDatabaseSchema(commitFailure.db,5,{
      afterVersion6Published() {
        commitFailure.sqlite.exec("PRAGMA defer_foreign_keys=ON; INSERT INTO manual_entry_identities VALUES ('commit-orphan','absent');");
      },
    }), /FOREIGN KEY|huérfanas/);
    assert.equal(snapshot(commitFailure),before);
  } finally { commitFailure.close(); }
  const writeFailure = fixture(); try {
    seedV5(writeFailure); const before = snapshot(writeFailure);
    await assert.rejects(schema.evolveDatabaseSchema(writeFailure.db,5,{
      afterV6TableCreated() {
        writeFailure.sqlite.exec("CREATE TRIGGER fail_backfill BEFORE INSERT ON manual_entry_identities WHEN NEW.saved_title_id='local2' BEGIN SELECT RAISE(ABORT,'Injected backfill write'); END");
      },
    }), /Injected backfill write/);
    assert.equal(snapshot(writeFailure),before);
  } finally { writeFailure.close(); }
  const future = fixture(); try { seedV5(future); future.sqlite.exec('PRAGMA user_version=8'); const before = snapshot(future); await assert.rejects(schema.evolveDatabaseSchema(future.db,8),/no soportada/); assert.equal(snapshot(future),before); } finally { future.close(); }
  console.log('PASS mixed v5 migration, full records, reopen, future rejection, phase/commit/corruption rollback, consistent-copy recovery');
}

async function identityContracts() {
  for (const value of ['', ' ', ' x', 'x ', '\tx', 'x\u0000y', 7, null]) assert.throws(() => parseManualEntryIdentity(value));
  assert.equal(parseManualEntryIdentity('opaque-token'), 'opaque-token');
  const generated = new Set(Array.from({length:100},generateManualEntryIdentity)); assert.equal(generated.size,100);
  const f = fixture(); try {
    await schema.evolveDatabaseSchema(f.db,0); await add(f,item('a','owned')); await add(f,item('b'));
    const before = snapshot(f);
    await assert.rejects(f.db.withTransactionAsync(() => identities.attachManualIdentityWithDb(f.db,'owned','b')), /propietario/);
    await assert.rejects(f.db.withTransactionAsync(() => identities.attachManualIdentityWithDb(f.db,'different','a')), /propietario/);
    await assert.rejects(f.db.withTransactionAsync(() => identities.attachManualIdentityWithDb(f.db,'free','absent')), /FOREIGN KEY|huérfanas/);
    let attempts = 0;
    await assert.rejects(f.db.withTransactionAsync(() => identities.assignManualIdentityWithDb(f.db,'b',() => { attempts++; return 'owned'; })), /25/);
    assert.equal(attempts,25); assert.equal(snapshot(f),before);
    attempts = 0;
    await f.db.withTransactionAsync(() => identities.assignManualIdentityWithDb(f.db,'b',() => ++attempts === 1 ? 'owned' : 'free'));
    assert.equal(attempts,2);
    assert.throws(() => f.sqlite.exec("INSERT INTO manual_entry_identities VALUES ('other','a')"),/UNIQUE/);
    assert.throws(() => f.sqlite.exec("INSERT INTO manual_entry_identities VALUES ('owned','b')"),/UNIQUE/);
    f.sqlite.exec("DELETE FROM saved_titles WHERE id='a'");
    assert.equal(await identities.manualIdentityOwnerWithDb(f.db,'owned'),null);
    assertLegacyEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally { f.close(); }
  console.log('PASS canonical identities, bounded collision retries/exhaustion, ownership, FK and cascade');
}

async function parsersAndHistory() {
  for (const invalid of ['', ' ', ' padded', null, 9, 'x\u0000']) assert.equal(parsed([item('bad',invalid)]).invalid.length,1);
  const duplicate = parsed([item('a','same'),item('b','same'),item('c','other')]);
  assert.equal(duplicate.invalid.length,2); assertLegacyEqual(duplicate.items.map(x=>x.id.value),['c']);
  assert.throws(() => createLibraryBackupV7([item('a')],[],appearance),/identidad portable/);
  assert.throws(() => createLibraryBackupV7([item('a','x'),item('b','x')],[],appearance),/válido/);
  const f = fixture(); try {
    await schema.evolveDatabaseSchema(f.db,0);
    for (let version=1;version<=6;version++) {
      const historical = version<=4 ? { id:`old-${version}`, provider:'manual',externalId:` exact-${version} `,type:'movie',title:'Historical',personalRating:80,createdAt:1,updatedAt:2,tags:['Keep'] }
        : version===5 ? { id:`old-${version}`,type:'movie',title:'Historical',personalRating:80,createdAt:1,updatedAt:2,providerReferences:[] }
        : item(`old-${version}`,undefined);
      historical.manualIdentity = 'ignored-v7-token';
      const p = parsed([historical],[],version);
      assert.equal(p.items.length,1); assert.equal(p.items[0].manualIdentity,undefined);
      assert.equal((await merge(f,p)).inserted,1);
      const repeat = await merge(f,p);
      if (version<=4) {
        assert.equal(repeat.skipped,1);
        assert.equal(await identities.manualIdentityForItemWithDb(f.db,`old-${version}`),undefined);
        assert.equal(f.sqlite.prepare('SELECT legacy_external_id FROM legacy_saved_title_identities WHERE saved_title_id=?').get(`old-${version}`).legacy_external_id,` exact-${version} `);
      } else {
        assert.equal(repeat.conflicts.length,1); assert.ok(await identities.manualIdentityForItemWithDb(f.db,`old-${version}`));
      }
    }
    const b = await backup(f); const g = fixture(); try {
      await schema.evolveDatabaseSchema(g.db,0); assert.equal((await merge(g,parsed(b.items,b.pins))).inserted,6); assertLegacyEqual(await backup(g),b);
    } finally { g.close(); }
    // Two independent imports of the identity-less historical file are not equivalent.
    const g2 = fixture(); try {
      await schema.evolveDatabaseSchema(g2.db,0);
      await merge(g2,parsed([item('old-6',undefined)],[],6));
      assert.notEqual(await identities.manualIdentityForItemWithDb(f.db,'old-6'),await identities.manualIdentityForItemWithDb(g2.db,'old-6'));
    } finally { g2.close(); }
  } finally { f.close(); }
  console.log('PASS v7 parser/export, all duplicate owners rejected, v1-v6 historical semantics, no retroactive deduplication');
}

async function mergeSemantics() {
  const f = fixture(); try {
    await schema.evolveDatabaseSchema(f.db,0);
    await add(f,item('occupied','occupant',{updatedAt:100})); const occupant = await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'occupied');
    const p = parsed([item('occupied','incoming')],[pin('occupied'),pin('occupied','tag','Keep')]);
    let n=0; const first = await merge(f,p,() => ++n<3 ? 'occupied' : 'remapped');
    assert.equal(first.inserted,1); assert.equal(first.pins.inserted,2); assert.equal(n,3);
    const full = snapshot(f); const repeat = await merge(f,p); assert.equal(repeat.skipped,1); assert.equal(repeat.pins.preserved,2); assert.equal(snapshot(f),full);
    assertLegacyEqual(await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'occupied'),occupant);
    let attempts=0; const exhausted = await merge(f,parsed([item('occupied','new')]),() => { attempts++; return 'occupied'; });
    assert.equal(exhausted.failed.length,1); assert.equal(attempts,24); assert.equal(snapshot(f),full);
    // Resolve all supplied identities before any writes, irrespective of freshness.
    await add(f,item('provider',undefined,{providerReferences:[{provider:'test',resourceNamespace:'work',externalId:'p'}]}));
    const before = snapshot(f);
    for (const supplied of [item('foreign','incoming',{providerReferences:[{provider:'test',resourceNamespace:'work',externalId:'p'}],updatedAt:0}),
      item('foreign','different',{providerReferences:[{provider:'test',resourceNamespace:'work',externalId:'p'}]})]) {
      if (supplied.manualIdentity==='different') await identities.attachManualIdentityWithDb(f.db,'provider-token','provider');
      const start=snapshot(f); const r=await merge(f,parsed([supplied],[pin('foreign')]));
      assert.equal(r.conflicts.length,1); assert.equal(r.pins.invalid.length,1); assert.equal(snapshot(f),start);
    }
    const mismatched = await merge(f,parsed([item('x','incoming',{medium:'comic',contentFamily:'manga',primaryFormat:null})])); assert.equal(mismatched.conflicts.length,1);
    const newer = parsed([item('foreign','incoming',{title:'Newer',contentFamily:null,primaryFormat:null,notes:null,updatedAt:200})]);
    delete newer.items[0].overview.value; newer.items[0].overview={present:false};
    assert.equal((await merge(f,newer)).updated,1);
    const local=await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'remapped');
    assert.equal(local.id,'remapped'); assert.equal(local.createdAt,10); assert.equal(local.notes,null); assert.equal(local.overview,'overview'); assert.equal(local.contentFamily,null); assert.equal(local.primaryFormat,null);
    // Older content can attach a compatible identity/reference without overwriting metadata.
    const old=parsed([item('other','incoming',{providerReferences:[{provider:'test',resourceNamespace:'work',externalId:'added'}],updatedAt:1})]);
    assert.equal((await merge(f,old)).skipped,1); assert.equal((await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'remapped')).title,'Newer');
    // Legacy/manual contradictory ownership and exact singular legacy association.
    f.sqlite.exec("INSERT INTO legacy_saved_title_identities VALUES ('library-backup-v1-v4','manual',' exact ','provider')");
    const start=snapshot(f);
    const contradiction=await merge(f,parsed([item('x','incoming',{legacyIdentity:{format:'library-backup-v1-v4',provider:'manual',externalId:' exact '}})]));
    assert.equal(contradiction.conflicts.length,1); assert.equal(snapshot(f),start);
    // An association failure rolls back content and references for that item; a valid sibling commits.
    f.sqlite.exec("CREATE TRIGGER fail_identity BEFORE INSERT ON manual_entry_identities WHEN NEW.portable_id='fail-token' BEGIN SELECT RAISE(ABORT,'Injected identity failure'); END");
    const failed=await merge(f,parsed([item('bad','fail-token',{providerReferences:[{provider:'test',resourceNamespace:'work',externalId:'bad'}]}),item('good','good-token')],[pin('bad'),pin('good')]));
    assert.equal(failed.failed.length,1); assert.equal(failed.inserted,1); assert.equal(failed.pins.invalid.length,1); assert.equal(failed.pins.inserted,1);
    assert.equal(await storage.getSavedTitleWithReferencesByIdWithDb(f.db,'bad'),null);
    assert.equal(f.sqlite.prepare("SELECT * FROM media_provider_references WHERE external_id='bad'").get(),undefined);
    // Association on an existing destination also rolls back if a later association fails.
    f.sqlite.exec("CREATE TRIGGER fail_ref BEFORE INSERT ON media_provider_references WHEN NEW.external_id='fail-ref' BEGIN SELECT RAISE(ABORT,'Injected reference failure'); END");
    await add(f,item('target',undefined,{providerReferences:[{provider:'test',resourceNamespace:'work',externalId:'target'}]}));
    const saved=snapshot(f);
    const r=await merge(f,parsed([item('foreign','free-token',{providerReferences:[{provider:'test',resourceNamespace:'work',externalId:'target'},{provider:'test',resourceNamespace:'work',externalId:'fail-ref'}],updatedAt:300})]));
    assert.equal(r.failed.length,1); assert.equal(snapshot(f),saved);
    // Rollback of the outer transaction restores every successful item and pin.
    const beforeOuter=snapshot(f);
    await assert.rejects(f.db.withTransactionAsync(async()=>{ await mergeLibraryBackupWithDb(f.db,parsed([item('outer','outer-token')],[pin('outer')]),()=> 'unused'); throw Error('Injected outer'); }),/Injected outer/);
    assert.equal(snapshot(f),beforeOuter);
    assertLegacyEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.notEqual(before,snapshot(f));
  } finally { f.close(); }
  console.log('PASS remap/reimport, bounded ID retries, contradictory ownership, freshness/presence/null, pins, savepoint/outer rollback');
}

async function appearanceAfterCommit() {
  const previous=dbModule.initDb;
  try {
    for (const mode of ['success','commit-failure','appearance-failure']) {
      const f=fixture(); try {
        await schema.evolveDatabaseSchema(f.db,0); let committed=false,writes=0;
        const tx=f.db.withTransactionAsync;
        f.db.withTransactionAsync=async task=>{ await tx(async()=>{ await task(); if(mode==='commit-failure') throw Error('Injected commit'); }); committed=true; };
        dbModule.initDb=async()=>f.db;
        const coordinator=new AppearanceCoordinator(async()=>{ assert.equal(committed,true); writes++; if(mode==='appearance-failure') throw Error('Injected appearance'); });
        coordinator.completeHydration(coordinator.beginHydration(),{status:'absent'});
        const handle=coordinator.reserveDeferred(appearance.preference);
        const p=parsed([item('appearance','appearance-token')],[pin('appearance')],7,{appearance:{scheme:'dark',palette:'lavender'}});
        if(mode==='commit-failure') {
          const before=snapshot(f); await assert.rejects(publicMerge(p,()=> 'unused'),/Injected commit/); coordinator.discardDeferred(handle);
          assert.equal(writes,0); assert.equal(snapshot(f),before);
        } else {
          assert.equal((await publicMerge(p,()=> 'unused')).inserted,1);
          const outcome=await coordinator.activateDeferred(handle); assert.equal(writes,1);
          assert.equal(outcome.status==='applied',mode==='success');
          assert.ok(await identities.manualIdentityOwnerWithDb(f.db,'appearance-token'));
        }
      } finally { f.close(); }
    }
  } finally { dbModule.initDb=previous; }
  const settings=fs.readFileSync(path.resolve(__dirname,'../../../app/(tabs)/ajustes.tsx'),'utf8');
  assert.match(settings,/createLibraryBackupV8/);
  assert.equal((settings.match(/payload.version === 7/g)||[]).length,3);
  console.log('PASS v7 export composition and Appearance only after commit; postcommit failure preserves library');
}

(async()=>{
  try {
    await migrationAndRecovery(); await identityContracts(); await parsersAndHistory(); await mergeSemantics(); await appearanceAfterCommit();
    console.log('B1 synthetic real-SQLite verification passed. No personal library opened.');
  } finally {
    // root was created by this process under os.tmpdir; remove only that exact directory.
    assert.ok(path.basename(root).startsWith('dlv-b1-synthetic-')); assert.equal(path.dirname(root),os.tmpdir());
    fs.rmSync(root,{recursive:true,force:true});
  }
})().catch(error=>{ console.error(error); process.exitCode=1; });

// These historical-contract assertions compare every original field. New v8 sidecars
// are verified separately by section-2-backups/storage, and have no authority in v1-v7.
function legacyShape(value) {
  if (Array.isArray(value)) return value.map(legacyShape);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['metadataState','localAliases'].includes(key)).map(([key,entry]) => [key,legacyShape(entry)]));
  return value;
}
function assertLegacyEqual(actual, expected, message) { assert.deepEqual(legacyShape(actual),legacyShape(expected),message); }

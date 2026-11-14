const assert = require('node:assert/strict');
const { fixture, createV6, originalTables } = require('./sqlite-fixtures.cjs');
const { evolveDatabaseSchema } = require('../../../src/storage/databaseSchema.ts');
(async () => {
  for (const mixed of [false, true]) {
    const f = fixture(); createV6(f, mixed);
    if (mixed) f.sqlite.exec("UPDATE saved_titles SET updated_at=20.25 WHERE id='manual'; UPDATE saved_titles SET updated_at=9e20 WHERE id='mu';");
    const before = originalTables(f);
    await evolveDatabaseSchema(f.db, 6);
    assert.deepEqual(originalTables(f), before); assert.equal(f.sqlite.prepare('PRAGMA user_version').get().user_version, 7);
    assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM media_metadata').get().n, 0, 'no invented fetch/documents');
    if (mixed) {
      assert.equal(f.sqlite.prepare("SELECT provider FROM media_metadata_selection WHERE saved_title_id='multi'").get().provider, null);
      assert.equal(f.sqlite.prepare("SELECT baseline_updated_at FROM media_metadata_selection WHERE saved_title_id='manual'").get().baseline_updated_at, 20.25);
    }
    await evolveDatabaseSchema(f.db, 7); f.close();
  }
  for (const hook of ['afterV7TablesCreated','afterV7BaselinesCreated','beforeVersion7Published','afterVersion7Published','commit']) {
    const f = fixture(); createV6(f); const before = originalTables(f);
    const target = hook === 'commit' ? { ...f.db, withTransactionAsync: task => f.db.withTransactionAsync(async () => { await task(); throw Error('injected commit'); }) } : f.db;
    await assert.rejects(evolveDatabaseSchema(target, 6, hook === 'commit' ? {} : { [hook]: () => { throw Error('injected'); } }), /injected/);
    assert.deepEqual(originalTables(f), before); assert.equal(f.sqlite.prepare('PRAGMA user_version').get().user_version, 6);
    assert.equal(f.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='media_metadata'").get(), undefined);
    f.close();
  }
  const corrupt=fixture(); createV6(corrupt); const beforeCorrupt=originalTables(corrupt);
  await assert.rejects(evolveDatabaseSchema(corrupt.db,6,{afterV7BaselinesCreated:()=>{corrupt.sqlite.exec("UPDATE saved_titles SET notes='corruption' WHERE id='tmdb'");}}),/alteró/);
  assert.deepEqual(originalTables(corrupt),beforeCorrupt);corrupt.close();
  const fresh = fixture(); await evolveDatabaseSchema(fresh.db, 0);
  await assert.rejects(evolveDatabaseSchema(fresh.db, 8), /no soportada/); fresh.close();
  console.log('PASS 2.2: empty/mixed v6->7, bootstrap0->7, preservation, FKs, reopen, four rollback phases plus commit/corruption and future rejection.');
})().catch(e => { console.error(e); process.exitCode = 1; });

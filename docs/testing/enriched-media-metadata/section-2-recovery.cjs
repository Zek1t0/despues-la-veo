const assert = require('node:assert/strict'), path = require('node:path');
const { fixture, createV6, originalTables, root } = require('./sqlite-fixtures.cjs');
const { createLibraryBackupV7 } = require('../../../src/core/libraryBackupV7.ts');
const { getLibraryBackupExportDataWithDb } = require('../../../src/storage/libraryBackupExport.ts');
(async () => {
  const f = fixture(); createV6(f); const before = originalTables(f);
  const exported = await getLibraryBackupExportDataWithDb(f.db, { status: 'unavailable' });
  const backup = createLibraryBackupV7(exported.items, exported.pins, exported.appearanceAvailability);
  assert.equal(backup.version, 7); assert.equal(backup.items.length, 5);
  const copy = path.join(root, 'consistent-v6.sqlite');
  // VACUUM INTO uses SQLite's consistent read, including committed pages still in WAL.
  f.sqlite.exec(`VACUUM INTO '${copy.replace(/'/g, "''")}';`);
  const restored = fixture(copy); assert.deepEqual(originalTables(restored), before);
  assert.equal(restored.sqlite.prepare('PRAGMA user_version').get().user_version, 6);
  assert.equal(restored.sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
  restored.close(); f.close();
  console.log('PASS 2.1: mixed v6, portable v7, committed WAL consistent copy and reopen; isolated fixtures only.');
})().catch(e => { console.error(e); process.exitCode = 1; });

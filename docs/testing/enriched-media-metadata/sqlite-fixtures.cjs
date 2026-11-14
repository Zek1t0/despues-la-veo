const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), { DatabaseSync } = require('node:sqlite');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: f }).outputText, f);
const originalLoad = Module._load;
Module._load = function (request, parent, main) { return request === 'expo-sqlite' ? {} : originalLoad.call(this, request, parent, main); };
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlv-metadata-v7-'));
let serial = 0;
function fixture(file = path.join(root, `${++serial}.sqlite`)) {
  const sqlite = new DatabaseSync(file); sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  const params = a => a.length === 1 && Array.isArray(a[0]) ? a[0] : a;
  const db = {
    execAsync: async sql => { sqlite.exec(sql); },
    getFirstAsync: async (sql, ...a) => sqlite.prepare(sql).get(...params(a)) ?? null,
    getAllAsync: async (sql, ...a) => sqlite.prepare(sql).all(...params(a)),
    runAsync: async (sql, ...a) => sqlite.prepare(sql).run(...params(a)),
    withTransactionAsync: async task => { sqlite.exec('BEGIN'); try { await task(); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
  return { db, sqlite, file, close: () => sqlite.close() };
}
function createV6(f, mixed = true) {
  const s = require('../../../src/storage/databaseSchema.ts');
  for (const sql of [s.SAVED_TITLES_V5_TABLE_SQL, s.MEDIA_PROVIDER_REFERENCES_TABLE_SQL, s.LEGACY_SAVED_TITLE_IDENTITIES_TABLE_SQL,
    s.TITLE_PINS_TABLE_SQL, s.APP_PREFERENCES_TABLE_SQL, s.MANUAL_ENTRY_IDENTITIES_TABLE_SQL,
    s.MEDIA_PROVIDER_REFERENCES_SAVED_TITLE_INDEX_SQL, s.LEGACY_SAVED_TITLE_IDENTITIES_SAVED_TITLE_INDEX_SQL, s.TITLE_PINS_CONTEXT_INDEX_SQL]) f.sqlite.exec(sql);
  f.sqlite.exec('PRAGMA user_version=6;');
  if (!mixed) return;
  const insert = f.sqlite.prepare(`INSERT INTO saved_titles VALUES (?, 'audiovisual', ?, ?, ?, 2000, NULL, 'TEST summary', ?, 85, '["Drama"]', 'watching', '["mine"]', 'TEST note', 10, 20)`);
  for (const [id, family, format, rating] of [['tmdb', null, 'tv', 8], ['kitsu', 'anime', 'tv', null], ['multi', 'anime', 'tv', null], ['manual', null, null, null]]) {
    insert.run(id, family, format, `TEST ${id}`, rating);
  }
  f.sqlite.exec(`INSERT INTO saved_titles VALUES ('mu','comic','manga',NULL,'TEST comic',2001,NULL,NULL,NULL,70,'[]','planned','[]',NULL,11,21);
    INSERT INTO media_provider_references VALUES ('tmdb','tv','1','tmdb'),('kitsu','anime','1','kitsu'),('kitsu','anime','2','multi'),('tmdb','tv','2','multi'),('mangaupdates','series','1','mu');
    INSERT INTO manual_entry_identities VALUES ('TEST-portable-manual','manual');
    INSERT INTO title_pins VALUES ('tmdb','library','',12),('kitsu','tag','mine',13);
    INSERT INTO app_preferences VALUES ('TEST.unknown','preserve',15);`);
}
function originalTables(f) {
  return Object.fromEntries(['saved_titles','media_provider_references','manual_entry_identities','legacy_saved_title_identities','title_pins','app_preferences']
    .map(table => [table, f.sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all()]));
}
module.exports = { fixture, createV6, originalTables, root };

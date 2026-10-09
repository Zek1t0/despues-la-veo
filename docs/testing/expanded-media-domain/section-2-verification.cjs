const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
}).outputText, filename);
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "expo-sqlite") return {};
  return originalLoad.call(this, request, parent, isMain);
};
const schema = require("../../../src/storage/databaseSchema.ts");
const { upsertSavedTitleAndCleanPinsWithDb: upsert } = require("../../../src/storage/savedTitleIntegrity.ts");
const storage = require("../../../src/storage/savedTitleStorage.ts");
const { getLibraryBackupExportDataWithDb: exportData } = require("../../../src/storage/libraryBackupExport.ts");
const { mergeLibraryBackupWithDb } = require("../../../src/storage/libraryBackupMerge.ts");
const { createLibraryBackupV6, parseLibraryBackupV6Value } = require("../../../src/core/libraryBackupV6.ts");
const { parseLibraryBackup } = require("../../../src/core/libraryBackup.ts");
const productionDbModule = require("../../../src/storage/db.ts");
const { mergeLibraryBackup: publicMerge } = require("../../../src/storage/savedTitlesRepo.ts");
const { AppearanceCoordinator } = require("../../../src/theme/appearanceCoordinator.ts");
Module._load = originalLoad;

function fixture(filename = ":memory:") {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA foreign_keys=ON");
  const params = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...params(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...params(values)); },
    async runAsync(sql, ...values) { return sqlite.prepare(sql).run(...params(values)); },
    async withTransactionAsync(task) { sqlite.exec("BEGIN"); try { await task(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; } },
  };
  return { sqlite, db, close: () => sqlite.close() };
}
const ref = (externalId, provider = "test-catalog", resourceNamespace = "work") => ({ provider, resourceNamespace, externalId });
const item = (id, medium = "audiovisual", contentFamily = null, primaryFormat = "movie", providerReferences = [ref(id)]) => ({
  id, medium, contentFamily, primaryFormat, providerReferences, title: `TEST ${id}`, year: 2020,
  posterUrl: null, overview: "Synthetic metadata", genres: ["Drama"], voteAverage: null,
  personalRating: 80, status: "watching", tags: ["Keep"], notes: "Personal note", createdAt: 101, updatedAt: 202,
});
function parsed(value) {
  const result = parseLibraryBackup(JSON.stringify(value)); assert.equal(result.ok, true); return result.payload;
}
function payload(items, pins = [], extra = {}) { return parsed({ version: 6, items, pins, ...extra }); }
async function merge(db, value, generator = () => "remapped") {
  let result; await db.withTransactionAsync(async () => { result = await mergeLibraryBackupWithDb(db, value, generator); }); return result;
}
async function add(db, value) {
  await upsert(db, value);
  for (const reference of value.providerReferences) await storage.attachProviderReferenceWithDb(db, reference, value.id);
}
function snapshot(sqlite) {
  return JSON.stringify({ version: sqlite.prepare("PRAGMA user_version").get().user_version,
    schema: sqlite.prepare("SELECT name,sql FROM sqlite_master ORDER BY name").all(),
    tables: ["saved_titles", "media_provider_references", "legacy_saved_title_identities", "title_pins", "app_preferences"]
      .map(name => sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all()),
    fk: sqlite.prepare("PRAGMA foreign_key_check").all(),
  });
}
function seedV4(f, badType = false) {
  for (const sql of [schema.SAVED_TITLES_V4_TABLE_SQL, schema.APP_PREFERENCES_TABLE_SQL,
    schema.MEDIA_PROVIDER_REFERENCES_TABLE_SQL, schema.MEDIA_PROVIDER_REFERENCES_SAVED_TITLE_INDEX_SQL,
    schema.LEGACY_SAVED_TITLE_IDENTITIES_TABLE_SQL, schema.LEGACY_SAVED_TITLE_IDENTITIES_SAVED_TITLE_INDEX_SQL,
    schema.TITLE_PINS_TABLE_SQL, schema.TITLE_PINS_CONTEXT_INDEX_SQL]) f.sqlite.exec(sql);
  const insert = f.sqlite.prepare("INSERT INTO saved_titles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const [id, type] of [["movie", "movie"], ["tv", "tv"], ["manual", "movie"]]) {
    insert.run(id, badType && id === "movie" ? "anime" : type, "Anime-looking historical title", 2001, "poster", "overview", 7.5, 90,
      '["Animation"]', "watching", '["Keep"]', "notes", 111, 222);
  }
  f.sqlite.exec(`INSERT INTO media_provider_references VALUES ('tmdb','movie','77','movie'),('tmdb','tv','77','tv'),('other','work','opaque','movie');
    INSERT INTO legacy_saved_title_identities VALUES ('library-backup-v1-v4','manual',' exact legacy ','manual');
    INSERT INTO title_pins VALUES ('movie','library','',333),('tv','tag','Keep',444),('manual','library','',555);
    INSERT INTO app_preferences VALUES ('appearance.palette','forest',666);
    UPDATE saved_titles SET genres_json=NULL,poster_url=NULL,overview=NULL WHERE id='manual';
    PRAGMA user_version=4;`);
}
async function migrations() {
  const fresh = fixture();
  try {
    await schema.evolveDatabaseSchema(fresh.db, 0); assert.equal(await schema.readUserVersion(fresh.db), 5);
    await schema.verifyV5Schema(fresh.db);
    assert.equal(fresh.sqlite.prepare("PRAGMA table_info(saved_titles)").all().some(x => x.name === "type"), false);
    const before = snapshot(fresh.sqlite);
    await schema.evolveDatabaseSchema(fresh.db, 5, { afterV5ItemsCopied() { throw Error("Must not remigrate"); } });
    assert.equal(snapshot(fresh.sqlite), before);
    fresh.sqlite.exec("PRAGMA user_version=6"); const future = snapshot(fresh.sqlite);
    await assert.rejects(schema.evolveDatabaseSchema(fresh.db, 6), /no soportada/); assert.equal(snapshot(fresh.sqlite), future);
  } finally { fresh.close(); }
  const valid = fixture();
  try {
    seedV4(valid); const original = valid.sqlite.prepare("SELECT * FROM saved_titles ORDER BY id").all();
    const children = ["media_provider_references", "legacy_saved_title_identities", "title_pins", "app_preferences"].map(name => valid.sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all());
    await schema.evolveDatabaseSchema(valid.db, 4);
    const current = valid.sqlite.prepare("SELECT * FROM saved_titles ORDER BY id").all();
    for (let index = 0; index < current.length; index++) {
      const { type, ...old } = original[index]; const { medium, content_family, primary_format, ...rest } = current[index];
      assert.deepEqual(rest, old); assert.equal(medium, "audiovisual"); assert.equal(content_family, null); assert.equal(primary_format, type);
    }
    assert.deepEqual(["media_provider_references", "legacy_saved_title_identities", "title_pins", "app_preferences"].map(name => valid.sqlite.prepare(`SELECT * FROM ${name} ORDER BY 1,2`).all()), children);
    assert.deepEqual(valid.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    for (const table of ["media_provider_references", "legacy_saved_title_identities", "title_pins"]) assert.equal(valid.sqlite.prepare(`PRAGMA foreign_key_list(${table})`).get().table, "saved_titles");
  } finally { valid.close(); }
  for (const hook of ["afterV5TargetTablesCreated", "afterV5ItemsCopied", "afterV5DependentsCopied", "beforeV5Verification", "beforeVersion5Published", "afterVersion5Published"]) {
    const f = fixture(); try {
      seedV4(f); const before = snapshot(f.sqlite);
      await assert.rejects(schema.evolveDatabaseSchema(f.db, 4, { [hook]() { throw Error(`Injected ${hook}`); } }), /Injected/);
      assert.equal(snapshot(f.sqlite), before, `${hook}: exact rollback`);
      assert.equal(f.sqlite.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
      await schema.evolveDatabaseSchema(f.db, 4); await schema.verifyV5Schema(f.db);
    } finally { f.close(); }
  }
  const invalid = fixture(); try {
    seedV4(invalid, true); const before = snapshot(invalid.sqlite);
    await assert.rejects(schema.evolveDatabaseSchema(invalid.db, 4), /inv/); assert.equal(snapshot(invalid.sqlite), before);
  } finally { invalid.close(); }
  // Actual verification failures, rather than just exceptions from verification hooks.
  for (const corrupt of [f => f.sqlite.exec("UPDATE saved_titles SET notes='corrupted' WHERE id='movie'"),
    f => f.sqlite.exec("DROP INDEX idx_media_provider_references_saved_title")]) {
    const f = fixture(); try {
      seedV4(f); const before = snapshot(f.sqlite);
      await assert.rejects(schema.evolveDatabaseSchema(f.db, 4, { beforeV5Verification() { corrupt(f); } }));
      assert.equal(snapshot(f.sqlite), before);
    } finally { f.close(); }
  }
  const filename = path.join(os.tmpdir(), `dlv-expanded-v5-reopen-${process.pid}-${Date.now()}.sqlite`);
  let f = fixture(filename);
  try {
    seedV4(f); await schema.evolveDatabaseSchema(f.db, 4);
    const before = snapshot(f.sqlite);
    f.close(); f = fixture(filename);
    assert.equal(await schema.readUserVersion(f.db), 5);
    await schema.evolveDatabaseSchema(f.db, 5, { afterV5ItemsCopied() { throw Error("Disk reopen must not migrate"); } });
    assert.equal(snapshot(f.sqlite), before);
  } finally { f.close(); if (fs.existsSync(filename)) fs.unlinkSync(filename); }
}
async function backupsAndMerge() {
  const source = fixture(), target = fixture();
  try {
    await schema.evolveDatabaseSchema(source.db, 0); await schema.evolveDatabaseSchema(target.db, 0);
    const cases = [item("movie", "audiovisual", null, "movie", [ref("77", "tmdb", "movie")]),
      item("tv", "audiovisual", "anime", "tv", [ref("77", "tmdb", "tv")]),
      item("ova", "audiovisual", "anime", "ova", [ref("88", "tmdb", "movie"), ref("ova")]),
      item("manga", "comic", "manga", null), item("one-shot", "comic", "manga", "one-shot"),
      item("manhwa", "comic", "manhwa", "webtoon"), item("manhua", "comic", "manhua", null),
      item("comic", "comic", null, null), item("novel", "literature", null, "novel"),
      item("light-novel", "literature", null, "light-novel")];
    cases[0].voteAverage = 7.7;
    for (const value of cases) {
      await add(source.db, value);
      source.sqlite.prepare("INSERT INTO title_pins VALUES (?,'library','',303)").run(value.id);
      source.sqlite.prepare("INSERT INTO title_pins VALUES (?,'tag','Keep',304)").run(value.id);
    }
    const manual = item("legacy", "comic", null, null, []); await add(source.db, manual);
    source.sqlite.exec("INSERT INTO legacy_saved_title_identities VALUES ('library-backup-v1-v4','manual',' exact ','legacy')");
    const appearance = { status: "confirmed", preference: { version: 1, scheme: "dark", palette: "lavender" } };
    const data = await exportData(source.db, appearance);
    const backup = createLibraryBackupV6(data.items, data.pins, appearance, "2026-10-09T00:00:00Z");
    assert.equal(backup.version, 6); assert.deepEqual(backup.appearance, { scheme: "dark", palette: "lavender" });
    const p = parsed(backup); assert.equal(p.invalid.length, 0); assert.equal(p.appearance.status, "valid");
    const result = await merge(target.db, p); assert.equal(result.inserted, 11); assert.equal(result.pins.inserted, 20);
    assert.equal(result.failed.length, 0); assert.equal(result.conflicts.length, 0);
    for (const value of cases) assert.deepEqual(await storage.getSavedTitleWithReferencesByIdWithDb(target.db, value.id), {
      ...value, providerReferences: [...value.providerReferences].sort((a,b) => a.provider.localeCompare(b.provider)),
    });
    const repeat = await merge(target.db, p); assert.equal(repeat.skipped, 11); assert.equal(repeat.pins.preserved, 20);
    const newBackup = await exportData(target.db, appearance); assert.deepEqual(createLibraryBackupV6(newBackup.items, newBackup.pins, appearance, backup.exportedAt), backup);
    assert.throws(() => createLibraryBackupV6([item("unportable", "comic", null, null, [])], [], { status: "unavailable" }), /portable/);
    // Required nullable keys, vocabulary, matrix, canonical references and duplicates.
    for (const modify of [x => { delete x.contentFamily; }, x => { delete x.primaryFormat; }, x => { x.medium = "unknown"; },
      x => { x.medium = "comic"; }, x => { x.personalRating = 9; }, x => { x.providerReferences[0].externalId = "00077"; },
      x => { x.providerReferences.push(x.providerReferences[0]); }, x => { x.type = "movie"; }, x => { x.tags = null; }]) {
      const value = structuredClone(cases[0]); modify(value); assert.equal(payload([value]).invalid.length, 1);
    }
    const unknownFormat = { ...cases[0], primaryFormat: null }; assert.equal(payload([unknownFormat]).invalid.length, 0);
    assert.equal(payload([cases[0], { ...cases[0], id: "duplicate" }]).invalid.length, 2);
    const directUndefined = { ...cases[0], contentFamily: undefined };
    assert.equal(parseLibraryBackupV6Value({ version: 6, items: [directUndefined], pins: [] }).payload.invalid.length, 1);
    // Newer v6 explicitly replaces local classification, older/equal never does.
    let incoming = { ...cases[2], id: "foreign-id", contentFamily: null, primaryFormat: null, updatedAt: 999, createdAt: 1 };
    assert.equal((await merge(target.db, payload([incoming]))).updated, 1);
    let local = await storage.getSavedTitleWithReferencesByIdWithDb(target.db, "ova");
    assert.equal(local.contentFamily, null); assert.equal(local.primaryFormat, null); assert.equal(local.createdAt, 101);
    for (const updatedAt of [998, 999]) assert.equal((await merge(target.db, payload([{ ...incoming, contentFamily: "anime", primaryFormat: "ova", updatedAt }]))).skipped, 1);
    assert.equal((await storage.getSavedTitleWithReferencesByIdWithDb(target.db, "ova")).primaryFormat, null);
    incoming = { ...cases[5], contentFamily: "manga", primaryFormat: "one-shot", updatedAt: 999 };
    assert.equal((await merge(target.db, payload([incoming]))).updated, 1);
    assert.equal((await storage.getSavedTitleWithReferencesByIdWithDb(target.db, "manhwa")).contentFamily, "manga");
    // Historical converters preserve unavailable family on an eligible newer update, all versions.
    for (const version of [1, 2, 3, 4, 5]) {
      const v = fixture(); try {
        await schema.evolveDatabaseSchema(v.db, 0); await add(v.db, item("known", "audiovisual", "anime", "ova", [ref("99", "tmdb", "movie")]));
        const historical = { id: "incoming", type: "movie", title: "Historical", provider: "tmdb", externalId: "99", personalRating: 70, updatedAt: 1000 };
        const raw = { version, items: [version === 5 ? { ...historical, providerReferences: [ref("99", "tmdb", "movie")] } : historical], ...(version === 1 ? {} : { pins: [] }) };
        const historicalParsed = parsed(raw); assert.equal(historicalParsed.invalid.length, 0);
        const update = await merge(v.db, historicalParsed); assert.equal(update.updated, 1);
        const value = await storage.getSavedTitleWithReferencesByIdWithDb(v.db, "known"); assert.equal(value.contentFamily, "anime"); assert.equal(value.primaryFormat, "movie");
        const empty = fixture(); try { await schema.evolveDatabaseSchema(empty.db, 0); assert.equal((await merge(empty.db, historicalParsed)).inserted, 1); assert.equal((await storage.listSavedTitlesWithReferencesWithDb(empty.db))[0].contentFamily, null); } finally { empty.close(); }
        raw.items[0].type = "manga"; assert.equal(parsed(raw).invalid.length, 1, `historical v${version} stays frozen`);
        delete raw.items[0].type;
        Object.assign(raw.items[0], { medium: "comic", contentFamily: "manga", primaryFormat: null });
        assert.equal(parsed(raw).invalid.length, 1, `v${version} does not accept current taxonomy instead of historical type`);
      } finally { v.close(); }
    }
    // Medium disagreement does not attach free references or restore its pins.
    incoming = { ...cases[3], medium: "literature", contentFamily: null, primaryFormat: "novel", updatedAt: 5000, providerReferences: [ref("manga"), ref("free-conflict")] };
    const conflict = await merge(target.db, payload([incoming], [{ itemId: incoming.id, contextType: "library", contextKey: "", pinnedAt: 5000 }]));
    assert.equal(conflict.conflicts.length, 1); assert.equal(conflict.pins.invalid.length, 1);
    assert.equal(await storage.getSavedTitleByProviderReferenceWithDb(target.db, ref("free-conflict")), null);
    // Divergent identities never fuse.
    assert.equal((await merge(target.db, payload([{ ...cases[0], providerReferences: [ref("77", "tmdb", "movie"), ref("77", "tmdb", "tv")] }]))).conflicts.length, 1);
    // Stale metadata can still add compatible free references.
    const stale = await merge(target.db, payload([{ ...cases[0], providerReferences: [...cases[0].providerReferences, ref("additive")], updatedAt: 1 }]));
    assert.equal(stale.skipped, 1); assert.equal((await storage.getSavedTitleByProviderReferenceWithDb(target.db, ref("additive"))).id, "movie");
    // ID collisions and final-ID pins; local-only free ID accepted defensively, occupied conflicts.
    const remapItem = item("movie", "comic", "manga", null, [ref("new-identity")]);
    const remapped = await merge(target.db, payload([remapItem], [{ itemId: "movie", contextType: "library", contextKey: "", pinnedAt: 777 }]));
    assert.equal(remapped.inserted, 1); assert.equal(remapped.pins.inserted, 1);
    assert.equal(target.sqlite.prepare("SELECT pinned_at FROM title_pins WHERE saved_title_id='remapped'").get().pinned_at, 777);
    assert.equal(target.sqlite.prepare("SELECT pinned_at FROM title_pins WHERE saved_title_id='movie' AND context_type='library'").get().pinned_at, 303);
    assert.equal((await merge(target.db, payload([item("free-local", "comic", null, null, [])]))).inserted, 1);
    assert.equal((await merge(target.db, payload([item("free-local", "comic", null, null, [])]))).conflicts.length, 1);
    // Item and pin failures use savepoints, preserve successful peers and truthful counts.
    target.sqlite.exec("CREATE TRIGGER fail_ref BEFORE INSERT ON media_provider_references WHEN NEW.external_id='fail-ref' BEGIN SELECT RAISE(ABORT,'injected reference failure'); END;");
    const partial = await merge(target.db, payload([item("failed", "comic", "manga", null, [ref("fail-ref")]), item("success", "comic", null, null)], [
      { itemId: "failed", contextType: "library", contextKey: "", pinnedAt: 1 }, { itemId: "success", contextType: "library", contextKey: "", pinnedAt: 2 },
    ]));
    assert.equal(partial.failed.length, 1); assert.equal(partial.inserted, 1); assert.equal(partial.pins.invalid.length, 1); assert.equal(partial.pins.inserted, 1);
    assert.equal(await storage.getSavedTitleWithReferencesByIdWithDb(target.db, "failed"), null);
    let releaseFailure = true;
    const releaseDb = { ...target.db, async runAsync(sql, ...values) {
      if (releaseFailure && sql === "RELEASE SAVEPOINT backup_item;") { releaseFailure = false; throw Error("Injected release failure"); }
      return target.db.runAsync(sql, ...values);
    } };
    const release = await merge(releaseDb, payload([item("release-fail", "comic", null, null)], [{ itemId: "release-fail", contextType: "library", contextKey: "", pinnedAt: 1 }]));
    assert.equal(release.failed.length, 1); assert.equal(release.inserted, 0); assert.equal(release.pins.invalid.length, 1);
    assert.equal(await storage.getSavedTitleWithReferencesByIdWithDb(target.db, "release-fail"), null);
    target.sqlite.exec("CREATE TRIGGER fail_pin BEFORE INSERT ON title_pins WHEN NEW.saved_title_id='pin-fail' BEGIN SELECT RAISE(ABORT,'injected pin failure'); END;");
    const pinFailure = await merge(target.db, payload([item("pin-fail", "comic", null, null)], [{ itemId: "pin-fail", contextType: "library", contextKey: "", pinnedAt: 2 }]));
    assert.equal(pinFailure.inserted, 1); assert.equal(pinFailure.pins.failed.length, 1); assert.equal(pinFailure.pins.inserted, 0);
    const changedTags = { ...cases[0], tags: [], updatedAt: 9000 };
    await merge(target.db, payload([changedTags])); assert.equal(target.sqlite.prepare("SELECT count(*) n FROM title_pins WHERE saved_title_id='movie' AND context_type='tag'").get().n, 0);
    // Invalid writes fail before changing data; schema rejects incompatible raw SQL too.
    await assert.rejects(upsert(target.db, { ...cases[3], primaryFormat: "movie" }));
    await assert.rejects(upsert(target.db, { ...cases[0], medium: "comic", contentFamily: null, primaryFormat: null }));
    await assert.rejects(storage.attachProviderReferenceWithDb(target.db, ref("1", "tmdb", "movie"), "manga"));
    await assert.rejects(storage.attachProviderReferenceWithDb(target.db, ref("0001", "tmdb", "movie"), "movie"));
    await assert.rejects(storage.attachProviderReferenceWithDb(target.db, ref("1", "tmdb", "person"), "movie"));
    await storage.attachProviderReferenceWithDb(target.db, ref("98", "tmdb", "movie"), "ova");
    assert.throws(() => target.sqlite.exec("UPDATE saved_titles SET medium='unknown' WHERE id='manga'"), /constraint/i);
    for (const [medium, family, format] of [["comic", "anime", null], ["audiovisual", "manga", null], ["literature", null, "movie"], ["comic", null, "serial"]]) {
      assert.throws(() => target.sqlite.prepare("UPDATE saved_titles SET medium=?,content_family=?,primary_format=? WHERE id='manga'").run(medium, family, format), /constraint/i);
    }
    target.sqlite.exec("DELETE FROM saved_titles WHERE id='legacy'; DELETE FROM saved_titles WHERE id='tv';");
    assert.equal(target.sqlite.prepare("SELECT count(*) n FROM legacy_saved_title_identities WHERE saved_title_id='legacy'").get().n, 0);
    assert.equal(target.sqlite.prepare("SELECT count(*) n FROM media_provider_references WHERE saved_title_id='tv'").get().n, 0);
    assert.equal(target.sqlite.prepare("SELECT count(*) n FROM title_pins WHERE saved_title_id='tv'").get().n, 0);
    assert.deepEqual(target.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    // Appearance export availability is unchanged; Settings activates only after committed merge.
    assert.equal(Object.hasOwn(createLibraryBackupV6([], [], { status: "unavailable" }), "appearance"), false);
    assert.equal(payload([], [], { appearance: { scheme: "bogus", palette: "bogus" } }).appearance.status, "incompatible");
    const settings = fs.readFileSync("app/(tabs)/ajustes.tsx", "utf8");
    assert.ok(settings.indexOf("await mergeLibraryBackup(payload, uuid)") < settings.indexOf("await activateDeferred(deferredHandle)"));
    assert.match(settings, /createLibraryBackupV6/); assert.match(settings, /payload.version === 6/);
  } finally { source.close(); target.close(); }
}
async function appearanceAfterCommit() {
  const previousInit = productionDbModule.initDb;
  try {
    for (const mode of ["success", "commit-failure", "pin-failure", "appearance-failure"]) {
      const f = fixture(); try {
        await schema.evolveDatabaseSchema(f.db, 0);
        let committed = false, writes = 0;
        const tx = f.db.withTransactionAsync;
        f.db.withTransactionAsync = async task => {
          await tx(async () => { await task(); if (mode === "commit-failure") throw Error("Injected pre-commit failure"); });
          committed = true;
        };
        productionDbModule.initDb = async () => f.db;
        if (mode === "pin-failure") f.sqlite.exec("CREATE TRIGGER fail_pin BEFORE INSERT ON title_pins BEGIN SELECT RAISE(ABORT,'pin failure'); END;");
        const preference = { version: 1, scheme: "dark", palette: "lavender" };
        const coordinator = new AppearanceCoordinator(async () => {
          assert.equal(committed, true, "Appearance write must follow successful restore commit");
          writes++; if (mode === "appearance-failure") throw Error("Appearance persistence failure");
        });
        coordinator.completeHydration(coordinator.beginHydration(), { status: "absent" });
        const handle = coordinator.reserveDeferred(preference);
        const restore = payload([item("commit-check", "comic", "manga", null)], [{ itemId: "commit-check", contextType: "library", contextKey: "", pinnedAt: 1 }], { appearance: { scheme: "dark", palette: "lavender" } });
        if (mode === "commit-failure") {
          await assert.rejects(publicMerge(restore, () => "unused"), /pre-commit/);
          coordinator.discardDeferred(handle);
          assert.equal(writes, 0); assert.equal(committed, false);
          assert.equal(f.sqlite.prepare("SELECT count(*) n FROM saved_titles").get().n, 0);
          assert.equal((await coordinator.activateDeferred(handle)).status, "discarded");
        } else {
          const result = await publicMerge(restore, () => "unused"); assert.equal(result.inserted, 1);
          const activation = await coordinator.activateDeferred(handle);
          assert.equal(writes, 1);
          if (mode === "appearance-failure") assert.notEqual(activation.status, "applied");
          else assert.equal(activation.status, "applied");
          assert.equal(result.pins.failed.length, mode === "pin-failure" ? 1 : 0);
        }
      } finally { f.close(); }
    }
  } finally { productionDbModule.initDb = previousInit; }
}
(async () => { await migrations(); await backupsAndMerge(); await appearanceAfterCommit(); console.log("Section 2 real-SQLite v5 migration/rollback, v1-v6 imports, v6 round-trip/merge, identities/pins/Appearance passed."); })()
  .catch(error => { console.error(error); process.exitCode = 1; });

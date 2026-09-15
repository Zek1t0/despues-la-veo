const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");

require.extensions[".ts"] = function compile(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename });
  module._compile(output.outputText, filename);
};
const originalLoad = Module._load;
Module._load = function mocked(request, parent, isMain) { if (request === "expo-sqlite") return {}; return originalLoad.call(this, request, parent, isMain); };
const { createLibraryBackupV5 } = require("../../../src/core/libraryBackupV5.ts");
const { parseLibraryBackup } = require("../../../src/core/libraryBackup.ts");
const { getLibraryBackupExportDataWithDb } = require("../../../src/storage/libraryBackupExport.ts");
const { mergeLibraryBackupWithDb } = require("../../../src/storage/libraryBackupMerge.ts");
Module._load = originalLoad;

function fixture(label) {
  const file = path.join(os.tmpdir(), `dlv-v5-${label}-${process.pid}-${Date.now()}-${Math.random()}.sqlite`);
  const sqlite = new DatabaseSync(file);
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE saved_titles (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, year INTEGER, poster_url TEXT, overview TEXT, vote_average REAL,
      personal_rating INTEGER CHECK(personal_rating IS NULL OR (typeof(personal_rating)='integer' AND personal_rating BETWEEN 10 AND 100)), genres_json TEXT,
      status TEXT NOT NULL, tags_json TEXT NOT NULL, notes TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE media_provider_references (provider TEXT NOT NULL, resource_namespace TEXT NOT NULL, external_id TEXT NOT NULL, saved_title_id TEXT NOT NULL,
      PRIMARY KEY(provider,resource_namespace,external_id), FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE);
    CREATE TABLE legacy_saved_title_identities (legacy_format TEXT NOT NULL, legacy_provider TEXT NOT NULL, legacy_external_id TEXT NOT NULL, saved_title_id TEXT NOT NULL,
      PRIMARY KEY(legacy_format,legacy_provider,legacy_external_id), FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE);
    CREATE TABLE title_pins (saved_title_id TEXT NOT NULL, context_type TEXT NOT NULL, context_key TEXT NOT NULL, pinned_at INTEGER NOT NULL,
      PRIMARY KEY(saved_title_id,context_type,context_key), FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE);`);
  const normalize = (values) => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const db = {
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...normalize(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...normalize(values)); },
    async runAsync(sql, ...values) { return sqlite.prepare(sql).run(...normalize(values)); },
    async withTransactionAsync(task) { sqlite.exec("BEGIN"); try { await task(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; } },
  };
  return { sqlite, db, close() { sqlite.close(); fs.unlinkSync(file); } };
}
function addItem(sqlite, item, references = [], legacy = null) {
  sqlite.prepare("INSERT INTO saved_titles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(item.id, item.type, item.title, item.year ?? null, item.posterUrl ?? null,
    item.overview ?? null, item.voteAverage ?? null, item.personalRating ?? null, JSON.stringify(item.genres ?? []), item.status ?? "planned", JSON.stringify(item.tags ?? []),
    item.notes ?? null, item.createdAt, item.updatedAt);
  for (const r of references) sqlite.prepare("INSERT INTO media_provider_references VALUES (?,?,?,?)").run(r.provider, r.resourceNamespace, r.externalId, item.id);
  if (legacy) sqlite.prepare("INSERT INTO legacy_saved_title_identities VALUES ('library-backup-v1-v4','manual',?,?)").run(legacy, item.id);
}
function parsed(value) { const result = parseLibraryBackup(JSON.stringify(value)); assert.equal(result.ok, true); return result.payload; }
async function mergeTx(db, payload, ids = ["generated-1", "generated-2", "generated-3"]) { let n = 0, result; await db.withTransactionAsync(async () => { result = await mergeLibraryBackupWithDb(db, payload, () => ids[n++] ?? `generated-${n}`); }); return result; }
function item(id, type, title, rating, tags, notes, status, updatedAt = 200) { return { id, type, title, personalRating: rating, tags, notes, status, genres: ["Drama"], createdAt: 100, updatedAt }; }

async function main() {
  const source = fixture("source"), target = fixture("target");
  try {
    addItem(source.sqlite, item("movie-local", "movie", "Movie 77", 20, ["Shared", "Movie"], "movie note", "done"), [{ provider: "tmdb", resourceNamespace: "movie", externalId: "77" }]);
    addItem(source.sqlite, item("tv-local", "tv", "TV 77", 90, ["Shared", "TV"], "tv note", "watching"), [{ provider: "tmdb", resourceNamespace: "tv", externalId: "77" }]);
    addItem(source.sqlite, item("manual-local", "movie", "Manual", 50, ["Local"], "manual note", "planned"), [], "manual-key");
    source.sqlite.prepare("INSERT INTO title_pins VALUES (?,?,?,?)").run("movie-local", "library", "", 300);
    source.sqlite.prepare("INSERT INTO title_pins VALUES (?,?,?,?)").run("tv-local", "library", "", 301);
    const data = await getLibraryBackupExportDataWithDb(source.db, { status: "available", preference: { version: 1, scheme: "dark", palette: "lavender" } });
    const backup = createLibraryBackupV5(data.items, data.pins, data.appearanceAvailability, "2030-01-01T00:00:00.000Z");
    assert.equal(backup.version, 5); assert.equal(backup.items.length, 3); assert.equal(backup.pins.length, 2);
    const movie = backup.items.find((x) => x.id === "movie-local"), tv = backup.items.find((x) => x.id === "tv-local");
    assert.notEqual(movie.id, tv.id); assert.deepEqual(movie.providerReferences[0], { provider: "tmdb", resourceNamespace: "movie", externalId: "77" });
    assert.deepEqual(tv.providerReferences[0], { provider: "tmdb", resourceNamespace: "tv", externalId: "77" });
    assert.deepEqual(new Set(backup.pins.map((x) => x.itemId)), new Set(["movie-local", "tv-local"]));
    assert.ok(backup.pins.every((x) => !("provider" in x) && !("externalId" in x)));
    assert.equal(backup.items.find((x) => x.id === "manual-local").legacyIdentity.externalId, "manual-key");
    assert.throws(() => createLibraryBackupV5([{ ...item("orphan", "movie", "Orphan", null, [], null, "planned"), providerReferences: [] }], [], { status: "unavailable" }), /identidad portable/);

    const payload = parsed(backup); const first = await mergeTx(target.db, payload);
    assert.equal(first.inserted, 3); assert.equal(first.pins.inserted, 2); assert.equal(first.conflicts.length, 0);
    const rows = target.sqlite.prepare("SELECT id,title,personal_rating,tags_json,notes,status FROM saved_titles ORDER BY id").all();
    assert.equal(rows.length, 3); assert.equal(rows.find((x) => x.id === "movie-local").personal_rating, 20); assert.equal(rows.find((x) => x.id === "tv-local").personal_rating, 90);
    assert.equal(target.sqlite.prepare("SELECT count(*) n FROM title_pins WHERE saved_title_id IN ('movie-local','tv-local')").get().n, 2);
    const repeat = await mergeTx(target.db, payload); assert.equal(repeat.inserted, 0); assert.equal(repeat.skipped, 3); assert.equal(repeat.pins.preserved, 2);

    addItem(target.sqlite, item("occupied", "movie", "Occupant", null, [], null, "planned", 900));
    const remapPayload = parsed({ version: 5, items: [{ ...item("occupied", "movie", "Incoming", 70, ["R"], "r", "done", 500), providerReferences: [{ provider: "catalog", resourceNamespace: "movie", externalId: "x" }] }], pins: [{ itemId: "occupied", contextType: "library", contextKey: "", pinnedAt: 600 }] });
    const remap = await mergeTx(target.db, remapPayload, ["remapped"]); assert.equal(remap.inserted, 1); assert.equal(remap.pins.inserted, 1);
    assert.equal(target.sqlite.prepare("SELECT saved_title_id id FROM media_provider_references WHERE provider='catalog'").get().id, "remapped");
    assert.ok(target.sqlite.prepare("SELECT 1 FROM title_pins WHERE saved_title_id='remapped'").get());

    const resolvePayload = parsed({ version: 5, items: [{ ...item("foreign-id", "movie", "Newer movie", 80, ["Shared"], "new", "watching", 700), providerReferences: [{ provider: "tmdb", resourceNamespace: "movie", externalId: "77" }, { provider: "catalog", resourceNamespace: "work", externalId: "m77" }] }], pins: [{ itemId: "foreign-id", contextType: "library", contextKey: "", pinnedAt: 700 }] });
    const resolved = await mergeTx(target.db, resolvePayload); assert.equal(resolved.updated, 1); assert.equal(resolved.pins.preserved, 1);
    assert.equal(target.sqlite.prepare("SELECT saved_title_id id FROM media_provider_references WHERE provider='catalog' AND external_id='m77'").get().id, "movie-local");
    assert.equal(target.sqlite.prepare("SELECT created_at n FROM saved_titles WHERE id='movie-local'").get().n, 100);

    target.sqlite.prepare("INSERT INTO media_provider_references VALUES ('catalog','work','tv-link','tv-local')").run();
    const conflictPayload = parsed({ version: 5, items: [{ ...item("conflict", "movie", "Conflict", 10, [], null, "done", 999), providerReferences: [{ provider: "tmdb", resourceNamespace: "movie", externalId: "77" }, { provider: "catalog", resourceNamespace: "work", externalId: "tv-link" }] }], pins: [{ itemId: "conflict", contextType: "library", contextKey: "", pinnedAt: 1 }] });
    const conflict = await mergeTx(target.db, conflictPayload); assert.equal(conflict.conflicts.length, 1); assert.equal(conflict.pins.invalid.length, 1);
    assert.equal(target.sqlite.prepare("SELECT title FROM saved_titles WHERE id='movie-local'").get().title, "Newer movie");

    addItem(target.sqlite, item("type-tv", "tv", "Local TV", 88, ["Keep"], "keep note", "watching", 900), [{ provider: "catalog", resourceNamespace: "work", externalId: "type-x" }]);
    const typeConflictPayload = parsed({ version: 5, items: [{ ...item("type-conflict", "movie", "Incoming movie", 11, ["Move"], "move note", "done", 999), providerReferences: [{ provider: "catalog", resourceNamespace: "work", externalId: "type-x" }, { provider: "tmdb", resourceNamespace: "movie", externalId: "177" }] }], pins: [{ itemId: "type-conflict", contextType: "library", contextKey: "", pinnedAt: 11 }] });
    const typeConflict = await mergeTx(target.db, typeConflictPayload);
    assert.equal(typeConflict.conflicts.length, 1); assert.equal(typeConflict.pins.invalid.length, 1);
    assert.equal(target.sqlite.prepare("SELECT 1 FROM media_provider_references WHERE provider='tmdb' AND resource_namespace='movie' AND external_id='177'").get(), undefined);
    assert.deepEqual({ ...target.sqlite.prepare("SELECT type,title,personal_rating,tags_json,notes,status FROM saved_titles WHERE id='type-tv'").get() }, { type: "tv", title: "Local TV", personal_rating: 88, tags_json: '["Keep"]', notes: "keep note", status: "watching" });

    const historicalManualMismatch = parsed({ version: 4, items: [{ ...item("ignored", "tv", "Wrong type", 10, ["Wrong"], "wrong", "done", 999), provider: "manual", externalId: "manual-key" }], pins: [{ provider: "manual", externalId: "manual-key", contextType: "library", contextKey: "", pinnedAt: 4 }] });
    const historicalMismatch = await mergeTx(target.db, historicalManualMismatch);
    assert.equal(historicalMismatch.conflicts.length, 1); assert.equal(historicalMismatch.pins.invalid.length, 1);
    assert.equal(target.sqlite.prepare("SELECT type,title,personal_rating FROM saved_titles WHERE id='manual-local'").get().type, "movie");

    const legacyA = parsed({ version: 5, items: [{ ...item("legacy-a", "movie", "Legacy A old", 80, [], null, "planned", 600), providerReferences: [{ provider: "catalog", resourceNamespace: "work", externalId: "m77" }], legacyIdentity: { format: "library-backup-v1-v4", provider: "manual", externalId: "legacy-A" } }], pins: [] });
    const attachA = await mergeTx(target.db, legacyA); assert.equal(attachA.conflicts.length, 0);
    const repeatA = await mergeTx(target.db, legacyA); assert.equal(repeatA.conflicts.length, 0); assert.equal(repeatA.skipped, 1);
    assert.equal(target.sqlite.prepare("SELECT count(*) n FROM legacy_saved_title_identities WHERE saved_title_id='movie-local' AND legacy_external_id='legacy-A'").get().n, 1);
    const beforeLegacyConflict = target.sqlite.prepare("SELECT title,personal_rating,tags_json,notes,status FROM saved_titles WHERE id='movie-local'").get();
    const legacyB = parsed({ version: 5, items: [{ ...item("legacy-b", "movie", "Must not move", 10, ["Bad"], "bad", "dropped", 1200), providerReferences: [{ provider: "catalog", resourceNamespace: "work", externalId: "m77" }], legacyIdentity: { format: "library-backup-v1-v4", provider: "manual", externalId: "legacy-B" } }], pins: [{ itemId: "legacy-b", contextType: "library", contextKey: "", pinnedAt: 8 }] });
    const attachB = await mergeTx(target.db, legacyB); assert.equal(attachB.conflicts.length, 1); assert.equal(attachB.pins.invalid.length, 1);
    assert.equal(target.sqlite.prepare("SELECT 1 FROM legacy_saved_title_identities WHERE legacy_external_id='legacy-B'").get(), undefined);
    assert.deepEqual(target.sqlite.prepare("SELECT title,personal_rating,tags_json,notes,status FROM saved_titles WHERE id='movie-local'").get(), beforeLegacyConflict);

    const identitylessFree = await mergeTx(target.db, parsed({ version: 5, items: [{ ...item("free-local", "movie", "Free", null, [], null, "planned"), providerReferences: [] }], pins: [] }));
    assert.equal(identitylessFree.inserted, 1);
    const identitylessOccupied = await mergeTx(target.db, parsed({ version: 5, items: [{ ...item("occupied", "movie", "No proof", null, [], null, "planned"), providerReferences: [] }], pins: [] }));
    assert.equal(identitylessOccupied.conflicts.length, 1);
    const manualCollision = parsed({ version: 5, items: [{ ...item("occupied", "movie", "Portable manual", 60, [], null, "planned"), providerReferences: [], legacyIdentity: { format: "library-backup-v1-v4", provider: "manual", externalId: "portable-remap" } }], pins: [{ itemId: "occupied", contextType: "library", contextKey: "", pinnedAt: 7 }] });
    const manualFirst = await mergeTx(target.db, manualCollision, ["manual-remapped"]); assert.equal(manualFirst.inserted, 1); assert.equal(manualFirst.pins.inserted, 1);
    const manualSecond = await mergeTx(target.db, manualCollision, ["must-not-be-used"]); assert.equal(manualSecond.inserted, 0); assert.equal(manualSecond.skipped, 1); assert.equal(manualSecond.pins.preserved, 1);

    const missingPin = await mergeTx(target.db, parsed({ version: 5, items: [], pins: [{ itemId: "missing", contextType: "library", contextKey: "", pinnedAt: 1 }] }));
    assert.equal(missingPin.pins.invalid.length, 1);
    target.sqlite.exec("CREATE TRIGGER fail_v5_item BEFORE INSERT ON saved_titles WHEN NEW.title='Fail item' BEGIN SELECT RAISE(ABORT,'controlled v5 failure'); END;");
    const partial = await mergeTx(target.db, parsed({ version: 5, items: [
      { ...item("failed-item", "movie", "Fail item", null, [], null, "planned"), providerReferences: [{ provider: "fail", resourceNamespace: "movie", externalId: "1" }] },
      { ...item("success-item", "movie", "Success item", null, [], null, "planned"), providerReferences: [{ provider: "ok", resourceNamespace: "movie", externalId: "2" }] }
    ], pins: [{ itemId: "failed-item", contextType: "library", contextKey: "", pinnedAt: 1 }, { itemId: "success-item", contextType: "library", contextKey: "", pinnedAt: 2 }] }));
    assert.equal(partial.failed.length, 1); assert.equal(partial.inserted, 1); assert.equal(partial.pins.invalid.length, 1); assert.equal(partial.pins.inserted, 1);
    assert.equal(target.sqlite.prepare("SELECT 1 FROM saved_titles WHERE id='failed-item'").get(), undefined);
    const duplicate = parsed({ version: 5, items: [
      { ...item("dup-a", "movie", "A", null, [], null, "planned"), providerReferences: [{ provider: "x", resourceNamespace: "y", externalId: "z" }] },
      { ...item("dup-b", "tv", "B", null, [], null, "planned"), providerReferences: [{ provider: "x", resourceNamespace: "y", externalId: "z" }] }
    ], pins: [] }); assert.equal(duplicate.items.length, 0); assert.equal(duplicate.invalid.length, 2);

    const canonicalTmdb = parsed({ version: 5, items: [{ ...item("canonical", "movie", "Canonical", null, [], null, "planned"), providerReferences: [{ provider: "tmdb", resourceNamespace: "movie", externalId: "00077" }] }], pins: [] });
    assert.equal(canonicalTmdb.items[0].providerReferences[0].externalId, "77");
    const canonicalDuplicate = parsed({ version: 5, items: [
      { ...item("canonical-a", "movie", "Canonical A", null, [], null, "planned"), providerReferences: [{ provider: "tmdb", resourceNamespace: "movie", externalId: "00077" }] },
      { ...item("canonical-b", "movie", "Canonical B", null, [], null, "planned"), providerReferences: [{ provider: "tmdb", resourceNamespace: "movie", externalId: "77" }] }
    ], pins: [] });
    assert.equal(canonicalDuplicate.items.length, 0); assert.equal(canonicalDuplicate.invalid.length, 2);
    for (const reference of [
      { provider: "tmdb", resourceNamespace: "person", externalId: "77" },
      { provider: "tmdb", resourceNamespace: "movie", externalId: "abc" },
      { provider: "tmdb", resourceNamespace: "movie", externalId: "0" },
      { provider: "tmdb", resourceNamespace: "movie", externalId: "-1" },
      { provider: "tmdb", resourceNamespace: "movie", externalId: "9007199254740992" },
      { provider: "tmdb", resourceNamespace: "tv", externalId: "77" },
    ]) {
      const invalidTmdb = parsed({ version: 5, items: [{ ...item(`bad-${reference.resourceNamespace}-${reference.externalId}`, "movie", "Bad TMDB", null, [], null, "planned"), providerReferences: [reference] }], pins: [] });
      assert.equal(invalidTmdb.items.length, 0); assert.equal(invalidTmdb.invalid.length, 1);
    }
    const opaqueGeneric = parsed({ version: 5, items: [{ ...item("opaque-generic", "movie", "Opaque", null, [], null, "planned"), providerReferences: [{ provider: "future-catalog", resourceNamespace: "work", externalId: "00077-A" }] }], pins: [] });
    assert.equal(opaqueGeneric.items[0].providerReferences[0].externalId, "00077-A");

    const historical = parsed({ version: 4, items: [
      { ...item("h-movie", "movie", "H movie", 30, [], null, "planned"), provider: "tmdb", externalId: "991" },
      { ...item("h-tv", "tv", "H tv", 40, [], null, "planned"), provider: "tmdb", externalId: "991" },
      { ...item("h-manual", "movie", "H manual", null, [], null, "planned"), provider: "manual", externalId: "hm" }
    ], pins: [{ provider: "tmdb", externalId: "991", contextType: "library", contextKey: "", pinnedAt: 2 }, { provider: "manual", externalId: "hm", contextType: "library", contextKey: "", pinnedAt: 3 }] });
    const historicalResult = await mergeTx(target.db, historical); assert.equal(historicalResult.inserted, 3); assert.equal(historicalResult.pins.invalid.length, 1); assert.equal(historicalResult.pins.inserted, 1);
    assert.ok(target.sqlite.prepare("SELECT 1 FROM media_provider_references WHERE provider='tmdb' AND resource_namespace='movie' AND external_id='991'").get());
    assert.ok(target.sqlite.prepare("SELECT 1 FROM media_provider_references WHERE provider='tmdb' AND resource_namespace='tv' AND external_id='991'").get());
    assert.equal(target.sqlite.prepare("SELECT count(*) n FROM media_provider_references WHERE provider='manual'").get().n, 0);

    const manualRepeat = await mergeTx(target.db, payload); assert.equal(manualRepeat.inserted, 0);
    const futureHistorical = parseLibraryBackup(JSON.stringify({ version: 4, items: [{ ...item("future", "anime", "Future", null, [], null, "planned"), provider: "future", externalId: "1" }], pins: [] }));
    assert.equal(futureHistorical.ok, true); assert.equal(futureHistorical.payload.items.length, 0); assert.equal(futureHistorical.payload.invalid.length, 1);

    const whitespaceSource = fixture("legacy-whitespace-source"), whitespaceTarget = fixture("legacy-whitespace-target");
    try {
      addItem(whitespaceSource.sqlite, item("whitespace-manual", "movie", "Whitespace manual", 55, ["Exact"], "exact note", "planned"), [], " manual-key ");
      const whitespaceData = await getLibraryBackupExportDataWithDb(whitespaceSource.db, { status: "unavailable" });
      const whitespaceBackup = createLibraryBackupV5(whitespaceData.items, whitespaceData.pins, whitespaceData.appearanceAvailability);
      assert.equal(whitespaceBackup.items[0].legacyIdentity.externalId, " manual-key ");
      const whitespaceParsed = parsed(whitespaceBackup);
      assert.equal(whitespaceParsed.items[0].legacyIdentity.externalId, " manual-key ");
      const whitespaceImport = await mergeTx(whitespaceTarget.db, whitespaceParsed); assert.equal(whitespaceImport.inserted, 1);
      const historicalWhitespace = parsed({ version: 4, items: [{ ...item("historical-whitespace", "movie", "Whitespace manual", 55, ["Exact"], "exact note", "planned"), provider: "manual", externalId: " manual-key " }], pins: [] });
      assert.equal(historicalWhitespace.items[0].externalId, " manual-key ");
      const historicalWhitespaceImport = await mergeTx(whitespaceTarget.db, historicalWhitespace);
      assert.equal(historicalWhitespaceImport.inserted, 0); assert.equal(historicalWhitespaceImport.skipped, 1);
      assert.equal(whitespaceTarget.sqlite.prepare("SELECT count(*) n FROM saved_titles").get().n, 1);
      assert.equal(whitespaceTarget.sqlite.prepare("SELECT legacy_external_id FROM legacy_saved_title_identities").get().legacy_external_id, " manual-key ");
    } finally { whitespaceSource.close(); whitespaceTarget.close(); }

    const invalidLegacyExport = fixture("invalid-legacy-export");
    try {
      addItem(invalidLegacyExport.sqlite, item("multi-legacy", "movie", "Multi legacy", null, [], null, "planned"), [{ provider: "catalog", resourceNamespace: "work", externalId: "multi" }], "legacy-one");
      invalidLegacyExport.sqlite.prepare("INSERT INTO legacy_saved_title_identities VALUES ('library-backup-v1-v4','manual','legacy-two','multi-legacy')").run();
      await assert.rejects(() => getLibraryBackupExportDataWithDb(invalidLegacyExport.db, { status: "unavailable" }), /varias identidades manuales legacy/);
    } finally { invalidLegacyExport.close(); }
    console.log("Section 4 backup v5 and historical import verification passed.");
  } finally { source.close(); target.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

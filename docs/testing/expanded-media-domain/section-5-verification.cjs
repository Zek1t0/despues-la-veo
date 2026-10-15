const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");
const previousFetch = global.fetch; let networkCalls = 0;
global.fetch = async () => { networkCalls++; throw Error("Review must not request a provider/catalog network"); };
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "media-review-verify-"));
const opened = [], removed = [], handles = [];
let personalInit = 0, writes = 0;
const originalLoad = Module._load;
function open(name) {
  assert.match(name, /^media-review-[a-z0-9-]+\.db$/);
  const filename = path.join(folder, name), sqlite = new DatabaseSync(filename);
  const params = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  let closed = false;
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, ...values) { return sqlite.prepare(sql).get(...params(values)) ?? null; },
    async getAllAsync(sql, ...values) { return sqlite.prepare(sql).all(...params(values)); },
    async runAsync(sql, ...values) { writes++; const result = sqlite.prepare(sql).run(...params(values)); return { changes: Number(result.changes) }; },
    async withTransactionAsync(task) { sqlite.exec("BEGIN"); try { await task(); sqlite.exec("COMMIT"); } catch(error) { sqlite.exec("ROLLBACK"); throw error; } },
    async closeAsync() { if (!closed) { sqlite.close(); closed = true; } },
    sqlite, filename,
  };
  opened.push(name); handles.push(db); return Promise.resolve(db);
}
Module._load = function(request, parent, isMain) {
  if (request === "expo-sqlite") return { openDatabaseAsync: open, deleteDatabaseAsync: async name => {
    assert.match(name, /^media-review-[a-z0-9-]+\.db$/); removed.push(name); fs.unlinkSync(path.join(folder, name));
  } };
  if (request === "./db" && parent?.filename.includes(`${path.sep}storage${path.sep}`)) return { initDb: async () => { personalInit++; throw Error("Personal DB must never initialize"); } };
  return originalLoad.call(this, request, parent, isMain);
};
const { createReviewSession } = require("../../../src/dev/mediaReview/session.ts");
const { isMediaReviewEnabled } = require("../../../src/dev/mediaReview/mode.ts");
const fixtures = require("../../../src/dev/mediaReview/fixtures.ts");
const { LIBRARY_PIN_CONTEXT } = require("../../../src/core/contextualPin.ts");
const { findUnambiguousTmdbReference } = require("../../../src/core/savedTitleProviderReferences.ts");
const { getSavedTitleByProviderReferenceWithDb } = require("../../../src/storage/savedTitleStorage.ts");
const { upsertSavedTitleAndCleanPinsWithDb } = require("../../../src/storage/savedTitleIntegrity.ts");
const fixture = key => fixtures.reviewFixtures.find(value => value.key === key);

async function main() {
  for (const development of [false, true]) for (const flag of [undefined, "", "0", "true", "1"]) {
    assert.equal(isMediaReviewEnabled(development, flag), development && flag === "1");
    if (!(development && flag === "1")) await assert.rejects(createReviewSession({ development, flag }), /no habilitada/);
  }
  assert.equal(opened.length, 0);
  const session = await createReviewSession({ development: true, flag: "1" });
  assert.equal(opened.length, 2); assert.notEqual(handles[0].filename, handles[1].filename);
  assert.ok(handles.every(db => fs.existsSync(db.filename)));
  for (const db of handles) { assert.equal(sqliteVersion(db), 5); assert.equal(db.sqlite.prepare("PRAGMA foreign_keys").get().foreign_keys, 1); }
  assert.equal((await session.source.getLibraryScreenSnapshot()).items.length, 0);
  assert.equal((await session.restored.getLibraryScreenSnapshot()).items.length, 0);
  const mangaId = await session.save(fixture("manga"));
  const initial = (await session.source.getTitleDetailPinSnapshot(mangaId, {})).item;
  assert.equal(initial.voteAverage, null); assert.equal(initial.personalRating, null); assert.equal(initial.status, "planned"); assert.deepEqual(initial.tags, []);
  assert.equal(await session.save(fixture("manga")), mangaId);
  await session.seed();
  let snapshot = await session.source.getLibraryScreenSnapshot(); assert.equal(snapshot.items.length, 20);
  assert.equal(new Set(snapshot.items.map(item => item.id)).size, 20);
  const shared = snapshot.items.filter(item => item.providerReferences.some(ref => ref.externalId === "900007")); assert.equal(shared.length, 3);
  assert.ok(snapshot.items.some(item => item.providerReferences.some(ref => ref.externalId === "9007199254740993")));
  assert.equal(fixtures.fixtureDetails(fixture("sparse")).snapshot.overview, null);
  assert.equal(fixtures.fixtureDetails(fixture("light-novel")).snapshot.overview.includes("script"), false);
  assert.equal(fixtures.fixtureDetails(fixture("light-novel")).snapshot.overview.includes("https:"), false);
  for (const invalid of fixtures.reviewInvalidCases) assert.throws(() => fixtures.fixtureInput(fixture("manga"), invalid.patch));
  for (const invalid of [null, undefined, 9]) {
    const before = writes;
    await assert.rejects(session.save(fixture("manga"), { voteAverage: invalid }), /voteAverage/);
    assert.equal(writes, before);
  }
  await session.source.updateSavedTitleMetadata(mangaId, { status: "watching", tags: ["TEST personal"], notes: "Nota de la sesión" });
  await session.source.setPersonalRating(mangaId, 87);
  await session.source.setTitlePinState(mangaId, LIBRARY_PIN_CONTEXT, 123);
  const beforeRefresh = (await session.source.getTitleDetailPinSnapshot(mangaId, {})).item;
  await session.save({ ...fixture("manga"), initialTags: ["IGNORAR"] }, { primaryFormat: "one-shot", title: "Título externo TEST actualizado", genres: ["Nuevo género TEST"] });
  const afterRefresh = (await session.source.getTitleDetailPinSnapshot(mangaId, {})).item;
  for (const key of ["id", "createdAt", "status", "tags", "notes", "personalRating"]) assert.deepEqual(afterRefresh[key], beforeRefresh[key]);
  assert.ok(afterRefresh.updatedAt > beforeRefresh.updatedAt); assert.equal(afterRefresh.primaryFormat, "one-shot"); assert.deepEqual(afterRefresh.genres, ["Nuevo género TEST"]);
  assert.equal((await session.source.getTitleDetailPinSnapshot(mangaId, {})).pinnedAt, 123);
  for (const pair of fixtures.reviewRefreshPairs) {
    const item = fixture(pair.fixture);
    const existing = await getSavedTitleByProviderReferenceWithDb(handles[0], item.reference);
    const writeCount = writes;
    if (pair.reject) { await assert.rejects(session.save(item, pair.patch, pair.reference ?? item.reference), /medio/); assert.equal(writes, writeCount); continue; }
    const id = await session.save(item, { ...pair.patch, title: `${item.snapshot.title} · refreshed` }, pair.reference ?? item.reference);
    const refreshed = (await session.source.getTitleDetailPinSnapshot(id, {})).item;
    assert.equal(id, existing.id);
    if (pair.key === "refine-both") { assert.equal(refreshed.contentFamily, "anime"); assert.equal(refreshed.primaryFormat, "tv"); }
    if (pair.key === "preserve-null" || pair.key === "preserve-conflict") { assert.equal(refreshed.contentFamily, "manhwa"); assert.equal(refreshed.primaryFormat, "webtoon"); }
    if (pair.key === "tmdb-less-specific") assert.equal(refreshed.contentFamily, "anime");
    if (pair.key === "ova-tmdb") { assert.equal(refreshed.primaryFormat, "ova"); assert.equal(refreshed.providerReferences.length, 2); assert.equal(findUnambiguousTmdbReference(refreshed).resourceNamespace, "movie"); assert.equal(refreshed.voteAverage, null); }
  }
  const ova = fixture("anime-ova"), ovaId = await session.save(ova, { voteAverage: 7.9 }, ova.additionalReferences[0]);
  await session.save(ova, { contentFamily: null, primaryFormat: null });
  const preserved = (await session.source.getTitleDetailPinSnapshot(ovaId, {})).item;
  assert.equal(preserved.voteAverage, 7.9); assert.equal(preserved.contentFamily, "anime"); assert.equal(preserved.primaryFormat, "ova");
  const json = await session.exportTest(), backup = JSON.parse(json); assert.equal(backup.version, 6);
  assert.equal(Object.hasOwn(backup, "test"), false); assert.equal(Object.hasOwn(backup, "appearance"), false);
  const outcome = await session.importTest(json); assert.equal(outcome.inserted, 20); assert.equal(outcome.pins.inserted, 1);
  const restored = await session.restored.getLibraryScreenSnapshot();
  const sourceById = new Map((await session.source.getLibraryScreenSnapshot()).items.map(item => [item.id, item]));
  for (const item of restored.items) assert.deepEqual(item, sourceById.get(item.id));
  assert.equal(restored.pins[0].savedTitleId, mangaId);
  const cleared = JSON.parse(json), clearedOva = cleared.items.find(item => item.id === ovaId);
  clearedOva.contentFamily = null; clearedOva.primaryFormat = null; clearedOva.updatedAt++;
  await session.importTest(JSON.stringify(cleared));
  const restoredOva = (await session.restored.getTitleDetailPinSnapshot(ovaId, {})).item;
  assert.equal(restoredOva.contentFamily, null); assert.equal(restoredOva.primaryFormat, null);
  assert.equal((await session.source.getTitleDetailPinSnapshot(ovaId, {})).item.primaryFormat, "ova", "restore never writes source DB");
  await upsertSavedTitleAndCleanPinsWithDb(handles[0], { ...initial, id: "test-local-only" });
  await assert.rejects(session.exportTest(), /identidad portable/);
  await session.source.deleteSavedTitle("test-local-only");
  const originalTheme = await session.themePersistence.read(); assert.equal(originalTheme.preference.scheme, "dark");
  await session.themePersistence.write({ ...originalTheme.preference, scheme: "light" }); assert.equal((await session.themePersistence.read()).preference.scheme, "light");
  await session.source.setViewPreference("library.viewMode", "grid"); assert.equal(await session.source.getViewPreference("library.viewMode"), "grid");
  assert.equal(personalInit, 0); assert.equal(networkCalls, 0);
  const testFile = path.join(__dirname, "TEST-section5-review-v6.json"); fs.writeFileSync(testFile, json);
  await session.close();
  const reopened = await createReviewSession({ development: true, flag: "1" });
  assert.deepEqual(reopened.names, session.names, "bounded review names across restart");
  assert.equal((await reopened.source.getLibraryScreenSnapshot()).items.length, 20);
  assert.equal((await reopened.source.getTitleDetailPinSnapshot(mangaId, {})).item.notes, afterRefresh.notes);
  assert.equal((await reopened.restored.getLibraryScreenSnapshot()).items.length, 20);
  await reopened.reset(); assert.deepEqual(removed.sort(), [...new Set(opened)].sort());
  assert.ok(handles.every(db => !fs.existsSync(db.filename))); await assert.rejects(session.save(fixture("manga")), /cerrada/);
  assert.equal(personalInit, 0); assert.equal(networkCalls, 0);
  console.log("Section 5 real-file SQLite: guard, two DBs, shared save/snapshots, corpus, edits/pins, monotonic refresh/ratings, v6 TEST restore/null contrast and scoped cleanup passed. Personal init calls: 0.");
}
const sqliteVersion = db => db.sqlite.prepare("PRAGMA user_version").get().user_version;
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const db of handles) await db.closeAsync(); Module._load = originalLoad; global.fetch = previousFetch;
  for (const name of fs.readdirSync(folder)) { const filename = path.join(folder, name); assert.equal(path.dirname(filename), folder); fs.unlinkSync(filename); }
  fs.rmdirSync(folder);
});

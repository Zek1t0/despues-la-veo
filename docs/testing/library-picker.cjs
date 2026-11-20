const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename,
);
const { localPickerDay, pickerDuration, selectLibraryCandidates, surpriseCandidate, visiblePickerTitles } =
  require("../../src/core/libraryPicker.ts");
const { initialMetadataState } = require("../../src/core/mediaMetadataState.ts");

const movie = { provider: "tmdb", resourceNamespace: "movie", externalId: "10" };
const anime = { provider: "kitsu", resourceNamespace: "anime", externalId: "20" };
const entry = (id, overrides = {}) => ({
  id, title: `Título ${id}`, status: "planned", medium: "audiovisual", contentFamily: null,
  primaryFormat: "movie", tags: ["Favoritos"], genres: ["Acción"], posterUrl: null,
  notes: "Nota personal", personalRating: 70, createdAt: 1, updatedAt: 2, providerReferences: [],
  ...overrides,
});
function withMetadata(item, reference, fields) {
  const base = { ...item, providerReferences: [reference] };
  const metadata = { version: 1, provenance: { reference, fetchedAt: null, checkedAt: null, sourceUpdatedAt: null }, fields };
  return { ...base, metadataState: { ...initialMetadataState(base, [reference]),
    documents: [{ metadata, changedAt: 2 }] } };
}

const day = localPickerDay(new Date(2026, 10, 20, 23, 59));
const tomorrow = localPickerDay(new Date(2026, 10, 21, 0, 0));
const planned = { status: "planned" };
const ids = candidates => candidates.map(candidate => candidate.item.id);
const items = Array.from({ length: 12 }, (_, index) => entry(String(index)));
for (let size = 0; size <= 5; size++) {
  const { daily, eligible } = selectLibraryCandidates(items.slice(0, size), planned, day);
  assert.equal(daily.length, Math.min(3, size));
  assert.equal(new Set(ids(daily)).size, daily.length);
  assert.equal(eligible.length, size);
}
const pick = selectLibraryCandidates(items, planned, day);
assert.deepEqual(ids(pick.daily), ids(selectLibraryCandidates([...items].reverse(), planned, day).daily));
assert.notDeepEqual(ids(pick.daily), ids(selectLibraryCandidates(items, planned, tomorrow).daily));
assert.notDeepEqual(ids(pick.daily), ids(selectLibraryCandidates(items, { ...planned, tag: "Favoritos" }, day).daily));
assert.equal(selectLibraryCandidates([...items, items[0]], planned, day).eligible.length, items.length);
const omitted = pick.eligible.findIndex(candidate => !ids(pick.daily).includes(candidate.item.id));
assert.equal(surpriseCandidate(pick.eligible, () => (omitted + 0.5) / pick.eligible.length), pick.eligible[omitted]);
for (let index = 0; index < pick.eligible.length; index++) {
  assert.equal(surpriseCandidate(pick.eligible, () => (index + 0.5) / pick.eligible.length), pick.eligible[index]);
}
assert.equal(surpriseCandidate([], () => { throw Error("No draw for empty library"); }), undefined);
const removed = pick.daily[0].item.id;
assert.ok(!ids(selectLibraryCandidates(items.filter(item => item.id !== removed), planned, day).daily).includes(removed));
assert.deepEqual(selectLibraryCandidates(items, { status: "done" }, day).eligible, []);

const film = withMetadata(entry("film"), movie, { totalLengthMinutes: 90 });
const episodic = entry("anime", { contentFamily: "anime", primaryFormat: "tv" });
const series = withMetadata(episodic, anime, { totalLengthMinutes: 25 });
const short = withMetadata({ ...episodic, id: "short" }, anime, { episodeLengthMinutes: 24, sensitive: true });
const manual = entry("manual", { manualIdentity: "local", medium: "comic", primaryFormat: null, contentFamily: "manga" });
assert.equal(pickerDuration(manual), null);
assert.equal(pickerDuration(series), null);
assert.equal(pickerDuration(short).unit, "episodio");
assert.equal(pickerDuration({ ...film, providerReferences: [anime] }), null);
for (const value of [undefined, null, 0, -1, NaN, Infinity, 10000001, "90"]) {
  assert.equal(pickerDuration(withMetadata(entry("bad"), movie, { totalLengthMinutes: value })), null);
}
const library = [film, short, series, manual];
const original = JSON.stringify(library);
const visible = visiblePickerTitles(library, true, ["es"]);
assert.ok(!ids(selectLibraryCandidates(visible, {}, day).eligible).includes(short.id));
assert.equal(visiblePickerTitles(library, false, ["es"]).length, 4);
const time = selectLibraryCandidates(visible, { minutes: 90 }, day);
assert.deepEqual(ids(time.daily), ["film"]);
assert.equal(time.missingDuration, 2);
assert.equal(selectLibraryCandidates(visible, { minutes: 89 }, day).overTime, 1);
assert.deepEqual(ids(selectLibraryCandidates(visible, { shortest: true }, day).daily), ["film", "anime", "manual"]);
const combined = selectLibraryCandidates(visible, {
  ...planned, medium: "comic", contentFamily: "manga", genre: "accion", tag: "Favoritos",
}, day);
assert.deepEqual(ids(combined.eligible), ["manual"]);
assert.deepEqual(combined.daily[0].reasons, ["Planeado", "Género: Acción", "Etiqueta: Favoritos"]);
assert.equal(combined.daily[0].item.posterUrl, null);
assert.deepEqual(ids(selectLibraryCandidates(visible, { primaryFormat: "tv" }, day).eligible), ["anime"]);
assert.equal(JSON.stringify(library), original);
console.log("PASS motor local: elegibilidad, fechas, duraciones, visibilidad, muestra y sorpresa sin mutaciones");

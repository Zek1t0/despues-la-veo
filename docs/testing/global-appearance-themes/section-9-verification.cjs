const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const saved = read("app/title/[id].tsx");
const remote = read("app/tmdb/[type]/[id].tsx");
const types = read("src/theme/types.ts");
const bases = read("src/theme/bases.ts");
const baseline = read("src/theme/darkOriginalBaseline.ts");

for (const source of [saved, remote]) {
  assert.match(source, /useAppTheme\(\)/);
  assert.match(source, /theme\.global\.background/);
  assert.doesNotMatch(source, /theme\/colors|\bcolors\./);
  assert.doesNotMatch(source, /paletteId|preference\.palette/);
}

assert.match(types, /personalRatingErrorText: string/);
assert.match(bases, /personalRatingErrorText: "#9b7b7b"/);
assert.match(bases, /personalRatingErrorText: "#7d2020"/);
const ratingErrorBaseline = baseline.slice(
  baseline.indexOf("titleDetailRatingError:"),
  baseline.indexOf("compactDisabledForeground:"),
);
assert.match(ratingErrorBaseline, /"#5a2a2a"/);
assert.match(ratingErrorBaseline, /"semantic\.personalRatingErrorText"/);
assert.match(ratingErrorBaseline, /"#9b7b7b"/);
assert.match(saved, /ratingError[\s\S]*theme\.semantic\.personalRatingErrorText/);
assert.doesNotMatch(saved, /ratingError[\s\S]{0,160}theme\.semantic\.(?:dangerBorder|dangerText|onDangerSurface)/);
assert.match(saved, /theme\.semantic\.dangerSurface/);
assert.match(saved, /theme\.semantic\.onDangerSurface/);
assert.match(saved, /theme\.semantic\.disabledSurface/);
assert.match(saved, /theme\.global\.inputBackground/);

// Notes/draft, PersonalRating, tag and contextual-pin contracts remain present.
for (const needle of [
  "notesDraft", "notesDraftDirty", "preserveNotesDraft", "saveNotesAndBack",
  "PERSONAL_RATING_MIN", "PERSONAL_RATING_MAX", "PersonalRatingIntentQueue",
  "applyPersonalRatingConfirmation", "applyPersonalRatingRollback", "setPersonalRating",
  "addTag", "removeTag", "ContextualPinIntentQueue", "titleDetailPinContextKey",
  "setTitlePinState", "getTitleDetailPinSnapshot",
]) assert.ok(saved.includes(needle), `Saved Detail contract missing ${needle}`);
assert.match(saved, /currentValue \+ delta/);
assert.match(saved, /next < PERSONAL_RATING_MIN \|\| next > PERSONAL_RATING_MAX/);

// Remote lifecycle, credentials, providers and local-preserving re-save path remain intact.
for (const needle of [
  "useTmdbCredential", "sameTmdbRemoteRequest", "isTmdbDetailLoadingVisible",
  "getMovieDetails", "getTvDetails", "getWatchProviders", "getByProviderExternal",
  "saveTmdbTitle", "router.push", "providerLogoUrl",
]) assert.ok(remote.includes(needle), `TMDB Detail contract missing ${needle}`);
assert.match(remote, /theme\.global\.surfaceSecondary/);
assert.match(remote, /theme\.semantic\.disabledSurface/);
assert.doesNotMatch(remote, /updateSavedTitleMetadata|setPersonalRating|setTitlePinState/);

console.log("Section 9 details runtime theme, PersonalRating error parity, draft/rating/tag/pin contracts and TMDB remote/re-save invariants verification passed.");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const search = read("app/(tabs)/buscar.tsx");
const lifecycle = read("src/components/search/useCategorySearch.ts");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { SEARCH_CATEGORIES, searchResultDestination } = require("../../../src/components/search/searchCategories.ts");

function normalizedConsumerBoundary() {
  assert.match(search, /import type \{ ProviderSearchResult \} from "\.\.\/\.\.\/src\/providers\/providerContracts"/);
  assert.match(search, /tmdbMovieSearchCapability, tmdbTvSearchCapability/);
  assert.match(search, /readonly ProviderSearchResult\[\]/);
  assert.match(lifecycle, /capability\.search\(query\)/);

  for (const rawDependency of [
    "TmdbSearchItem",
    "searchMulti",
    "posterUrl(",
    "media_type",
    "poster_path",
    "release_date",
    "first_air_date",
  ]) {
    assert.equal(search.includes(rawDependency), false, `Buscar still consumes ${rawDependency}`);
  }

  for (const normalizedField of [
    "displayTitle",
    "releaseLabel",
    "posterUrl",
    "description",
    "kindLabel",
    "reference.provider",
    "reference.resourceNamespace",
    "reference.externalId",
  ]) {
    assert.equal(search.includes(normalizedField), true, `Buscar does not consume ${normalizedField}`);
  }
}

function identityAndNavigation() {
  const key = (reference) => `${reference.provider}/${reference.resourceNamespace}/${reference.externalId}`;
  const route = (reference) => searchResultDestination(SEARCH_CATEGORIES.find(x => x.id === reference.resourceNamespace), { reference });
  const movie = { provider: "tmdb", resourceNamespace: "movie", externalId: "77" };
  const tv = { provider: "tmdb", resourceNamespace: "tv", externalId: "77" };

  assert.notEqual(key(movie), key(tv));
  assert.equal(route(movie), "/tmdb/movie/77");
  assert.equal(route(tv), "/tmdb/tv/77");
  assert.match(search, /keyExtractor=\{\(item\) => `\$\{item\.reference\.provider\}\/\$\{item\.reference\.resourceNamespace\}\/\$\{item\.reference\.externalId\}`\}/);
  assert.match(search, /selected\?\.destination\(item\)/);
  assert.equal(route({ ...movie, provider: "arbitrary" }), null);
}

function preservedRuntimeBehavior() {
  assert.match(lifecycle, /setTimeout\(\(\) => setDebounced\(query\), 350\)/);
  assert.match(search, /useCategorySearch\(/);
  assert.match(lifecycle, /sameSearchRequest\(identity, active\.current\)/);
  assert.match(search, /tmdbGeneration: isTmdb \? snapshot\?\.generation : undefined/);
  assert.match(search, /snapshot\?\.status === "configured"/);
  assert.match(search, /isTmdb && search\.error !== null \? presentTmdbRemoteError/);
  assert.match(search, /setSearchRetry\(\(value\) => value \+ 1\)/);
  assert.match(lifecycle, /loading: true/);
  assert.match(lifecycle, /if \(isCurrent\(\)\) setState\(\{ identity, items, loading: false/);
  assert.match(search, /currentQuery\.length === 0/);
  assert.match(search, /"No encontré resultados"/);
  assert.doesNotMatch(search, /\.filter\([^\n]*media_type/);
}

normalizedConsumerBoundary();
identityAndNavigation();
preservedRuntimeBehavior();
console.log("Section 3 Buscar verification passed.");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const search = read("app/(tabs)/buscar.tsx");

function normalizedConsumerBoundary() {
  assert.match(search, /import type \{ ProviderSearchResult \} from "\.\.\/\.\.\/src\/providers\/providerContracts"/);
  assert.match(search, /import \{ tmdbSearchCapability \} from "\.\.\/\.\.\/src\/providers\/tmdb\/tmdbAdapter"/);
  assert.match(search, /useState<readonly ProviderSearchResult\[\]>/);
  assert.match(search, /tmdbSearchCapability\.search\(currentQuery\)/);

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
  const route = (reference) => `/${reference.provider}/${reference.resourceNamespace}/${reference.externalId}`;
  const movie = { provider: "tmdb", resourceNamespace: "movie", externalId: "77" };
  const tv = { provider: "tmdb", resourceNamespace: "tv", externalId: "77" };

  assert.notEqual(key(movie), key(tv));
  assert.equal(route(movie), "/tmdb/movie/77");
  assert.equal(route(tv), "/tmdb/tv/77");
  assert.match(search, /keyExtractor=\{\(item\) => `\$\{item\.reference\.provider\}\/\$\{item\.reference\.resourceNamespace\}\/\$\{item\.reference\.externalId\}`\}/);
  assert.match(search, /`\/\$\{item\.reference\.provider\}\/\$\{item\.reference\.resourceNamespace\}\/\$\{item\.reference\.externalId\}`/);
}

function preservedRuntimeBehavior() {
  assert.match(search, /setTimeout\(\(\) => setDebounced\(q\.trim\(\)\), 350\)/);
  assert.match(search, /shouldRunTmdbSearch\(previousObservation, observation\)/);
  assert.match(search, /sameTmdbRemoteRequest\(identity, currentSearchIdentity\.current\)/);
  assert.match(search, /generation: snapshot\.generation/);
  assert.match(search, /snapshot\.status === "configured"/);
  assert.match(search, /presentTmdbRemoteError\(e\)/);
  assert.match(search, /setSearchRetry\(\(value\) => value \+ 1\)/);
  assert.match(search, /setLoading\(true\)/);
  assert.match(search, /if \(isCurrent\(\)\) setLoading\(false\)/);
  assert.match(search, /currentQuery\.length === 0/);
  assert.match(search, /"No encontré resultados"/);
  assert.doesNotMatch(search, /\.filter\([^\n]*media_type/);
}

normalizedConsumerBoundary();
identityAndNavigation();
preservedRuntimeBehavior();
console.log("Section 3 Buscar verification passed.");

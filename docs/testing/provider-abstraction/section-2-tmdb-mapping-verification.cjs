const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  createTmdbMaterializationInput,
  mapTmdbMovieDetails,
  mapTmdbSearchItem,
  mapTmdbSearchResults,
  mapTmdbTvDetails,
  tmdbInitialTags,
} = require("../../../src/providers/tmdb/tmdbMappers.ts");

function searchMapping() {
  const movieInput = {
    id: 77,
    media_type: "movie",
    title: "Película",
    release_date: "2024-03-09",
    poster_path: "/movie.jpg",
    overview: "Resumen de película",
  };
  const tvInput = {
    id: 77,
    media_type: "tv",
    name: "Serie",
    first_air_date: "2021-11-02",
    poster_path: null,
    overview: "Resumen de serie",
  };
  const movieBefore = structuredClone(movieInput);
  const tvBefore = structuredClone(tvInput);

  const movie = mapTmdbSearchItem(movieInput);
  const tv = mapTmdbSearchItem(tvInput);

  assert.deepEqual(movie, {
    reference: { provider: "tmdb", resourceNamespace: "movie", externalId: "77" },
    displayTitle: "Película",
    releaseLabel: "2024",
    posterUrl: "https://image.tmdb.org/t/p/w185/movie.jpg",
    description: "Resumen de película",
    kindLabel: "Película",
  });
  assert.deepEqual(tv, {
    reference: { provider: "tmdb", resourceNamespace: "tv", externalId: "77" },
    displayTitle: "Serie",
    releaseLabel: "2021",
    posterUrl: null,
    description: "Resumen de serie",
    kindLabel: "Serie",
  });
  assert.notDeepEqual(movie.reference, tv.reference);
  assert.deepEqual(movieInput, movieBefore);
  assert.deepEqual(tvInput, tvBefore);

  assert.equal(mapTmdbSearchItem({ id: 5, media_type: "person", name: "Persona" }), null);
  assert.deepEqual(
    mapTmdbSearchResults([movieInput, { id: 5, media_type: "person" }, tvInput]),
    [movie, tv],
  );
  assert.throws(
    () => mapTmdbSearchItem({ ...movieInput, id: 0 }),
    /TMDB/,
  );
}

function detailMapping() {
  const movieInput = {
    id: 101,
    title: "Detalle película",
    release_date: "2023-05-04",
    poster_path: "/detail.jpg",
    overview: "Resumen portable",
    vote_average: 8.4,
    genres: [{ id: 1, name: "Drama" }, { id: 2, name: "Acción" }],
    runtime: 125,
  };
  const tvInput = {
    id: 202,
    name: "Detalle TV",
    first_air_date: "not-a-date",
    poster_path: null,
    overview: "   ",
    vote_average: 7.2,
    genres: [{ id: 3, name: "Comedia" }],
    episode_run_time: [42],
    number_of_seasons: 3,
  };
  const movieBefore = structuredClone(movieInput);
  const tvBefore = structuredClone(tvInput);

  const movie = mapTmdbMovieDetails(movieInput);
  const tv = mapTmdbTvDetails(tvInput);

  assert.deepEqual(movie, {
    reference: { provider: "tmdb", resourceNamespace: "movie", externalId: "101" },
    snapshot: {
      medium: "audiovisual", contentFamily: null, primaryFormat: "movie",
      title: "Detalle película",
      year: 2023,
      posterUrl: "https://image.tmdb.org/t/p/w342/detail.jpg",
      overview: "Resumen portable",
      genres: ["Drama", "Acción"],
      voteAverage: 8.4,
    },
  });
  assert.deepEqual(tv, {
    reference: { provider: "tmdb", resourceNamespace: "tv", externalId: "202" },
    snapshot: {
      medium: "audiovisual", contentFamily: null, primaryFormat: "tv",
      title: "Detalle TV",
      year: null,
      posterUrl: null,
      overview: null,
      genres: ["Comedia"],
      voteAverage: 7.2,
    },
  });
  assert.deepEqual(mapTmdbMovieDetails({ id: 303, title: "Sin fecha" }).snapshot, {
    medium: "audiovisual", contentFamily: null, primaryFormat: "movie",
    title: "Sin fecha",
    year: null,
    posterUrl: null,
    overview: null,
    genres: [],
    voteAverage: null,
  });
  assert.deepEqual(movieInput, movieBefore);
  assert.deepEqual(tvInput, tvBefore);

  assert.deepEqual(Object.keys(movie).sort(), ["reference", "snapshot"]);
  assert.equal(Object.hasOwn(movie, "initialTags"), false);
  for (const enrichment of ["runtime", "episode_run_time", "number_of_seasons", "cast", "crew", "watchProviders"]) {
    assert.equal(Object.hasOwn(movie.snapshot, enrichment), false);
    assert.equal(Object.hasOwn(tv.snapshot, enrichment), false);
  }

  const initialTags = tmdbInitialTags(movieInput);
  assert.deepEqual(initialTags, ["Drama", "Acción"]);
  const materialization = createTmdbMaterializationInput(movie, initialTags);
  assert.deepEqual(materialization, {
    reference: movie.reference,
    snapshot: movie.snapshot,
    initialTags: ["Drama", "Acción"],
  });
  assert.equal(Object.hasOwn(movie, "initialTags"), false);
  assert.throws(() => mapTmdbTvDetails({ id: -1, name: "Inválida" }), /TMDB/);

  const tvTags = tmdbInitialTags(tvInput);
  const tvMaterialization = createTmdbMaterializationInput(tv, tvTags);
  assert.deepEqual(tvTags, ["Comedia"]);
  assert.strictEqual(tvMaterialization.snapshot, tv.snapshot);
  assert.strictEqual(materialization.snapshot, movie.snapshot);
  assert.notStrictEqual(initialTags, movie.snapshot.genres);
  assert.notStrictEqual(tvTags, tv.snapshot.genres);
  const customPolicy = createTmdbMaterializationInput(movie, ["Ver con amigos"]);
  assert.deepEqual(customPolicy.snapshot.genres, ["Drama", "Acción"]);
  assert.deepEqual(customPolicy.initialTags, ["Ver con amigos"]);
  assert.notDeepEqual(customPolicy.snapshot.genres, customPolicy.initialTags);

  for (const map of [mapTmdbMovieDetails, mapTmdbTvDetails]) {
    for (const genres of [undefined, []]) {
      const dto = { id: 404, genres };
      assert.deepEqual(map(dto).snapshot.genres, []);
      assert.deepEqual(tmdbInitialTags(dto), []);
    }
    const dto = { id: 405, genres: [{ name: "" }, { name: "  Drama  " }, { name: "Drama" }] };
    assert.deepEqual(map(dto).snapshot.genres, ["  Drama  ", "Drama"]);
    assert.deepEqual(tmdbInitialTags(dto), ["  Drama  ", "Drama"]);
  }
  assert.deepEqual(movieInput, movieBefore);
  assert.deepEqual(tvInput, tvBefore);
}

function pureDetailMappingDoesNotRequest() {
  const previousFetch = global.fetch;
  global.fetch = () => { throw new Error("Unexpected request inside pure mapper"); };
  try {
    for (const map of [mapTmdbMovieDetails, mapTmdbTvDetails]) {
      const dto = { id: 606, genres: [{ id: 1, name: "Drama" }] };
      const details = map(dto);
      const input = createTmdbMaterializationInput(details, tmdbInitialTags(dto));
      assert.deepEqual(input.snapshot.genres, ["Drama"]);
      assert.deepEqual(input.initialTags, ["Drama"]);
    }
    const source = fs.readFileSync(path.join(__dirname, "../../../src/providers/tmdb/tmdbMappers.ts"), "utf8");
    assert.doesNotMatch(source, /tmdbApi|tmdbClient|tmdbTransport|fetch\s*\(|getMovieDetails|getTvDetails/);
    assert.equal((source.match(/genres\.map/g) || []).length, 1, "one genre DTO interpretation");
  } finally {
    global.fetch = previousFetch;
  }
}

async function searchCapability() {
  const adapterPath = require.resolve("../../../src/providers/tmdb/tmdbAdapter.ts");
  const apiPath = require.resolve("../../../src/providers/tmdb/tmdbApi.ts");
  const previousApi = require.cache[apiPath];
  let observed = null;
  require.cache[apiPath] = {
    id: apiPath,
    filename: apiPath,
    loaded: true,
    exports: {
      searchMulti: async (query, page) => {
        observed = { query, page };
        return { results: [{ id: 9, media_type: "movie", title: "Adaptada" }] };
      },
    },
    children: [],
    paths: [],
  };
  delete require.cache[adapterPath];
  try {
    const { tmdbSearchCapability } = require(adapterPath);
    const results = await tmdbSearchCapability.search("consulta");
    assert.deepEqual(observed, { query: "consulta", page: 1 });
    assert.deepEqual(results[0].reference, {
      provider: "tmdb",
      resourceNamespace: "movie",
      externalId: "9",
    });
  } finally {
    delete require.cache[adapterPath];
    if (previousApi) require.cache[apiPath] = previousApi;
    else delete require.cache[apiPath];
  }
}

function unchangedApiEndpoints() {
  const source = fs.readFileSync(
    path.join(__dirname, "../../../src/providers/tmdb/tmdbApi.ts"),
    "utf8",
  );
  assert.match(source, /searchMulti\(query: string, page = 1\)/);
  assert.match(source, /"\/search\/multi"/);
  assert.match(source, /include_adult: "false"/);
  assert.match(source, /language: "es-AR"/);
  assert.match(source, /`\/movie\/\$\{id\}`/);
  assert.match(source, /`\/tv\/\$\{id\}`/);
}

async function main() {
  searchMapping();
  detailMapping();
  pureDetailMappingDoesNotRequest();
  await searchCapability();
  unchangedApiEndpoints();
  console.log("Section 2 TMDB mapping verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

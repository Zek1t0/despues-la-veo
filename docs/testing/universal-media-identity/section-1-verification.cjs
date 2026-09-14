const assert = require("node:assert/strict");
const fs = require("node:fs");
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
  createProviderReference,
  providerReferencesEqual,
} = require("../../../src/core/providerReference.ts");
const {
  createTmdbProviderReference,
  materializeTmdbSavedTitle,
} = require("../../../src/core/tmdbSavedTitle.ts");

function localItem(overrides = {}) {
  return {
    id: "opaque-local-id",
    type: "tv",
    title: "Título anterior",
    year: 2020,
    posterUrl: "poster-anterior",
    overview: "Resumen anterior",
    voteAverage: 7.1,
    personalRating: 87,
    genres: ["Drama"],
    status: "watching",
    tags: ["Favoritas"],
    notes: "Nota personal",
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

function testUniversalProviderReference() {
  const reference = createProviderReference({
    provider: "future-provider",
    resourceNamespace: "catalog-entry",
    externalId: "Opaque/ID With Case",
  });
  assert.deepEqual(reference, {
    provider: "future-provider",
    resourceNamespace: "catalog-entry",
    externalId: "Opaque/ID With Case",
  });
  assert.equal(Object.isFrozen(reference), true);
  assert.equal(
    providerReferencesEqual(reference, createProviderReference({ ...reference })),
    true
  );
  assert.equal(
    providerReferencesEqual(reference, { ...reference, externalId: "opaque/id with case" }),
    false
  );

  for (const provider of ["", " ", " tmdb", "tmdb ", "\ttmdb"] ) {
    assert.throws(
      () => createProviderReference({
        provider,
        resourceNamespace: "movie",
        externalId: "123",
      }),
      /provider/
    );
  }
  for (const resourceNamespace of ["", " ", " movie", "movie ", "\ttv"] ) {
    assert.throws(
      () => createProviderReference({
        provider: "tmdb",
        resourceNamespace,
        externalId: "123",
      }),
      /resourceNamespace/
    );
  }
  assert.throws(
    () => createProviderReference({
      provider: "tmdb",
      resourceNamespace: "movie",
      externalId: "   ",
    }),
    /externalId/
  );

  const opaqueWhitespace = createProviderReference({
    provider: "future-provider",
    resourceNamespace: "entry",
    externalId: " external-id-owned-by-provider ",
  });
  assert.equal(opaqueWhitespace.externalId, " external-id-owned-by-provider ");
}

function testTmdbCanonicalReference() {
  const movie = createTmdbProviderReference("movie", "00123");
  const sameMovie = createTmdbProviderReference("movie", 123);
  const tv = createTmdbProviderReference("tv", " 123 ");

  assert.deepEqual(movie, {
    provider: "tmdb",
    resourceNamespace: "movie",
    externalId: "123",
  });
  assert.equal(providerReferencesEqual(movie, sameMovie), true);
  assert.equal(providerReferencesEqual(movie, tv), false);
  assert.notDeepEqual(movie, tv);

  for (const invalid of [0, -1, 1.5, "", "abc", "1.0", "1e3", "9007199254740992"]) {
    assert.throws(() => createTmdbProviderReference("movie", invalid), /TMDB/);
  }
  assert.throws(() => createTmdbProviderReference("anime", 123), /namespace/);
}

function testTmdbRefreshPreservesLocalIdentityAndPersonalState() {
  const existing = localItem();
  const reference = createTmdbProviderReference("tv", "00077");
  const refreshed = materializeTmdbSavedTitle(
    reference,
    {
      type: "tv",
      title: "Título actualizado",
      year: 2026,
      posterUrl: "poster-nuevo",
      overview: "Resumen nuevo",
      genres: ["Science Fiction"],
      voteAverage: 9.2,
    },
    existing,
    () => "must-not-be-used",
    2000
  );

  assert.deepEqual(
    {
      id: refreshed.id,
      createdAt: refreshed.createdAt,
      personalRating: refreshed.personalRating,
      status: refreshed.status,
      tags: refreshed.tags,
      notes: refreshed.notes,
    },
    {
      id: existing.id,
      createdAt: existing.createdAt,
      personalRating: existing.personalRating,
      status: existing.status,
      tags: existing.tags,
      notes: existing.notes,
    }
  );
  assert.equal(refreshed.updatedAt, 2001);
  assert.equal(refreshed.title, "Título actualizado");
  assert.equal(refreshed.voteAverage, 9.2);
  assert.equal(Object.hasOwn(refreshed, "provider"), false);
  assert.equal(Object.hasOwn(refreshed, "externalId"), false);

  assert.throws(
    () => materializeTmdbSavedTitle(
      createTmdbProviderReference("movie", 77),
      {
        type: "tv",
        title: "Namespace incorrecto",
        year: null,
        posterUrl: null,
        overview: null,
        genres: [],
        voteAverage: null,
      },
      existing,
      () => "unused",
      3000
    ),
    /no coincide/
  );
}

function testNewTmdbItemUsesLocalDefaults() {
  const created = materializeTmdbSavedTitle(
    createTmdbProviderReference("movie", 99),
    {
      type: "movie",
      title: "Nueva",
      year: null,
      posterUrl: null,
      overview: null,
      genres: ["Drama"],
      voteAverage: 8.2,
    },
    null,
    () => "non-uuid-local-id",
    4000
  );
  assert.equal(created.id, "non-uuid-local-id");
  assert.equal(created.createdAt, 4000);
  assert.equal(created.updatedAt, 4000);
  assert.equal(created.personalRating, null);
  assert.equal(created.status, "planned");
  assert.deepEqual(created.tags, ["Drama"]);
}

testUniversalProviderReference();
testTmdbCanonicalReference();
testTmdbRefreshPreservesLocalIdentityAndPersonalState();
testNewTmdbItemUsesLocalDefaults();
console.log("Section 1 universal media identity contracts verification passed.");

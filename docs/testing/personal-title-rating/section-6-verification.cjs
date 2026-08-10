const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  applyPersonalRatingConfirmation,
  applyPersonalRatingRollback,
  PersonalRatingIntentQueue,
} = require("../../../src/core/personalRatingIntent.ts");
const originalModuleLoad = Module._load;
Module._load = function loadForStorage(request, parent, isMain) {
  if (request === "expo-sqlite") return {};
  return originalModuleLoad.call(this, request, parent, isMain);
};
const {
  setPersonalRatingWithDb,
  updateSavedTitleMetadataWithDb,
} = require("../../../src/storage/savedTitlesRepo.ts");
Module._load = originalModuleLoad;

function createDatabase() {
  const databasePath = path.join(os.tmpdir(), `dlv-rating-section-6-${process.pid}-${Date.now()}.sqlite`);
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE saved_titles (
      id TEXT NOT NULL PRIMARY KEY, provider TEXT NOT NULL, external_id TEXT NOT NULL,
      type TEXT NOT NULL, title TEXT NOT NULL, year INTEGER, poster_url TEXT,
      overview TEXT, vote_average REAL,
      personal_rating INTEGER CHECK (personal_rating IS NULL OR
        (typeof(personal_rating) = 'integer' AND personal_rating BETWEEN 10 AND 100)),
      genres_json TEXT, status TEXT NOT NULL, tags_json TEXT NOT NULL, notes TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_saved_titles_provider_external
      ON saved_titles(provider, external_id);
    CREATE TABLE title_pins (
      saved_title_id TEXT NOT NULL, context_type TEXT NOT NULL, context_key TEXT NOT NULL,
      pinned_at INTEGER NOT NULL,
      PRIMARY KEY(saved_title_id, context_type, context_key),
      FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE
    );
    INSERT INTO saved_titles VALUES
      ('title', 'tmdb', '1', 'movie', 'Title', 2026, NULL, NULL, 7.5,
       87, '["Drama"]', 'planned', '["watch"]', 'draft persisted', 1, 100);
    INSERT INTO title_pins VALUES ('title', 'library', '', 50);
  `);
  const normalize = (params) => params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  const db = {
    async getFirstAsync(sql, ...params) {
      return sqlite.prepare(sql).get(...normalize(params)) ?? null;
    },
    async getAllAsync(sql, ...params) {
      return sqlite.prepare(sql).all(...normalize(params));
    },
    async runAsync(sql, ...params) {
      const result = sqlite.prepare(sql).run(...normalize(params));
      return { changes: Number(result.changes) };
    },
    async withTransactionAsync(task) { await task(); },
  };
  return {
    db,
    row() { return sqlite.prepare("SELECT * FROM saved_titles WHERE id = 'title'").get(); },
    pinCount() { return Number(sqlite.prepare("SELECT COUNT(*) AS count FROM title_pins").get().count); },
    reset() {
      sqlite.exec("UPDATE saved_titles SET personal_rating = 87, status = 'planned', tags_json = '[\"watch\"]', notes = 'draft persisted', updated_at = 100 WHERE id = 'title';");
    },
    close() { sqlite.close(); fs.unlinkSync(databasePath); },
  };
}

function callbacks(events) {
  return {
    onOptimistic(value) { events.push(["optimistic", value]); },
    onConfirmed(state) { events.push(["confirmed", state.confirmed.value, state.confirmed.updatedAt, state.latest]); },
    onRollback(confirmed) { events.push(["rollback", confirmed.value, confirmed.updatedAt]); },
    onError(error) { events.push(["error", error.message]); },
  };
}

async function runQueueTests() {
  {
    const events = [];
    const queue = new PersonalRatingIntentQueue({ value: null, updatedAt: 10 });
    await queue.request(87, async (value) => {
      assert.equal(value, 87);
      return 11;
    }, callbacks(events));
    assert.deepEqual(queue.getConfirmed(), { value: 87, updatedAt: 11 });
    assert.equal(queue.getLatest(), 87);
  }

  {
    const writes = [];
    const events = [];
    const queue = new PersonalRatingIntentQueue({ value: 87, updatedAt: 20 });
    const persist = async (value) => {
      writes.push(value);
      return 20 + writes.length;
    };
    void queue.request(88, persist, callbacks(events));
    void queue.request(89, persist, callbacks(events));
    void queue.request(90, persist, callbacks(events));
    await queue.whenIdle();
    assert.deepEqual(writes, [88, 89, 90]);
    assert.deepEqual(queue.getConfirmed(), { value: 90, updatedAt: 23 });
    assert.equal(queue.getLatest(), 90);
  }

  {
    const events = [];
    const queue = new PersonalRatingIntentQueue({ value: 87, updatedAt: 30 });
    void queue.request(88, async () => { throw new Error("old"); }, callbacks(events));
    void queue.request(89, async () => 31, callbacks(events));
    await queue.whenIdle();
    assert.equal(queue.getLatest(), 89);
    assert.deepEqual(queue.getConfirmed(), { value: 89, updatedAt: 31 });
    assert.equal(events.some(([kind]) => kind === "rollback"), false);
    assert.equal(events.some(([kind]) => kind === "error"), false);
  }

  {
    const events = [];
    const queue = new PersonalRatingIntentQueue({ value: 87, updatedAt: 40 });
    await queue.request(88, async () => { throw new Error("final"); }, callbacks(events));
    assert.equal(queue.getLatest(), 87);
    assert.deepEqual(events.slice(-2), [["rollback", 87, 40], ["error", "final"]]);
    await queue.request(91, async () => 41, callbacks(events));
    assert.deepEqual(queue.getConfirmed(), { value: 91, updatedAt: 41 });
  }

  {
    const queue = new PersonalRatingIntentQueue({ value: 87, updatedAt: 50 });
    await queue.request(null, async (value) => {
      assert.equal(value, null);
      return 51;
    }, callbacks([]));
    assert.deepEqual(queue.getConfirmed(), { value: null, updatedAt: 51 });
  }

  {
    const events = [];
    const queue = new PersonalRatingIntentQueue({ value: 87, updatedAt: 60 });
    await queue.request(null, async () => { throw new Error("remove"); }, callbacks(events));
    assert.deepEqual(queue.getConfirmed(), { value: 87, updatedAt: 60 });
    assert.equal(queue.getLatest(), 87);
  }

  {
    const queue = new PersonalRatingIntentQueue({ value: null, updatedAt: 70 });
    const writes = [];
    const persist = async (value) => {
      writes.push(value);
      return 70 + writes.length;
    };
    for (const value of [87, 88, 91, null]) void queue.request(value, persist, callbacks([]));
    await queue.whenIdle();
    assert.deepEqual(writes, [87, 88, 91, null]);
    assert.deepEqual(queue.getConfirmed(), { value: null, updatedAt: 74 });
  }
}

async function runRapidAdjustmentTests() {
  const exercise = async (initial, deltas) => {
    const queue = new PersonalRatingIntentQueue({ value: initial, updatedAt: 1 });
    const writes = [];
    const adjust = (delta) => {
      const currentValue = queue.getLatest();
      if (currentValue === null) return;
      const next = currentValue + delta;
      if (next < 10 || next > 100) return;
      void queue.request(next, async (value) => {
        writes.push(value);
        return 2 + writes.length;
      }, callbacks([]));
    };
    for (const delta of deltas) adjust(delta);
    await queue.whenIdle();
    return { latest: queue.getLatest(), writes };
  };

  assert.deepEqual(await exercise(87, [1, 1, 1]), {
    latest: 90,
    writes: [88, 89, 90],
  });
  assert.deepEqual(await exercise(87, [1, -1]), {
    latest: 87,
    writes: [88, 87],
  });
  assert.deepEqual(await exercise(100, [1]), { latest: 100, writes: [] });
  assert.deepEqual(await exercise(10, [-1]), { latest: 10, writes: [] });
}

async function runMetadataRaceTests() {
  const fixture = createDatabase();
  try {
    // Orden A: rating y luego metadata.
    await setPersonalRatingWithDb(fixture.db, "title", 88, () => 101);
    const afterMetadata = await updateSavedTitleMetadataWithDb(
      fixture.db, "title", { status: "watching" }, () => 102
    );
    assert.equal(afterMetadata.personalRating, 88);
    assert.equal(afterMetadata.status, "watching");
    assert.equal(fixture.row().personal_rating, 88);
    assert.equal(fixture.pinCount(), 1);

    // Orden B: metadata y luego rating.
    fixture.reset();
    await updateSavedTitleMetadataWithDb(
      fixture.db, "title", { status: "done" }, () => 101
    );
    await setPersonalRatingWithDb(fixture.db, "title", 88, () => 102);
    assert.equal(fixture.row().personal_rating, 88);
    assert.equal(fixture.row().status, "done");

    // La intención se solicita mientras metadata está en progreso, pero ambos
    // turnos se ejecutan completos y serializados.
    fixture.reset();
    let serial = Promise.resolve();
    const runSerial = (task) => {
      const result = serial.then(task, task);
      serial = result.then(() => undefined, () => undefined);
      return result;
    };
    const metadataWrite = runSerial(() => updateSavedTitleMetadataWithDb(
      fixture.db, "title", { notes: "new notes" }, () => 101
    ));
    const ratingWrite = runSerial(() => setPersonalRatingWithDb(
      fixture.db, "title", 89, () => 102
    ));
    await Promise.all([metadataWrite, ratingWrite]);
    assert.equal(fixture.row().personal_rating, 89);
    assert.equal(fixture.row().notes, "new notes");
    assert.equal(fixture.row().tags_json, '["watch"]');
    assert.equal(fixture.row().updated_at, 102);
  } finally {
    fixture.close();
  }
}

function runSharedTimestampTests() {
  const metadataState = {
    personalRating: 87,
    updatedAt: 200,
    status: "watching",
    notesDraft: "draft sin guardar",
    dirtyNotes: true,
  };
  assert.deepEqual(
    applyPersonalRatingRollback(metadataState, { value: 87, updatedAt: 100 }),
    metadataState
  );
  assert.deepEqual(
    applyPersonalRatingConfirmation(metadataState, {
      confirmed: { value: 88, updatedAt: 201 }, latest: 88,
    }),
    { ...metadataState, personalRating: 88, updatedAt: 201 }
  );
  assert.deepEqual(
    applyPersonalRatingConfirmation(metadataState, {
      confirmed: { value: 88, updatedAt: 150 }, latest: 89,
    }),
    { ...metadataState, personalRating: 89 }
  );
}

function runStructuralIntegrationChecks() {
  const root = path.resolve(__dirname, "../../..");
  const detail = fs.readFileSync(path.join(root, "app/title/[id].tsx"), "utf8");
  const repo = fs.readFileSync(path.join(root, "src/storage/savedTitlesRepo.ts"), "utf8");

  assert.match(detail, /Tu puntuación/);
  assert.match(detail, /TMDB/);
  assert.match(detail, /Sin calificar/);
  assert.match(detail, /INITIAL_PERSONAL_RATING = 70/);
  assert.match(detail, /delta: -1[\s\S]*delta: 1/);
  assert.match(detail, /next < PERSONAL_RATING_MIN \|\| next > PERSONAL_RATING_MAX/);
  assert.match(detail, /requestPersonalRating\(null\)/);
  assert.match(detail, /setPersonalRating\(savedTitleId, value\)/);
  assert.match(detail, /updateSavedTitleMetadata\(savedTitleId, patch\)/);
  assert.doesNotMatch(detail, /getSavedTitleById\(savedTitleId\)/);
  assert.match(detail, /setRatingPending\(false\)[\s\S]*setRatingError\(null\)[\s\S]*visibleTitleId\.current = savedTitleId/);
  assert.match(detail, /ratingQueue[\s\S]*ratingQueue\.getLatest\(\)/);
  const adjustHandler = detail.match(/const adjustPersonalRating[\s\S]*?const togglePin/)?.[0] ?? "";
  assert.match(adjustHandler, /ratingIntentQueues\.current\.get\(item\.id\)/);
  assert.match(adjustHandler, /ratingQueue\?\.getLatest\(\) \?\? item\.personalRating/);
  assert.doesNotMatch(adjustHandler, /item\.personalRating \+ delta/);
  assert.match(detail, /preserveNotesDraft: true/);
  assert.doesNotMatch(detail, /requestPersonalRating[\s\S]{0,500}load\(/);
  const ratingHandler = detail.match(/const requestPersonalRating[\s\S]*?const adjustPersonalRating/)?.[0] ?? "";
  assert.doesNotMatch(ratingHandler, /setNotes|notesDraft|setDirtyNotes/);
  assert.match(repo, /UPDATE saved_titles[\s\S]*personal_rating = \?, updated_at = \?[\s\S]*WHERE id = \?/);
  assert.doesNotMatch(repo.match(/function setPersonalRatingWithDb[\s\S]*?^}/m)?.[0] ?? "", /INSERT|ON CONFLICT/i);
  assert.match(repo, /function updateSavedTitleMetadataWithDb[\s\S]*getSavedTitleByIdWithDb[\s\S]*upsertSavedTitleAndCleanPinsWithDb/);
  assert.match(repo, /function updateSavedTitleMetadata\([\s\S]*runSerializedStorageMutation[\s\S]*withTransactionAsync/);
}

runQueueTests()
  .then(runRapidAdjustmentTests)
  .then(runMetadataRaceTests)
  .then(() => {
    runSharedTimestampTests();
    runStructuralIntegrationChecks();
    console.log("Section 6 personal rating editor and intent queue verification passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

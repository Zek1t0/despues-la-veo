import { granularOrder, newGranularUuid } from "../core/granularTracking";
import { createTmdbGuideAdapter, type GuideFetch, type GuideEpisode, type SeasonGuide, type SeasonIndexEntry } from "../providers/tmdb/tmdbGuide";
import { TmdbError } from "../providers/tmdb/tmdbErrors";
import { initDb } from "./db";
import { attachReference, mutation, resolveIdentity, touch } from "./granularRepo";
import { getProgressClassificationWithDb, type ProgressDatabase, type ProgressWriteDb } from "./personalProgressRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";

import { guideEvidenceCurrent } from "../core/granularCoverage";
export { GUIDE_VALIDITY_MS, guideEvidenceCurrent } from "../core/granularCoverage";

export type GuideScope = { ownerId: string; seriesId: string; language: string; season: number };
type IndexRow = { checked_at: number; payload: string };
type Snapshot = IndexRow & { revision: number; status: "accredited" | "partial" | "stale"; issues: string };
type Member = GuideEpisode & { unitId: string };
type Payload = { guide: Omit<SeasonGuide, "issues" | "episodes">; members: Member[] };

const key = (scope: GuideScope) => [scope.ownerId, scope.seriesId, scope.language, scope.season] as const;
const selector = "owner_id=? AND series_id=? AND language=? AND season=?";
async function readSnapshot(db: ProgressWriteDb, scope: GuideScope) {
  return db.getFirstAsync<Snapshot>(`SELECT * FROM granular_guide_snapshots WHERE ${selector}`, ...key(scope));
}
async function readIndex(db: ProgressWriteDb, scope: GuideScope) {
  return db.getFirstAsync<IndexRow>("SELECT * FROM granular_guide_indices WHERE owner_id=? AND series_id=? AND language=?", ...key(scope).slice(0,3));
}
async function hasReference(db: ProgressWriteDb, scope: GuideScope) {
  return !!await db.getFirstAsync(`SELECT 1 FROM media_provider_references
    WHERE saved_title_id=? AND provider='tmdb' AND resource_namespace='tv' AND external_id=?`, scope.ownerId, scope.seriesId);
}
async function assertGuideOwner(db: ProgressWriteDb, scope: GuideScope) {
  const classification = await getProgressClassificationWithDb(db, scope.ownerId);
  if (!await hasReference(db, scope) || classification.medium !== "audiovisual" ||
      classification.primaryFormat === "movie" || classification.primaryFormat === "music") {
    throw new Error("El título no conserva una referencia TMDB de serie compatible.");
  }
  return JSON.stringify(classification);
}

export type GranularGuideView = { index: SeasonIndexEntry[]; indexCheckedAt: number | null; snapshot: Payload | null; revision: number | null; checkedAt: number | null; issues: string[]; status: Snapshot["status"] };
export function readGranularGuide(scope: GuideScope, db?: ProgressDatabase, now = Date.now()): Promise<GranularGuideView | null> {
  return runSerializedStorageMutation<GranularGuideView | null>(async () => {
    const connection = db ?? await initDb();
    let result: GranularGuideView | null = null;
    await connection.withTransactionAsync(async () => {
      const row = await readSnapshot(connection, scope);
      const index = await readIndex(connection, scope);
      if (!row && !index) return;
      const valid = await assertGuideOwner(connection, scope).then(() => true, () => false);
      const indexCurrent = !!index && guideEvidenceCurrent(index.checked_at, now);
      const indexEntries: SeasonIndexEntry[] = index ? JSON.parse(index.payload) : [];
      const payload: Payload | null = row ? JSON.parse(row.payload) : null;
      const indexed = indexEntries.find(item => item.number === scope.season);
      const matching = !!indexed && indexed.id === payload?.guide.id && indexed.count === payload.members.length;
      result = { index: indexEntries, indexCheckedAt: index?.checked_at ?? null, snapshot: payload, revision: row?.revision ?? null,
        checkedAt: row?.checked_at ?? null, issues: row ? JSON.parse(row.issues) as string[] : [],
        status: !valid || !indexCurrent || (row && (!guideEvidenceCurrent(row.checked_at, now) || (row.status === "accredited" && !matching)))
          ? "stale" as const : row?.status ?? "partial" };
    });
    return result;
  });
}

type Options = { fetch?: GuideFetch; validatedContract?: boolean; db?: ProgressDatabase; now?: () => number; uuid?: () => string };
const active = new Map<string, { requestKey: string; signal: AbortSignal; promise: Promise<void> }>();

export function downloadGranularGuide(scope: GuideScope, signal: AbortSignal, options: Options = {}): Promise<void> { return download(scope, signal, options, false); }
export function downloadGranularGuideIndex(scope: Omit<GuideScope, "season">, signal: AbortSignal, options: Options = {}): Promise<void> {
  return download({ ...scope, season: 0 }, signal, options, true);
}
function download(scope: GuideScope, signal: AbortSignal, options: Options, indexOnly: boolean): Promise<void> {
  scope = { ...scope };
  const requestKey = JSON.stringify([indexOnly, ...key(scope)]);
  const previous = active.get(scope.ownerId);
  if (previous?.requestKey === requestKey && !previous.signal.aborted && !signal.aborted) {
    // A joined caller may leave without cancelling the owner's download.
    return new Promise<void>((resolve, reject) => {
      const abort = () => reject(new TmdbError("aborted"));
      signal.addEventListener("abort", abort, { once: true });
      previous.promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }
  if (previous && !previous.signal.aborted) return Promise.reject(new Error("Ya hay una descarga activa para este título."));
  if (signal.aborted) return Promise.reject(new TmdbError("aborted"));
  const uuid = options.uuid ?? newGranularUuid, now = options.now ?? Date.now;
  function ensureActive() {
    if (signal.aborted || active.get(scope.ownerId)?.promise !== promise) throw new TmdbError("aborted");
  }
  const promise = Promise.resolve().then(async () => {
    const db = options.db ?? await initDb();
    const { captured, cached } = await runSerializedStorageMutation(async () => ({
      captured: await assertGuideOwner(db, scope), cached: await readIndex(db, scope),
    }));
    ensureActive();
    const fetch = options.fetch ?? (await import("../providers/tmdb/tmdbClient")).tmdbFetch;
    const adapter = createTmdbGuideAdapter(fetch);
    if (indexOnly) {
      if (cached && guideEvidenceCurrent(cached.checked_at, now())) return;
      const entries = await adapter.index(scope.seriesId, scope.language, signal);
      const payload = JSON.stringify(entries), checked = now();
      await mutation(scope.ownerId, db, async connection => {
        ensureActive();
        if (await assertGuideOwner(connection, scope) !== captured) throw Error("El título cambió durante la consulta.");
        await connection.runAsync(`INSERT INTO granular_guide_indices VALUES(?,?,?,?,?)
          ON CONFLICT(owner_id,series_id,language) DO UPDATE SET checked_at=excluded.checked_at,payload=excluded.payload`,
          scope.ownerId, scope.seriesId, scope.language, checked, payload);
        const changed = !cached || payload !== cached.payload || !guideEvidenceCurrent(cached.checked_at, checked);
        if (changed) await touch(connection, scope.ownerId);
        ensureActive();
        return { value: undefined, changed };
      });
      return;
    }
    let index = cached;
    let guide: SeasonGuide;
    try {
      if (!index || !guideEvidenceCurrent(index.checked_at, now())) {
        const entries = await adapter.index(scope.seriesId, scope.language, signal);
        index = { checked_at: now(), payload: JSON.stringify(entries) };
      }
      ensureActive();
      guide = await adapter.season(scope.seriesId, scope.season, scope.language, signal);
    } catch (error) {
      ensureActive();
      await mutation(scope.ownerId, db, async connection => {
        ensureActive();
        if (await assertGuideOwner(connection, scope) !== captured) throw Error("El título cambió durante la consulta.");
        ensureActive();
        const current = await readSnapshot(connection, scope);
        const status = !(error instanceof TmdbError) || error.kind === "invalid-response" ? "partial" : "stale";
        const issues = JSON.stringify([status === "partial" ? "Respuesta editorial inválida." : "No se pudo actualizar la guía."]);
        const changed = !!current && (current.status !== status || current.issues !== issues);
        if (changed) {
          await connection.runAsync(`UPDATE granular_guide_snapshots SET status=?,issues=?,revision=revision+1 WHERE ${selector}`, status, issues, ...key(scope));
          await touch(connection, scope.ownerId);
        }
        ensureActive();
        return { value: undefined, changed };
      });
      throw error;
    }

    const selectedIndex = index;
    await mutation(scope.ownerId, db, async connection => {
      ensureActive();
      if (await assertGuideOwner(connection, scope) !== captured) throw Error("El título cambió durante la consulta.");
      const checked = now();
      const entries: SeasonIndexEntry[] = JSON.parse(selectedIndex.payload);
      const entry = entries.find(value => value.number === scope.season);
      const issues = [...guide.issues];
      const sameScope = entry?.id === guide.id;
      if (!sameScope || entry.count === null || entry.count !== guide.episodes.length ||
          !guideEvidenceCurrent(selectedIndex.checked_at, checked)) issues.push("Sin concordancia con el índice del alcance.");
      if (!options.fetch || options.validatedContract !== true) issues.push("Contrato del contador pendiente de aceptación en runtime.");
      const accredited = issues.length === 0;
      const current = await readSnapshot(connection, scope);
      let payload: Payload | null = current ? JSON.parse(current.payload) : null;
      let durableChanged = false;

      const knownCoordinates = new Map(guide.episodes.map(episode => [episode.id, episode.number]));
      const safePartial = sameScope && guide.issues.length === 0 &&
        (!payload || (payload.guide.id === guide.id &&
          payload.members.every(member => knownCoordinates.get(member.id) === member.number)));
      let replaceSnapshot = accredited || safePartial;
      if (replaceSnapshot) {
        const materialized = await storeGuideUnits(connection, scope, guide, accredited, uuid);
        if (materialized) {
          durableChanged = materialized.changed;
          payload = { guide: { id: guide.id, number: guide.number, title: guide.title }, members: materialized.members };
        } else {
          replaceSnapshot = false;
        }
      }
      if (!replaceSnapshot && payload) issues.push("Se conserva el snapshot anterior por evidencia incompatible.");
      if (index !== cached) {
        await connection.runAsync(`INSERT INTO granular_guide_indices VALUES(?,?,?,?,?)
          ON CONFLICT(owner_id,series_id,language) DO UPDATE SET checked_at=excluded.checked_at,payload=excluded.payload`,
          scope.ownerId, scope.seriesId, scope.language, selectedIndex.checked_at, selectedIndex.payload);
      }
      ensureActive();
      const status = accredited ? "accredited" : "partial";
      const serialized = JSON.stringify(payload), diagnostics = JSON.stringify(issues);
      const changed = durableChanged || !current || current.status !== status || current.payload !== serialized || current.issues !== diagnostics ||
        (index !== cached && (!cached || cached.payload !== selectedIndex.payload || !guideEvidenceCurrent(cached.checked_at, checked)));
      const lastChecked = replaceSnapshot || !current ? checked : current.checked_at;
      if (changed || current?.checked_at !== lastChecked) {
        await connection.runAsync(`INSERT INTO granular_guide_snapshots VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(owner_id,series_id,language,season) DO UPDATE SET revision=excluded.revision,checked_at=excluded.checked_at,
          status=excluded.status,payload=excluded.payload,issues=excluded.issues`, ...key(scope),
          (current?.revision ?? 0) + Number(changed), lastChecked, status, serialized, diagnostics);
      }

      if (changed) await touch(connection, scope.ownerId);
      if (await assertGuideOwner(connection, scope) !== captured) throw Error("El título cambió durante la consulta.");
      ensureActive();
      return { value: undefined, changed };
    });
  }).finally(() => {
    if (active.get(scope.ownerId)?.promise === promise) active.delete(scope.ownerId);
  });
  active.set(scope.ownerId, { requestKey, signal, promise });
  return promise;
}

async function storeGuideUnits(db: ProgressWriteDb, scope: GuideScope, guide: SeasonGuide, accredited: boolean, uuid: () => string) {
  const reference = (namespace: string, externalId: string) => ({
    provider: "tmdb", parentNamespace: "tv", parentId: scope.seriesId, namespace, externalId,
  });
  const ownerId = scope.ownerId;
  const resolve = async (kind: "group" | "unit", namespace: string, externalId: string) => {
    const existing = await db.getFirstAsync<{ entity_id: string }>(`SELECT entity_id FROM granular_${kind}_references
      WHERE provider='tmdb' AND parent_namespace='tv' AND parent_id=? AND namespace=? AND external_id=?`,
      scope.seriesId, namespace, externalId);
    return resolveIdentity(db, kind, { ownerId, id: existing?.entity_id ?? uuid(), reference: reference(namespace, externalId) });
  };
  const group = await resolve("group", "season", guide.id);
  const planned = [];
  const plannedIds = new Set<string>();
  for (const episode of guide.episodes) {
    const identity = await resolve("unit", "episode", episode.id);
    const old = await db.getFirstAsync<{ group_id: string | null; coordinate: string; retired: number }>(
      "SELECT group_id,coordinate,retired FROM granular_units WHERE id=?", identity.id);
    const coordinate = { mode: "season-episode", season: guide.number, episode: episode.number } as const;
    const structural = !old || old.group_id !== group.id || old.coordinate !== JSON.stringify(coordinate) || !!old.retired;
    if (!accredited && old && structural) return null;
    if (plannedIds.has(identity.id)) throw Error("UUID repetido al preparar el inventario.");
    plannedIds.add(identity.id);
    planned.push({ episode, identity, coordinate, structural });
  }
  const prior = await db.getAllAsync<{ id: string; coordinate: string }>(`SELECT u.id,u.coordinate FROM granular_units u JOIN granular_unit_references r
    ON r.owner_id=u.owner_id AND r.entity_id=u.id WHERE u.owner_id=? AND u.group_id=? AND u.retired=0
    AND r.provider='tmdb' AND r.parent_namespace='tv' AND r.parent_id=? AND r.namespace='episode'`, ownerId, group.id, scope.seriesId);
  const existingCoordinates = new Map(prior.map(row => [row.coordinate, row.id]));
  if (!accredited && planned.some(({ coordinate, identity }) => {
    const occupant = existingCoordinates.get(JSON.stringify(coordinate));
    return occupant !== undefined && occupant !== identity.id;
  })) return null;

  const groupLabel = `Temporada ${guide.number}`;
  const groupWrite = await db.runAsync(`INSERT INTO granular_groups VALUES(?,?,'season',?)
    ON CONFLICT(id) DO UPDATE SET label=excluded.label WHERE label<>excluded.label`, group.id, ownerId, groupLabel);
  await attachReference(db, "group", ownerId, group.id, group.attach);
  let changed = groupWrite.changes > 0;
  const members: Member[] = [], presentIds = new Set<string>(), structuralIds = new Set<string>();
  for (const { episode, identity, coordinate, structural } of planned) {
    const label = episode.title ? [...episode.title.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, " ")].slice(0,120).join("").trim() || null : null;
    const write = await db.runAsync(`INSERT INTO granular_units VALUES(?,?,?,?,?,?,?,?,?,0)
      ON CONFLICT(id) DO UPDATE SET group_id=excluded.group_id,coordinate=excluded.coordinate,label=excluded.label,
      sort_kind=excluded.sort_kind,sort_group=excluded.sort_group,sort_whole=excluded.sort_whole,sort_fraction=excluded.sort_fraction,retired=0
      WHERE group_id IS NOT excluded.group_id OR coordinate<>excluded.coordinate OR label IS NOT excluded.label OR retired<>0`,
      identity.id, ownerId, group.id, JSON.stringify(coordinate), label, ...granularOrder(coordinate));
    await attachReference(db, "unit", ownerId, identity.id, identity.attach);
    if (write.changes) changed = true;
    if (write.changes && structural) structuralIds.add(identity.id);
    members.push({ ...episode, unitId: identity.id });
    presentIds.add(identity.id);
  }
  if (accredited) for (const row of prior) {
    if (presentIds.has(row.id)) continue;
    await db.runAsync("UPDATE granular_units SET retired=1 WHERE owner_id=? AND id=?", ownerId, row.id);
    structuralIds.add(row.id);
    changed = true;
  }
  if (structuralIds.size) await invalidateOtherScopes(db, scope, guide.id, structuralIds);
  return { members, changed };
}

async function invalidateOtherScopes(db: ProgressWriteDb, scope: GuideScope, guideId: string, structuralIds: ReadonlySet<string>) {
  const candidates = await db.getAllAsync<{ language: string; season: number; payload: string }>(
    "SELECT language,season,payload FROM granular_guide_snapshots WHERE owner_id=? AND series_id=? AND status='accredited' AND (language<>? OR season<>?)",
    ...key(scope));
  for (const other of candidates) {
    const payload = JSON.parse(other.payload) as Payload | null;
    if (payload && (other.season === scope.season || payload.guide.id === guideId || payload.members.some(member => structuralIds.has(member.unitId)))) {
      await db.runAsync(`UPDATE granular_guide_snapshots SET status='stale',revision=revision+1 WHERE ${selector}`,
        scope.ownerId, scope.seriesId, other.language, other.season);
    }
  }
}

import { civilConsumptionDate, granularCompatible, granularOrder, granularUuid } from "../core/granularTracking";
import { nextProgressTimestamp, parseProgressPosition, type ProgressPosition } from "../core/personalProgress";
import { initDb } from "./db";
import { publishLibraryInvalidation } from "./libraryInvalidation";
import { getProgressClassificationWithDb, type ProgressDatabase, type ProgressWriteDb } from "./personalProgressRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";

type Reference = { provider: string; parentNamespace: string; parentId: string; namespace: string; externalId: string };
type Identity = { ownerId: string; id?: string; reference?: Reference };
type UnitInput = Identity & { groupId: string | null; coordinate: ProgressPosition; label: string | null };
type UnitRow = {
  id: string; owner_id: string; group_id: string | null; coordinate: string; label: string | null;
  sort_kind: number; sort_group: number; sort_whole: number; sort_fraction: string; retired: number;
};
type DecisionRow = { marked: number; consumed_on: string | null; revision: number; updated_at: number };
type DecisionIntent = { unitId: string; expectedRevision: number | null; marked: boolean; consumedOn: string | null };

function conflict(): never { throw new Error("La identidad o revisión granular cambió. Revisá los datos antes de continuar."); }

function mutation<T>(owner: string, db: ProgressDatabase | undefined, work: (db: ProgressWriteDb) => Promise<{ value: T; changed: boolean }>): Promise<T> {
  return runSerializedStorageMutation(async () => {
    const connection = db ?? await initDb();
    let result!: { value: T; changed: boolean };
    await connection.withTransactionAsync(async () => { result = await work(connection); });
    if (result.changed) publishLibraryInvalidation([owner]);
    return result.value;
  });
}

async function state(db: ProgressWriteDb, owner: string) {
  return await db.getFirstAsync<{ revision: number; enabled: number }>(
    "SELECT revision,enabled FROM granular_title_state WHERE owner_id=?", owner) ?? { revision: 0, enabled: 0 };
}
async function touch(db: ProgressWriteDb, owner: string) {
  const previous = await state(db, owner);
  await db.runAsync(`INSERT INTO granular_title_state VALUES(?,?,?)
    ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision`,
    owner, nextProgressTimestamp(previous.revision, 0), previous.enabled);
}

export function setGranularEnabled(owner: string, expectedRevision: number, enabled: boolean, db?: ProgressDatabase) {
  return mutation(owner, db, async connection => {
    await getProgressClassificationWithDb(connection, owner);
    const current = await state(connection, owner);
    if (current.enabled === Number(enabled)) return { value: current.revision, changed: false };
    if (current.revision !== expectedRevision) conflict();
    const revision = nextProgressTimestamp(current.revision, 0);
    await connection.runAsync(`INSERT INTO granular_title_state VALUES(?,?,?)
      ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled`, owner, revision, Number(enabled));
    return { value: revision, changed: true };
  });
}

async function resolveIdentity(db: ProgressWriteDb, kind: "unit" | "group", input: Identity) {
  const { ownerId, reference } = input;
  const requested = input.id === undefined ? null : granularUuid(input.id);
  const table = `granular_${kind}s`;
  const existing = requested ? await db.getFirstAsync<{ owner_id: string }>(`SELECT owner_id FROM ${table} WHERE id=?`, requested) : null;
  if (existing && existing.owner_id !== ownerId) conflict();
  if (!reference) {
    if (!requested) throw new Error("Falta el UUID portable.");
    if (existing && await db.getFirstAsync(`SELECT 1 FROM granular_${kind}_references WHERE owner_id=? AND entity_id=?`, ownerId, requested)) conflict();
    return { id: requested, attach: null };
  }

  const { provider, parentNamespace, parentId, namespace, externalId } = reference;
  const key = [provider, parentNamespace, parentId, namespace, externalId];
  if (key.some(value => typeof value !== "string" || !value || value !== value.trim() || /[\u0000-\u001f]/u.test(value))) {
    throw new Error("Referencia granular inválida.");
  }
  if (!await db.getFirstAsync(`SELECT 1 FROM media_provider_references
    WHERE saved_title_id=? AND provider=? AND resource_namespace=? AND external_id=?`, ownerId, provider, parentNamespace, parentId)) conflict();
  const match = await db.getFirstAsync<{ entity_id: string; owner_id: string }>(`SELECT entity_id,owner_id FROM granular_${kind}_references
    WHERE provider=? AND parent_namespace=? AND parent_id=? AND namespace=? AND external_id=?`, ...key);
  if (match) {
    if (match.owner_id !== ownerId || (requested && requested !== match.entity_id)) conflict();
    return { id: match.entity_id, attach: null };
  }
  if (existing || !requested) conflict();
  return { id: requested, attach: key };
}

async function attachReference(db: ProgressWriteDb, kind: "unit" | "group", owner: string, id: string, key: string[] | null) {
  if (key) await db.runAsync(`INSERT INTO granular_${kind}_references VALUES (?,?,?,?,?,?,?)`, owner, id, ...key);
}

function labelValid(label: string) {
  return typeof label === "string" && !!label && label.trim() === label && [...label].length <= 120 && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(label);
}

export function saveGranularGroup(input: Identity & { kind: "manual" | "season" | "volume"; label: string }, expectedRevision: number, db?: ProgressDatabase) {
  return mutation(input.ownerId, db, async connection => {
    await getProgressClassificationWithDb(connection, input.ownerId);
    if (!["manual", "season", "volume"].includes(input.kind) || !labelValid(input.label)) throw new Error("Grupo inválido.");
    const { id, attach } = await resolveIdentity(connection, "group", input);
    const current = await connection.getFirstAsync<{ kind: string; label: string }>("SELECT kind,label FROM granular_groups WHERE id=?", id);
    if (current?.kind === input.kind && current.label === input.label) return { value: id, changed: false };
    if ((await state(connection, input.ownerId)).revision !== expectedRevision) conflict();
    await connection.runAsync(`INSERT INTO granular_groups VALUES(?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,label=excluded.label`, id, input.ownerId, input.kind, input.label);
    await attachReference(connection, "group", input.ownerId, id, attach);
    await touch(connection, input.ownerId);
    return { value: id, changed: true };
  });
}

export function saveGranularUnit(input: UnitInput, expectedRevision: number, db?: ProgressDatabase) {
  return mutation(input.ownerId, db, async connection => {
    const classification = await getProgressClassificationWithDb(connection, input.ownerId);
    const currentState = await state(connection, input.ownerId);
    const position = parseProgressPosition(input.coordinate);
    if (!position || !granularCompatible(classification, position, !!currentState.enabled)) throw new Error("Unidad incompatible.");
    if (input.label !== null && !labelValid(input.label)) throw new Error("Descriptor inválido.");
    if (input.groupId !== null) {
      const group = granularUuid(input.groupId);
      if (!await connection.getFirstAsync("SELECT 1 FROM granular_groups WHERE owner_id=? AND id=?", input.ownerId, group)) conflict();
    }
    const { id, attach } = await resolveIdentity(connection, "unit", input);
    const coordinate = JSON.stringify(position);
    const current = await connection.getFirstAsync<UnitRow>("SELECT * FROM granular_units WHERE id=?", id);
    if (current?.coordinate === coordinate && current.group_id === input.groupId && current.label === input.label) return { value: id, changed: false };
    if (currentState.revision !== expectedRevision) conflict();
    await connection.runAsync(`INSERT INTO granular_units VALUES(?,?,?,?,?,?,?,?,?,0)
      ON CONFLICT(id) DO UPDATE SET group_id=excluded.group_id,coordinate=excluded.coordinate,label=excluded.label,
      sort_kind=excluded.sort_kind,sort_group=excluded.sort_group,sort_whole=excluded.sort_whole,sort_fraction=excluded.sort_fraction`,
      id, input.ownerId, input.groupId, coordinate, input.label, ...granularOrder(position));
    await attachReference(connection, "unit", input.ownerId, id, attach);
    await touch(connection, input.ownerId);
    return { value: id, changed: true };
  });
}

export function retireGranularUnit(owner: string, id: string, retired: boolean, expectedRevision: number, db?: ProgressDatabase) {
  return mutation(owner, db, async connection => {
    const unit = await connection.getFirstAsync<UnitRow>("SELECT * FROM granular_units WHERE owner_id=? AND id=?", owner, granularUuid(id));
    if (!unit) conflict();
    if (!!unit.retired === retired) return { value: undefined, changed: false };
    if ((await state(connection, owner)).revision !== expectedRevision) conflict();
    await connection.runAsync("UPDATE granular_units SET retired=? WHERE owner_id=? AND id=?", Number(retired), owner, id);
    await touch(connection, owner);
    return { value: undefined, changed: true };
  });
}

type PageCursor = { owner: string; revision: number; order: [number, number, number, string, string] };
export function listGranularUnits(owner: string, limit: number, cursor: PageCursor | null = null, db?: ProgressDatabase) {
  return runSerializedStorageMutation(async () => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Tamaño de página inválido.");
    const connection = db ?? await initDb();
    let page!: { revision: number; rows: (UnitRow & Partial<DecisionRow>)[]; next: PageCursor | null };
    await connection.withTransactionAsync(async () => {
      const { revision } = await state(connection, owner);
      if (cursor && (cursor.owner !== owner || cursor.revision !== revision)) conflict();
      const order = "sort_kind,sort_group,sort_whole,sort_fraction,id";
      const rows = await connection.getAllAsync<UnitRow & Partial<DecisionRow>>(`SELECT u.*,d.marked,d.consumed_on,d.revision,d.updated_at
        FROM granular_units u LEFT JOIN granular_decisions d ON d.owner_id=u.owner_id AND d.unit_id=u.id
        WHERE u.owner_id=? ${cursor ? `AND (${order}) > (?,?,?,?,?)` : ""} ORDER BY ${order} LIMIT ?`,
        owner, ...(cursor?.order ?? []), limit + 1);
      const last = rows[limit - 1];
      const next: PageCursor | null = rows.length > limit ? {
        owner, revision, order: [last.sort_kind, last.sort_group, last.sort_whole, last.sort_fraction, last.id],
      } : null;
      page = { revision, rows: rows.slice(0, limit), next };
    });
    return page;
  });
}

export function setGranularDecisions(owner: string, expectedListRevision: number, intents: readonly DecisionIntent[], db?: ProgressDatabase, now = Date.now()) {
  return mutation(owner, db, async connection => {
    const ids = intents.map(intent => granularUuid(intent.unitId));
    if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length) throw new Error("Selección inválida.");
    const classification = await getProgressClassificationWithDb(connection, owner);
    const currentState = await state(connection, owner);
    const result: DecisionRow[] = [];
    const writes: { id: string; decision: DecisionRow }[] = [];
    for (const intent of intents) {
      if (typeof intent.marked !== "boolean" || (!intent.marked && intent.consumedOn !== null)) throw new Error("Decisión inválida.");
      const date = civilConsumptionDate(intent.consumedOn);
      const row = await connection.getFirstAsync<UnitRow & Partial<DecisionRow>>(`SELECT u.*,d.marked,d.consumed_on,d.revision,d.updated_at
        FROM granular_units u LEFT JOIN granular_decisions d ON d.owner_id=u.owner_id AND d.unit_id=u.id
        WHERE u.owner_id=? AND u.id=?`, owner, intent.unitId);
      if (!row) conflict();
      const position = parseProgressPosition(JSON.parse(row.coordinate));
      if (!position || row.retired || !granularCompatible(classification, position, !!currentState.enabled)) conflict();
      if (row.revision != null && row.marked === Number(intent.marked) && row.consumed_on === date) {
        if (row.updated_at === undefined) conflict();
        result.push({ marked: row.marked, consumed_on: date, revision: row.revision, updated_at: row.updated_at });
        continue;
      }
      if (currentState.revision !== expectedListRevision || (row.revision ?? null) !== intent.expectedRevision) conflict();
      // An equivalent retry preserves its original civil date even if the local day moved backward.
      civilConsumptionDate(date, new Date(now));
      const decision = { marked: Number(intent.marked), consumed_on: date, revision: nextProgressTimestamp(row.revision ?? undefined, 1),
        updated_at: nextProgressTimestamp(row.updated_at ?? undefined, now) };
      writes.push({ id: row.id, decision });
      result.push(decision);
    }
    for (const { id, decision } of writes) {
      await connection.runAsync(`INSERT INTO granular_decisions VALUES(?,?,?,?,?,?)
        ON CONFLICT(owner_id,unit_id) DO UPDATE SET marked=excluded.marked,consumed_on=excluded.consumed_on,
        updated_at=excluded.updated_at,revision=excluded.revision`, owner, id, decision.marked, decision.consumed_on, decision.updated_at, decision.revision);
    }
    if (writes.length) await touch(connection, owner);
    return { value: result, changed: writes.length > 0 };
  });
}

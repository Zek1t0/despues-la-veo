import { granularCompatible, granularOrder, newGranularUuid } from "../core/granularTracking";
import { parseProgressPosition, type ProgressPosition } from "../core/personalProgress";
import { initDb } from "./db";
import { mutation, state, touch } from "./granularRepo";
import { getProgressClassificationWithDb, type ProgressDatabase, type ProgressWriteDb } from "./personalProgressRepo";
import { runSerializedStorageMutation } from "./storageMutationQueue";

export type ManualRange = { ownerId: string; groupId: string | null; first: number; last: number } &
  ({ mode: "episode" | "chapter" } | { mode: "season-episode"; season: number });
type Match = { id: string; retired: number };
type Entry = { coordinate: ProgressPosition; matches: Match[] };
type Preview = { range: ManualRange; revision: number; classification: string; entries: Entry[]; newCount: number };

function coordinates(range: ManualRange): ProgressPosition[] {
  const { first, last } = range;
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last > 999999 || last < first || last - first >= 200) {
    throw new Error("El rango debe contener de 1 a 200 enteros válidos.");
  }
  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const n = first + offset;
    const coordinate = range.mode === "chapter" ? { mode: "chapter", chapter: String(n) } :
      range.mode === "season-episode" ? { mode: "season-episode", season: range.season, episode: n } :
      { mode: range.mode, episode: n };
    const parsed = parseProgressPosition(coordinate);
    if (!parsed) throw new Error("Coordenada inválida.");
    return parsed;
  });
}

async function inspectRange(db: ProgressWriteDb, range: ManualRange): Promise<Preview> {
  const positions = coordinates(range);
  const classification = await getProgressClassificationWithDb(db, range.ownerId);
  const current = await state(db, range.ownerId);
  if (!granularCompatible(classification, positions[0], !!current.enabled)) throw new Error("Rango incompatible.");
  if (range.groupId !== null && !await db.getFirstAsync(`SELECT 1 FROM granular_groups g
    WHERE g.owner_id=? AND g.id=? AND NOT EXISTS (SELECT 1 FROM granular_group_references r WHERE r.entity_id=g.id)`, range.ownerId, range.groupId)) {
    throw new Error("El grupo manual ya no está disponible.");
  }
  const serialized = positions.map(value => JSON.stringify(value));
  const rows = await db.getAllAsync<Match & { coordinate: string }>(`SELECT id,retired,coordinate FROM granular_units u
    WHERE owner_id=? AND group_id IS ? AND coordinate IN (${positions.map(() => "?").join(",")})
      AND NOT EXISTS(SELECT 1 FROM granular_unit_references r WHERE r.entity_id=u.id) ORDER BY id`, range.ownerId, range.groupId, ...serialized);
  const matches = new Map<string, Match[]>();
  for (const row of rows) {
    const list = matches.get(row.coordinate) ?? [];
    list.push({ id: row.id, retired: row.retired });
    matches.set(row.coordinate, list);
  }
  const entries = positions.map((coordinate, index) => ({ coordinate, matches: matches.get(serialized[index]) ?? [] }));
  return { range: { ...range }, revision: current.revision, classification: JSON.stringify(classification), entries,
    newCount: entries.filter(entry => !entry.matches.length).length };
}

export function previewManualRange(range: ManualRange, db?: ProgressDatabase): Promise<Preview> {
  range = { ...range };
  return runSerializedStorageMutation(async () => {
    const connection = db ?? await initDb();
    let result!: Preview;
    await connection.withTransactionAsync(async () => { result = await inspectRange(connection, range); });
    return result;
  });
}

export function confirmManualRange(preview: Preview, omitMatches: boolean, db?: ProgressDatabase, uuid = newGranularUuid) {
  const evidence = JSON.stringify(preview);
  const range = { ...preview.range };
  return mutation(range.ownerId, db, async connection => {
    const current = await inspectRange(connection, range);
    if (JSON.stringify(current) !== evidence) throw new Error("La vista previa del rango cambió.");
    if (!omitMatches && current.newCount !== current.entries.length) throw new Error("Confirmá omitir las coincidencias o cancelá el rango.");
    const created: string[] = [];
    for (const entry of current.entries) {
      if (entry.matches.length) continue;
      const id = uuid();
      await connection.runAsync("INSERT INTO granular_units VALUES(?,?,?, ?,NULL,?,?,?,?,0)",
        id, range.ownerId, range.groupId, JSON.stringify(entry.coordinate), ...granularOrder(entry.coordinate));
      created.push(id);
    }
    if (created.length) await touch(connection, range.ownerId);
    return { value: created, changed: created.length > 0 };
  });
}

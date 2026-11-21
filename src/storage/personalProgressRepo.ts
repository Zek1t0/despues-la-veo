import { assertMediaClassification, type MediaClassification } from "../core/mediaClassification";
import { nextProgressTimestamp, parsePersonalProgress, parseProgressPosition, progressPositionCompatible,
  progressPositionsEqual, progressVersionsEqual, type PersonalProgress, type ProgressPosition } from "../core/personalProgress";
import type { SchemaDatabase } from "./databaseSchema";
import { initDb } from "./db";
import { publishLibraryInvalidation } from "./libraryInvalidation";
import { progressFromRow, type ProgressRow } from "./personalProgressSchema";
import { runSerializedStorageMutation } from "./storageMutationQueue";

export type ProgressReadDb = Pick<SchemaDatabase, "getFirstAsync" | "getAllAsync">;
export type ProgressWriteDb = ProgressReadDb & Pick<SchemaDatabase, "runAsync">;
export type ProgressDatabase = ProgressWriteDb & Pick<SchemaDatabase, "withTransactionAsync">;
export class ProgressConflict extends Error {
  constructor() { super("El título o progreso cambió. Revisá la versión confirmada antes de guardar."); this.name = "ProgressConflict"; }
}
export async function getPersonalProgressWithDb(db: ProgressReadDb, itemId: string): Promise<PersonalProgress | null> {
  const row = await db.getFirstAsync<ProgressRow>("SELECT * FROM personal_title_progress WHERE saved_title_id=?;", itemId);
  return row ? progressFromRow(row) : null;
}
/** One query per bounded batch, never a query per card. Empty input makes no query. */
export async function listPersonalProgressWithDb(db: ProgressReadDb, itemIds: readonly string[]): Promise<Record<string, PersonalProgress>> {
  const ids = [...new Set(itemIds)], entries: [string, PersonalProgress][] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500);
    const rows = await db.getAllAsync<ProgressRow>(`SELECT * FROM personal_title_progress WHERE saved_title_id IN (${batch.map(() => "?").join(",")});`, ...batch);
    for (const row of rows) { const value = progressFromRow(row); entries.push([value.itemId, value]); }
  }
  return Object.fromEntries(entries);
}
export async function getProgressClassificationWithDb(db: ProgressReadDb, itemId: string): Promise<MediaClassification> {
  const row = await db.getFirstAsync<{ medium: unknown; content_family: unknown; primary_format: unknown }>(
    "SELECT medium,content_family,primary_format FROM saved_titles WHERE id=?;", itemId);
  if (!row) throw new Error("El título dejó de existir.");
  const value = { medium: row.medium, contentFamily: row.content_family, primaryFormat: row.primary_format };
  assertMediaClassification(value); return value;
}
export function progressClassificationsEqual(a: MediaClassification, b: MediaClassification): boolean {
  return a.medium === b.medium && a.contentFamily === b.contentFamily && a.primaryFormat === b.primaryFormat;
}
export type ProgressIntent = Readonly<{ itemId: string; expected: PersonalProgress | null;
  expectedClassification: MediaClassification; position: ProgressPosition | null }>;
/** Caller owns transaction; no init, queue, activity or publication in this helper. */
export async function setPersonalProgressWithDb(db: ProgressWriteDb, intent: ProgressIntent, now = Date.now()): Promise<{ progress: PersonalProgress; changed: boolean }> {
  const position = parseProgressPosition(intent.position);
  assertMediaClassification(intent.expectedClassification);
  const expected = intent.expected === null ? null : parsePersonalProgress(intent.expected);
  if (expected && expected.itemId !== intent.itemId) throw new ProgressConflict();
  const classification = await getProgressClassificationWithDb(db, intent.itemId);
  if (!progressClassificationsEqual(classification, intent.expectedClassification)) throw new ProgressConflict();
  const current = await getPersonalProgressWithDb(db, intent.itemId);
  // Safe retry of an absolute target; a stale increment is never recomputed here.
  if (current && progressPositionsEqual(current.position, position)) return { progress: current, changed: false };
  if (!progressVersionsEqual(current, expected)) throw new ProgressConflict();
  if (!progressPositionCompatible(classification, position)) throw new Error("La posición no es compatible con la clasificación actual.");
  const progress = parsePersonalProgress({ version: 1, itemId: intent.itemId, position, updatedAt: nextProgressTimestamp(current?.updatedAt, now) });
  const p = progress.position;
  const result = await db.runAsync(`INSERT INTO personal_title_progress
    (saved_title_id,shape_version,mode,season,episode,chapter,label,updated_at) VALUES (?,1,?,?,?,?,?,?)
    ON CONFLICT(saved_title_id) DO UPDATE SET mode=excluded.mode,season=excluded.season,episode=excluded.episode,
      chapter=excluded.chapter,label=excluded.label,updated_at=excluded.updated_at;`,
    progress.itemId, p?.mode ?? null, p?.mode === "season-episode" ? p.season : null,
    p?.mode === "episode" || p?.mode === "season-episode" ? p.episode : null,
    p?.mode === "chapter" ? p.chapter : null, p?.mode === "special" ? p.label : null, progress.updatedAt);
  if (result.changes !== 1) throw new Error("No se pudo confirmar el progreso.");
  return { progress, changed: true };
}
export function setPersonalProgress(intent: ProgressIntent, database?: ProgressDatabase, now = Date.now()): Promise<PersonalProgress> {
  return runSerializedStorageMutation(async () => {
    const db = database ?? await initDb();
    let result!: Awaited<ReturnType<typeof setPersonalProgressWithDb>>;
    await db.withTransactionAsync(async () => { result = await setPersonalProgressWithDb(db, intent, now); });
    if (result.changed) publishLibraryInvalidation([intent.itemId]);
    return result.progress;
  });
}
export function getPersonalProgress(itemId: string, database?: ProgressDatabase): Promise<PersonalProgress | null> {
  return runSerializedStorageMutation(async () => getPersonalProgressWithDb(database ?? await initDb(), itemId));
}

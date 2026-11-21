import { parsePersonalProgress, type PersonalProgress } from "../core/personalProgress";
import type { SchemaDatabase } from "./databaseSchema";

export const PERSONAL_PROGRESS_TABLE_SQL = `CREATE TABLE personal_title_progress (
  saved_title_id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(saved_title_id))>0),
  shape_version INTEGER NOT NULL CHECK(typeof(shape_version)='integer' AND shape_version=1),
  mode TEXT NULL, season INTEGER NULL, episode INTEGER NULL, chapter TEXT NULL, label TEXT NULL,
  updated_at INTEGER NOT NULL CHECK(typeof(updated_at)='integer' AND updated_at BETWEEN 0 AND 9007199254740991),
  FOREIGN KEY(saved_title_id) REFERENCES saved_titles(id) ON DELETE CASCADE,
  CHECK(
    (mode IS NULL AND season IS NULL AND episode IS NULL AND chapter IS NULL AND label IS NULL) OR
    (mode IS NOT NULL AND (
      (mode='episode' AND season IS NULL AND episode IS NOT NULL AND chapter IS NULL AND label IS NULL) OR
      (mode='season-episode' AND season IS NOT NULL AND episode IS NOT NULL AND chapter IS NULL AND label IS NULL) OR
      (mode='chapter' AND season IS NULL AND episode IS NULL AND chapter IS NOT NULL AND label IS NULL) OR
      (mode='special' AND season IS NULL AND episode IS NULL AND chapter IS NULL AND label IS NOT NULL)
    ))
  ),
  CHECK(season IS NULL OR (typeof(season)='integer' AND season BETWEEN 0 AND 9999)),
  CHECK(episode IS NULL OR (typeof(episode)='integer' AND episode BETWEEN 0 AND 999999)),
  CHECK(chapter IS NULL OR (typeof(chapter)='text' AND length(chapter) BETWEEN 1 AND 13
    AND chapter NOT GLOB '*[^0-9.]*' AND substr(chapter,1,1) BETWEEN '0' AND '9'
    AND (chapter='0' OR substr(chapter,1,1)<>'0' OR substr(chapter,2,1)='.')
    AND length(chapter)-length(replace(chapter,'.',''))<=1
    AND ((instr(chapter,'.')=0 AND length(chapter)<=6) OR
      (instr(chapter,'.') BETWEEN 2 AND 7 AND length(chapter)-instr(chapter,'.') BETWEEN 1 AND 6 AND substr(chapter,-1)<>'0')))),
  CHECK(label IS NULL OR (typeof(label)='text' AND length(label) BETWEEN 1 AND 120 AND label=trim(label)
    AND instr(label,char(0))=0 AND instr(label,char(10))=0 AND instr(label,char(13))=0))
);`;

export type ProgressRow = { saved_title_id: string; shape_version: number; mode: string | null;
  season: number | null; episode: number | null; chapter: string | null; label: string | null; updated_at: number };
export function progressFromRow(row: ProgressRow): PersonalProgress {
  // Also validate exclusivity when reading a corrupted database, not just through SQL CHECKs.
  const position = row.mode === null ? null : row.mode === "episode" ? { mode: row.mode, episode: row.episode }
    : row.mode === "season-episode" ? { mode: row.mode, season: row.season, episode: row.episode }
    : row.mode === "chapter" ? { mode: row.mode, chapter: row.chapter } : { mode: row.mode, label: row.label };
  const result = parsePersonalProgress({ version: row.shape_version, itemId: row.saved_title_id, position, updatedAt: row.updated_at });
  const p = result.position;
  if (row.season !== (p?.mode === "season-episode" ? p.season : null) ||
      row.episode !== (p?.mode === "episode" || p?.mode === "season-episode" ? p.episode : null) ||
      row.chapter !== (p?.mode === "chapter" ? p.chapter : null) || row.label !== (p?.mode === "special" ? p.label : null))
    throw new Error("Columnas de progreso contradictorias.");
  return result;
}
export async function verifyPersonalProgressSchemaWithDb(db: Pick<SchemaDatabase, "getFirstAsync" | "getAllAsync">): Promise<void> {
  const normalized = (sql: string) => sql.toLowerCase().replace(/\s+/g, " ").replace(/;$/, "").trim();
  const table = await db.getFirstAsync<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type='table' AND name='personal_title_progress';");
  if (!table || normalized(table.sql) !== normalized(PERSONAL_PROGRESS_TABLE_SQL)) throw new Error("Esquema de progreso inválido.");
  const fk = await db.getAllAsync<{ table: string; from: string; to: string; on_delete: string }>("PRAGMA foreign_key_list(personal_title_progress);");
  if (fk.length !== 1 || fk[0].table !== "saved_titles" || fk[0].from !== "saved_title_id" || fk[0].to !== "id" || fk[0].on_delete !== "CASCADE") throw new Error("FK de progreso inválida.");
  if ((await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;"))?.foreign_keys !== 1 || await db.getFirstAsync("PRAGMA foreign_key_check;")) throw new Error("Integridad de progreso inválida.");
  for (const row of await db.getAllAsync<ProgressRow>("SELECT * FROM personal_title_progress;")) progressFromRow(row);
}

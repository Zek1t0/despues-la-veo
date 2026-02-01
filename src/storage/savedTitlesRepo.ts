import { initDb } from "./db";
import type { SavedTitle } from "../core/savedTitle";

function rowToSavedTitle(row: any): SavedTitle {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    type: row.type,
    title: row.title,
    year: row.year ?? null,
    posterUrl: row.poster_url ?? null,
    status: row.status,
    tags: safeParseJsonArray(row.tags_json),
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function listSavedTitles(): Promise<SavedTitle[]> {
  const db = await initDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM saved_titles ORDER BY created_at DESC`
  );
  return rows.map(rowToSavedTitle);
}

export async function upsertSavedTitle(item: SavedTitle): Promise<void> {
  const db = await initDb();

  await db.runAsync(
    `
    INSERT INTO saved_titles (
      id, provider, external_id, type, title, year, poster_url, status, tags_json, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider=excluded.provider,
      external_id=excluded.external_id,
      type=excluded.type,
      title=excluded.title,
      year=excluded.year,
      poster_url=excluded.poster_url,
      status=excluded.status,
      tags_json=excluded.tags_json,
      notes=excluded.notes,
      updated_at=excluded.updated_at
    `,
    item.id,
    item.provider,
    item.externalId,
    item.type,
    item.title,
    item.year ?? null,
    item.posterUrl ?? null,
    item.status,
    JSON.stringify(item.tags ?? []),
    item.notes ?? null,
    item.createdAt,
    item.updatedAt
  );
}

export async function deleteSavedTitle(id: string): Promise<void> {
  const db = await initDb();
  await db.runAsync(`DELETE FROM saved_titles WHERE id = ?`, id);
}

export async function getSavedTitleById(id: string): Promise<SavedTitle | null> {
  const db = await initDb();
  const rows = await db.getAllAsync(`SELECT * FROM saved_titles WHERE id = ? LIMIT 1`, id);
  if (!rows.length) return null;
  return rowToSavedTitle(rows[0]);
}

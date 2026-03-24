import { initDb } from "./db";
import type { SavedTitle } from "../core/savedTitle";

function safeParseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function rowToSavedTitle(row: any): SavedTitle {
  return {
    id: String(row.id),
    provider: row.provider,
    externalId: String(row.external_id),
    type: row.type,
    title: String(row.title),
    year: row.year ?? null,
    posterUrl: row.poster_url ?? null,

    overview: row.overview ?? null,
    voteAverage: typeof row.vote_average === "number" ? row.vote_average : row.vote_average ?? null,
    genres: safeParseJsonArray(String(row.genres_json ?? "[]")),

    status: row.status,
    tags: safeParseJsonArray(String(row.tags_json ?? "[]")),
    notes: row.notes ?? null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function upsertSavedTitleWithDb(db: any, item: SavedTitle): Promise<string> {
  await db.runAsync(
    `
    INSERT INTO saved_titles (
      id, provider, external_id, type, title, year, poster_url,
      overview, vote_average, genres_json,
      status, tags_json, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, external_id) DO UPDATE SET
      type=excluded.type,
      title=excluded.title,
      year=excluded.year,
      poster_url=excluded.poster_url,
      overview=excluded.overview,
      vote_average=excluded.vote_average,
      genres_json=excluded.genres_json,
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

    item.overview ?? null,
    item.voteAverage ?? null,
    JSON.stringify(item.genres ?? []),

    item.status,
    JSON.stringify(item.tags ?? []),
    item.notes ?? null,
    item.createdAt,
    item.updatedAt
  );

  const row = (await db.getFirstAsync(
    `SELECT id FROM saved_titles WHERE provider = ? AND external_id = ? LIMIT 1`,
    [item.provider, item.externalId]
  )) as { id: string } | undefined;

  if (!row?.id) throw new Error("No se pudo leer el id guardado");
  return row.id;
}

export async function listSavedTitles(): Promise<SavedTitle[]> {
  const db = await initDb();
  const rows = await db.getAllAsync(`SELECT * FROM saved_titles ORDER BY created_at DESC`);
  return rows.map(rowToSavedTitle);
}

export async function getAllSavedTitles(): Promise<SavedTitle[]> {
  return listSavedTitles();
}

export async function upsertSavedTitle(item: SavedTitle): Promise<string> {
  const db = await initDb();
  return upsertSavedTitleWithDb(db, item);
}

export async function bulkUpsertSavedTitles(
  items: SavedTitle[]
): Promise<{ ok: number; fail: number }> {
  const db = await initDb();

  let ok = 0;
  let fail = 0;

  const work = async () => {
    for (const it of items) {
      try {
        await upsertSavedTitleWithDb(db, it);
        ok++;
      } catch {
        fail++;
      }
    }
  };

  if (typeof db.withTransactionAsync === "function") {
    await db.withTransactionAsync(work);
  } else {
    await work();
  }

  return { ok, fail };
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

export async function getByProviderExternal(
  provider: string,
  externalId: string
): Promise<SavedTitle | null> {
  const db = await initDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM saved_titles WHERE provider = ? AND external_id = ? LIMIT 1`,
    provider,
    externalId
  );
  return rows.length ? rowToSavedTitle(rows[0]) : null;
}
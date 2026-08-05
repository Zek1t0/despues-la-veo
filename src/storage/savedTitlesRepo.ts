import { initDb } from "./db";
import type { SavedTitle } from "../core/savedTitle";
import {
  materializeSavedTitleForInsert,
  type NormalizedBackupSavedTitle,
} from "../core/libraryBackupV1";

export type LibraryImportIssue = { reference: string; reason: string };
export type LibraryImportMergeResult = {
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: LibraryImportIssue[];
  failed: LibraryImportIssue[];
};

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

function backupItemReference(item: NormalizedBackupSavedTitle): string {
  return `${item.title} [${item.provider}/${item.type}/${item.externalId}]`;
}

async function findAvailableInsertId(db: any, preferredId: string, generateId: () => string) {
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let candidate = preferredId.trim();
    if (attempt > 0) {
      const generatedId = generateId();
      if (typeof generatedId !== "string" || generatedId.trim().length === 0) {
        throw new Error("El generador de IDs devolvió un ID vacío o inválido.");
      }
      candidate = generatedId.trim();
    }

    if (candidate.length === 0) {
      throw new Error("El ID preferido está vacío o es inválido.");
    }

    const occupied = await db.getFirstAsync(
      `SELECT id FROM saved_titles WHERE id = ? LIMIT 1`,
      [candidate]
    );
    if (!occupied) return candidate;
  }

  throw new Error(`No se pudo generar un ID libre después de ${maxAttempts} intentos.`);
}

async function insertSavedTitleWithDb(db: any, item: SavedTitle): Promise<void> {
  await db.runAsync(
    `INSERT INTO saved_titles (
      id, provider, external_id, type, title, year, poster_url,
      overview, vote_average, genres_json,
      status, tags_json, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id, item.provider, item.externalId, item.type, item.title,
    item.year ?? null, item.posterUrl ?? null, item.overview ?? null,
    item.voteAverage ?? null, JSON.stringify(item.genres ?? []),
    item.status, JSON.stringify(item.tags ?? []), item.notes ?? null,
    item.createdAt, item.updatedAt
  );
}

async function updateSavedTitleFromBackupWithDb(
  db: any,
  local: SavedTitle,
  incoming: NormalizedBackupSavedTitle
): Promise<void> {
  await db.runAsync(
    `UPDATE saved_titles SET
      title = ?, year = ?, poster_url = ?, overview = ?, vote_average = ?,
      genres_json = ?, status = ?, tags_json = ?, notes = ?, updated_at = ?
    WHERE id = ?`,
    incoming.title,
    incoming.year.present ? incoming.year.value : local.year ?? null,
    incoming.posterUrl.present ? incoming.posterUrl.value : local.posterUrl ?? null,
    incoming.overview.present ? incoming.overview.value : local.overview ?? null,
    incoming.voteAverage.present ? incoming.voteAverage.value : local.voteAverage ?? null,
    JSON.stringify(incoming.genres.present ? incoming.genres.value : local.genres ?? []),
    incoming.status.present ? incoming.status.value : local.status,
    JSON.stringify(incoming.tags.present ? incoming.tags.value : local.tags ?? []),
    incoming.notes.present ? incoming.notes.value : local.notes ?? null,
    incoming.updatedAt.present ? incoming.updatedAt.value : local.updatedAt,
    local.id
  );
}

export async function mergeLibraryBackupItems(
  items: NormalizedBackupSavedTitle[],
  generateId: () => string
): Promise<LibraryImportMergeResult> {
  const db = await initDb();
  const result: LibraryImportMergeResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    conflicts: [],
    failed: [],
  };

  for (const incoming of items) {
    const reference = backupItemReference(incoming);
    try {
      const row = await db.getFirstAsync(
        `SELECT * FROM saved_titles WHERE provider = ? AND external_id = ? LIMIT 1`,
        [incoming.provider, incoming.externalId]
      );
      const local = row ? rowToSavedTitle(row) : null;

      if (local) {
        if (local.type !== incoming.type) {
          result.conflicts.push({
            reference,
            reason: `La identidad ${incoming.provider}:${incoming.externalId} ya existe con type ${local.type}.`,
          });
          continue;
        }
        if (!incoming.updatedAt.present || incoming.updatedAt.value <= local.updatedAt) {
          result.skipped++;
          continue;
        }

        await updateSavedTitleFromBackupWithDb(db, local, incoming);
        result.updated++;
        continue;
      }

      const materialized = materializeSavedTitleForInsert(incoming, generateId);
      materialized.id = await findAvailableInsertId(db, materialized.id, generateId);
      await insertSavedTitleWithDb(db, materialized);
      result.inserted++;
    } catch (error) {
      result.failed.push({
        reference,
        reason: error instanceof Error ? error.message : "No se pudo persistir el elemento.",
      });
    }
  }

  return result;
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

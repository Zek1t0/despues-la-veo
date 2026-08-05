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

export type LibraryBackupMergeDb = {
  getFirstAsync(sql: string, params: any): Promise<any>;
  runAsync(sql: string, ...params: any[]): Promise<any>;
};

function safeParseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rowToSavedTitle(row: any): SavedTitle {
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

function backupItemReference(item: NormalizedBackupSavedTitle): string {
  return `${item.title} [${item.provider}/${item.type}/${item.externalId}]`;
}

async function findAvailableInsertId(
  db: LibraryBackupMergeDb,
  preferredId: string,
  generateId: () => string
) {
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

async function insertSavedTitleWithDb(db: LibraryBackupMergeDb, item: SavedTitle): Promise<void> {
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
  db: LibraryBackupMergeDb,
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

export async function mergeLibraryBackupItemsWithDb(
  db: LibraryBackupMergeDb,
  items: NormalizedBackupSavedTitle[],
  generateId: () => string
): Promise<LibraryImportMergeResult> {
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

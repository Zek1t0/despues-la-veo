import type { SavedTitle } from "../core/savedTitle";
import {
  materializeSavedTitleForInsert,
  type NormalizedBackupSavedTitle,
} from "../core/libraryBackupV1";
import { upsertSavedTitleAndCleanPinsWithDb } from "./savedTitleIntegrity";

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
  getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
  runAsync(sql: string, ...params: any[]): Promise<any>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
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

function materializeSavedTitleForUpdate(
  local: SavedTitle,
  incoming: NormalizedBackupSavedTitle
): SavedTitle {
  return {
    ...local,
    title: incoming.title,
    year: incoming.year.present ? incoming.year.value : local.year ?? null,
    posterUrl: incoming.posterUrl.present ? incoming.posterUrl.value : local.posterUrl ?? null,
    overview: incoming.overview.present ? incoming.overview.value : local.overview ?? null,
    voteAverage: incoming.voteAverage.present
      ? incoming.voteAverage.value
      : local.voteAverage ?? null,
    genres: incoming.genres.present ? incoming.genres.value : local.genres ?? [],
    status: incoming.status.present ? incoming.status.value : local.status,
    tags: incoming.tags.present ? incoming.tags.value : local.tags ?? [],
    notes: incoming.notes.present ? incoming.notes.value : local.notes ?? null,
    updatedAt: incoming.updatedAt.present ? incoming.updatedAt.value : local.updatedAt,
  };
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

        const updated = materializeSavedTitleForUpdate(local, incoming);
        await db.withTransactionAsync(async () => {
          await upsertSavedTitleAndCleanPinsWithDb(db, updated);
        });
        result.updated++;
        continue;
      }

      const materialized = materializeSavedTitleForInsert(incoming, generateId);
      materialized.id = await findAvailableInsertId(db, materialized.id, generateId);
      await db.withTransactionAsync(async () => {
        await upsertSavedTitleAndCleanPinsWithDb(db, materialized);
      });
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

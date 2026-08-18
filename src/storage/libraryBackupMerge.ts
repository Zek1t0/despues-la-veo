import type { SavedTitle } from "../core/savedTitle";
import { parsePersonalRating } from "../core/personalRating";
import {
  materializeSavedTitleForInsert,
  type NormalizedBackupSavedTitle,
} from "../core/libraryBackupV1";
import { upsertSavedTitleAndCleanPinsWithDb } from "./savedTitleIntegrity";
import { mergeBackupPinWithDb } from "./titlePinsBackup";
import { parsePinContext } from "../core/contextualPin";
import type { LibraryBackupPinV2 } from "../core/libraryBackupV2";

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

export type LibraryPinImportResult = {
  inserted: number;
  preserved: number;
  invalid: LibraryImportIssue[];
  failed: LibraryImportIssue[];
};

export type LibraryBackupMergeResult = LibraryImportMergeResult & {
  pins: LibraryPinImportResult;
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
    personalRating: parsePersonalRating(row.personal_rating),
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

async function withBackupSavepoint<T>(
  db: LibraryBackupMergeDb,
  name: "backup_item" | "backup_pin",
  task: () => Promise<T>
): Promise<T> {
  await db.runAsync(`SAVEPOINT ${name};`);
  try {
    const result = await task();
    await db.runAsync(`RELEASE SAVEPOINT ${name};`);
    return result;
  } catch (error) {
    await db.runAsync(`ROLLBACK TO SAVEPOINT ${name};`);
    await db.runAsync(`RELEASE SAVEPOINT ${name};`);
    throw error;
  }
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
    personalRating: incoming.personalRating.present
      ? parsePersonalRating(incoming.personalRating.value)
      : local.personalRating,
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
        await withBackupSavepoint(db, "backup_item", () =>
          upsertSavedTitleAndCleanPinsWithDb(db, updated)
        );
        result.updated++;
        continue;
      }

      const materialized = materializeSavedTitleForInsert(incoming, generateId);
      materialized.id = await findAvailableInsertId(db, materialized.id, generateId);
      await withBackupSavepoint(db, "backup_item", () =>
        upsertSavedTitleAndCleanPinsWithDb(db, materialized)
      );
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

function backupPinReference(pin: LibraryBackupPinV2): string {
  const context = pin.contextType === "library" ? "Biblioteca" : `tag ${pin.contextKey}`;
  return `${pin.provider}:${pin.externalId} (${context})`;
}

export async function mergeLibraryBackupWithDb(
  db: LibraryBackupMergeDb,
  items: NormalizedBackupSavedTitle[],
  pins: LibraryBackupPinV2[] | null,
  generateId: () => string
): Promise<LibraryBackupMergeResult> {
  const titles = await mergeLibraryBackupItemsWithDb(db, items, generateId);
  const pinResult: LibraryPinImportResult = {
    inserted: 0,
    preserved: 0,
    invalid: [],
    failed: [],
  };

  if (pins) {
    const finalRows = await db.getAllAsync<{
      id: string;
      provider: string;
      external_id: string;
      tags_json: string;
    }>("SELECT id, provider, external_id, tags_json FROM saved_titles;");
    const byIdentity = new Map(
      finalRows.map((row) => [`${row.provider}\u0000${row.external_id}`, row] as const)
    );

    for (const pin of pins) {
      const reference = backupPinReference(pin);
      const row = byIdentity.get(`${pin.provider}\u0000${pin.externalId}`);
      if (!row) {
        pinResult.invalid.push({ reference, reason: "El título referido no existe después del merge." });
        continue;
      }
      const context = parsePinContext(pin.contextType, pin.contextKey);
      if (!context) {
        pinResult.invalid.push({ reference, reason: "El contexto del pin no es aplicable." });
        continue;
      }
      if (context.contextType === "tag") {
        const tags = safeParseJsonArray(row.tags_json)
          .map((tag) => tag.trim())
          .filter(Boolean);
        if (!tags.includes(context.contextKey)) {
          pinResult.invalid.push({
            reference,
            reason: "El título final no pertenece exactamente a la etiqueta indicada.",
          });
          continue;
        }
      }
      try {
        let outcome: "inserted" | "preserved" = "preserved";
        outcome = await withBackupSavepoint(db, "backup_pin", () =>
          mergeBackupPinWithDb(db, row.id, context, pin.pinnedAt)
        );
        pinResult[outcome]++;
      } catch (error) {
        pinResult.failed.push({
          reference,
          reason: error instanceof Error ? error.message : "No se pudo persistir el pin.",
        });
      }
    }
  }

  return { ...titles, pins: pinResult };
}

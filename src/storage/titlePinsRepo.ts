import {
  assertValidPinnedAt,
  normalizeSavedTitleTags,
  parsePinContext,
  type PinContext,
  type TitlePin,
} from "../core/contextualPin";
import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";

export type TitlePinsDatabase = {
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: any[]): Promise<T[]>;
  runAsync(source: string, ...params: any[]): Promise<unknown>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

type TitlePinRow = {
  saved_title_id: string;
  context_type: string;
  context_key: string;
  pinned_at: number;
};

type SavedTitlePinValidationRow = { id: string; tags_json: string };

export type BackupTitlePinRow = {
  provider: "manual" | "tmdb";
  externalId: string;
  contextType: "library" | "tag";
  contextKey: string;
  pinnedAt: number;
};

function assertSavedTitleId(savedTitleId: string): void {
  if (typeof savedTitleId !== "string" || !savedTitleId.trim()) {
    throw new Error("El id del título guardado debe ser un string no vacío.");
  }
}

function normalizePinContext(context: PinContext): PinContext {
  const normalized = parsePinContext(context?.contextType, context?.contextKey);
  if (!normalized) throw new Error("El contexto de pin es inválido.");
  return normalized;
}

function parseStoredTags(tagsJson: string): string[] {
  try {
    const value: unknown = JSON.parse(tagsJson);
    if (!Array.isArray(value)) return [];
    return normalizeSavedTitleTags(
      value.filter((tag): tag is string => typeof tag === "string")
    );
  } catch {
    return [];
  }
}

function rowToTitlePin(row: TitlePinRow): TitlePin {
  const context = parsePinContext(row.context_type, row.context_key);
  assertValidPinnedAt(row.pinned_at);
  if (!context) throw new Error("Se encontró un contexto de pin persistido inválido.");
  return { savedTitleId: String(row.saved_title_id), context, pinnedAt: row.pinned_at };
}

async function requireSavedTitleForPin(
  db: TitlePinsDatabase,
  savedTitleId: string,
  context: PinContext
): Promise<void> {
  const row = await db.getFirstAsync<SavedTitlePinValidationRow>(
    "SELECT id, tags_json FROM saved_titles WHERE id = ? LIMIT 1;",
    [savedTitleId]
  );
  if (!row) throw new Error("El título guardado no existe.");

  if (context.contextType === "tag") {
    const tags = parseStoredTags(String(row.tags_json ?? "[]"));
    if (!tags.includes(context.contextKey)) {
      throw new Error("El título ya no pertenece a la etiqueta indicada.");
    }
  }
}

export async function listTitlePinsForContextWithDb(
  db: TitlePinsDatabase,
  contextInput: PinContext
): Promise<TitlePin[]> {
  const context = normalizePinContext(contextInput);
  const rows = await db.getAllAsync<TitlePinRow>(
    `SELECT saved_title_id, context_type, context_key, pinned_at
     FROM title_pins
     WHERE context_type = ? AND context_key = ?;`,
    [context.contextType, context.contextKey]
  );
  return rows.map(rowToTitlePin);
}

export async function listAllPinsForBackupWithDb(
  db: TitlePinsDatabase
): Promise<BackupTitlePinRow[]> {
  const rows = await db.getAllAsync<{
    provider: "manual" | "tmdb";
    external_id: string;
    context_type: string;
    context_key: string;
    pinned_at: number;
  }>(
    `SELECT s.provider, s.external_id, p.context_type, p.context_key, p.pinned_at
     FROM title_pins p
     INNER JOIN saved_titles s ON s.id = p.saved_title_id
     ORDER BY s.provider, s.external_id, p.context_type, p.context_key;`
  );
  return rows.map((row) => {
    const context = parsePinContext(row.context_type, row.context_key);
    assertValidPinnedAt(row.pinned_at);
    if (!context) throw new Error("Se encontró un contexto de pin persistido inválido.");
    return {
      provider: row.provider,
      externalId: String(row.external_id),
      contextType: context.contextType,
      contextKey: context.contextKey,
      pinnedAt: row.pinned_at,
    };
  });
}

export async function isTitlePinnedWithDb(
  db: TitlePinsDatabase,
  savedTitleId: string,
  contextInput: PinContext
): Promise<boolean> {
  assertSavedTitleId(savedTitleId);
  const context = normalizePinContext(contextInput);
  const row = await db.getFirstAsync<{ found: number }>(
    `SELECT 1 AS found FROM title_pins
     WHERE saved_title_id = ? AND context_type = ? AND context_key = ? LIMIT 1;`,
    [savedTitleId, context.contextType, context.contextKey]
  );
  return row?.found === 1;
}

export async function pinTitleWithDb(
  db: TitlePinsDatabase,
  savedTitleId: string,
  contextInput: PinContext,
  pinnedAt = Date.now()
): Promise<void> {
  assertSavedTitleId(savedTitleId);
  const context = normalizePinContext(contextInput);
  assertValidPinnedAt(pinnedAt);

  await requireSavedTitleForPin(db, savedTitleId, context);
  await db.runAsync(
    `INSERT INTO title_pins (saved_title_id, context_type, context_key, pinned_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(saved_title_id, context_type, context_key) DO NOTHING;`,
    savedTitleId,
    context.contextType,
    context.contextKey,
    pinnedAt
  );
}

export async function unpinTitleWithDb(
  db: TitlePinsDatabase,
  savedTitleId: string,
  contextInput: PinContext
): Promise<void> {
  assertSavedTitleId(savedTitleId);
  const context = normalizePinContext(contextInput);
  await db.runAsync(
    `DELETE FROM title_pins
     WHERE saved_title_id = ? AND context_type = ? AND context_key = ?;`,
    savedTitleId,
    context.contextType,
    context.contextKey
  );
}

export async function deletePinsForSavedTitleWithDb(
  db: TitlePinsDatabase,
  savedTitleId: string
): Promise<void> {
  assertSavedTitleId(savedTitleId);
  await db.runAsync("DELETE FROM title_pins WHERE saved_title_id = ?;", savedTitleId);
}

export async function deleteTagPinsExceptWithDb(
  db: TitlePinsDatabase,
  savedTitleId: string,
  currentTags: readonly string[]
): Promise<void> {
  assertSavedTitleId(savedTitleId);
  const tags = normalizeSavedTitleTags(currentTags);
  if (tags.length === 0) {
    await db.runAsync(
      "DELETE FROM title_pins WHERE saved_title_id = ? AND context_type = 'tag';",
      savedTitleId
    );
    return;
  }

  const placeholders = tags.map(() => "?").join(", ");
  await db.runAsync(
    `DELETE FROM title_pins
     WHERE saved_title_id = ? AND context_type = 'tag'
       AND context_key NOT IN (${placeholders});`,
    savedTitleId,
    ...tags
  );
}

export async function listTitlePinsForContext(context: PinContext): Promise<TitlePin[]> {
  return listTitlePinsForContextWithDb(await initDb(), context);
}

export async function listAllPinsForBackup(): Promise<BackupTitlePinRow[]> {
  return listAllPinsForBackupWithDb(await initDb());
}

export async function isTitlePinned(savedTitleId: string, context: PinContext): Promise<boolean> {
  return isTitlePinnedWithDb(await initDb(), savedTitleId, context);
}

export async function pinTitle(
  savedTitleId: string,
  context: PinContext,
  pinnedAt = Date.now()
): Promise<void> {
  const db = await initDb();
  return runSerializedStorageMutation(() =>
    db.withTransactionAsync(() => pinTitleWithDb(db, savedTitleId, context, pinnedAt))
  );
}

export async function unpinTitle(savedTitleId: string, context: PinContext): Promise<void> {
  const db = await initDb();
  return runSerializedStorageMutation(() => unpinTitleWithDb(db, savedTitleId, context));
}

export async function deletePinsForSavedTitle(savedTitleId: string): Promise<void> {
  const db = await initDb();
  return runSerializedStorageMutation(() => deletePinsForSavedTitleWithDb(db, savedTitleId));
}

export async function deleteTagPinsExcept(
  savedTitleId: string,
  currentTags: readonly string[]
): Promise<void> {
  const db = await initDb();
  return runSerializedStorageMutation(() =>
    deleteTagPinsExceptWithDb(db, savedTitleId, currentTags)
  );
}

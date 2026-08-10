import { assertValidPinnedAt, parsePinContext, type PinContext } from "../core/contextualPin";

export type BackupPinMergeDatabase = {
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  runAsync(source: string, ...params: any[]): Promise<unknown>;
};

export async function mergeBackupPinWithDb(
  db: BackupPinMergeDatabase,
  savedTitleId: string,
  contextInput: PinContext,
  pinnedAt: number
): Promise<"inserted" | "preserved"> {
  if (typeof savedTitleId !== "string" || !savedTitleId.trim()) {
    throw new Error("El id del título guardado debe ser un string no vacío.");
  }
  const context = parsePinContext(contextInput.contextType, contextInput.contextKey);
  if (!context) throw new Error("El contexto de pin es inválido.");
  assertValidPinnedAt(pinnedAt);

  const existing = await db.getFirstAsync<{ found: number }>(
    `SELECT 1 AS found FROM title_pins
     WHERE saved_title_id = ? AND context_type = ? AND context_key = ? LIMIT 1;`,
    [savedTitleId, context.contextType, context.contextKey]
  );
  if (existing?.found === 1) return "preserved";

  await db.runAsync(
    `INSERT INTO title_pins (saved_title_id, context_type, context_key, pinned_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(saved_title_id, context_type, context_key) DO NOTHING;`,
    savedTitleId,
    context.contextType,
    context.contextKey,
    pinnedAt
  );
  return "inserted";
}

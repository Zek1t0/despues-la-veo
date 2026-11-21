import { createLibraryBackupV9, parseLibraryBackupV9, type ParsedLibraryBackupV9 } from "./libraryBackupV9";
import { parsePersonalProgress, progressVersionsEqual, type PersonalProgress } from "./personalProgress";
import type { BackupValidationError } from "./libraryBackupV1";

export type ProgressBackupIssue = { reference: string; reason: string };
export type ParsedLibraryBackupV10 = Omit<ParsedLibraryBackupV9, "version"> & {
  version: 10; progress: PersonalProgress[]; progressIssues: ProgressBackupIssue[];
};
export function parseLibraryBackupV10(text: string): { ok: true; payload: ParsedLibraryBackupV10 } | { ok: false; error: BackupValidationError } {
  let root: Record<string, unknown>;
  try { root = JSON.parse(text); } catch { return { ok: false, error: { field: "json", message: "JSON inválido." } }; }
  if (!root || typeof root !== "object" || Array.isArray(root) || root.version !== 10 || !Array.isArray(root.progress))
    return { ok: false, error: { field: "root", message: "Backup v10 requiere una lista de progreso, aun vacía." } };
  const previous = parseLibraryBackupV9(JSON.stringify({ ...root, version: 9 }));
  if (!previous.ok) return previous;
  const entries = new Map<string, PersonalProgress>(), blocked = new Set<string>(), progressIssues: ProgressBackupIssue[] = [];
  root.progress.forEach((raw, index) => {
    const reference = raw && typeof raw === "object" && typeof raw.itemId === "string" ? raw.itemId : `Progreso ${index + 1}`;
    try {
      // Copy the durable shape; unknown envelope fields have no authority.
      const value = parsePersonalProgress(raw && typeof raw === "object" ? { version: raw.version, itemId: raw.itemId, position: raw.position, updatedAt: raw.updatedAt } : raw);
      const old = entries.get(value.itemId);
      if (old && !progressVersionsEqual(old, value)) { blocked.add(value.itemId); progressIssues.push({ reference, reason: "Registros de progreso contradictorios para el mismo título." }); }
      else entries.set(value.itemId, value);
    } catch (error) { blocked.add(reference); progressIssues.push({ reference, reason: error instanceof Error ? error.message : "Progreso inválido." }); }
  });
  return { ok: true, payload: { ...previous.payload, version: 10, progress: [...entries.values()].filter(p => !blocked.has(p.itemId)), progressIssues } };
}
export function createLibraryBackupV10(
  items: Parameters<typeof createLibraryBackupV9>[0], pins: Parameters<typeof createLibraryBackupV9>[1],
  appearance: Parameters<typeof createLibraryBackupV9>[2], exportedAt: string | undefined,
  extras: Parameters<typeof createLibraryBackupV9>[4] & { progress: readonly PersonalProgress[] }
) {
  const previous = createLibraryBackupV9(items, pins, appearance, exportedAt, extras);
  const progress = extras.progress.map(parsePersonalProgress), ids = new Set(items.map(item => item.id));
  if (progress.some(p => !ids.has(p.itemId)) || new Set(progress.map(p => p.itemId)).size !== progress.length)
    throw new Error("Hay progreso duplicado o sin título exportable.");
  return { ...previous, version: 10 as const, progress };
}

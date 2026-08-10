import {
  parseLibraryBackupV1,
  type BackupValidationError,
  type ParsedLibraryBackupV1,
} from "./libraryBackupV1";
import { parseLibraryBackupV2, type ParsedLibraryBackupV2 } from "./libraryBackupV2";

export type ParsedLibraryBackup = ParsedLibraryBackupV1 | ParsedLibraryBackupV2;
export type LibraryBackupParseResult =
  | { ok: true; payload: ParsedLibraryBackup }
  | { ok: false; error: BackupValidationError };

export function parseLibraryBackup(jsonText: string): LibraryBackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: { field: "json", message: "El archivo no es JSON válido." } };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: { field: "root", message: "El JSON debe ser un objeto." } };
  }
  const version = (parsed as Record<string, unknown>).version;
  if (version === 1) return parseLibraryBackupV1(jsonText);
  if (version === 2) return parseLibraryBackupV2(jsonText);
  return {
    ok: false,
    error: { field: "version", message: `Versión de backup no soportada: ${String(version)}.` },
  };
}

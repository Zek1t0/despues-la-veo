import { isValidPinnedAt, parsePinContext, type PinContext } from "./contextualPin";
import {
  normalizeBackupSavedTitle,
  type BackupValidationError,
  type NormalizedBackupSavedTitle,
  type SavedTitleProvider,
} from "./libraryBackupV1";

export const LIBRARY_BACKUP_VERSION_V2 = 2 as const;

export type LibraryBackupPinV2 = {
  provider: SavedTitleProvider;
  externalId: string;
  contextType: PinContext["contextType"];
  contextKey: string;
  pinnedAt: number;
};

export type BackupPinValidationError = BackupValidationError & { index: number };

export type ParsedLibraryBackupV2 = {
  version: 2;
  exportedAt?: string;
  items: NormalizedBackupSavedTitle[];
  invalid: BackupValidationError[];
  pins: LibraryBackupPinV2[];
  invalidPins: BackupPinValidationError[];
};

export type LibraryBackupV2ParseResult =
  | { ok: true; payload: ParsedLibraryBackupV2 }
  | { ok: false; error: BackupValidationError };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, field);
}

function normalizeBackupPin(
  value: unknown
): { ok: true; pin: LibraryBackupPinV2 } | { ok: false; message: string } {
  if (!isObject(value)) return { ok: false, message: "El pin debe ser un objeto." };
  if (value.provider !== "manual" && value.provider !== "tmdb") {
    return { ok: false, message: "provider debe ser manual o tmdb." };
  }
  if (typeof value.externalId !== "string" || value.externalId.trim().length === 0) {
    return { ok: false, message: "externalId debe ser un string no vacío." };
  }
  const context = parsePinContext(value.contextType, value.contextKey);
  if (!context) {
    return {
      ok: false,
      message: "El contexto debe ser library con key vacía o tag con key no vacía.",
    };
  }
  if (!isValidPinnedAt(value.pinnedAt)) {
    return { ok: false, message: "pinnedAt debe ser un number entero seguro y no negativo." };
  }
  return {
    ok: true,
    pin: {
      provider: value.provider,
      externalId: value.externalId.trim(),
      contextType: context.contextType,
      contextKey: context.contextKey,
      pinnedAt: value.pinnedAt,
    },
  };
}

export function parseLibraryBackupV2Value(parsed: unknown): LibraryBackupV2ParseResult {
  if (!isObject(parsed)) {
    return { ok: false, error: { field: "root", message: "El JSON debe ser un objeto." } };
  }
  if (parsed.version !== LIBRARY_BACKUP_VERSION_V2) {
    return {
      ok: false,
      error: { field: "version", message: "Versión de backup no soportada (se esperaba version=2)." },
    };
  }
  if (hasOwn(parsed, "exportedAt") && typeof parsed.exportedAt !== "string") {
    return {
      ok: false,
      error: { field: "exportedAt", message: "exportedAt debe ser un string cuando está presente." },
    };
  }
  if (!Array.isArray(parsed.items)) {
    return { ok: false, error: { field: "items", message: "El JSON debe tener 'items' como array." } };
  }
  if (!Array.isArray(parsed.pins)) {
    return { ok: false, error: { field: "root", message: "El JSON v2 debe tener 'pins' como array." } };
  }

  const items: NormalizedBackupSavedTitle[] = [];
  const invalid: BackupValidationError[] = [];
  parsed.items.forEach((item, index) => {
    const result = normalizeBackupSavedTitle(item);
    if (result.ok) items.push(result.item);
    else invalid.push({ ...result.error, index });
  });

  const pins: LibraryBackupPinV2[] = [];
  const invalidPins: BackupPinValidationError[] = [];
  parsed.pins.forEach((pin, index) => {
    const result = normalizeBackupPin(pin);
    if (result.ok) pins.push(result.pin);
    else invalidPins.push({ index, message: result.message });
  });

  return {
    ok: true,
    payload: {
      version: LIBRARY_BACKUP_VERSION_V2,
      exportedAt: parsed.exportedAt as string | undefined,
      items,
      invalid,
      pins,
      invalidPins,
    },
  };
}

export function parseLibraryBackupV2(jsonText: string): LibraryBackupV2ParseResult {
  try {
    return parseLibraryBackupV2Value(JSON.parse(jsonText));
  } catch {
    return { ok: false, error: { field: "json", message: "El archivo no es JSON válido." } };
  }
}

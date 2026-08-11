import { parsePersonalRating } from "./personalRating";
import type { SavedTitle } from "./savedTitle";
import {
  normalizeBackupSavedTitle,
  type BackupValidationError,
  type NormalizedBackupSavedTitle,
} from "./libraryBackupV1";
import {
  normalizeBackupPin,
  type BackupPinValidationError,
  type LibraryBackupPinV2,
} from "./libraryBackupV2";

export const LIBRARY_BACKUP_VERSION_V3 = 3 as const;

export type LibraryBackupV3 = {
  version: 3;
  exportedAt: string;
  items: SavedTitle[];
  pins: LibraryBackupPinV2[];
};

export type ParsedLibraryBackupV3 = {
  version: 3;
  exportedAt?: string;
  items: NormalizedBackupSavedTitle[];
  invalid: BackupValidationError[];
  pins: LibraryBackupPinV2[];
  invalidPins: BackupPinValidationError[];
};

export type LibraryBackupV3ParseResult =
  | { ok: true; payload: ParsedLibraryBackupV3 }
  | { ok: false; error: BackupValidationError };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, field);
}

function normalizeBackupSavedTitleV3(
  value: unknown
): { ok: true; item: NormalizedBackupSavedTitle } | { ok: false; error: BackupValidationError } {
  const common = normalizeBackupSavedTitle(value);
  if (!common.ok) return common;
  if (!isObject(value) || !hasOwn(value, "personalRating")) {
    return {
      ok: false,
      error: {
        field: "personalRating",
        message: "personalRating es obligatorio en items de backup v3.",
      },
    };
  }
  try {
    const personalRating = parsePersonalRating(value.personalRating);
    return {
      ok: true,
      item: {
        ...common.item,
        personalRating: { present: true, value: personalRating },
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        field: "personalRating",
        message: "personalRating debe ser null o un entero entre 10 y 100.",
      },
    };
  }
}

export function parseLibraryBackupV3Value(parsed: unknown): LibraryBackupV3ParseResult {
  if (!isObject(parsed)) {
    return { ok: false, error: { field: "root", message: "El JSON debe ser un objeto." } };
  }
  if (parsed.version !== LIBRARY_BACKUP_VERSION_V3) {
    return {
      ok: false,
      error: { field: "version", message: "Versión de backup no soportada (se esperaba version=3)." },
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
    return { ok: false, error: { field: "root", message: "El JSON v3 debe tener 'pins' como array." } };
  }

  const items: NormalizedBackupSavedTitle[] = [];
  const invalid: BackupValidationError[] = [];
  parsed.items.forEach((item, index) => {
    const result = normalizeBackupSavedTitleV3(item);
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
      version: LIBRARY_BACKUP_VERSION_V3,
      exportedAt: parsed.exportedAt as string | undefined,
      items,
      invalid,
      pins,
      invalidPins,
    },
  };
}

export function parseLibraryBackupV3(jsonText: string): LibraryBackupV3ParseResult {
  try {
    return parseLibraryBackupV3Value(JSON.parse(jsonText));
  } catch {
    return { ok: false, error: { field: "json", message: "El archivo no es JSON válido." } };
  }
}

export function createLibraryBackupV3(
  items: SavedTitle[],
  pins: LibraryBackupPinV2[],
  exportedAt = new Date().toISOString()
): LibraryBackupV3 {
  return {
    version: LIBRARY_BACKUP_VERSION_V3,
    exportedAt,
    items: items.map((item) => ({
      ...item,
      personalRating: parsePersonalRating(item.personalRating),
    })),
    pins,
  };
}

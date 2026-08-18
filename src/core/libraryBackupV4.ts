import type { SavedTitle } from "./savedTitle";
import {
  createLibraryBackupV3,
  parseLibraryBackupV3Value,
  type ParsedLibraryBackupV3,
} from "./libraryBackupV3";
import type { BackupValidationError } from "./libraryBackupV1";
import type { LibraryBackupPinV2 } from "./libraryBackupV2";
import {
  APPEARANCE_PALETTE_IDS,
  APPEARANCE_PREFERENCE_VERSION,
  APPEARANCE_SCHEMES,
  type AppearancePaletteId,
  type AppearancePreference,
  type AppearanceScheme,
} from "../theme/types";
import type { AppearanceBackupAvailability } from "../theme/appearanceBackupAvailability";

export const LIBRARY_BACKUP_VERSION_V4 = 4 as const;

export type PortableBackupAppearance = Readonly<{
  scheme: AppearanceScheme;
  palette: AppearancePaletteId;
}>;

export type LibraryBackupV4 = {
  version: 4;
  exportedAt: string;
  items: SavedTitle[];
  pins: LibraryBackupPinV2[];
  appearance?: PortableBackupAppearance;
};

export type ParsedBackupAppearance =
  | Readonly<{ status: "valid"; preference: AppearancePreference }>
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "incompatible"; reason: string }>;

export type ParsedLibraryBackupV4 = Omit<ParsedLibraryBackupV3, "version"> & {
  version: 4;
  appearance: ParsedBackupAppearance;
};

export type LibraryBackupV4ParseResult =
  | { ok: true; payload: ParsedLibraryBackupV4 }
  | { ok: false; error: BackupValidationError };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, field);
}

export function parsePortableBackupAppearance(value: unknown): ParsedBackupAppearance {
  if (!isObject(value)) {
    return { status: "incompatible", reason: "La Appearance del backup no tiene una forma compatible." };
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("scheme") || !keys.includes("palette")) {
    return { status: "incompatible", reason: "La Appearance del backup contiene una forma incompatible." };
  }
  if (!APPEARANCE_SCHEMES.includes(value.scheme as never)) {
    return { status: "incompatible", reason: "El scheme de Appearance no es compatible." };
  }
  if (!APPEARANCE_PALETTE_IDS.includes(value.palette as never)) {
    return { status: "incompatible", reason: "La palette de Appearance no es compatible." };
  }
  return {
    status: "valid",
    preference: Object.freeze({
      version: APPEARANCE_PREFERENCE_VERSION,
      scheme: value.scheme as AppearanceScheme,
      palette: value.palette as AppearancePaletteId,
    }),
  };
}

export function parseLibraryBackupV4Value(parsed: unknown): LibraryBackupV4ParseResult {
  if (!isObject(parsed)) {
    return { ok: false, error: { field: "root", message: "El JSON debe ser un objeto." } };
  }
  if (parsed.version !== LIBRARY_BACKUP_VERSION_V4) {
    return {
      ok: false,
      error: { field: "version", message: "Versión de backup no soportada (se esperaba version=4)." },
    };
  }

  const v3Compatible = parseLibraryBackupV3Value({ ...parsed, version: 3 });
  if (!v3Compatible.ok) return v3Compatible;
  const appearance = hasOwn(parsed, "appearance")
    ? parsePortableBackupAppearance(parsed.appearance)
    : { status: "absent" as const };
  return {
    ok: true,
    payload: {
      ...v3Compatible.payload,
      version: LIBRARY_BACKUP_VERSION_V4,
      appearance,
    },
  };
}

export function parseLibraryBackupV4(jsonText: string): LibraryBackupV4ParseResult {
  try {
    return parseLibraryBackupV4Value(JSON.parse(jsonText));
  } catch {
    return { ok: false, error: { field: "json", message: "El archivo no es JSON válido." } };
  }
}

export function createLibraryBackupV4(
  items: SavedTitle[],
  pins: LibraryBackupPinV2[],
  appearanceAvailability: AppearanceBackupAvailability,
  exportedAt = new Date().toISOString()
): LibraryBackupV4 {
  const v3 = createLibraryBackupV3(items, pins, exportedAt);
  const backup: LibraryBackupV4 = {
    version: LIBRARY_BACKUP_VERSION_V4,
    exportedAt: v3.exportedAt,
    items: v3.items,
    pins: v3.pins,
  };
  if (appearanceAvailability.status !== "unavailable") {
    backup.appearance = {
      scheme: appearanceAvailability.preference.scheme,
      palette: appearanceAvailability.preference.palette,
    };
  }
  return backup;
}

export type BackupAppearanceImportOutcome =
  | Readonly<{ status: "applied" }>
  | Readonly<{ status: "superseded" }>
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "incompatible"; reason: string }>
  | Readonly<{ status: "persistence-failure"; error: unknown }>;

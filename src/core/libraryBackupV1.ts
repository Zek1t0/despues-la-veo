import type { SavedTitle, TitleStatus, TitleType } from "./savedTitle";

export const LIBRARY_BACKUP_VERSION = 1 as const;

export type SavedTitleProvider = SavedTitle["provider"];

// Contrato JSON v1 y correspondencia persistida:
// id: string opcional -> id TEXT NOT NULL
// provider: "manual" | "tmdb" requerido -> provider TEXT NOT NULL
// externalId: string no vacío requerido -> external_id TEXT NOT NULL
// type: "movie" | "tv" requerido -> type TEXT NOT NULL
// title: string no vacío requerido -> title TEXT NOT NULL
// year: número finito | null opcional -> year INTEGER NULL
// posterUrl: string | null opcional -> poster_url TEXT NULL
// overview: string | null opcional -> overview TEXT NULL
// voteAverage: número finito | null opcional -> vote_average REAL NULL
// genres: string[] opcional, no admite null -> genres_json TEXT
// status: TitleStatus opcional, no admite null -> status TEXT NOT NULL
// tags: string[] opcional, no admite null -> tags_json TEXT NOT NULL
// notes: string | null opcional -> notes TEXT NULL
// createdAt: número finito no negativo opcional -> created_at INTEGER NOT NULL
// updatedAt: número finito no negativo opcional -> updated_at INTEGER NOT NULL

export type OptionalBackupField<T> =
  | { present: false }
  | { present: true; value: T };

export type NormalizedBackupSavedTitle = {
  provider: SavedTitleProvider;
  externalId: string;
  type: TitleType;
  title: string;
  id: OptionalBackupField<string>;
  year: OptionalBackupField<number | null>;
  posterUrl: OptionalBackupField<string | null>;
  overview: OptionalBackupField<string | null>;
  voteAverage: OptionalBackupField<number | null>;
  genres: OptionalBackupField<string[]>;
  status: OptionalBackupField<TitleStatus>;
  tags: OptionalBackupField<string[]>;
  notes: OptionalBackupField<string | null>;
  createdAt: OptionalBackupField<number>;
  updatedAt: OptionalBackupField<number>;
};

export type BackupValidationError = {
  index?: number;
  field?: keyof SavedTitle | "version" | "exportedAt" | "items" | "root" | "json";
  message: string;
};

export type ParsedLibraryBackupV1 = {
  version: 1;
  exportedAt?: string;
  items: NormalizedBackupSavedTitle[];
  invalid: BackupValidationError[];
};

export type LibraryBackupParseResult =
  | { ok: true; payload: ParsedLibraryBackupV1 }
  | { ok: false; error: BackupValidationError };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, field);
}

function absent<T>(): OptionalBackupField<T> {
  return { present: false };
}

function present<T>(value: T): OptionalBackupField<T> {
  return { present: true, value };
}

function isProvider(value: unknown): value is SavedTitleProvider {
  return value === "manual" || value === "tmdb";
}

function isTitleType(value: unknown): value is TitleType {
  return value === "movie" || value === "tv";
}

function isTitleStatus(value: unknown): value is TitleStatus {
  return value === "planned" || value === "watching" || value === "done" || value === "dropped";
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function invalidField(field: keyof SavedTitle, message: string): BackupValidationError {
  return { field, message };
}

function readOptional<T>(
  raw: Record<string, unknown>,
  field: keyof SavedTitle,
  isValid: (value: unknown) => value is T,
  description: string
): OptionalBackupField<T> | BackupValidationError {
  if (!hasOwn(raw, field)) return absent();
  const value = raw[field];
  return isValid(value) ? present(value) : invalidField(field, `${String(field)} debe ser ${description}.`);
}

export function normalizeBackupSavedTitle(
  value: unknown
): { ok: true; item: NormalizedBackupSavedTitle } | { ok: false; error: BackupValidationError } {
  if (!isObject(value)) {
    return { ok: false, error: { message: "El elemento debe ser un objeto." } };
  }

  if (!isProvider(value.provider)) {
    return { ok: false, error: invalidField("provider", "provider debe ser manual o tmdb.") };
  }
  if (typeof value.externalId !== "string" || value.externalId.trim().length === 0) {
    return { ok: false, error: invalidField("externalId", "externalId debe ser un string no vacío.") };
  }
  if (!isTitleType(value.type)) {
    return { ok: false, error: invalidField("type", "type debe ser movie o tv.") };
  }
  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    return { ok: false, error: invalidField("title", "title debe ser un string no vacío.") };
  }

  const id = readOptional(value, "id", (item): item is string => typeof item === "string" && item.trim().length > 0, "un string no vacío");
  const year = readOptional(value, "year", (item): item is number | null => item === null || typeof item === "number" && Number.isFinite(item), "un número finito o null");
  const posterUrl = readOptional(value, "posterUrl", (item): item is string | null => item === null || typeof item === "string", "un string o null");
  const overview = readOptional(value, "overview", (item): item is string | null => item === null || typeof item === "string", "un string o null");
  const voteAverage = readOptional(value, "voteAverage", (item): item is number | null => item === null || typeof item === "number" && Number.isFinite(item), "un número finito o null");
  const genres = readOptional(value, "genres", isStringArray, "un array de strings");
  const status = readOptional(value, "status", isTitleStatus, "un estado permitido");
  const tags = readOptional(value, "tags", isStringArray, "un array de strings");
  const notes = readOptional(value, "notes", (item): item is string | null => item === null || typeof item === "string", "un string o null");
  const createdAt = readOptional(value, "createdAt", isFiniteNonNegativeNumber, "un número finito y no negativo");
  const updatedAt = readOptional(value, "updatedAt", isFiniteNonNegativeNumber, "un número finito y no negativo");

  const optionalFields = [id, year, posterUrl, overview, voteAverage, genres, status, tags, notes, createdAt, updatedAt];
  const error = optionalFields.find((field): field is BackupValidationError => "message" in field);
  if (error) return { ok: false, error };
  const normalizedId = id as OptionalBackupField<string>;

  return {
    ok: true,
    item: {
      provider: value.provider,
      externalId: value.externalId.trim(),
      type: value.type,
      title: value.title.trim(),
      id: normalizedId.present ? present(normalizedId.value.trim()) : absent(),
      year: year as OptionalBackupField<number | null>,
      posterUrl: posterUrl as OptionalBackupField<string | null>,
      overview: overview as OptionalBackupField<string | null>,
      voteAverage: voteAverage as OptionalBackupField<number | null>,
      genres: genres as OptionalBackupField<string[]>,
      status: status as OptionalBackupField<TitleStatus>,
      tags: tags as OptionalBackupField<string[]>,
      notes: notes as OptionalBackupField<string | null>,
      createdAt: createdAt as OptionalBackupField<number>,
      updatedAt: updatedAt as OptionalBackupField<number>,
    },
  };
}

export function parseLibraryBackupV1(jsonText: string): LibraryBackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: { field: "json", message: "El archivo no es JSON válido." } };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: { field: "root", message: "El JSON debe ser un objeto." } };
  }
  if (parsed.version !== LIBRARY_BACKUP_VERSION) {
    return { ok: false, error: { field: "version", message: "Versión de backup no soportada (se esperaba version=1)." } };
  }
  if (hasOwn(parsed, "exportedAt") && typeof parsed.exportedAt !== "string") {
    return { ok: false, error: { field: "exportedAt", message: "exportedAt debe ser un string cuando está presente." } };
  }
  if (!Array.isArray(parsed.items)) {
    return { ok: false, error: { field: "items", message: "El JSON debe tener 'items' como array." } };
  }

  const items: NormalizedBackupSavedTitle[] = [];
  const invalid: BackupValidationError[] = [];
  parsed.items.forEach((item, index) => {
    const result = normalizeBackupSavedTitle(item);
    if (result.ok) items.push(result.item);
    else invalid.push({ ...result.error, index });
  });

  return {
    ok: true,
    payload: {
      version: LIBRARY_BACKUP_VERSION,
      exportedAt: parsed.exportedAt as string | undefined,
      items,
      invalid,
    },
  };
}

export function materializeSavedTitleForInsert(
  item: NormalizedBackupSavedTitle,
  generateId: () => string,
  now = Date.now()
): SavedTitle {
  return {
    id: item.id.present ? item.id.value : generateId(),
    provider: item.provider,
    externalId: item.externalId,
    type: item.type,
    title: item.title,
    year: item.year.present ? item.year.value : null,
    posterUrl: item.posterUrl.present ? item.posterUrl.value : null,
    overview: item.overview.present ? item.overview.value : null,
    voteAverage: item.voteAverage.present ? item.voteAverage.value : null,
    genres: item.genres.present ? item.genres.value : [],
    status: item.status.present ? item.status.value : "planned",
    tags: item.tags.present ? item.tags.value : [],
    notes: item.notes.present ? item.notes.value : null,
    createdAt: item.createdAt.present ? item.createdAt.value : now,
    updatedAt: item.updatedAt.present ? item.updatedAt.value : now,
  };
}

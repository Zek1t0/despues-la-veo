import { parsePinContext, isValidPinnedAt, type PinContext } from "./contextualPin";
import { normalizeBackupSavedTitle, type BackupValidationError, type NormalizedBackupSavedTitle } from "./libraryBackupV1";
import { parsePersonalRating } from "./personalRating";
import { createProviderReference, providerReferenceKey, type ProviderReference } from "./providerReference";
import type { SavedTitle, SavedTitleWithProviderReferences } from "./savedTitle";
import { createTmdbProviderReference } from "./tmdbSavedTitle";
import { parsePortableBackupAppearance, type ParsedBackupAppearance, type PortableBackupAppearance } from "./libraryBackupV4";
import type { AppearanceBackupAvailability } from "../theme/appearanceBackupAvailability";

export const LIBRARY_BACKUP_VERSION_V5 = 5 as const;
export const LEGACY_MANUAL_BACKUP_FORMAT = "library-backup-v1-v4" as const;

export type BackupLegacyIdentityV5 = {
  format: typeof LEGACY_MANUAL_BACKUP_FORMAT;
  provider: "manual";
  externalId: string;
};

export type BackupMediaItemV5 = SavedTitle & {
  providerReferences: ProviderReference[];
  legacyIdentity?: BackupLegacyIdentityV5;
};

export type BackupPinV5 = {
  itemId: string;
  contextType: PinContext["contextType"];
  contextKey: string;
  pinnedAt: number;
};

export type LibraryBackupV5 = {
  version: 5;
  exportedAt: string;
  items: BackupMediaItemV5[];
  pins: BackupPinV5[];
  appearance?: PortableBackupAppearance;
};

export type NormalizedBackupMediaItemV5 = Omit<NormalizedBackupSavedTitle, "provider" | "externalId"> & {
  id: { present: true; value: string };
  providerReferences: ProviderReference[];
  legacyIdentity?: BackupLegacyIdentityV5;
};

export type BackupPinValidationErrorV5 = BackupValidationError & { index: number };
export type ParsedLibraryBackupV5 = {
  version: 5;
  exportedAt?: string;
  items: NormalizedBackupMediaItemV5[];
  invalid: BackupValidationError[];
  pins: BackupPinV5[];
  invalidPins: BackupPinValidationErrorV5[];
  appearance: ParsedBackupAppearance;
};

export type LibraryBackupV5ParseResult =
  | { ok: true; payload: ParsedLibraryBackupV5 }
  | { ok: false; error: BackupValidationError };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeLegacyIdentity(value: unknown): BackupLegacyIdentityV5 | null {
  if (!isObject(value)) return null;
  if (value.format !== LEGACY_MANUAL_BACKUP_FORMAT || value.provider !== "manual") return null;
  if (typeof value.externalId !== "string" || value.externalId.length === 0) return null;
  return { format: LEGACY_MANUAL_BACKUP_FORMAT, provider: "manual", externalId: value.externalId };
}

function normalizeItem(value: unknown): { ok: true; item: NormalizedBackupMediaItemV5 } | { ok: false; error: BackupValidationError } {
  if (!isObject(value)) return { ok: false, error: { message: "El elemento debe ser un objeto." } };
  if (typeof value.id !== "string" || !value.id.trim()) {
    return { ok: false, error: { field: "id", message: "id debe ser un string no vacío." } };
  }
  if (!Array.isArray(value.providerReferences)) {
    return { ok: false, error: { message: "providerReferences debe ser un array." } };
  }
  const providerReferences: ProviderReference[] = [];
  const providerReferenceKeys = new Set<string>();
  try {
    for (const reference of value.providerReferences) {
      if (!isObject(reference)) throw new Error("Cada ProviderReference debe ser un objeto.");
      const canonical = createProviderReference({
        provider: reference.provider as string,
        resourceNamespace: reference.resourceNamespace as string,
        externalId: reference.externalId as string,
      });
      const key = providerReferenceKey(canonical);
      if (providerReferenceKeys.has(key)) throw new Error("Una ProviderReference está duplicada dentro del item.");
      providerReferenceKeys.add(key);
      providerReferences.push(canonical);
    }
  } catch (error) {
    return { ok: false, error: { message: error instanceof Error ? error.message : "ProviderReference inválida." } };
  }
  let legacyIdentity: BackupLegacyIdentityV5 | undefined;
  if (hasOwn(value, "legacyIdentity")) {
    legacyIdentity = normalizeLegacyIdentity(value.legacyIdentity) ?? undefined;
    if (!legacyIdentity) return { ok: false, error: { message: "legacyIdentity no es compatible." } };
  }
  const common = normalizeBackupSavedTitle({ ...value, provider: "manual", externalId: legacyIdentity?.externalId ?? value.id });
  if (!common.ok) return common;
  try {
    for (let index = 0; index < providerReferences.length; index++) {
      const reference = providerReferences[index];
      if (reference.provider !== "tmdb") continue;
      const canonical = createTmdbProviderReference(
        reference.resourceNamespace as "movie" | "tv",
        reference.externalId
      );
      if (canonical.resourceNamespace !== common.item.type) {
        throw new Error("La referencia TMDB no coincide con el tipo movie/tv del item.");
      }
      providerReferences[index] = canonical;
    }
    const canonicalKeys = providerReferences.map(providerReferenceKey);
    if (new Set(canonicalKeys).size !== canonicalKeys.length) {
      throw new Error("Una ProviderReference está duplicada dentro del item después de canonicalizar TMDB.");
    }
  } catch (error) {
    return { ok: false, error: { message: error instanceof Error ? error.message : "Referencia TMDB inválida." } };
  }
  if (!hasOwn(value, "personalRating")) {
    return { ok: false, error: { field: "personalRating", message: "personalRating es obligatorio en items de backup v5." } };
  }
  try {
    return {
      ok: true,
      item: {
        ...common.item,
        id: { present: true, value: value.id.trim() },
        personalRating: { present: true, value: parsePersonalRating(value.personalRating) },
        providerReferences,
        legacyIdentity,
      },
    };
  } catch {
    return { ok: false, error: { field: "personalRating", message: "personalRating debe ser null o un entero entre 10 y 100." } };
  }
}

function normalizePin(value: unknown): { ok: true; pin: BackupPinV5 } | { ok: false; message: string } {
  if (!isObject(value)) return { ok: false, message: "El pin debe ser un objeto." };
  if (typeof value.itemId !== "string" || !value.itemId.trim()) return { ok: false, message: "itemId debe ser un string no vacío." };
  const context = parsePinContext(value.contextType, value.contextKey);
  if (!context) return { ok: false, message: "El contexto debe ser library con key vacía o tag con key no vacía." };
  if (!isValidPinnedAt(value.pinnedAt)) return { ok: false, message: "pinnedAt debe ser un number entero seguro y no negativo." };
  return { ok: true, pin: { itemId: value.itemId.trim(), ...context, pinnedAt: value.pinnedAt } };
}

export function parseLibraryBackupV5Value(parsed: unknown): LibraryBackupV5ParseResult {
  if (!isObject(parsed)) return { ok: false, error: { field: "root", message: "El JSON debe ser un objeto." } };
  if (parsed.version !== LIBRARY_BACKUP_VERSION_V5) return { ok: false, error: { field: "version", message: "Versión de backup no soportada (se esperaba version=5)." } };
  if (hasOwn(parsed, "exportedAt") && typeof parsed.exportedAt !== "string") return { ok: false, error: { field: "exportedAt", message: "exportedAt debe ser un string cuando está presente." } };
  if (!Array.isArray(parsed.items)) return { ok: false, error: { field: "items", message: "El JSON debe tener 'items' como array." } };
  if (!Array.isArray(parsed.pins)) return { ok: false, error: { field: "root", message: "El JSON v5 debe tener 'pins' como array." } };

  const candidates: Array<{ index: number; item: NormalizedBackupMediaItemV5 }> = [];
  const invalid: BackupValidationError[] = [];
  parsed.items.forEach((value, index) => {
    const result = normalizeItem(value);
    if (result.ok) candidates.push({ index, item: result.item });
    else invalid.push({ ...result.error, index });
  });
  const duplicateIndexes = new Set<number>();
  const ids = new Map<string, number[]>();
  const references = new Map<string, number[]>();
  const legacyIdentities = new Map<string, number[]>();
  for (const candidate of candidates) {
    ids.set(candidate.item.id.value, [...(ids.get(candidate.item.id.value) ?? []), candidate.index]);
    for (const reference of candidate.item.providerReferences) {
      const key = providerReferenceKey(reference);
      references.set(key, [...(references.get(key) ?? []), candidate.index]);
    }
    if (candidate.item.legacyIdentity) {
      const key = `${candidate.item.legacyIdentity.format}\u0000manual\u0000${candidate.item.legacyIdentity.externalId}`;
      legacyIdentities.set(key, [...(legacyIdentities.get(key) ?? []), candidate.index]);
    }
  }
  for (const indexes of ids.values()) if (indexes.length > 1) indexes.forEach((index) => duplicateIndexes.add(index));
  for (const indexes of references.values()) if (new Set(indexes).size > 1) indexes.forEach((index) => duplicateIndexes.add(index));
  for (const indexes of legacyIdentities.values()) if (indexes.length > 1) indexes.forEach((index) => duplicateIndexes.add(index));
  for (const index of duplicateIndexes) invalid.push({ index, field: "id", message: "El item tiene un id duplicado o una ProviderReference compartida con otro item." });

  const pins: BackupPinV5[] = [];
  const invalidPins: BackupPinValidationErrorV5[] = [];
  parsed.pins.forEach((value, index) => {
    const result = normalizePin(value);
    if (result.ok) pins.push(result.pin);
    else invalidPins.push({ index, message: result.message });
  });
  return { ok: true, payload: {
    version: 5,
    exportedAt: parsed.exportedAt as string | undefined,
    items: candidates.filter(({ index }) => !duplicateIndexes.has(index)).map(({ item }) => item),
    invalid,
    pins,
    invalidPins,
    appearance: hasOwn(parsed, "appearance") ? parsePortableBackupAppearance(parsed.appearance) : { status: "absent" },
  } };
}

export function parseLibraryBackupV5(jsonText: string): LibraryBackupV5ParseResult {
  try { return parseLibraryBackupV5Value(JSON.parse(jsonText)); }
  catch { return { ok: false, error: { field: "json", message: "El archivo no es JSON válido." } }; }
}

export function createLibraryBackupV5(
  items: Array<SavedTitleWithProviderReferences & { legacyIdentity?: BackupLegacyIdentityV5 }>,
  pins: BackupPinV5[],
  appearanceAvailability: AppearanceBackupAvailability,
  exportedAt = new Date().toISOString()
): LibraryBackupV5 {
  const backupItems = items.map((item): BackupMediaItemV5 => {
    if (item.providerReferences.length === 0 && !item.legacyIdentity) throw new Error(`El MediaItem ${item.id} no tiene identidad portable para backup v5.`);
    const { providerReferences, legacyIdentity, ...savedTitle } = item;
    return { ...savedTitle, personalRating: parsePersonalRating(savedTitle.personalRating), providerReferences: providerReferences.map(createProviderReference), ...(legacyIdentity ? { legacyIdentity } : {}) };
  });
  const backup: LibraryBackupV5 = { version: 5, exportedAt, items: backupItems, pins };
  if (appearanceAvailability.status !== "unavailable") backup.appearance = { scheme: appearanceAvailability.preference.scheme, palette: appearanceAvailability.preference.palette };
  return backup;
}

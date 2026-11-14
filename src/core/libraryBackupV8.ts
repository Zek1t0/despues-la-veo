import { metadataSemanticKey } from "./metadataSemanticKey";
import { createLibraryBackupV7, parseLibraryBackupV7Value, type BackupLegacyIdentityV7, type BackupPinV7, type NormalizedBackupMediaItemV7, type ParsedLibraryBackupV7 } from "./libraryBackupV7";
import type { SavedTitleWithProviderReferences } from "./savedTitle";
import { parseMediaMetadataState, projectMediaMetadata, legacyMetadataSnapshot, type MediaMetadataState } from "./mediaMetadataState";
import { metadataObject, metadataTimestamp, METADATA_FIELD_NAMES } from "./metadataValidation";
import { parseMediaPreferences, type PortableMediaPreferences } from "./mediaPreferences";
import type { AppearanceBackupAvailability } from "../theme/appearanceBackupAvailability";
import type { BackupValidationError } from "./libraryBackupV1";

export type PortableActivityEvent = Readonly<{ id: string; itemId: string; occurredAt: number; kind: string;
  origin: "metadata" | "personal"; fields: readonly string[]; operationKey: string }>;
export type NormalizedBackupMediaItemV8 = NormalizedBackupMediaItemV7 & { metadataState?: MediaMetadataState };
export type ParsedLibraryBackupV8 = Omit<ParsedLibraryBackupV7, "version" | "items"> & { version: 8; items: NormalizedBackupMediaItemV8[];
  preferences?: PortableMediaPreferences; preferenceIssues: string[]; activity?: PortableActivityEvent[]; invalidActivity: string[] };

export function parsePortableActivity(value: unknown): PortableActivityEvent {
  if (!metadataObject(value) || ![value.id,value.itemId,value.operationKey].every(v => typeof v === "string" && v.length > 0 && v.length <= 10000) ||
      !metadataTimestamp(value.occurredAt) || !["metadata","personal"].includes(value.origin as string) ||
      !["metadata","added","manual-edit","status","tags","notes","personalRating","pin"].includes(value.kind as string) ||
      !Array.isArray(value.fields) || value.fields.length > 64 || !value.fields.every(field => typeof field === "string" &&
        [...METADATA_FIELD_NAMES,"status","tags","notes","personalRating","pin","title"].includes(field as never))) throw new Error("Actividad portable inválida.");
  return { id: value.id as string, itemId: value.itemId as string, operationKey: value.operationKey as string, occurredAt: value.occurredAt,
    kind: value.kind as string, origin: value.origin as "metadata" | "personal", fields: [...value.fields] };
}
export function parseLibraryBackupV8(jsonText: string): { ok: true; payload: ParsedLibraryBackupV8 } | { ok: false; error: BackupValidationError } {
  let root: unknown;
  try { root = JSON.parse(jsonText); } catch { return { ok: false, error: { field: "json", message: "JSON inválido." } }; }
  if (!metadataObject(root) || root.version !== 8) return { ok: false, error: { field: "version", message: "Se esperaba backup v8." } };
  const legacy = parseLibraryBackupV7Value({ ...root, version: 7 });
  if (!legacy.ok) return legacy;
  const items: NormalizedBackupMediaItemV8[] = [], invalid = [...legacy.payload.invalid];
  const rawItems = root.items as Record<string, unknown>[];
  for (const item of legacy.payload.items) {
    const raw = rawItems.find(raw => metadataObject(raw) && typeof raw.id === "string" && raw.id.trim() === item.id.value)!;
    try {
      const metadataState = raw.metadataState === undefined ? undefined : parseMediaMetadataState(raw.metadataState, item.providerReferences, item.medium);
      if (metadataState) {
        const projection = projectMediaMetadata(metadataState);
        const actual = legacyMetadataSnapshot(raw as unknown as SavedTitleWithProviderReferences);
        if (metadataSemanticKey(projection) !== metadataSemanticKey(actual)) throw new Error("Proyección derivada contradictoria con sus fuentes/baseline.");
      }
      items.push({ ...item, ...(metadataState ? { metadataState } : {}) });
    } catch (error) { invalid.push({ index: rawItems.indexOf(raw), field: "items", message: String(error instanceof Error ? error.message : error) }); }
  }
  let preferences: PortableMediaPreferences | undefined;
  const preferenceIssues: string[] = [];
  if (root.preferences !== undefined) { try { preferences = parseMediaPreferences(root.preferences); } catch { preferenceIssues.push("Preferencias inválidas: se conservarán las locales."); } }
  const activity: PortableActivityEvent[] = [], invalidActivity: string[] = [];
  if (root.activity !== undefined) {
    if (!Array.isArray(root.activity) || root.activity.length > 2000) invalidActivity.push("Actividad inválida o fuera de límite.");
    else for (const entry of root.activity) { try { activity.push(parsePortableActivity(entry)); } catch { invalidActivity.push("Evento inválido."); } }
  }
  return { ok: true, payload: { ...legacy.payload, version: 8, items, invalid, preferences, preferenceIssues,
    ...(root.activity !== undefined ? { activity } : {}), invalidActivity } };
}

export function createLibraryBackupV8(items: Array<SavedTitleWithProviderReferences & { legacyIdentity?: BackupLegacyIdentityV7 }>,
  pins: BackupPinV7[], appearance: AppearanceBackupAvailability, exportedAt = new Date().toISOString(),
  extras: { preferences?: PortableMediaPreferences; activity?: PortableActivityEvent[] } = {}) {
  const clean = items.map(({ metadataState: _, localAliases: __, ...item }) => item);
  const old = createLibraryBackupV7(clean, pins, appearance, exportedAt);
  const result = { ...old, version: 8 as const, items: old.items.map((item, index) => ({ ...item,
    ...(items[index].metadataState ? { metadataState: items[index].metadataState } : {}) })),
    ...(extras.preferences ? { preferences: parseMediaPreferences(extras.preferences) } : {}),
    ...(extras.activity ? { activity: extras.activity.map(parsePortableActivity) } : {}) };
  const parsed = parseLibraryBackupV8(JSON.stringify(result));
  if (!parsed.ok || parsed.payload.invalid.length || parsed.payload.invalidActivity.length) throw new Error("El estado local no puede exportarse como v8.");
  return result;
}

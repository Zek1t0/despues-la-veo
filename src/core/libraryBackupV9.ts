import { createLibraryBackupV8, parseLibraryBackupV8, type ParsedLibraryBackupV8 } from "./libraryBackupV8";
import { parseCollection, parseMembership, type PersonalCollection, type CollectionMembership } from "./personalCollection";
import type { BackupValidationError } from "./libraryBackupV1";

export type ParsedLibraryBackupV9 = Omit<ParsedLibraryBackupV8, "version"> & {
  version: 9; collections: PersonalCollection[]; collectionMemberships: CollectionMembership[]; organizationIssues: string[];
};
function records<T>(raw: unknown[], parse: (v: unknown) => T, key: (v: T) => string, issues: string[]): T[] {
  const entries = new Map<string, T>(); const conflicts = new Set<string>();
  for (const value of raw) {
    try {
      const entry = parse(value), id = key(entry), old = entries.get(id);
      if (old && JSON.stringify(old) !== JSON.stringify(entry)) { conflicts.add(id); issues.push(`Registro contradictorio: ${id}.`); }
      else entries.set(id, entry);
    } catch (error) { issues.push(error instanceof Error ? error.message : "Registro inválido."); }
  }
  return [...entries].filter(([id]) => !conflicts.has(id)).map(([, entry]) => entry);
}
export function parseLibraryBackupV9(text: string): { ok: true; payload: ParsedLibraryBackupV9 } | { ok: false; error: BackupValidationError } {
  let root: Record<string, unknown>;
  try { root = JSON.parse(text); } catch { return { ok: false, error: { field: "json", message: "JSON inválido." } }; }
  if (!root || typeof root !== "object" || root.version !== 9 || !Array.isArray(root.collections) || !Array.isArray(root.collectionMemberships)) {
    return { ok: false, error: { field: "root", message: "Backup v9 malformado: se esperan colecciones y membresías." } };
  }
  // S1 cannot silently discard data from a later Inbox-capable build.
  if (root.recommendations !== undefined && (!Array.isArray(root.recommendations) || root.recommendations.length)) {
    return { ok: false, error: { field: "root", message: "Este build todavía no restaura recomendaciones. Conservá el archivo para S2." } };
  }
  const previous = parseLibraryBackupV8(JSON.stringify({ ...root, version: 8 }));
  if (!previous.ok) return previous;
  const organizationIssues: string[] = [];
  const collections = records(root.collections, parseCollection, v => v.id, organizationIssues);
  const collectionMemberships = records(root.collectionMemberships, parseMembership, v => JSON.stringify([v.collectionId,v.itemId]), organizationIssues);
  return { ok: true, payload: { ...previous.payload, version: 9, collections, collectionMemberships, organizationIssues } };
}
export function createLibraryBackupV9(
  items: Parameters<typeof createLibraryBackupV8>[0], pins: Parameters<typeof createLibraryBackupV8>[1],
  appearance: Parameters<typeof createLibraryBackupV8>[2], exportedAt: string | undefined,
  extras: NonNullable<Parameters<typeof createLibraryBackupV8>[4]> & { collections: PersonalCollection[]; collectionMemberships: CollectionMembership[] }
) {
  const previous = createLibraryBackupV8(items,pins,appearance,exportedAt,extras);
  const result = { ...previous, version: 9 as const, collections: extras.collections.map(parseCollection), collectionMemberships: extras.collectionMemberships.map(parseMembership) };
  const checked = parseLibraryBackupV9(JSON.stringify(result));
  if (!checked.ok || checked.payload.organizationIssues.length) throw new Error("La organización local no puede exportarse como v9.");
  const ids = new Set(items.map(item => item.id)), collections = new Set(result.collections.map(entry => entry.id));
  if (result.collectionMemberships.some(entry => !ids.has(entry.itemId) || !collections.has(entry.collectionId))) throw new Error("Hay membresías sin destino exportable.");
  return result;
}

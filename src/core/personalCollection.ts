export type PersonalCollection = { id: string; name: string; description: string | null; createdAt: number; updatedAt: number };
export type CollectionMembership = { collectionId: string; itemId: string; addedAt: number; updatedAt: number };
export function organizationId(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error("Identificador inválido.");
  return value;
}
export function organizationTimestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Fecha inválida.");
  return value;
}
export function collectionFields(name: unknown, description: unknown): Pick<PersonalCollection, "name" | "description"> {
  if (typeof name !== "string" || !name.trim()) throw new Error("Escribí un nombre para la colección.");
  if (description !== null && description !== undefined && typeof description !== "string") throw new Error("Descripción inválida.");
  return { name: name.trim(), description: typeof description === "string" ? description.trim() || null : null };
}
export function parseCollection(value: unknown): PersonalCollection {
  const v = value as PersonalCollection | null;
  if (!v || typeof v !== "object") throw new Error("Colección inválida.");
  return { id: organizationId(v.id), ...collectionFields(v.name, v.description),
    createdAt: organizationTimestamp(v.createdAt), updatedAt: organizationTimestamp(v.updatedAt) };
}
export function parseMembership(value: unknown): CollectionMembership {
  const v = value as CollectionMembership | null;
  if (!v || typeof v !== "object") throw new Error("Membresía inválida.");
  return { collectionId: organizationId(v.collectionId), itemId: organizationId(v.itemId),
    addedAt: organizationTimestamp(v.addedAt), updatedAt: organizationTimestamp(v.updatedAt) };
}

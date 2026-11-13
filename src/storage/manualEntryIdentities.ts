import { generateManualEntryIdentity, parseManualEntryIdentity } from "../core/manualEntryIdentity";
import type { SavedTitleStorageMutationDatabase, SavedTitleStorageReadDatabase } from "./savedTitleStorage";

export class ManualIdentityConflict extends Error {}

export async function manualIdentityOwnerWithDb(db: SavedTitleStorageReadDatabase, token: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ saved_title_id: string }>(
    "SELECT saved_title_id FROM manual_entry_identities WHERE portable_id = ?;", [parseManualEntryIdentity(token)]
  );
  return row?.saved_title_id ?? null;
}

export async function manualIdentityForItemWithDb(db: SavedTitleStorageReadDatabase, id: string): Promise<string | undefined> {
  const row = await db.getFirstAsync<{ portable_id: string }>(
    "SELECT portable_id FROM manual_entry_identities WHERE saved_title_id = ?;", [id]
  );
  return row ? parseManualEntryIdentity(row.portable_id) : undefined;
}

/** Caller owns the serialized transaction/savepoint. Never initializes or nests one. */
export async function attachManualIdentityWithDb(db: SavedTitleStorageMutationDatabase, token: string, id: string): Promise<void> {
  parseManualEntryIdentity(token);
  const owner = await manualIdentityOwnerWithDb(db, token);
  const existing = await manualIdentityForItemWithDb(db, id);
  if (owner !== null && owner !== id || existing !== undefined && existing !== token) {
    throw new ManualIdentityConflict("La identidad manual o su destino ya tienen otro propietario.");
  }
  if (owner === id) return;
  await db.runAsync("INSERT INTO manual_entry_identities (portable_id, saved_title_id) VALUES (?, ?);", token, id);
}

export async function assignManualIdentityWithDb(
  db: SavedTitleStorageMutationDatabase, id: string, generate = generateManualEntryIdentity
): Promise<string> {
  const existing = await manualIdentityForItemWithDb(db, id);
  if (existing !== undefined) return existing;
  for (let attempt = 0; attempt < 25; attempt++) {
    const token = parseManualEntryIdentity(generate());
    if (await manualIdentityOwnerWithDb(db, token) !== null) continue;
    await attachManualIdentityWithDb(db, token, id);
    return token;
  }
  throw new Error("No se pudo generar una identidad manual libre después de 25 intentos.");
}

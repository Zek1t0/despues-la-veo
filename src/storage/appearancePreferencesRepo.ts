import {
  parseSerializedAppearance,
  serializeAppearancePreference,
  type AppearanceReadResult,
} from "../theme/appearancePreference";
import type { AppearancePreference } from "../theme/types";
import { initDb } from "./db";
import { runSerializedStorageMutation } from "./storageMutationQueue";

export const APPEARANCE_PREFERENCE_KEY = "appearance";

type AppearanceDatabase = {
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  runAsync(source: string, ...params: any[]): Promise<unknown>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

type PreferenceRow = { value: unknown; updated_at: unknown };

export const UPSERT_APPEARANCE_PREFERENCE_SQL = `
  INSERT INTO app_preferences (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`;

export async function getAppearancePreference(): Promise<AppearanceReadResult> {
  try {
    const db = await initDb();
    const row = await db.getFirstAsync<PreferenceRow>(
      "SELECT value, updated_at FROM app_preferences WHERE key = ? LIMIT 1;",
      [APPEARANCE_PREFERENCE_KEY]
    );
    if (!row) return { status: "absent" };
    const parsed = parseSerializedAppearance(row.value);
    if (parsed.status !== "valid" || typeof row.updated_at !== "number" ||
        !Number.isSafeInteger(row.updated_at) || row.updated_at < 0) {
      return { status: "invalid" };
    }
    return { status: "valid", preference: parsed.preference, updatedAt: row.updated_at };
  } catch (error) {
    return { status: "error", error };
  }
}

export async function setAppearancePreferenceWithDb(
  db: AppearanceDatabase,
  preference: AppearancePreference,
  updatedAt: number
): Promise<void> {
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0) {
    throw new Error("updatedAt inválido para Appearance.");
  }
  await db.runAsync(
    UPSERT_APPEARANCE_PREFERENCE_SQL,
    APPEARANCE_PREFERENCE_KEY,
    serializeAppearancePreference(preference),
    updatedAt
  );
}

export async function setAppearancePreference(preference: AppearancePreference): Promise<void> {
  const db = await initDb();
  const updatedAt = Date.now();
  return runSerializedStorageMutation(() =>
    db.withTransactionAsync(() =>
      setAppearancePreferenceWithDb(db, preference, updatedAt)
    )
  );
}

import {
  isLibrarySort,
  isLibraryViewMode,
  isSearchViewMode,
  isTagsSort,
  isTagsViewMode,
  parseViewPreference,
  type LibrarySort,
  type LibraryViewMode,
  type SearchViewMode,
  type TagsSort,
  type TagsViewMode,
  type ViewPreferenceKey,
  type ViewPreferenceValueByKey,
} from "../core/viewPreferences";
import { initDb } from "./db";

type PreferenceRow = { value: unknown };
type ViewPreferenceValue = ViewPreferenceValueByKey[ViewPreferenceKey];

export const UPSERT_VIEW_PREFERENCE_SQL = `
  INSERT INTO app_preferences (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`;

async function readStoredPreferenceValue(key: ViewPreferenceKey): Promise<unknown> {
  try {
    const db = await initDb();
    const row = await db.getFirstAsync<PreferenceRow>(
      "SELECT value FROM app_preferences WHERE key = ? LIMIT 1;",
      [key]
    );
    return row?.value;
  } catch (error) {
    console.error(`No se pudo leer la preferencia local ${key}.`, error);
    return undefined;
  }
}

function validatePreferenceForWrite(key: unknown, value: unknown): ViewPreferenceValue {
  switch (key) {
    case "library.viewMode":
      if (isLibraryViewMode(value)) return value;
      break;
    case "search.viewMode":
      if (isSearchViewMode(value)) return value;
      break;
    case "tags.viewMode":
      if (isTagsViewMode(value)) return value;
      break;
    case "library.sort":
      if (isLibrarySort(value)) return value;
      break;
    case "tags.sort":
      if (isTagsSort(value)) return value;
      break;
  }

  throw new Error("Clave o valor de preferencia local no permitido.");
}

export function getViewPreference(key: "library.viewMode"): Promise<LibraryViewMode>;
export function getViewPreference(key: "search.viewMode"): Promise<SearchViewMode>;
export function getViewPreference(key: "tags.viewMode"): Promise<TagsViewMode>;
export function getViewPreference(key: "library.sort"): Promise<LibrarySort>;
export function getViewPreference(key: "tags.sort"): Promise<TagsSort>;
export async function getViewPreference(
  key: ViewPreferenceKey
): Promise<ViewPreferenceValue> {
  const value = await readStoredPreferenceValue(key);

  switch (key) {
    case "library.viewMode":
      return parseViewPreference(key, value);
    case "search.viewMode":
      return parseViewPreference(key, value);
    case "tags.viewMode":
      return parseViewPreference(key, value);
    case "library.sort":
      return parseViewPreference(key, value);
    case "tags.sort":
      return parseViewPreference(key, value);
  }
}

export function setViewPreference(
  key: "library.viewMode",
  value: LibraryViewMode
): Promise<void>;
export function setViewPreference(
  key: "search.viewMode",
  value: SearchViewMode
): Promise<void>;
export function setViewPreference(key: "tags.viewMode", value: TagsViewMode): Promise<void>;
export function setViewPreference(key: "library.sort", value: LibrarySort): Promise<void>;
export function setViewPreference(key: "tags.sort", value: TagsSort): Promise<void>;
export async function setViewPreference(
  key: ViewPreferenceKey,
  value: ViewPreferenceValue
): Promise<void> {
  const validatedValue = validatePreferenceForWrite(key, value);
  const db = await initDb();
  await db.runAsync(UPSERT_VIEW_PREFERENCE_SQL, key, validatedValue, Date.now());
}

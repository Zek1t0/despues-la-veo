import type { TmdbCredentialStore } from "./tmdbCredentialTypes";
import { TMDB_CREDENTIAL_STORAGE_KEY } from "./tmdbCredentialKey";

type LocalStorageBoundary = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserLocalStorage(): LocalStorageBoundary {
  if (typeof window === "undefined" || window.localStorage === undefined) {
    throw new Error("TMDB credential browser storage is unavailable.");
  }
  return window.localStorage;
}

export function createWebTmdbCredentialStore(
  getStorage: () => LocalStorageBoundary = browserLocalStorage,
): TmdbCredentialStore {
  return {
    async get() {
      return getStorage().getItem(TMDB_CREDENTIAL_STORAGE_KEY);
    },
    async set(token) {
      getStorage().setItem(TMDB_CREDENTIAL_STORAGE_KEY, token);
    },
    async delete() {
      getStorage().removeItem(TMDB_CREDENTIAL_STORAGE_KEY);
    },
  };
}

export const tmdbCredentialStore = createWebTmdbCredentialStore();

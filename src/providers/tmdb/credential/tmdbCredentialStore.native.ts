import * as SecureStore from "expo-secure-store";
import type { TmdbCredentialStore } from "./tmdbCredentialTypes";
import { TMDB_CREDENTIAL_STORAGE_KEY } from "./tmdbCredentialKey";

type SecureStoreBoundary = Pick<
  typeof SecureStore,
  "getItemAsync" | "setItemAsync" | "deleteItemAsync"
>;

export function createNativeTmdbCredentialStore(
  secureStore: SecureStoreBoundary = SecureStore,
): TmdbCredentialStore {
  return {
    get: () => secureStore.getItemAsync(TMDB_CREDENTIAL_STORAGE_KEY),
    set: (token) => secureStore.setItemAsync(TMDB_CREDENTIAL_STORAGE_KEY, token),
    delete: () => secureStore.deleteItemAsync(TMDB_CREDENTIAL_STORAGE_KEY),
  };
}

export const tmdbCredentialStore = createNativeTmdbCredentialStore();

import type { TmdbCredentialService } from "./TmdbCredentialService";
import type { TmdbCredentialSnapshot } from "./tmdbCredentialTypes";

export type TmdbCredentialExternalStore = Readonly<{
  getSnapshot: () => TmdbCredentialSnapshot;
  subscribe: (listener: () => void) => () => void;
  initializeSafely: () => Promise<void>;
  retryInitialization: () => Promise<TmdbCredentialSnapshot>;
}>;

export function createTmdbCredentialExternalStore(
  service: TmdbCredentialService,
): TmdbCredentialExternalStore {
  return {
    getSnapshot: () => service.getSnapshot(),
    subscribe: (listener) => service.subscribe(() => listener()),
    async initializeSafely() {
      try {
        await service.initialize();
      } catch {
        // El snapshot storage-error es el resultado público; el root no debe rechazar ni bloquear.
      }
    },
    retryInitialization: () => service.retryInitialization(),
  };
}

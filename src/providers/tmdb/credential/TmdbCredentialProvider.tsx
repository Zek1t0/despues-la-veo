import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import type { TmdbCredentialSnapshot } from "./tmdbCredentialTypes";
import { tmdbCredentialService } from "./tmdbCredentialRuntime";
import { createTmdbCredentialExternalStore } from "./tmdbCredentialExternalStore";

type TmdbCredentialContextValue = Readonly<{
  snapshot: TmdbCredentialSnapshot;
  retryInitialization: () => Promise<TmdbCredentialSnapshot>;
}>;

const TmdbCredentialContext = createContext<TmdbCredentialContextValue | null>(null);
const credentialExternalStore = createTmdbCredentialExternalStore(tmdbCredentialService);

export function TmdbCredentialProvider({ children }: PropsWithChildren) {
  const snapshot = useSyncExternalStore(
    credentialExternalStore.subscribe,
    credentialExternalStore.getSnapshot,
    credentialExternalStore.getSnapshot,
  );

  useEffect(() => {
    void credentialExternalStore.initializeSafely();
  }, []);

  const retryInitialization = useCallback(
    () => credentialExternalStore.retryInitialization(),
    [],
  );
  const value = useMemo(
    () => ({ snapshot, retryInitialization }),
    [snapshot, retryInitialization],
  );

  return (
    <TmdbCredentialContext.Provider value={value}>
      {children}
    </TmdbCredentialContext.Provider>
  );
}

export function useTmdbCredential(): TmdbCredentialContextValue {
  const value = useContext(TmdbCredentialContext);
  if (value === null) {
    throw new Error("useTmdbCredential debe usarse dentro de TmdbCredentialProvider.");
  }
  return value;
}

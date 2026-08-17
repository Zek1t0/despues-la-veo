import { createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { getAppearancePreference, setAppearancePreference } from "../storage/appearancePreferencesRepo";
import { AppearanceCoordinator, type AppearanceCoordinatorState } from "./appearanceCoordinator";
import { resolveAppearanceTheme, resolveEffectiveScheme } from "./resolver";
import type { AppearancePaletteId, AppearanceScheme, EffectiveScheme,
  ThemeDefinition } from "./types";

export type AppThemeContextValue = Readonly<{
  theme: ThemeDefinition;
  preference: AppearanceCoordinatorState["displayed"];
  confirmedPersisted: AppearanceCoordinatorState["confirmedPersisted"];
  latestIntent: AppearanceCoordinatorState["latestIntent"];
  effectiveScheme: EffectiveScheme;
  hydrationStatus: AppearanceCoordinatorState["hydrationStatus"];
  isHydrationGateOpen: boolean;
  storageError: AppearanceCoordinatorState["storageError"];
  setScheme(scheme: AppearanceScheme): Promise<void>;
  setPalette(palette: AppearancePaletteId): Promise<void>;
  retryHydration(): Promise<void>;
  retryPersistence(): Promise<boolean>;
}>;

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children, fallback = null }: Readonly<{
  children: ReactNode;
  fallback?: ReactNode;
}>): ReactNode {
  const coordinator = useMemo(() => new AppearanceCoordinator(setAppearancePreference), []);
  const [state, setState] = useState(() => coordinator.getState());
  const observedScheme = useColorScheme();
  const runtimeSystemScheme: EffectiveScheme = observedScheme === "light" ? "light" : "dark";

  const hydrate = useCallback(async () => {
    const token = coordinator.beginHydration();
    const result = await getAppearancePreference();
    coordinator.completeHydration(token, result);
  }, [coordinator]);

  useEffect(() => {
    const unsubscribe = coordinator.subscribe(setState);
    setState(coordinator.getState());
    void hydrate();
    return () => {
      unsubscribe();
      coordinator.invalidateHydration();
    };
  }, [coordinator, hydrate]);

  const setScheme = useCallback((scheme: AppearanceScheme) =>
    coordinator.select({ ...coordinator.getState().displayed, scheme }), [coordinator]);
  const setPalette = useCallback((palette: AppearancePaletteId) =>
    coordinator.select({ ...coordinator.getState().displayed, palette }), [coordinator]);
  const retryPersistence = useCallback(() => coordinator.retryWrite(), [coordinator]);
  const effectiveScheme = resolveEffectiveScheme(state.displayed.scheme, runtimeSystemScheme);
  const theme = useMemo(() => resolveAppearanceTheme(state.displayed, runtimeSystemScheme),
    [state.displayed, runtimeSystemScheme]);
  const value = useMemo<AppThemeContextValue>(() => ({
    theme, preference: state.displayed, confirmedPersisted: state.confirmedPersisted,
    latestIntent: state.latestIntent, effectiveScheme, hydrationStatus: state.hydrationStatus,
    isHydrationGateOpen: state.isHydrationGateOpen, storageError: state.storageError,
    setScheme, setPalette, retryHydration: hydrate, retryPersistence,
  }), [theme, state, effectiveScheme, setScheme, setPalette, hydrate, retryPersistence]);

  return <AppThemeContext.Provider value={value}>
    {state.isHydrationGateOpen ? children : fallback}
  </AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error("useAppTheme debe usarse dentro de AppThemeProvider.");
  return value;
}

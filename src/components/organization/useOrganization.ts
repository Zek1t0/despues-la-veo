import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getOrganizationSnapshot, type OrganizationSnapshot } from "../../storage/organizationSnapshot";
import { subscribeOrganization } from "../../storage/organizationInvalidation";
import { subscribeLibraryInvalidation } from "../../storage/libraryInvalidation";
import { subscribeMediaPreferences } from "../../storage/mediaPreferencesRepo";

export function useOrganization() {
  const [snapshot, setSnapshot] = useState<OrganizationSnapshot>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(false), sequence = useRef(0), mutating = useRef(false);
  const refresh = useCallback(async () => {
    const token = ++sequence.current;
    try { const next = await getOrganizationSnapshot(); if (active.current && token === sequence.current) { setSnapshot(next); setError(null); } }
    catch (e) { if (active.current && token === sequence.current) setError(e instanceof Error ? e.message : "No se pudieron leer las colecciones."); }
  }, []);
  useFocusEffect(useCallback(() => {
    active.current = true;
    const stops = [subscribeOrganization(() => void refresh()), subscribeLibraryInvalidation(() => void refresh()), subscribeMediaPreferences(() => void refresh())];
    void refresh();
    return () => { active.current = false; sequence.current++; stops.forEach(stop => stop()); };
  }, [refresh]));
  async function run(action: () => Promise<void>): Promise<boolean> {
    if (mutating.current) return false;
    mutating.current = true; setBusy(true); setError(null);
    try { await action(); await refresh(); return true; }
    catch (e) { if (active.current) setError(e instanceof Error ? e.message : "No se pudo guardar. Podés reintentar."); return false; }
    finally { mutating.current = false; if (active.current) setBusy(false); }
  }
  return { snapshot, error, busy, refresh, run };
}

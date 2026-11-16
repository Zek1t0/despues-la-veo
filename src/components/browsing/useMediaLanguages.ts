import { useEffect, useState } from "react";
import { DEFAULT_MEDIA_PREFERENCES, type PortableMediaPreferences } from "../../core/mediaPreferences";
import { getMediaPreferences, subscribeMediaPreferences } from "../../storage/mediaPreferencesRepo";
export type MediaLanguageServices = Readonly<{ read(): Promise<PortableMediaPreferences>; subscribe(listener: (value: PortableMediaPreferences) => void): () => void }>;
export const defaultMediaLanguageServices: MediaLanguageServices = { read:getMediaPreferences,subscribe:subscribeMediaPreferences };
/** Subscribe before hydration; a late initial read cannot replace a newer committed preference. */
export function useMediaLanguages(enabled = true, services = defaultMediaLanguageServices) {
  const [value,setValue]=useState<PortableMediaPreferences>({value:DEFAULT_MEDIA_PREFERENCES,updatedAt:0});
  const [error,setError]=useState<string | null>(null);
  useEffect(()=>{
    if (!enabled) return;
    let active=true;
    const apply=(next:PortableMediaPreferences)=>{ if(active){setValue(old=>next.updatedAt>=old.updatedAt?next:old);setError(null);} };
    const stop=services.subscribe(apply);
    void services.read().then(apply).catch(()=>{if(active)setError("No se pudieron leer los idiomas guardados.");});
    return ()=>{active=false;stop();};
  },[enabled,services]);
  return {languages:value.value.languages,preference:value,error};
}

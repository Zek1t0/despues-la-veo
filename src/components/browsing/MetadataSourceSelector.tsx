import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SavedTitleWithProviderReferences } from "../../core/savedTitle";
import { providerReferenceKey, providerReferencesEqual, type ProviderReference } from "../../core/providerReference";
import { mediaSourceName } from "../../core/editorialPresentation";
import { useAppTheme } from "../../theme/AppThemeProvider";
export function MetadataSourceSelector({ item, select }: { item: SavedTitleWithProviderReferences; select(id:string,reference:ProviderReference):Promise<unknown> }) {
  const {theme}=useAppTheme();
  const [busy,setBusy]=useState(false),[error,setError]=useState<string | null>(null),locked=useRef(false);
  const active=item.metadataState?.selection.reference;
  if (item.providerReferences.length<2) return null;
  const options=[...new Map(item.providerReferences.map(ref=>[providerReferenceKey(ref),ref])).values()];
  async function choose(reference:ProviderReference){
    if(locked.current)return;locked.current=true;setBusy(true);setError(null);
    try{await select(item.id,reference);}catch{setError("No se pudo cambiar la fuente. Se conserva la selección anterior.");}finally{locked.current=false;setBusy(false);}
  }
  return <View style={{gap:8}}>
    <Text accessibilityRole="header" style={{color:theme.global.textPrimary,fontWeight:"800"}}>Fuente de presentación</Text>
    {!active&&<Text style={{color:theme.global.textSecondary}}>Fuente ambigua: se muestran datos históricos. Elegí una fuente guardada.</Text>}
    {options.map(ref=>{
      const selected=!!active&&providerReferencesEqual(ref,active);
      const documented=item.metadataState?.documents.some(doc=>providerReferencesEqual(doc.metadata.provenance.reference,ref));
      const label=`${mediaSourceName(ref.provider)} · ${ref.resourceNamespace}/${ref.externalId}${documented?" · ficha local":" · sin ficha enriquecida"}`;
      return <Pressable key={providerReferenceKey(ref)} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected,checked:selected,disabled:busy}}
        disabled={busy||selected} onPress={()=>{void choose(ref);}} style={{minHeight:44,padding:12,borderWidth:1,borderRadius:10,borderColor:selected?theme.global.accent:theme.global.border,backgroundColor:theme.global.surfaceSecondary}}>
        <Text style={{color:theme.global.textPrimary}}>{selected?"✓ ":""}{label}</Text>
      </Pressable>;
    })}
    <Text style={{color:theme.global.textMuted}}>Usa los datos locales de esa referencia, sin consultar proveedores.</Text>
    {error&&<Text accessibilityRole="alert" style={{color:theme.semantic.dangerText}}>{error}</Text>}
  </View>;
}

import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { useAppTheme } from "../../src/theme/AppThemeProvider";
import { useMediaLanguages } from "../../src/components/browsing/useMediaLanguages";
import { setMediaLanguages } from "../../src/storage/mediaPreferencesRepo";
import { parseMediaPreferences } from "../../src/core/mediaPreferences";
export default function MetadataLanguagesScreen() {
  const {theme}=useAppTheme(),{languages,preference,error:readError}=useMediaLanguages();
  const [draft,setDraft]=useState<readonly string[]>(languages),[code,setCode]=useState("");
  const [dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState<string | null>(null);
  useEffect(()=>{if(!dirty)setDraft(languages);},[languages,dirty]);
  const change=(next:readonly string[])=>{setDraft(next);setDirty(true);setError(null);};
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label}
    disabled={saving||disabled} accessibilityState={{disabled:saving||disabled}} onPress={action}
    style={{minHeight:44,padding:10,borderRadius:10,borderWidth:1,borderColor:theme.global.border}}><Text style={{color:theme.global.textPrimary}}>{label}</Text></Pressable>;
  const move=(index:number,delta:number)=>{const next=[...draft];[next[index],next[index+delta]]=[next[index+delta],next[index]];change(next);};
  async function save(){
    try {parseMediaPreferences({...preference,value:{...preference.value,languages:draft}});}
    catch {setError("Usá entre 1 y 16 códigos de idioma válidos, sin duplicados.");return;}
    setSaving(true);setError(null);
    try{await setMediaLanguages(draft);setDirty(false);}catch{setError("No se pudieron guardar los idiomas. Podés reintentar.");}finally{setSaving(false);}
  }
  return <ScrollView style={{backgroundColor:theme.global.background}} contentContainerStyle={{padding:16,gap:14,maxWidth:800,width:"100%",alignSelf:"center"}}>
    <Stack.Screen options={{title:"Idiomas de títulos"}} />
    <Text accessibilityRole="header" style={{color:theme.global.textPrimary,fontSize:22,fontWeight:"800"}}>Idiomas de títulos</Text>
    <Text style={{color:theme.global.textSecondary}}>Se usa el primer idioma disponible. Después: título canónico, otra variante y título local. No se traducen títulos ni se consulta al proveedor.</Text>
    {draft.map((locale,index)=><View key={locale} style={{gap:8}}>
      <Text style={{color:theme.global.textPrimary}}>{index+1}. {locale === "es" ? "Español" : locale === "en" ? "Inglés" : locale === "ja-Latn" ? "Japonés romanizado" : locale === "ja" ? "Japonés" : locale} ({locale})</Text>
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{button(`Subir ${locale}`,()=>move(index,-1),index===0)}{button(`Bajar ${locale}`,()=>move(index,1),index===draft.length-1)}{button(`Quitar ${locale}`,()=>change(draft.filter((_,i)=>i!==index)),draft.length===1)}</View>
    </View>)}
    <TextInput accessibilityLabel="Código de idioma o script" placeholder="es, en, ja-Latn, ja, fr…" value={code} onChangeText={setCode} editable={!saving}
      placeholderTextColor={theme.global.textMuted} autoCapitalize="none" style={{color:theme.global.textPrimary,borderWidth:1,borderColor:theme.global.border,padding:12,borderRadius:10}} />
    {button("Agregar idioma",()=>{const next=[...draft,code.trim()];try{parseMediaPreferences({...preference,value:{...preference.value,languages:next}});change(next);setCode("");}catch{setError("Código inválido, duplicado o límite de 16 idiomas alcanzado.");}})}
    {button("Restablecer orden inicial",()=>change(["es","en","ja-Latn"]))}
    {button(saving?"Guardando…":"Guardar idiomas",()=>{void save();},!dirty)}
    {(error||readError)&&<Text accessibilityRole="alert" style={{color:theme.semantic.dangerText}}>{error??readError}</Text>}
  </ScrollView>;
}

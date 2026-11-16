import React,{useState} from "react";
import { ScrollView,Switch,Text,View } from "react-native";
import { Stack } from "expo-router";
import { useAppTheme } from "../../src/theme/AppThemeProvider";
import { useMediaLanguages } from "../../src/components/browsing/useMediaLanguages";
import { SensitiveFilterStatus } from "../../src/components/browsing/SensitiveContentNotice";
import { setMediaHideSensitive } from "../../src/storage/mediaPreferencesRepo";
import { SENSITIVE_FILTER_COVERAGE } from "../../src/core/sensitiveContent";
export default function SensitiveContentSettings(){
 const {theme}=useAppTheme(),preferences=useMediaLanguages();const [saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null);
 async function change(value:boolean){if(saving)return;setSaving(true);setError(null);try{await setMediaHideSensitive(value);}catch{setError("No se pudo guardar el filtro. Podés reintentar.");}finally{setSaving(false);}}
 return <ScrollView style={{backgroundColor:theme.global.background}} contentContainerStyle={{padding:16,gap:14,maxWidth:800,width:"100%",alignSelf:"center"}}>
 <Stack.Screen options={{title:"Contenido sensible"}}/>
 <Text accessibilityRole="header" style={{color:theme.global.textPrimary,fontSize:22,fontWeight:"800"}}>Contenido sensible</Text>
 <View style={{flexDirection:"row",alignItems:"center",gap:12}}><Switch accessibilityLabel="Ocultar contenido marcado como sensible" disabled={!preferences.ready||saving} value={preferences.preference.value.hideSensitive} onValueChange={value=>{void change(value);}}/><Text style={{flex:1,color:theme.global.textPrimary}}>Ocultar contenido marcado como sensible</Text></View>
 <Text style={{color:theme.global.textSecondary}}>{SENSITIVE_FILTER_COVERAGE}</Text>
 <Text style={{color:theme.global.textSecondary}}>Desactivado por defecto. Los desconocidos permanecen visibles. Es un filtro visual voluntario, no un control parental. No borra títulos, pins ni historial y no limita backups o revisiones globales.</Text>
 <SensitiveFilterStatus active={false} ready={preferences.ready} error={preferences.error} onRetry={preferences.retry}/>
 {error&&<Text accessibilityRole="alert" style={{color:theme.semantic.dangerText}}>{error}</Text>}
 </ScrollView>;
}

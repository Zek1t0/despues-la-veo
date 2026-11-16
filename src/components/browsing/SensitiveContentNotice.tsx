import React from "react";
import { Pressable,Text,View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { SENSITIVE_FILTER_COVERAGE } from "../../core/sensitiveContent";
export function SensitiveFilterStatus({active,ready,error,onRetry}:{active:boolean;ready:boolean;error:string|null;onRetry():void}) {
 const {theme}=useAppTheme();
 if(!active&&ready&&!error)return null;
 return <View style={{gap:8,paddingVertical:8}}><Text accessibilityLiveRegion="polite" style={{color:theme.global.textSecondary}}>{error??(!ready?"Leyendo preferencias de visibilidad…":SENSITIVE_FILTER_COVERAGE)}</Text>
 {error&&<Pressable accessibilityRole="button" onPress={onRetry} style={{minHeight:44,padding:10}}><Text style={{color:theme.global.textPrimary}}>Reintentar preferencias</Text></Pressable>}</View>;
}
/** Contains no title, image component or image URI. The guarded subtree is never mounted. */
export function SensitiveContentNotice({pending,error,onReveal,onBack,onRetry}:{pending:boolean;error:string|null;onReveal():void;onBack():void;onRetry():void}) {
 const {theme}=useAppTheme();
 const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{minHeight:44,padding:12,borderRadius:12,borderWidth:1,borderColor:theme.global.border}}><Text style={{color:theme.global.textPrimary,fontWeight:"800"}}>{label}</Text></Pressable>;
 return <View style={{flex:1,padding:16,gap:14,backgroundColor:theme.global.background}}>
  <Text accessibilityRole="header" style={{color:theme.global.textPrimary,fontSize:20,fontWeight:"800"}}>{error?"Preferencias no disponibles":pending?"Comprobando visibilidad…":"Contenido oculto"}</Text>
  <Text accessibilityLiveRegion="polite" style={{color:theme.global.textSecondary}}>{error??(pending?"La ficha se mostrará después de leer la preferencia guardada.":"Kitsu marca esta obra como sensible (NSFW). Podés verla deliberadamente sin desactivar el filtro global.")}</Text>
  {!pending&&!error&&button("Ver contenido",onReveal)}
  {error&&button("Reintentar preferencias",onRetry)}
  {button("Volver",onBack)}
  <Text style={{color:theme.global.textMuted}}>{SENSITIVE_FILTER_COVERAGE}</Text>
 </View>;
}

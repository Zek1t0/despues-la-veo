import React from "react";
import { Pressable,Text,View } from "react-native";
import type { MetadataRunSummary } from "../../storage/metadataRunRepo";
import { REFRESH_ERROR_MESSAGES } from "../../application/metadataRefreshError";
import { useAppTheme } from "../../theme/AppThemeProvider";

const stateLabels={running:"En ejecución",completed:"Completada",partial:"Parcial",cancelled:"Cancelada",interrupted:"Interrumpida"};
const omissions:Record<string,string>={manual:"Entrada manual",credential:"Credencial no disponible",ambiguous:"Elegí una fuente",deleted:"Título eliminado",offline:"Sin conexión",obsolete:"Respuesta descartada","source-unavailable":"Fuente no disponible o bloqueada"};
export function LibraryRunHeader({run,completedAt,error,onStart,onCancel,onRetry,available=true}:{run:(MetadataRunSummary&{capturing?:boolean})|null;completedAt:number|null;error:string|null;onStart():void;onCancel():void;onRetry():void;available?:boolean}) {
  const {theme}=useAppTheme();const running=run?.state==="running";
  const date=(value:number|null|undefined)=>value==null?"ninguna conocida":new Date(value).toLocaleString("es-AR");
  const button=(label:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{disabled}} onPress={onPress} style={{minHeight:44,padding:12,borderWidth:1,borderColor:theme.global.border,borderRadius:10}}><Text style={{color:theme.global.textPrimary,fontWeight:"700"}}>{label}</Text></Pressable>;
  return <View style={{gap:10,padding:14,borderWidth:1,borderRadius:12,borderColor:theme.global.border}}>
    <Text accessibilityRole="header" style={{color:theme.global.textPrimary,fontSize:18,fontWeight:"800"}}>Revisión de biblioteca</Text>
    <Text style={{color:theme.global.textSecondary}}>Última revisión iniciada: {date(run?.startedAt)}</Text>
    <Text style={{color:theme.global.textSecondary}}>Última revisión completada: {date(completedAt)}</Text>
    <Text style={{color:theme.global.textPrimary}}>Último intento: {run?stateLabels[run.state]:"sin revisiones"}</Text>
    {running?button("Cancelar revisión",onCancel):button("Actualizar biblioteca",onStart,!available)}
    {run?.capturing&&<Text accessibilityLiveRegion="polite" style={{color:theme.global.textSecondary}}>Preparando biblioteca…</Text>}
    {run&&!run.capturing&&<View accessibilityRole="progressbar" accessibilityLabel="Progreso de revisión" accessibilityLiveRegion="polite" accessibilityValue={{min:0,max:run.counters.total,now:run.counters.processed,text:`${run.counters.processed} de ${run.counters.total}`}} style={{gap:6}}>
      <Text style={{color:theme.global.textPrimary}}>Procesados: {run.counters.processed} / {run.counters.total}</Text>
      <Text style={{color:theme.global.textSecondary}}>Modificados: {run.counters.changed} · Sin cambios: {run.counters.unchanged}</Text>
      <Text style={{color:theme.global.textSecondary}}>Omitidos: {run.counters.skipped} · Fallidos: {run.counters.failed}</Text>
      <Text style={{color:theme.global.textSecondary}}>Cancelados: {run.counters.cancelled} · Pendientes: {run.counters.pending}</Text>
    </View>}
    {run&&Object.entries(run.counters.omissions).map(([reason,count])=><Text key={reason} style={{color:theme.global.textSecondary}}>{omissions[reason]??"Otro motivo de omisión"}: {count}</Text>)}
    {!!run?.errors.length&&<View style={{gap:6}}><Text accessibilityRole="header" style={{color:theme.global.textPrimary}}>Errores del último intento</Text>
      {Object.entries(run.errors.reduce<Record<string,number>>((counts,{code})=>({...counts,[code]:(counts[code]??0)+1}),{})).map(([code,count])=><Text key={code} style={{color:theme.global.textSecondary}}>{REFRESH_ERROR_MESSAGES[code as keyof typeof REFRESH_ERROR_MESSAGES]??"No se pudo completar la consulta."} ({count})</Text>)}
      {run.counters.failed>run.errors.length&&<Text style={{color:theme.global.textSecondary}}>Se muestran {run.errors.length} detalles de {run.counters.failed} fallos; detalles truncados. El total se conserva.</Text>}
    </View>}
    {error&&<><Text accessibilityRole="alert" style={{color:theme.semantic.dangerText}}>{error}</Text>{button("Reintentar lectura",onRetry)}</>}
  </View>;
}

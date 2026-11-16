import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SavedTitleWithProviderReferences } from "../../core/savedTitle";
import { getSavedMetadataRefreshService, type SavedMetadataRefreshService, type SavedRefreshStatus } from "../../application/savedMetadataRefreshService";
import type { RefreshResult } from "../../application/metadataRefreshCoordinator";
import { REFRESH_ERROR_MESSAGES } from "../../application/metadataRefreshError";
import { useAppTheme } from "../../theme/AppThemeProvider";
export function SavedMetadataRefresh({item,enabled=true,service:injected,claimAutomaticOpening}:{item:SavedTitleWithProviderReferences;enabled?:boolean;service?:SavedMetadataRefreshService;claimAutomaticOpening?:()=>boolean}){
  const {theme}=useAppTheme();
  const [service,setService]=useState<SavedMetadataRefreshService|undefined>(injected),[status,setStatus]=useState<SavedRefreshStatus|null>(null),[result,setResult]=useState<RefreshResult|null>(null),[retry,setRetry]=useState(0);
  const locked=useRef(false),controller=useRef<AbortController|null>(null),context=useRef(0);
  const readStatus=useRef<(()=>void)|null>(null);
  useEffect(()=>{
    ++context.current;
    return()=>{++context.current;controller.current?.abort();locked.current=false;};
  },[service,enabled,item.id,item.metadataState?.selection.updatedAt]);
  useEffect(()=>{let active=true;if(!enabled)return;if(injected){setService(injected);return;}void getSavedMetadataRefreshService().then(value=>{if(active)setService(value);}).catch(()=>{if(active)setResult({status:"failed",code:"persistence"});});return()=>{active=false;};},[enabled,injected,retry]);
  useEffect(()=>{
    if(!service||!enabled)return;
    let active=true,revision=0,timer:ReturnType<typeof setTimeout>|undefined;
    const clearTimer=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
    const read=()=>{
      clearTimer();
      const generation=++revision;
      void service.inspect(item.id).then(next=>{
        if(!active||generation!==revision)return;
        setStatus(next);
        // Wake only to inspect local admission again. Never call refresh/open here.
        const until=next.retryAt;
        if(!next.enabled&&typeof until==="number"&&Number.isSafeInteger(until)&&until<=8_640_000_000_000_000&&until>Date.now())
          timer=setTimeout(()=>{timer=undefined;read();},Math.min(until-Date.now(),2_147_483_647));
      }).catch(()=>{if(active&&generation===revision){setResult({status:"failed",code:"persistence"});setStatus(old=>old?{...old,running:false}:old);}});
    };
    setStatus(null);setResult(null);readStatus.current=read;
    const stop=service.subscribe(id=>{if(id===item.id)read();},item.id);
    read();
    return()=>{active=false;++revision;clearTimer();stop();if(readStatus.current===read)readStatus.current=null;};
  },[service,enabled,item.id,item.metadataState?.selection.updatedAt]);
  // Mounting a detail is an opening. Presentation invalidations/focus are not new openings.
  useEffect(()=>{
    if(!service?.open||!enabled)return;
    if(claimAutomaticOpening&&!claimAutomaticOpening())return;
    const automatic=new AbortController(),generation=context.current;let active=true;
    void service.open(item.id,automatic.signal).then(next=>{if(active&&generation===context.current&&next)setResult(next);}).catch(()=>{
      if(active&&generation===context.current)setResult({status:"failed",code:"persistence"});
    });
    return()=>{active=false;automatic.abort();};
  },[service,enabled,item.id,claimAutomaticOpening]);
  async function refresh(){
    if(!service||!status?.enabled||locked.current)return;
    const generation=context.current;
    locked.current=true;controller.current=new AbortController();setStatus({...status,running:true});setResult(null);
    try{
      const next=await service.refresh(item.id,controller.current.signal);
      if(generation===context.current){setResult(next);readStatus.current?.();}
    }catch{
      if(generation===context.current){setResult({status:"failed",code:"persistence"});readStatus.current?.();}
    }finally{if(generation===context.current)locked.current=false;}
  }
  if(!enabled)return null;
  const date=status?.checkedAt;
  const message=result?.status==="changed"?"Metadata actualizada.":result?.status==="unchanged"?"Sin cambios; consulta exitosa registrada.":result?.code?REFRESH_ERROR_MESSAGES[result.code]:result?.reason;
  return <View style={{gap:8,padding:12,borderWidth:1,borderColor:theme.global.border,borderRadius:12}}>
    <Text accessibilityRole="header" style={{color:theme.global.textPrimary,fontWeight:"800"}}>Actualización de metadata</Text>
    <Text style={{color:theme.global.textSecondary}}>Última consulta exitosa: {typeof date==="number"?`${new Date(date).toLocaleString("es-AR")}${date>Date.now()?" (fecha futura no confiable)":""}`:"sin fecha conocida"}</Text>
    {status&&!status.enabled&&<Text style={{color:theme.global.textSecondary}}>{status.reason}</Text>}
    {status&&!status.enabled&&typeof status.retryAt==="number"&&Number.isSafeInteger(status.retryAt)&&status.retryAt>=0&&status.retryAt<=8_640_000_000_000_000&&<Text style={{color:theme.global.textSecondary}}>Próximo intento manual permitido: {new Date(status.retryAt).toLocaleString("es-AR")}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Actualizar metadata" accessibilityState={{disabled:!status?.enabled||!!status?.running,busy:!!status?.running}}
      disabled={!status?.enabled||!!status?.running} onPress={()=>{void refresh();}} style={{minHeight:44,padding:12,borderRadius:10,backgroundColor:theme.global.surfaceSecondary}}>
      <Text style={{color:theme.global.textPrimary}}>{status?.running?"Consultando…":"Actualizar metadata"}</Text>
    </Pressable>
    {!service&&result?.status==="failed"&&<Pressable accessibilityRole="button" onPress={()=>setRetry(value=>value+1)} style={{minHeight:44,padding:12}}><Text style={{color:theme.global.textPrimary}}>Reintentar lectura de metadata</Text></Pressable>}
    {message&&<Text accessibilityLiveRegion="polite" style={{color:result?.status==="failed"?theme.semantic.dangerText:theme.global.textSecondary}}>{message}</Text>}
    {!!result?.diagnostics?.length&&<Text style={{color:theme.global.textMuted}}>Respuesta parcial: se conservaron campos no verificables ({result.diagnostics.length}).</Text>}
  </View>;
}

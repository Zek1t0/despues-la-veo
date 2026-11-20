import React,{useState} from "react";
import {Pressable,View} from "react-native";
import {useRouter} from "expo-router";
import {Ionicons} from "@expo/vector-icons";
import {OrganizationPage,OrganizationButton,OrganizationText,OrganizationError} from "../../../src/components/organization/OrganizationUI";
import {RecommendationForm} from "../../../src/components/organization/RecommendationForm";
import {useRecommendationInbox} from "../../../src/components/organization/useRecommendationInbox";
import {recommendationTitle,recommendationStatusLabel,type RecommendationStatus} from "../../../src/core/recommendationInbox";
import {savedContentVisible} from "../../../src/core/sensitiveContent";
import {savedMediaPresentation} from "../../../src/core/mediaPresentation";
import {MediaPoster} from "../../../src/components/browsing/MediaPoster";
import {useAppTheme} from "../../../src/theme/AppThemeProvider";
import {radius,space} from "../../../src/theme/presentation";
export default function RecommendationInboxScreen(){
  const router=useRouter(),{snapshot,error,busy,refresh,run}=useRecommendationInbox();const {theme}=useAppTheme();
  const [status,setStatus]=useState<RecommendationStatus>("pending"),[creating,setCreating]=useState(false),[focused,setFocused]=useState<string|null>(null);
  const open=(id:string)=>router.push({pathname:"/organize/recommendations/[id]",params:{id}});
  const entries=snapshot?.recommendations.filter(v=>v.status===status)??[];
  return <OrganizationPage title="Bandeja de recomendaciones"><OrganizationError error={error} retry={()=>void refresh()}/>
    {!snapshot?<OrganizationText>{error?"No se pudo cargar la bandeja.":"Cargando recomendaciones…"}</OrganizationText>:<>
      <OrganizationButton label="Nueva recomendación" icon="add" disabled={busy||creating} onPress={()=>setCreating(true)}/>
      {creating&&<RecommendationForm others={snapshot.recommendations} busy={busy} run={run} review={open} done={id=>{setCreating(false);if(id)open(id);}}/>}
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:space.sm}}>{([["pending","Pendientes"],["incorporated","Incorporadas"],["discarded","Descartadas"]] as const).map(([value,label])=><OrganizationButton key={value} label={label} selected={status===value} onPress={()=>setStatus(value)}/>)}</View>
      <OrganizationText>{entries.length} recomendaciones · {recommendationStatusLabel(status)}</OrganizationText>
      {!entries.length&&<OrganizationText muted>No hay recomendaciones en este estado. Podés registrar sugerencias sin guardarlas en Biblioteca.</OrganizationText>}
      {entries.map(entry=>{
        const item=snapshot.items.find(v=>v.id===entry.linkedItemId),visible=item&&savedContentVisible(item,snapshot.preferences.value.hideSensitive)?item:null;
        return <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Abrir recomendación ${recommendationTitle(entry)}`} focusable onFocus={()=>setFocused(entry.id)} onBlur={()=>setFocused(null)} onPress={()=>open(entry.id)}
          style={({pressed})=>({flexDirection:"row",alignItems:"center",gap:space.md,padding:space.md,borderRadius:radius.card,borderWidth:1,borderColor:focused===entry.id?theme.global.accent:theme.global.border,backgroundColor:theme.global.surface,opacity:pressed ? 0.8 : 1})}>
          {visible&&<MediaPoster identity={visible.id} context="list" posterUrl={visible.posterUrl} {...savedMediaPresentation(visible)} style={{width:40,height:60,borderRadius:radius.control,flexShrink:0}}/>}
          <View style={{flex:1,minWidth:0,gap:space.xs}}><OrganizationText heading>{recommendationTitle(entry)}</OrganizationText>
            {(entry.person||entry.origin)&&<OrganizationText muted>{[entry.person,entry.origin].filter(Boolean).join(" · ")}</OrganizationText>}
            {!!entry.comment&&<OrganizationText muted numberOfLines={2}>{entry.comment}</OrganizationText>}
            <OrganizationText muted>{recommendationStatusLabel(entry.status)}{entry.linkedItemId?" · En Biblioteca":""}</OrganizationText>
          </View><Ionicons name="chevron-forward" size={20} color={theme.global.textSecondary} accessible={false}/>
        </Pressable>;
      })}
    </>}
  </OrganizationPage>;
}

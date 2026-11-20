import React,{useState} from "react";
import {View} from "react-native";
import {useLocalSearchParams,useRouter} from "expo-router";
import {OrganizationPage,OrganizationButton,OrganizationCard,OrganizationText,OrganizationInput,OrganizationError} from "../../../src/components/organization/OrganizationUI";
import {RecommendationForm} from "../../../src/components/organization/RecommendationForm";
import {useRecommendationInbox} from "../../../src/components/organization/useRecommendationInbox";
import {recommendationTitle,recommendationStatusLabel} from "../../../src/core/recommendationInbox";
import {localRecommendationCandidates} from "../../../src/core/recommendationResolution";
import {linkRecommendation,transitionRecommendation} from "../../../src/storage/recommendationInboxRepo";
import {savedContentVisible,SENSITIVE_FILTER_COVERAGE} from "../../../src/core/sensitiveContent";
import {presentSavedTitle} from "../../../src/core/mediaViewProjection";
import {mediaClassificationLabel} from "../../../src/core/presentationLabels";
import {savedMediaPresentation} from "../../../src/core/mediaPresentation";
import {MediaPoster} from "../../../src/components/browsing/MediaPoster";
import {space,radius} from "../../../src/theme/presentation";
export default function RecommendationScreen(){
  const {id}=useLocalSearchParams<{id:string}>(),router=useRouter();const {snapshot,error,busy,refresh,run}=useRecommendationInbox();
  const [editing,setEditing]=useState(false),[searching,setSearching]=useState(false),[query,setQuery]=useState<string|null>(null),[original,setOriginal]=useState(false);
  const entry=snapshot?.recommendations.find(v=>v.id===id);
  const visible=snapshot?.items.filter(v=>savedContentVisible(v,snapshot.preferences.value.hideSensitive)).map(v=>presentSavedTitle(v,snapshot.preferences.value.languages))??[];
  const candidates=entry&&searching?localRecommendationCandidates(entry,visible,query??entry.name??""):[];
  const linked=visible.find(v=>v.id===entry?.linkedItemId);
  return <OrganizationPage title="Recomendación"><OrganizationError error={error} retry={()=>void refresh()}/>
    {!snapshot?<OrganizationText>{error?"No se pudo cargar la recomendación.":"Cargando recomendación…"}</OrganizationText>:!entry?<OrganizationText>La recomendación no existe.</OrganizationText>:<>
      <OrganizationCard><OrganizationText heading prominent>{recommendationTitle(entry)}</OrganizationText><OrganizationText muted>{recommendationStatusLabel(entry.status)}</OrganizationText>
        {!!entry.person&&<OrganizationText>Recomendada por: {entry.person}</OrganizationText>}{!!entry.origin&&<OrganizationText>Origen: {entry.origin}</OrganizationText>}
        {!!entry.name&&!!entry.url&&<OrganizationText muted>{entry.url}</OrganizationText>}{!!entry.comment&&<OrganizationText>{entry.comment}</OrganizationText>}
        {!!entry.reference&&<OrganizationText muted>Referencia: {entry.reference.provider}/{entry.reference.resourceNamespace}/{entry.reference.externalId}</OrganizationText>}
        {!!entry.linkedItemId&&<OrganizationText muted>{linked?`En Biblioteca: ${linked.title}`:"Vinculada a Biblioteca · contenido oculto por tu preferencia"}</OrganizationText>}
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:space.sm}}>
          {entry.status==="pending"&&<><OrganizationButton label="Buscar en mi biblioteca" variant="primary" icon="search-outline" disabled={busy} onPress={()=>setSearching(true)}/>
            <OrganizationButton label="Buscar en catálogo" disabled={busy} onPress={()=>router.push({pathname:"/organize/recommendations/catalog",params:{recommendationId:entry.id}})}/></>}
          {linked&&<OrganizationButton label="Abrir título vinculado" variant="primary" onPress={()=>router.push({pathname:"/title/[id]",params:{id:linked.id}})}/>}
          <OrganizationButton label="Editar" icon="create-outline" disabled={busy} onPress={()=>setEditing(v=>!v)}/>
        </View>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:space.sm}}>
          {entry.status!=="pending"&&<OrganizationButton label="Reabrir" variant="quiet" disabled={busy} onPress={()=>void run(()=>transitionRecommendation(id,"pending"))}/>}
          {entry.status!=="discarded"&&<OrganizationButton label="Descartar" variant="quiet" disabled={busy} onPress={()=>void run(()=>transitionRecommendation(id,"discarded"))}/>}
          <OrganizationButton label={original?"Ocultar captura original":"Ver captura original"} variant="quiet" expanded={original} onPress={()=>setOriginal(v=>!v)}/>
        </View>
      </OrganizationCard>
      {original&&<OrganizationCard><OrganizationText heading>Captura original</OrganizationText><OrganizationText>{recommendationTitle(entry.originalCapture)}</OrganizationText>
        {entry.originalCapture.url&&entry.originalCapture.name&&<OrganizationText>{entry.originalCapture.url}</OrganizationText>}
        <OrganizationText muted>{[entry.originalCapture.person,entry.originalCapture.origin,entry.originalCapture.comment].filter(Boolean).join(" · ")}</OrganizationText></OrganizationCard>}
      {editing&&<RecommendationForm key={entry.id} recommendation={entry} others={snapshot.recommendations} busy={busy} run={run} review={other=>router.push({pathname:"/organize/recommendations/[id]",params:{id:other}})} done={()=>setEditing(false)}/>}
      {searching&&entry.status==="pending"&&<OrganizationCard><OrganizationText heading>Coincidencias locales</OrganizationText>
        <OrganizationText muted>Las coincidencias por nombre son sugerencias. Confirmá la obra correcta con Vincular.</OrganizationText>
        <OrganizationInput label="Nombre para buscar en Biblioteca" value={query??entry.name??""} onChangeText={setQuery}/>
        {snapshot.preferences.value.hideSensitive&&<OrganizationText muted>{SENSITIVE_FILTER_COVERAGE}</OrganizationText>}
        {candidates.map(item=><View key={item.id} style={{gap:space.sm,paddingVertical:space.sm}}>
          <View style={{flexDirection:"row",alignItems:"center",gap:space.md}}><MediaPoster identity={item.id} context="list" posterUrl={item.posterUrl} {...savedMediaPresentation(item)} style={{width:40,height:60,borderRadius:radius.control,flexShrink:0}}/>
            <View style={{flex:1,minWidth:0}}><OrganizationText heading>{item.title}{item.year?` (${item.year})`:""}</OrganizationText><OrganizationText muted>{mediaClassificationLabel(item)}</OrganizationText></View></View>
          <OrganizationButton label="Vincular" accessibilityLabel={`Vincular con ${item.title}`} disabled={busy} onPress={()=>void run(()=>linkRecommendation(id,item.id))}/>
        </View>)}
        {!candidates.length&&<OrganizationText>No hay coincidencias visibles. Podés cambiar el nombre, buscar en catálogo o crear un título manual.</OrganizationText>}
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:space.sm}}><OrganizationButton label="Crear título manual" disabled={busy} onPress={()=>router.push({pathname:"/manual-entry",params:{recommendationId:id}})}/><OrganizationButton label="Cerrar coincidencias" variant="quiet" onPress={()=>setSearching(false)}/></View>
      </OrganizationCard>}
    </>}
  </OrganizationPage>;
}

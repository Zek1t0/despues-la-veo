import { visibleGuideCoverage } from "../../core/granularCoverage";
import type { ProgressDatabase } from "../../storage/personalProgressRepo";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import type { SavedTitleWithProviderReferences } from "../../core/savedTitle";
import { progressEligibility, parseProgressPosition } from "../../core/personalProgress";
import { progressPositionLabel } from "../../core/personalProgressPresentation";
import { readKey } from "../../core/granularInteraction";
import { listGranularUnits, type GranularRow } from "../../storage/granularRepo";
import { readGranularScreen } from "../../storage/granularPresentationRepo";
import { downloadGranularGuide, downloadGranularGuideIndex, readGranularGuide } from "../../storage/granularInventory";
import { observeLibraryProjection } from "../../storage/libraryInvalidation";
import { OrganizationButton as Button, OrganizationCard, OrganizationError, OrganizationText } from "../organization/OrganizationUI";
import { GranularCoveragePanel } from "./GranularCoveragePanel";
import { useGranularDay } from "./useGranularDay";
import { space } from "../../theme/presentation";

export function granularHeading(item: SavedTitleWithProviderReferences) {
  return item.medium==="audiovisual" ? "Episodios" : "Capítulos";
}
export function granularTitleEligible(item: SavedTitleWithProviderReferences) {
  return item.medium==="literature" || progressEligibility(item)!=="none";
}
export function unitLabel(row: GranularRow) {
  const coordinate=parseProgressPosition(JSON.parse(row.coordinate));
  return coordinate ? progressPositionLabel(coordinate,true) : "";
}
type PreviewData={rows:GranularRow[]; screen:Awaited<ReturnType<typeof readGranularScreen>>;
  guide:Awaited<ReturnType<typeof readGranularGuide>>};
export function GranularPreview({ item, isolated = false, database, onOpen, fixtureGuide }: {
  item: SavedTitleWithProviderReferences; isolated?:boolean; database?:ProgressDatabase;
  onOpen?:(source:string,season:number)=>void; fixtureGuide?:Parameters<typeof downloadGranularGuide>[2];
}) {
  const router=useRouter();
  const [source,setSource]=useState("manual"), [season,setSeason]=useState(0);
  const [read,setRead]=useState<{key:string;data:PreviewData}|null>(null);
  const [failure,setFailure]=useState<{key:string;data:string}|null>(null);
  const [refresh,setRefresh]=useState(0), [busy,setBusy]=useState(false);
  const request=useRef<AbortController|null>(null);
  const eligible=granularTitleEligible(item);
  const refs=item.providerReferences.filter(ref=>ref.provider==="tmdb" && ref.resourceNamespace==="tv");
  const series=refs.some(ref=>ref.externalId===source)?source:null;
  const evidence=read?.data.screen.guide;
  const clock=useGranularDay(evidence?.indexCheckedAt,evidence?.checkedAt);
  const key=JSON.stringify([item.id,series,season,clock.day]);
  useEffect(()=>{
    if (!eligible || isolated) return;
    const scope=series?{ownerId:item.id,seriesId:series,language:"es-AR",season}:null;
    return observeLibraryProjection(async()=>{
      const [screen,guide]=await Promise.all([readGranularScreen(item.id,scope,database),scope?readGranularGuide(scope,database):null]);
      const page=await listGranularUnits(item.id,3,null,database,{status:"active",source:scope?"tmdb":"manual",
        ...(scope?{seriesId:scope.seriesId,group:screen.guide?.group??null}:{})});
      if(screen.revision!==page.revision)throw Error("El inventario cambió durante la lectura.");
      return {rows:page.rows,screen,guide};
    },data=>{setRead({key,data});setFailure(null);},ids=>ids.includes(item.id),
    ()=>{setRead(null);setFailure({key,data:"No se pudo leer la vista previa."});},true);
  },[eligible,isolated,item.id,database,key,series,season,refresh]);
  useEffect(()=>()=>request.current?.abort(),[]);
  if (!eligible || isolated) return null;
  const data=readKey(key,read), failed=readKey(key,failure);
  const heading=granularHeading(item);
  const scopeLabel=series?(season===0?"TMDB · Especiales":`TMDB · Temporada ${season}`):"Lista manual";
  const editorial=data?.screen.guide;
  const coverage=editorial?visibleGuideCoverage(editorial,season,clock):null;
  const index=data?.guide?.index ?? [];
  function download(indexOnly:boolean) {
    if(!series||request.current)return;
    const controller=new AbortController();request.current=controller;
    setBusy(true);setFailure(null);
    const scope={ownerId:item.id,seriesId:series,language:"es-AR",season};
    const action=indexOnly?downloadGranularGuideIndex:downloadGranularGuide;
    void action(scope,controller.signal,{...fixtureGuide,db:database})
      .then(()=>setRefresh(value=>value+1))
      .catch(cause=>{if(!controller.signal.aborted)setFailure({key,data:cause instanceof Error?cause.message:"No se pudo actualizar la guía."});})
      .finally(()=>{request.current=null;setBusy(false);});
  }
  const wrap={flexDirection:"row",flexWrap:"wrap",gap:space.sm} as const;
  return <OrganizationCard>
    <OrganizationText heading prominent>{heading}</OrganizationText>
    {refs.length>0&&<View style={wrap}><Button label="Lista manual" selected={!series} disabled={busy} onPress={()=>setSource("manual")}/>
      {refs.map((ref,i)=><Button key={ref.externalId} label={refs.length===1?"Guía TMDB":`Guía TMDB ${i+1}`} selected={series===ref.externalId}
        disabled={busy} onPress={()=>{setSource(ref.externalId);setSeason(0);}}/>)}</View>}
    {series&&<View style={wrap}>
      <Button label="Consultar temporadas" disabled={busy} onPress={()=>download(true)}/>
      <Button label="Actualizar temporada" disabled={busy} onPress={()=>download(false)}/>
      {busy&&<Button label="Cancelar descarga" onPress={()=>request.current?.abort()}/>}
      {index.map(entry=><Button key={entry.id} label={entry.number===0?"Especiales":`T${entry.number}`} disabled={busy}
        selected={season===entry.number} onPress={()=>setSeason(entry.number)}/>)}
    </View>}
    {busy&&<OrganizationText muted>Consultando TMDB…</OrganizationText>}
    <OrganizationError error={failed} retry={()=>setRefresh(value=>value+1)}/>
    {data&&<GranularCoveragePanel scope={scopeLabel} marked={series?coverage?.counted??0:data.screen.manual.marked}
      denominator={coverage?.denominator} outside={Math.max(0,data.screen.marked-(series?coverage?.counted??0:data.screen.manual.marked))}
      caption={series?(editorial?.checkedAt!=null?coverage?.label??"Guía parcial":"Guía aún no descargada"):`${data.screen.manual.marked} de ${data.screen.manual.total} en tu lista`}
      percent={series?coverage?.percent:null}/>}
    {!!series&&editorial?.checkedAt!=null&&<OrganizationText muted>Consulta del {new Date(editorial.checkedAt).toLocaleDateString("es-AR")}</OrganizationText>}
    <View style={{gap:space.xs}}>
      {!data&&!failed&&<OrganizationText muted>Cargando inventario…</OrganizationText>}
      {data&&!data.rows.length&&(!series||editorial?.checkedAt!=null)&&<OrganizationText muted>No hay unidades activas en este alcance.</OrganizationText>}
      {data?.rows.map(row=><OrganizationText key={row.id}>{unitLabel(row)}{row.marked===1?" · Marcado":""}</OrganizationText>)}
    </View>
    <Button label={`Ver ${heading.toLowerCase()}`} icon="list-outline" variant="primary"
      onPress={()=>onOpen?onOpen(series??"manual",season):router.push({pathname:"/title/[id]/units",params:{id:item.id,source:series??"manual",season:String(season)}})} />
  </OrganizationCard>;
}

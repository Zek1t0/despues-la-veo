import { consumptionIntent, requestGeneration, selectionUnitLabel, type ConsumptionDateMode } from "../../core/granularInteraction";
import { GranularCoveragePanel } from "./GranularCoveragePanel";
import { useGranularDay } from "./useGranularDay";
import type { ProgressDatabase } from "../../storage/personalProgressRepo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import type { SavedTitleWithProviderReferences } from "../../core/savedTitle";
import { canonicalChapter, parseProgressPosition, progressEligibility, type ProgressPosition } from "../../core/personalProgress";
import { civilDateLabel, localCivilDay, partitionGranularSelection, unitAvailability, visibleGuideCoverage } from "../../core/granularCoverage";
import { newGranularUuid } from "../../core/granularTracking";
import { downloadGranularGuide, downloadGranularGuideIndex, readGranularGuide, type GuideScope } from "../../storage/granularInventory";
import { confirmManualRange, previewManualRange, type ManualRange } from "../../storage/granularManualInventory";
import { listGranularUnits, retireGranularUnit, saveGranularGroup, saveGranularUnit, setGranularDecisions,
  setGranularEnabled, state, type GranularRow, type PageCursor, type UnitFilter } from "../../storage/granularRepo";
import { readGranularScreen, readScopeWithDb } from "../../storage/granularPresentationRepo";
import { subscribeLibraryInvalidation } from "../../storage/libraryInvalidation";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { radius, space, type } from "../../theme/presentation";
import { OrganizationButton as Button, OrganizationCard as Card, OrganizationError, OrganizationInput as Input, OrganizationText as Label } from "../organization/OrganizationUI";
import { granularHeading, granularTitleEligible, unitLabel } from "./GranularPreview";
import { posterUrl } from "../../providers/tmdb/tmdbImages";

const wrap = {flexDirection:"row",flexWrap:"wrap",gap:space.sm,alignItems:"center"} as const;
const pageSize=40;
type Screen = Awaited<ReturnType<typeof readGranularScreen>>;
type Guide = Awaited<ReturnType<typeof readGranularGuide>>;
type Confirmation={rows:GranularRow[]; marked:boolean; revision:number; scope:GuideScope|null; guideRevision:number|null;
  today:string; preset:boolean; approved:string[]; step:number; done:number; failed:boolean};
type Editor={kind:"unit"|"range"|"group";revision:number; id?:string; mode:ProgressPosition["mode"]; group:string|null;
  first:string;last:string;season:string;label:string; groupKind:"manual"|"season"|"volume"};
const filters=[["active","Todas"],["marked","Marcadas"],["pending","Sin marcar"],["retired","Retiradas"],["announced","Anunciadas"]] as const;
const errorText=(error:unknown)=>error instanceof Error?error.message:"No se pudo completar la operación.";
const asInteger=(raw:string)=>/^\d+$/.test(raw.trim())?Number(raw):NaN;

export function GranularScreen({item,database,fixtureGuide,initialSource,initialSeason}:{initialSource?:string;initialSeason?:number;item:SavedTitleWithProviderReferences; database?:ProgressDatabase; fixtureGuide?:Parameters<typeof downloadGranularGuide>[2]}) {
  const {theme}=useAppTheme();
  const {width,fontScale}=useWindowDimensions();
  const [source,setSource]=useState(()=>item.providerReferences.some(ref=>ref.provider==="tmdb"&&ref.resourceNamespace==="tv"&&ref.externalId===initialSource)?initialSource!:"manual"), [season,setSeason]=useState(()=>Number.isInteger(initialSeason)&&initialSeason!>=0&&initialSeason!<=9999?initialSeason!:0);
  const [group,setGroup]=useState<string|null|undefined>(undefined);
  const [filter,setFilter]=useState<UnitFilter["status"]|"announced">("active"), [grid,setGrid]=useState(false);
  const [storedScreen,setScreen]=useState<Screen|null>(null), [guide,setGuide]=useState<Guide>(null);
  const [storedRows,setRows]=useState<GranularRow[]>([]), [next,setNext]=useState<PageCursor|null>(null);
  const [error,setError]=useState<string|null>(null), [busy,setBusy]=useState(false), [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<Record<string,GranularRow>>({});
  const [choice,setChoice]=useState<Confirmation|null>(null);
  const [dateMode,setDateMode]=useState<ConsumptionDateMode>("none"), [date,setDate]=useState("");
  const [selecting,setSelecting]=useState(false);
  const [menu,setMenu]=useState<string|null>(null), [focused,setFocused]=useState<string|null>(null);
  const [revealed,setRevealed]=useState<string|null>(null);
  const [editor,assignEditor]=useState<Editor|null>(null);
  const [range,setRange]=useState<Awaited<ReturnType<typeof previewManualRange>>|null>(null);
  const lock=useRef(false), paging=useRef(false), loadGeneration=useRef(0);
  const editorRequests=useRef(requestGeneration()).current;
  function setEditor(value:Editor|null) {
    editorRequests.invalidate();
    setRange(null);
    assignEditor(value);
  }
  const selectedRevision=useRef<number|undefined>(undefined);
  const controller=useRef<AbortController|null>(null);
  const eligible=granularTitleEligible(item);
  const explicit=item.medium==="literature" || progressEligibility(item)==="explicit";

  const tv=item.providerReferences.filter(ref=>ref.provider==="tmdb" && ref.resourceNamespace==="tv");
  const activeSeries=tv.some(ref=>ref.externalId===source)?source:null;
  const scope=useMemo<GuideScope|null>(()=>activeSeries?{ownerId:item.id,seriesId:activeSeries,language:"es-AR",season}:null,[item.id,activeSeries,season]);

  const clock=useGranularDay(storedScreen?.guide?.indexCheckedAt,storedScreen?.guide?.checkedAt);
  const today=clock.day;
  const [snapshotKey,setSnapshotKey]=useState("");
  const projectionKey=JSON.stringify([item.id,activeSeries,season,group===undefined?"all":group,filter,today]);
  const currentProjection=snapshotKey===projectionKey;
  const screen=currentProjection?storedScreen:null, rows=currentProjection?storedRows:[];
  const coverage=screen?.guide?visibleGuideCoverage(screen.guide,season,clock):null;
  const enabled=eligible && (!explicit || !!screen?.enabled);
  const memberById=useMemo(()=>new Map(screen?.guide?.members.map(member=>[member.unitId,member])??[]),[screen]);
  const filtersFor = useCallback((view:Screen|null):UnitFilter=>({
    source:scope?"tmdb":"manual",seriesId:scope?.seriesId,season:scope?.season,group:scope?view?.guide?.group??null:group,
    status:filter==="announced"?"active":filter,
    unitIds:scope&&!view?.guide?.group?[]:filter==="announced" ? (view?.guide?.members??[])
      .filter(member=>unitAvailability(member.airDate,member.retired,today)==="Anunciado").map(member=>member.unitId) : undefined,
  }),[scope,group,filter,today]);
  const listFilter=useMemo(()=>filtersFor(screen),[filtersFor,screen]);

  const reload=useCallback(async()=>{
    const generation=++loadGeneration.current;
    setLoading(true);
    try{
      const [value,editorial]=await Promise.all([readGranularScreen(item.id,scope,database,Date.now(),group),scope?readGranularGuide(scope,database):null]);
      const page=await listGranularUnits(item.id,pageSize,null,database,filtersFor(value));
      if(generation!==loadGeneration.current) return;
      if (value.revision!==page.revision) throw Error("El inventario cambió durante la lectura. Reintenta.");
      setError(null);
      setSnapshotKey(projectionKey);setScreen(value);
      setGuide(editorial);setRows(page.rows);setNext(page.next);
    }catch(cause){if(generation===loadGeneration.current)setError(errorText(cause));}
    finally{if(generation===loadGeneration.current)setLoading(false);}
  },[item.id,scope,group,database,filtersFor,projectionKey]);
  useEffect(()=>{
    void reload();
    const stop=subscribeLibraryInvalidation(change=>{if(change.ids.includes(item.id))void reload();});
    return ()=>{loadGeneration.current++;stop();};
  },[reload,item.id]);
  useEffect(()=>()=>controller.current?.abort(),[]);

  function run(action:()=>Promise<void>) {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError(null);
    void action().catch(cause=>setError(errorText(cause))).finally(()=>{lock.current=false;setBusy(false);});
  }
  async function more(){
    if(!next || paging.current || loading || !currentProjection)return;
    const generation=loadGeneration.current;
    paging.current=true;
    try{
      const page=await listGranularUnits(item.id,pageSize,next,database,listFilter);
      if(generation!==loadGeneration.current)return;
      setRows(previous=>[...previous,...page.rows]);setNext(page.next);
    }catch(cause){if(generation===loadGeneration.current){setError(errorText(cause));void reload();}}
    finally{paging.current=false;}
  }
  function clearProjection() {
    loadGeneration.current++;
    setMenu(null);setFocused(null);setRows([]);setNext(null);setScreen(null);setGuide(null);setError(null);setLoading(true);
  }
  function switchGroup(value:string|null|undefined) {
    if(lock.current || value===group)return;
    clearProjection();setEditor(null);setChoice(null);setGroup(value);
  }
  function switchFilter(value:typeof filter) {
    if(lock.current || value===filter)return;
    clearProjection();setChoice(null);setFilter(value);
  }
  function switchScope(value:string, number=0){
    if(lock.current || (value===source && number===season && group===undefined))return;
    clearProjection();
    controller.current?.abort();
    setSource(value);setSeason(number);if(value==="manual" && filter==="announced")setFilter("active");setGroup(undefined);setSelected({});setChoice(null);setEditor(null);setRange(null);setRows([]);setNext(null);
  }
  function download(indexOnly:boolean){
    if(!scope)return;
    run(async()=>{
      const active=new AbortController();controller.current=active;
      try{await (indexOnly?downloadGranularGuideIndex(scope,active.signal,{...fixtureGuide,db:database}):downloadGranularGuide(scope,active.signal,{...fixtureGuide,db:database}));}
      finally{controller.current=null;await reload();}
    });
  }
  function availability(row:GranularRow) {
    return unitAvailability(memberById.get(row.id)?.airDate??null,!!row.retired,today);
  }
  function openChoice(values:GranularRow[],marked:boolean,preset=false,revision=screen?.revision){
    if(!screen || loading || !values.length || revision===undefined)return;
    setEditor(null);setRange(null);setDateMode("none");setDate("");
    setChoice({rows:values,marked,revision,scope,guideRevision:screen?.guide?.revision??null,today,preset,
      approved:[],step:0,done:0,failed:false});
  }
  function preset(){
    if(!scope || !screen?.guide)return;
    run(async()=>{
      const generation=loadGeneration.current;
      const ids=new Set(screen.guide!.eligible);
      let cursor:PageCursor|null=null;
      const matches:GranularRow[]=[];
      let revision=screen.revision;
      do {
        const page=await listGranularUnits(item.id,500,cursor,database,{...listFilter,status:"active",unitIds:[...ids]});
        revision=page.revision;cursor=page.next;matches.push(...page.rows.filter(row=>ids.has(row.id)));
      } while(cursor);
      if(generation===loadGeneration.current) openChoice(matches,true,true,revision);
    });
  }
  function submitChoice(){
    if(!choice)return;
    const current=choice;
    const batch=partitionGranularSelection(current.rows)[current.step];
    run(async()=>{
      try{
        const now=Date.now(), day=localCivilDay(new Date(now));
        const intents=batch.map(row=>({unitId:row.id,expectedRevision:row.revision??null,
          marked:current.marked,consumedOn:consumptionIntent(current.marked,dateMode,row,day,date)}));
        await setGranularDecisions(item.id,current.revision,intents,database,now,async db=>{
          const actual=await state(db,item.id);
          if(actual.revision!==current.revision || localCivilDay(new Date())!==current.today) throw Error("El inventario o el día cambió. Revisa la selección de nuevo.");
          if(current.scope){
            const fresh=await readScopeWithDb(db,current.scope,Date.now());
            if(fresh.revision!==current.guideRevision) throw Error("La guía cambió. Revisa la selección de nuevo.");
            const aired=new Set(fresh.eligible), schedule=new Map(fresh.members.map(unit=>[unit.unitId,unit.airDate]));
            for(const row of batch){
              if(current.preset && !aired.has(row.id))throw Error("Cambió el conjunto de episodios estrenados.");
              if(current.marked && unitAvailability(schedule.get(row.id)??null,false,current.today)==="Anunciado" && !current.approved.includes(row.id))throw Error("Confirma cada unidad anunciada.");
            }
          }
        });
        const changed=batch.some((row,index)=>row.marked!==Number(current.marked) || (row.consumed_on??null)!==intents[index].consumedOn);
        const done=current.done+batch.length;
        if(done===current.rows.length){setChoice(null);setSelected({});setResult(done===1?"1 unidad confirmada.":`${done} unidades confirmadas.`);}
        else setChoice({...current,step:current.step+1,done,revision:current.revision+Number(changed)});
      }catch(cause){setChoice({...current,failed:true});throw cause;}
    });
  }
  const [result,setResult]=useState("");
  function startEditor(kind:Editor["kind"],row?:GranularRow){
    if(!screen)return;
    const coordinate=row?parseProgressPosition(JSON.parse(row.coordinate)):null;
    setChoice(null);setRange(null);
    setEditor({kind,revision:screen.revision,id:row?.id,mode:coordinate?.mode??(item.medium==="audiovisual"?"episode":"chapter"),
      group:row?.group_id??group??null,first:coordinate?.mode==="chapter"?coordinate.chapter:coordinate && "episode" in coordinate?String(coordinate.episode):"",
      last:"",season:coordinate?.mode==="season-episode"?String(coordinate.season):"0",
      label:coordinate?.mode==="special"?coordinate.label:row?.label??"",groupKind:"manual"});
  }
  function saveEditor(){
    if(!editor)return;
    const value=editor;
    const ticket=editorRequests.begin();
    run(async()=>{
      if(value.kind==="group")await saveGranularGroup({ownerId:item.id,id:newGranularUuid(),kind:value.groupKind,label:value.label.trim()},value.revision,database);
      else if(value.kind==="range"){
        if(value.mode==="special")throw Error("Los especiales se agregan individualmente.");
        const base={ownerId:item.id,groupId:value.group,first:asInteger(value.first),last:asInteger(value.last)};
        const intent:ManualRange=value.mode==="season-episode"?{...base,mode:value.mode,season:asInteger(value.season)}:{...base,mode:value.mode};
        try {
          const preview=await previewManualRange(intent,database);
          if(editorRequests.current(ticket))setRange(preview);
        } catch(cause) {
          if(editorRequests.current(ticket))throw cause;
        }
        return;
      } else{
        const n=asInteger(value.first);
        const coordinate:ProgressPosition=value.mode==="chapter"?{mode:"chapter",chapter:canonicalChapter(value.first)}:
          value.mode==="special"?{mode:"special",label:value.label.trim()}:value.mode==="episode"?{mode:"episode",episode:n}:
          {mode:"season-episode",season:asInteger(value.season),episode:n};
        await saveGranularUnit({ownerId:item.id,id:value.id??newGranularUuid(),groupId:value.group,coordinate,label:value.mode==="special"?null:value.label.trim()||null},value.revision,database);
      }
      if(editorRequests.current(ticket))setEditor(null);
    });
  }
  const parts=choice?partitionGranularSelection(choice.rows):[];
  const currentPart=choice?parts[choice.step]:[];
  const future=currentPart.filter(row=>availability(row)==="Anunciado");
  const choiceLabels=currentPart.map(row=>selectionUnitLabel(unitLabel(row),scope?`TMDB · T${season}`:screen?.groups.find(entry=>entry.id===row.group_id)?.label??"Sin grupo"));
  const duplicates=new Map<string,number>();
  for(const label of choiceLabels)duplicates.set(label,(duplicates.get(label)??0)+1);
  function toggleSelection(row:GranularRow) {
    setSelected(previous=>{
      if (!Object.keys(previous).length)selectedRevision.current=screen?.revision;
      const updated={...previous};if(updated[row.id])delete updated[row.id];else updated[row.id]=row;
      return updated;
    });
  }
  const columns=grid?Math.max(1,Math.min(6,Math.floor(width/(135*Math.max(fontScale,1))))):1;

  const header=<View style={{gap:space.md}}>
    <Card>
      <Label heading prominent>{item.title}</Label>
      <Label muted>{granularHeading(item)} · Seguimiento por unidad</Label>
      {eligible && explicit && !screen?.enabled && <Button label="Habilitar seguimiento granular" disabled={busy||!screen} onPress={()=>run(async()=>{await setGranularEnabled(item.id,screen!.revision,true,database);})}/>}
      {!eligible && <Label muted>El formato actual no admite nuevas decisiones. Se conservan las anteriores.</Label>}
      <View style={wrap}>
        <Button label="Tu lista" selected={!scope} disabled={busy} onPress={()=>switchScope("manual")}/>
        {tv.map((ref,index)=><Button key={ref.externalId} label={tv.length===1?"Guía TMDB":`Guía TMDB ${index+1}`} selected={source===ref.externalId} disabled={busy} onPress={()=>switchScope(ref.externalId)}/>)}
      </View>
      {scope?<><View style={wrap}>
        <Button label="Consultar temporadas" disabled={busy||!eligible} onPress={()=>download(true)}/>
        <Button label="Actualizar temporada" disabled={busy||!eligible} icon="download-outline" onPress={()=>download(false)}/>
        {busy&&controller.current&&<Button label="Cancelar descarga" onPress={()=>controller.current?.abort()}/>}
      </View><View style={wrap}>{guide?.index.map(entry=><Button key={entry.id} label={entry.number===0?"Especiales":`T${entry.number}`}
        selected={entry.number===season} disabled={busy} onPress={()=>switchScope(source,entry.number)}/>)}</View>
      {!!guide?.seasonConflicts.length&&<Label muted>Referencias de temporada incompatibles. Se muestran los alcances identificados.</Label>}
      <GranularCoveragePanel scope={season===0?"TMDB · Especiales":`TMDB · Temporada ${season}`} marked={coverage?.counted??0} denominator={coverage?.denominator} caption={(screen?.guide?.checkedAt!=null||!!screen?.guide?.members.length)?coverage?.label??"Guía parcial":loading?"Cargando guía…":"Guía aún no descargada"} percent={coverage?.percent}/>
      {screen?.guide?.checkedAt!=null&&<Label muted>TMDB · Consulta {new Date(screen.guide.checkedAt).toLocaleDateString("es-AR")} · {season===0?"Especiales":`Temporada ${season}`}</Label>}
      {!!screen?.guide?.members.some(member=>unitAvailability(member.airDate,member.retired,today)==="Anunciado") && <Label muted>Próximos: {screen.guide.members.filter(member=>unitAvailability(member.airDate,member.retired,today)==="Anunciado").slice(0,3).map(member=>`E${member.number} · ${civilDateLabel(member.airDate!)}`).join(", ")}</Label>}
      </>:<><GranularCoveragePanel scope={screen?.groups.find(entry=>entry.id===group)?.label??"Lista manual"}
        marked={screen?.manual.marked??0} caption={screen?`${screen.manual.marked} de ${screen.manual.total} en tu lista`:"Cargando lista…"}/>
      <View style={wrap}><Button label="Todos los grupos" selected={group===undefined} onPress={()=>switchGroup(undefined)}/><Button label="Sin grupo" selected={group===null} onPress={()=>switchGroup(null)}/>
        {screen?.groups.map(entry=><Button key={entry.id} label={entry.label} selected={group===entry.id} onPress={()=>switchGroup(entry.id)}/>)}</View></>}
      {!!screen && screen.marked>(scope?coverage?.counted??0:screen.manual.marked)&&<Label muted>{screen.marked-(scope?coverage?.counted??0:screen.manual.marked)} marcas fuera del conteo mostrado</Label>}
    </Card>
    <View style={wrap}>
      <Button label="Lista" selected={!grid} onPress={()=>setGrid(false)}/><Button label="Cuadrícula" selected={grid} onPress={()=>setGrid(true)}/>
      <Button label={selecting?"Salir de selección":"Seleccionar varias"} icon="checkbox-outline" selected={selecting}
        onPress={()=>{setSelecting(!selecting);if(selecting){setSelected({});setChoice(null);}}} disabled={busy}/>
      {filters.filter(([key])=>key!=="announced"||!!scope).map(([key,label])=><Button key={key} label={label} selected={filter===key} onPress={()=>switchFilter(key)}/>)}
    </View>
    <View style={wrap}>
      {!scope&&enabled&&<><Button label="Agregar unidad" disabled={!screen||loading} icon="add" onPress={()=>startEditor("unit")}/><Button label="Crear rango" disabled={!screen||loading} onPress={()=>startEditor("range")}/><Button label="Crear grupo" disabled={!screen||loading} onPress={()=>startEditor("group")}/></>}
      {!!scope&&enabled&&!!screen?.guide?.eligible.length&&<Button label="Marcar estrenados conocidos" disabled={busy} onPress={preset}/>}
      {!!Object.keys(selected).length&&<><Label>{Object.keys(selected).length} {Object.keys(selected).length===1?"seleccionada":"seleccionadas"}</Label>
        <Button label="Marcar selección" disabled={busy||!enabled||!screen||loading} onPress={()=>openChoice(Object.values(selected),true,false,selectedRevision.current)}/>
        <Button label="Desmarcar selección" disabled={busy||!enabled||!screen||loading} onPress={()=>openChoice(Object.values(selected),false,false,selectedRevision.current)}/>
        <Button label="Limpiar selección" onPress={()=>setSelected({})}/></>}
    </View>
    {!!result&&<Text accessibilityLiveRegion="polite" style={{color:theme.global.textPrimary}}>{result}</Text>}
    <OrganizationError error={error} retry={()=>void reload()}/>
    {editor&&<Card>
      <Label heading>{editor.kind==="range"?"Crear rango":editor.kind==="group"?"Crear grupo":editor.id?"Editar unidad":"Agregar unidad"}</Label>
      {editor.kind==="group"?<View style={wrap}>{(["manual","season","volume"] as const).map((kind,i)=><Button key={kind}
        label={["Grupo","Temporada","Volumen"][i]} selected={editor.groupKind===kind} onPress={()=>setEditor({...editor,groupKind:kind})}/>)}</View>:
      <><View style={wrap}>{(item.medium==="audiovisual"?["episode","season-episode","special"] as const:["chapter","special"] as const)
        .filter(mode=>editor.kind!=="range"||mode!=="special").map(mode=><Button key={mode} selected={editor.mode===mode}
          label={{episode:"Episodio","season-episode":"Temporada y episodio",chapter:"Capítulo",special:"Especial"}[mode]}
          onPress={()=>{setRange(null);setEditor({...editor,mode});}}/>)}</View>
        <View style={wrap}><Button label="Sin grupo" selected={editor.group===null} onPress={()=>{setEditor({...editor,group:null});setRange(null);}}/>
          {screen?.groups.map(entry=><Button key={entry.id} label={entry.label} selected={editor.group===entry.id}
            onPress={()=>{setEditor({...editor,group:entry.id});setRange(null);}}/>)}</View>
        {editor.mode==="season-episode"&&<Input label="Temporada" inputMode="numeric" value={editor.season} onChangeText={seasonValue=>{setEditor({...editor,season:seasonValue});setRange(null);}}/>}
        {editor.mode!=="special"&&<Input label={editor.kind==="range"?"Desde":"Número"} inputMode={editor.mode==="chapter"?"decimal":"numeric"} value={editor.first}
          onChangeText={first=>{setEditor({...editor,first});setRange(null);}}/>}
        {editor.kind==="range"&&<Input label="Hasta" inputMode="numeric" value={editor.last} onChangeText={last=>{setEditor({...editor,last});setRange(null);}}/>}
      </>}
      {editor.kind!=="range"&&<Input label={editor.mode==="special"||editor.kind==="group"?"Nombre":"Nombre opcional"} value={editor.label} onChangeText={label=>setEditor({...editor,label})}/>}
      {range&&<><Label>{range.entries.length} solicitadas · {range.newCount} nuevas</Label><Label muted>
        {range.entries.filter(entry=>entry.matches.some(match=>!match.retired)).length} coordenadas con coincidencias activas · {range.entries.filter(entry=>entry.matches.some(match=>match.retired)).length} con retiradas
      </Label><Button label="Confirmar y omitir coincidencias" disabled={busy} variant="primary" onPress={()=>run(async()=>{const ticket=editorRequests.begin();await confirmManualRange(range,true,database);if(editorRequests.current(ticket))setEditor(null);})}/></>}
      <View style={wrap}><Button label={editor.kind==="range"?(range?"Revisar de nuevo":"Vista previa"):"Guardar"} disabled={busy} variant="primary" onPress={saveEditor}/>
        <Button label="Cancelar edición" onPress={()=>{setEditor(null);setRange(null);}}/></View>
    </Card>}
    {choice&&<Card>
      <Label heading>{choice.marked?"Confirmar marcado":"Confirmar desmarcado"}</Label>
      <Label>{choice.rows.length} {choice.rows.length===1?"unidad":"unidades"} · {scope?`TMDB · T${season}`:"Tu lista"} · Lote {choice.step+1}/{parts.length}</Label>
      {parts.length>1&&<Label muted>{parts.map((part,i)=>`${i+1}: ${part.length}`).join(" · ")}. Cada lote se confirma por separado. {choice.done} ya confirmadas.</Label>}
      {choice.preset&&<Label muted>Solo estrenados ordinarios conocidos. Se excluyen especiales, retirados, futuros y fechas inciertas.</Label>}
      <Label muted>{choiceLabels.map((label,index)=>(duplicates.get(label)??0)>1?`${label} · ${currentPart[index].id}`:label).join(", ")}</Label>
      {choice.marked&&<><View style={wrap}>{(["none","today","date","clear"] as const).map((mode,i)=><Button key={mode} label={["Conservar fechas","Hoy","Fecha elegida","Quitar fechas"][i]} selected={dateMode===mode} onPress={()=>setDateMode(mode)}/>)}</View>
      <Label muted>{dateMode==="none"?"Las marcas existentes conservan su fecha. Las nuevas quedan sin fecha.":dateMode==="clear"?"Las marcas seleccionadas quedarán sin fecha.":"Se reemplazará la fecha de las unidades seleccionadas."}</Label>
      {dateMode==="date"&&<Input label="Fecha de consumo (AAAA-MM-DD)" placeholder="AAAA-MM-DD" value={date} onChangeText={setDate}/>}
      {future.map(row=><Button key={row.id} label={`Confirmar anunciado: ${unitLabel(row)}`} selected={choice.approved.includes(row.id)}
        onPress={()=>setChoice({...choice,approved:choice.approved.includes(row.id)?choice.approved.filter(id=>id!==row.id):[...choice.approved,row.id]})}/>)}</>}
      {choice.failed&&<Label muted>{choice.done} confirmadas. El lote actual quedó sin aplicar. Cierra y revisa la selección.</Label>}
      <View style={wrap}><Button label="Confirmar lote" variant="primary" disabled={busy||choice.failed||(choice.marked&&future.some(row=>!choice.approved.includes(row.id)))} onPress={submitChoice}/>
        <Button label="Cerrar confirmación" disabled={busy} onPress={()=>{setChoice(null);setSelected({});}}/></View>
    </Card>}
  </View>;

  return <FlatList key={columns} style={{flex:1,backgroundColor:theme.global.background}}
    contentContainerStyle={{padding:space.md,gap:space.md,width:"100%",maxWidth:1040,alignSelf:"center"}}
    data={rows} numColumns={columns} keyExtractor={row=>row.id} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5}
    keyboardShouldPersistTaps="handled" ListHeaderComponent={header} onEndReached={()=>void more()} onEndReachedThreshold={0.4}
    ListEmptyComponent={<Label muted>{loading?"Cargando unidades…":"No hay unidades en este alcance."}</Label>}
    ListFooterComponent={next?<Button label="Cargar más" disabled={loading} onPress={()=>void more()}/>:null}
    renderItem={({item:row})=>{
      const member=memberById.get(row.id), heading=unitLabel(row);
      const label=member?.title??row.label, available=availability(row);
      const open=revealed===row.id;
      const marked=row.marked===1, picked=!!selected[row.id];
      const action=selecting?(picked?"Deseleccionar":"Seleccionar"):(marked?"Desmarcar":"Marcar");
      const disabled=busy||loading||!enabled||!!row.retired;
      if(grid)return <View testID="granular-unit-row" style={{flex:1/columns,minWidth:0,padding:space.xs}}>
        <Pressable accessibilityRole={selecting?"checkbox":"button"} accessibilityLabel={`${action} ${heading}`}
          accessibilityHint={`${marked?"Marcado":"Sin marcar"} · ${available}`}
          accessibilityState={selecting?{checked:picked,disabled}:{disabled}} disabled={disabled} focusable={!disabled}
          onFocus={()=>setFocused(row.id)} onBlur={()=>setFocused(null)}
          onPress={()=>selecting?toggleSelection(row):openChoice([row],!marked)}
          style={({pressed})=>({padding:space.sm,gap:space.xs,minHeight:78,borderRadius:radius.card,
            borderWidth:focused===row.id||picked?2:1,borderColor:focused===row.id?theme.global.accent:picked?theme.global.selectedBorder:theme.global.border,
            backgroundColor:picked?theme.global.selectedSurface:theme.global.surface,opacity:pressed?0.75:1})}>
          <Text style={[type.heading,{color:picked?theme.global.selectedForeground:theme.global.textPrimary,fontVariant:["tabular-nums"]}]}>{heading}</Text>
          <Text style={[type.caption,{color:picked?theme.global.selectedForeground:theme.global.textSecondary}]}>{marked?"✓ Marcado":"○ Sin marcar"}{picked?" · Seleccionado":""}</Text>
          {(available==="Anunciado"||available==="Retirado"||available==="Hoy · hora desconocida")&&<Label muted>{available}</Label>}
        </Pressable>
      </View>;
      return <View testID="granular-unit-row" style={{flex:1/columns,minWidth:0,padding:space.xs}}><Card style={{padding:grid?space.sm:space.md,borderColor:selected[row.id]?theme.global.selectedBorder:theme.global.border}}>
        <Text accessibilityRole="header" style={[grid?type.heading:type.title,{color:theme.global.textPrimary,fontVariant:["tabular-nums"]}]}>{heading}</Text>
        {!grid&&label&&<Label>{label}</Label>}
        <Label muted>{row.marked===1?"✓ Marcado":"Sin marcar"}{!grid||available==="Anunciado"?` · ${available}`:""}</Label>
        {!grid&&row.consumed_on&&<Label muted>Consumo: {civilDateLabel(row.consumed_on)}</Label>}
        {!grid&&member?.airDate&&<Label muted>TMDB · {civilDateLabel(member.airDate)}</Label>}
        <View style={wrap}>
          {!row.retired&&enabled&&<Button label={selecting?(picked?"Deseleccionar":"Seleccionar"):(marked?"Desmarcar":"Marcar")}
            icon={selecting?(picked?"checkbox-outline":"square-outline"):(marked?"checkmark-circle":"checkmark-circle-outline")}
            selected={selecting?picked:undefined} accessibilityLabel={`${action} ${heading}`} disabled={disabled}
            onPress={()=>selecting?toggleSelection(row):openChoice([row],!marked)}/>}
          {!scope&&enabled&&<Button label="Opciones" icon="ellipsis-horizontal" accessibilityLabel={`Opciones de ${heading}`}
            expanded={menu===row.id} onPress={()=>setMenu(menu===row.id?null:row.id)}/>}
          {!scope&&enabled&&menu===row.id&&<><Button label="Editar" onPress={()=>{setMenu(null);startEditor("unit",row);}}/>
            <Button label={row.retired?"Reactivar":"Retirar"} disabled={busy} onPress={()=>run(async()=>{
              if(screen)await retireGranularUnit(item.id,row.id,!row.retired,screen.revision,database);
              setMenu(null);
            })}/></>}
          {!grid&&member&&(member.overview||member.image)&&<Button label={open?"Ocultar detalles":"Mostrar sinopsis e imagen"}
            expanded={open} onPress={()=>setRevealed(open?null:row.id)}/>}
        </View>
        {!grid&&open&&member&&<><Label>{member.overview}</Label>{posterUrl(member.image)&&<Image accessibilityLabel={`Imagen de ${heading}`}
          source={{uri:posterUrl(member.image)!}} resizeMode="contain" style={{width:"100%",height:140}}/>}</>}
      </Card></View>;
    }}/>;
}

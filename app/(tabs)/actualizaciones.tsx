import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMediaLanguages } from "../../src/components/browsing/useMediaLanguages";
import { presentSavedTitle } from "../../src/core/mediaViewProjection";
import { activityDescription,activityRows } from "../../src/core/libraryActivityPresentation";
import type { ActivityFilter,ActivityCursor } from "../../src/storage/libraryActivityRepo";
import React,{useCallback,useEffect,useRef,useState} from "react";
import { AppState,FlatList,Pressable,Text,View } from "react-native";
import { useAppTheme } from "../../src/theme/AppThemeProvider";
import { LibraryRunHeader } from "../../src/components/browsing/LibraryRunHeader";
import { getLibraryUpdatesService,type LibraryUpdatesService } from "../../src/application/libraryUpdatesService";
import type { MetadataRunSummary } from "../../src/storage/metadataRunRepo";
export function UpdatesScreen({service:injected}:{service?:LibraryUpdatesService}={}) {
 const {theme}=useAppTheme();const [service,setService]=useState(injected),[run,setRun]=useState<MetadataRunSummary|null>(null),[completedAt,setCompletedAt]=useState<number|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
 const router=useRouter(),insets=useSafeAreaInsets(),{languages}=useMediaLanguages();
 const [filter,setFilter]=useState<ActivityFilter>("all"),[entries,setEntries]=useState<Awaited<ReturnType<LibraryUpdatesService["page"]>>["events"]>([]),[cursor,setCursor]=useState<ActivityCursor|undefined>(),[loading,setLoading]=useState(false),[feedError,setFeedError]=useState<string|null>(null),[focus,setFocus]=useState(0);
 const feedRead=useRef<(()=>void)|null>(null),more=useRef<(()=>void)|null>(null);
 const focusSeen=useRef(false);
 useFocusEffect(useCallback(()=>{if(!focusSeen.current){focusSeen.current=true;return;}setFocus(value=>value+1);},[]));
 useEffect(()=>{const stop=AppState?.addEventListener("change",state=>{if(state==="active")setFocus(value=>value+1);});return()=>stop?.remove();},[]);
 const alive=useRef(true),locked=useRef(false),read=useRef<(()=>void)|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{let active=true;if(injected){setService(injected);return;}void getLibraryUpdatesService().then(next=>{if(active)setService(next);}).catch(()=>{if(active)setError("No se pudo abrir el historial local. Podés reintentar.");});return()=>{active=false;};},[injected,retry]);
 useEffect(()=>{if(!service)return;let active=true,revision=0;
  const load=()=>{const generation=++revision;void service.status().then(next=>{if(active&&generation===revision){setRun(next.latest);setCompletedAt(next.completedAt);setError(null);}}).catch(()=>{if(active&&generation===revision)setError("No se pudo leer el resumen local. Podés reintentar.");});};
  read.current=load;const stop=service.subscribeRun(next=>{++revision;if(active){setRun(next);if(next.state!=="running")load();}});load();return()=>{active=false;stop();if(read.current===load)read.current=null;};
 },[service]);
 useEffect(()=>{
  if(!service)return;let active=true,version=0,busy=false,dirty=false,next:ActivityCursor|undefined;
  const load=async(reset:boolean)=>{
    if(!active)return;
    if(reset){version++;dirty=true;}
    if(busy)return;
    busy=true;setLoading(true);
    try{
      do{
        const replacing=dirty;dirty=false;const generation=version;
        let page:Awaited<ReturnType<LibraryUpdatesService["page"]>>;
        try{page=await service.page(filter,replacing?undefined:next);}catch(cause){if(active&&generation!==version){dirty=true;continue;}throw cause;}
        if(!active)return;
        if(generation!==version){dirty=true;continue;}
        next=page.next;setCursor(next);
        setEntries(old=>replacing?page.events:[...new Map([...old,...page.events].map(entry=>[entry.event.id,entry])).values()]);setFeedError(null);
      }while(dirty&&active);
    }catch{if(active)setFeedError("No se pudo leer la actividad local. Podés reintentar.");}
    finally{busy=false;if(active)setLoading(false);}
  };
  const reset=()=>{void load(true);};feedRead.current=reset;more.current=()=>{if(next&&!busy)void load(false);};
  const stop=service.subscribeFeed(reset);setEntries([]);setCursor(undefined);reset();
  return()=>{active=false;++version;stop();if(feedRead.current===reset)feedRead.current=null;more.current=null;};
 },[service,filter,focus]);
 async function openItem(id:string){if(!service)return;try{const item=await service.item(id);if(!alive.current)return;if(item)router.push({pathname:"/title/[id]",params:{id:item.id}});else feedRead.current?.();}catch{if(alive.current)setFeedError("No se pudo abrir la ficha local. Podés reintentar.");}}
 function start(){if(!service||locked.current)return;locked.current=true;setError(null);try{const handle=service.start();setRun(handle.getSnapshot());void handle.done.then(()=>{locked.current=false;},()=>{locked.current=false;if(alive.current)setError("No se pudo confirmar el resumen. Reintentá la lectura local.");});}catch{locked.current=false;setError("No se pudo iniciar la revisión. Podés reintentar.");}}
 const action=(label:string,onPress:()=>void,selected=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} style={{minHeight:44,padding:10,borderRadius:10,borderWidth:1,borderColor:theme.global.border,backgroundColor:selected?theme.global.surfaceSecondary:theme.global.background}}><Text style={{color:theme.global.textPrimary,fontWeight:"700"}}>{label}</Text></Pressable>;
 return <FlatList style={{flex:1,backgroundColor:theme.global.background}} contentContainerStyle={{padding:16,paddingBottom:16+insets.bottom,gap:12,maxWidth:900,width:"100%",alignSelf:"center"}}
  data={activityRows(entries)} keyExtractor={row=>row.key} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5}
  ListHeaderComponent={<View style={{gap:14}}><Text accessibilityRole="header" style={{color:theme.global.textPrimary,fontSize:22,fontWeight:"800"}}>Actualizaciones</Text>
    <LibraryRunHeader available={!!service} run={run} completedAt={completedAt} error={error} onStart={start} onCancel={()=>service?.cancel()} onRetry={()=>{if(service)read.current?.();else setRetry(value=>value+1);}} />
    {!service&&<Text style={{color:theme.global.textSecondary}}>Abriendo historial local…</Text>}
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{([['all','Todos'],['metadata','Metadata'],['personal','Mi actividad']] as const).map(([value,label])=><View key={value}>{action(label,()=>setFilter(value),filter===value)}</View>)}</View>
    <Text style={{color:theme.global.textMuted}}>Historial local: hasta 90 días y 2000 eventos. Revisiones: hasta 30 días y 20 terminadas. Políticas de DespuésLaVeo.</Text>
  </View>}
  renderItem={({item:row})=>row.kind==="day"?<Text accessibilityRole="header" style={{color:theme.global.textPrimary,fontSize:17,fontWeight:"800",marginTop:12}}>{row.label}</Text>:
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${presentSavedTitle(row.entry.item,languages).title}. ${activityDescription(row.entry.event)}`} onPress={()=>{void openItem(row.entry.item.id);}} style={{minHeight:44,gap:6,padding:12,borderRadius:12,borderWidth:1,borderColor:theme.global.border}}>
      <Text numberOfLines={2} style={{color:theme.global.textPrimary,fontWeight:"800"}}>{presentSavedTitle(row.entry.item,languages).title}</Text>
      <Text numberOfLines={3} style={{color:theme.global.textSecondary}}>{activityDescription(row.entry.event)}</Text>
      <Text style={{color:theme.global.textMuted}}>{new Date(row.entry.event.occurredAt).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})} · {row.entry.event.origin==="metadata"?"Metadata":"Mi actividad"}</Text>
    </Pressable>}
  onEndReached={()=>more.current?.()} onEndReachedThreshold={0.3}
  ListEmptyComponent={<Text accessibilityLiveRegion="polite" style={{color:theme.global.textSecondary,paddingVertical:18}}>{!service&&error?"Historial no disponible. Podés reintentar la lectura.":!service||loading?"Leyendo actividad local…":"Sin actividad en este filtro. Tu biblioteca sigue disponible sin conexión."}</Text>}
  ListFooterComponent={<View style={{gap:8}}>{loading&&entries.length>0&&<Text style={{color:theme.global.textSecondary}}>Cargando más actividad…</Text>}{cursor&&!loading&&action("Cargar más actividad",()=>more.current?.())}{feedError&&<><Text accessibilityRole="alert" style={{color:theme.semantic.dangerText}}>{feedError}</Text>{action("Reintentar actividad",()=>feedRead.current?.())}</>}</View>}
 />;
}
export default function UpdatesRoute(){return <UpdatesScreen/>;}

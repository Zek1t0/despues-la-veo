const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
let active;
const same = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
const react = {
  Fragment: "Fragment", createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState(initial) { const h=active,i=h.cursor++; if (!(i in h.slots)) h.slots[i]=typeof initial === "function" ? initial() : initial;
    return [h.slots[i], next => { h.slots[i]=typeof next === "function" ? next(h.slots[i]) : next; h.dirty=true; }]; },
  useRef(initial) { const i=active.cursor++; return active.slots[i] ??= {current:initial}; },
  useMemo(factory,deps) { const i=active.cursor++,old=active.slots[i]; if (!old || !same(old.deps,deps)) active.slots[i]={deps,value:factory()}; return active.slots[i].value; },
  useCallback(callback,deps) { return react.useMemo(() => callback,deps); },
  useEffect(effect,deps) { const h=active,i=h.cursor++,old=h.slots[i]; if (!old || !same(old.deps,deps)) { h.slots[i]={deps,cleanup:old?.cleanup}; h.effects.push(() => {h.slots[i].cleanup?.();h.slots[i].cleanup=effect();}); } },
};
function host(render,item) {
  return { slots:[],cursor:0,effects:[],dirty:true,tree:null,item,patches:[],navigation:[],reads:0,
    render() { active=this; this.cursor=0; this.dirty=false; this.tree=render(); this.effects.splice(0).forEach(f => f()); },
    async flush() { for(let i=0;i<12;i++){ if(this.dirty)this.render(); await new Promise(setImmediate); } if(this.dirty)this.render(); },
  };
}
function nodes(value,result=[]) { if(Array.isArray(value))value.forEach(x=>nodes(x,result)); else if(value && typeof value === "object" && value.props){result.push(value);nodes(value.props.children,result);} return result; }
function text(value) { if(Array.isArray(value))return value.map(text).join(" "); if(value && value.props)return text(value.props.children); return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
const item = (medium,family,format,refs=[]) => ({ id:"local",medium,contentFamily:family,primaryFormat:format,title:"Synthetic title",year:2020,posterUrl:null,
  overview:"Local persisted summary",genres:["Drama"],voteAverage:null,personalRating:80,status:"watching",tags:["Review"],notes:"Personal notes",createdAt:1,updatedAt:2,providerReferences:refs });
let settingsPreference={value:{version:1,languages:['ja','es'],hideSensitive:false,autoRefresh:{enabled:false,intervalDays:2.5}},updatedAt:1},settingsWrites=[];
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request.endsWith("mediaPreferencesRepo"))return {
    getMediaPreferences:async()=>settingsPreference,subscribeMediaPreferences:()=>()=>{},
    setMediaAutoRefresh:async value=>{settingsWrites.push(value);settingsPreference={...settingsPreference,value:{...settingsPreference.value,autoRefresh:value},updatedAt:settingsPreference.updatedAt+1};},
  };
  if(request === "react")return react;
  if(request === "react-native")return { ...Object.fromEntries(["Switch","FlatList","ActivityIndicator","Image","Pressable","ScrollView","Text","TextInput","View"].map(x=>[x,x])),
    Platform:{OS:"web"},Alert:{alert(){}},useWindowDimensions:()=>({width:800,height:800}),StyleSheet:{create:x=>x,absoluteFillObject:{},hairlineWidth:1} };
  if(request === "expo-router")return {Stack:{Screen:"Stack.Screen"},useLocalSearchParams:()=>({id:active.item.id}),useRouter:()=>({push:r=>active.navigation.push(r),back(){}})};
  if(request === "@react-navigation/native")return {useFocusEffect:callback=>react.useEffect(callback,[callback])};
  if(request === "react-native-safe-area-context")return {useSafeAreaInsets:()=>({bottom:0})};
  if(request === "@expo/vector-icons")return {Ionicons:"Ionicons"};
  if(request.endsWith("AppThemeProvider"))return {useAppTheme:()=>({theme:{global:{},semantic:{},structural:{}}})};
  if(request.endsWith("titleDetailPinSnapshot"))return {getTitleDetailPinSnapshot:async()=>{active.reads++;return {item:active.item,context:null,pinnedAt:null};}};
  if(request.endsWith("savedTitlesRepo"))return {deleteSavedTitle:async()=>{},setPersonalRating:async()=>{},updateSavedTitleMetadata:async(id,patch)=>{active.patches.push(patch);active.item={...active.item,...patch};return active.item;}};
  if(request.endsWith("manualContentEntries"))return {isManualContentEditable:async()=>false};
  if(request === "expo-sqlite" || request.endsWith("/db"))throw Error("Personal DB forbidden in local detail UI fixtures");
  if(request.endsWith("titlePinsRepo"))return {setTitlePinState:async()=>{}};
  if(request.includes("tmdbApi"))throw Error("Local detail must never import a provider API");
  return originalLoad.call(this,request,parent,isMain);
};


const {SavedMetadataRefresh}=require('../../../src/components/browsing/SavedMetadataRefresh.tsx');
(async()=>{
 let calls=0,resolve,listener;const aborts=[];
 const service={inspect:async()=>({enabled:true,running:false,checkedAt:0}),subscribe:fn=>{listener=fn;return()=>{listener=null;};},refresh:async(id,signal)=>{calls++;signal.addEventListener('abort',()=>aborts.push(id));return new Promise(r=>resolve=r);}};
 const value=item('audiovisual',null,'movie',[{provider:'tmdb',resourceNamespace:'movie',externalId:'1'}]);
 const h=host(()=>SavedMetadataRefresh({item:value,service}),value);await h.flush();
 const button=()=>nodes(h.tree).find(n=>n.props.accessibilityLabel==='Actualizar metadata');
 button().props.onPress();button().props.onPress();await h.flush();assert.equal(calls,1);assert.ok(text(h.tree).includes('Consultando'));
 resolve({status:'unchanged',checkedAt:100});await h.flush();assert.ok(text(h.tree).includes('Sin cambios'));assert.equal(value.notes,'Personal notes');
 button().props.onPress();await h.flush();resolve({status:'failed',code:'not-found'});await h.flush();assert.ok(text(h.tree).includes('no encontró'));assert.equal(button().props.disabled,false);
 button().props.onPress();await h.flush();h.slots.forEach(slot=>slot?.cleanup?.());assert.deepEqual(aborts,[value.id]);resolve({status:'changed'});await h.flush();assert.equal(listener,null);

 let opens=0,automaticAbort=null,autoListener;const autoService={...service,subscribe:fn=>{autoListener=fn;return()=>{autoListener=null;}},open:async(id,signal)=>{opens++;automaticAbort=signal;return null;}};
 let current={...value};const ah=host(()=>SavedMetadataRefresh({item:current,service:autoService}),current);await ah.flush();assert.equal(opens,1);
 current={...current,notes:'Dirty notes',metadataState:{selection:{updatedAt:10}}};ah.dirty=true;autoListener(value.id);await ah.flush();assert.equal(opens,1,'render/invalidation/source presentation is not a new opening');
 ah.slots.forEach(slot=>slot?.cleanup?.());assert.equal(automaticAbort.aborted,true);
 const nh=host(()=>SavedMetadataRefresh({item:value,service:autoService}),value);await nh.flush();assert.equal(opens,2,'actual remount is evaluated');nh.slots.forEach(slot=>slot?.cleanup?.());
 const Settings=require('../../../app/settings/metadata-refresh.tsx').default;const sh=host(()=>Settings(),value);await sh.flush();
 let input=()=>nodes(sh.tree).find(n=>n.type==='TextInput'),save=()=>nodes(sh.tree).find(n=>n.props.accessibilityLabel==='Guardar configuración');
 assert.equal(input().props.value,'2.5');assert.equal(nodes(sh.tree).find(n=>n.type==='Switch').props.value,false);
 input().props.onChangeText('0');await sh.flush();save().props.onPress();await sh.flush();assert.equal(settingsWrites.length,0);assert.ok(text(sh.tree).includes('positivo'));
 input().props.onChangeText('3,5');await sh.flush();save().props.onPress();await sh.flush();assert.deepEqual(settingsWrites,[{enabled:false,intervalDays:3.5}]);assert.deepEqual(settingsPreference.value.languages,['ja','es']);
 assert.ok(text(sh.tree).includes('políticas de DespuésLaVeo'));assert.ok(text(sh.tree).includes('No son cuotas'));
 sh.slots.forEach(slot=>slot?.cleanup?.());
 console.log('PASS 5.3 real panel hook-host: initial date, manual single click flight/double touch, unchanged/error/retry, retained personal inputs and unmount cancellation. Auto mount vs rerender/unmount, settings hydration/disabled/custom/invalid/save. No browser/device acceptance.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;});

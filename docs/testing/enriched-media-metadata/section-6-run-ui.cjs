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
function nodes(value,result=[]) { if(Array.isArray(value))value.forEach(x=>nodes(x,result)); else if(value && typeof value === "object" && value.props){result.push(value);nodes(value.props.children,result);nodes(value.props.ListHeaderComponent,result);nodes(value.props.ListFooterComponent,result);} return result; }
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



const {UpdatesScreen}=require('../../../app/(tabs)/actualizaciones.tsx');const {LibraryRunHeader}=require('../../../src/components/browsing/LibraryRunHeader.tsx');
(async()=>{let listener=null,starts=0,cancels=0,statusReads=0,resolve;let last=null;const counters={total:150,processed:150,changed:0,unchanged:0,skipped:0,failed:150,cancelled:0,pending:0,omissions:{}};
const service={page:async()=>({events:[]}),subscribeFeed:()=>()=>{},item:async()=>null,status:async()=>{statusReads++;return {latest:last,completedAt:1000}},subscribeRun:fn=>{listener=fn;return()=>listener=null},start:()=>{starts++;last={id:'run',startedAt:2000,finishedAt:null,state:'running',counters:{...counters,processed:0,failed:0,pending:150},errors:[]};return {getSnapshot:()=>last,done:new Promise(r=>resolve=r)};},cancel:()=>cancels++};
const h=host(()=>UpdatesScreen({service}),{});await h.flush();assert.equal(starts,0);const header=()=>nodes(h.tree).find(n=>n.type===LibraryRunHeader);assert.equal(header().props.completedAt,1000);header().props.onStart();header().props.onStart();await h.flush();assert.equal(starts,1);assert.equal(header().props.run.state,'running');header().props.onCancel();assert.equal(cancels,1);
last={...last,state:'cancelled',finishedAt:2500,counters:{...counters,failed:0,cancelled:150}};listener(last);resolve(last);await h.flush();assert.equal(header().props.run.state,'cancelled');assert.equal(header().props.completedAt,1000,'last attempt never replaces prior completion');
const before=statusReads;h.dirty=true;await h.flush();assert.equal(statusReads,before);h.slots.forEach(slot=>slot?.cleanup?.());assert.equal(listener,null);
const props={run:{...last,state:'partial',counters,errors:Array.from({length:100},()=>({code:'server'}))},completedAt:1000,error:null,onStart(){},onCancel(){},onRetry(){}};
let tree=LibraryRunHeader(props);assert.ok(text(tree).replace(/\s+/g,' ').includes('100 detalles de 150'));assert.ok(text(tree).includes('Parcial'));const progress=nodes(tree).find(n=>n.props.accessibilityRole==='progressbar');assert.equal(progress.props.accessibilityValue.now,150);assert.equal(progress.props.accessibilityValue.max,150);
for(const state of ['completed','partial','cancelled','interrupted','running']){tree=LibraryRunHeader({...props,run:{...props.run,state}});assert.ok(nodes(tree).find(n=>n.props.accessibilityLabel===(state==='running'?'Cancelar revisión':'Actualizar biblioteca')));}
tree=LibraryRunHeader({...props,run:null,error:'Error recuperable'});assert.ok(text(tree).includes('sin revisiones'));assert.ok(nodes(tree).find(n=>n.props.accessibilityRole==='alert'));assert.ok(nodes(tree).find(n=>n.props.accessibilityLabel==='Reintentar lectura'));
const reopen=host(()=>UpdatesScreen({service}),{});await reopen.flush();assert.equal(nodes(reopen.tree).find(n=>n.type===LibraryRunHeader).props.run.state,'cancelled');assert.equal(starts,1);reopen.slots.forEach(slot=>slot?.cleanup?.());
console.log('PASS S6.4 actual screen/header: no global start on mount, double tap guard, shared start/cancel, terminal states, independent completion date, accessible counters, 150/100 truncation, recoverable error, remount/read/subscription cleanup/no render polling. Hook-host only.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>Module._load=originalLoad);

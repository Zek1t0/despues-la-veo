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




let preferenceListener,appStateListener;const inheritedLoad=Module._load;
Module._load=function(r,p,m){if(r==='react-native')return {...inheritedLoad.call(this,r,p,m),AppState:{addEventListener:(name,fn)=>{appStateListener=fn;return {remove:()=>appStateListener=null}}}};if(r.endsWith('mediaPreferencesRepo'))return {...inheritedLoad.call(this,r,p,m),subscribeMediaPreferences:fn=>{preferenceListener=fn;return()=>{preferenceListener=null;}}};return inheritedLoad.call(this,r,p,m);};
const {UpdatesScreen}=require('../../../app/(tabs)/actualizaciones.tsx');const {activityRows,activityDay,activityDescription}=require('../../../src/core/libraryActivityPresentation.ts');
(async()=>{let listener,reads=0,starts=0,deleted=false,fail=false;const calls=[];
const reference={provider:'tmdb',resourceNamespace:'movie',externalId:'1'},value=item('audiovisual',null,'movie',[reference]);
const {initialMetadataState}=require('../../../src/core/mediaMetadataState.ts');
value.metadataState={...initialMetadataState(value,[reference]),documents:[{changedAt:1,metadata:{version:1,provenance:{reference,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{canonicalTitle:'Canonical',titles:[{value:'Nombre español',language:'es',script:'Latn',kind:'localized'},{value:'English name',language:'en',script:'Latn',kind:'localized'}]}}}]};const event=(id,origin='personal')=>({id,itemId:value.id,occurredAt:Date.UTC(2026,10,16,2),kind:origin==='metadata'?'metadata':'notes',origin,fields:origin==='metadata'?['synopsis','genres']:['notes'],operationKey:id});
const entries=[{event:event('a'),item:value},{event:event('b','metadata'),item:value}];
const service={status:async()=>({latest:null,completedAt:null}),subscribeRun:()=>()=>{},start:()=>starts++,cancel(){},subscribeFeed:fn=>{listener=fn;return()=>listener=null},item:async()=>deleted?null:value,page:async(filter,cursor)=>{reads++;calls.push([filter,cursor]);if(fail)throw Error('sqlite failed');return {events:cursor?[entries[0]]:filter==='all'?entries:entries.filter(e=>e.event.origin===filter),next:cursor?undefined:{occurredAt:1,eventId:'next'}}}};
const h=host(()=>UpdatesScreen({service}),value);await h.flush();assert.equal(starts,0);assert.equal(h.tree.type,'FlatList');assert.equal(h.tree.props.initialNumToRender,12);assert.ok(h.tree.props.windowSize<=5);assert.equal(h.tree.props.data.filter(r=>r.kind==='event').length,2);
const first=h.tree.props.data.find(r=>r.kind==='event');h.tree.props.renderItem({item:first}).props.onPress();await h.flush();assert.deepEqual(h.navigation[0],{pathname:'/title/[id]',params:{id:value.id}});
const before=reads;h.dirty=true;await h.flush();assert.equal(reads,before,'renders do not query SQLite');
assert.ok(h.tree.props.renderItem({item:first}).props.accessibilityLabel.includes('Nombre español'));const beforeLanguage=reads;
settingsPreference={...settingsPreference,updatedAt:2,value:{...settingsPreference.value,languages:['en','es']}};preferenceListener(settingsPreference);await h.flush();assert.ok(h.tree.props.renderItem({item:first}).props.accessibilityLabel.includes('English name'));assert.equal(reads,beforeLanguage,'language changes only presentation');assert.equal(first.entry.event.itemId,value.id);assert.equal(value.notes,'Personal notes');

h.tree.props.onEndReached();h.tree.props.onEndReached();await h.flush();assert.equal(reads,before+1);assert.equal(h.tree.props.data.filter(r=>r.kind==='event').length,2,'duplicate page identities deduped');
const press=label=>nodes(h.tree).find(n=>n.props.accessibilityLabel===label).props.onPress();press('Metadata');await h.flush();assert.equal(h.tree.props.data.filter(r=>r.kind==='event').length,1);assert.equal(calls.at(-1)[0],'metadata');press('Mi actividad');await h.flush();assert.equal(calls.at(-1)[0],'personal');assert.equal(starts,0);
listener();listener();await h.flush();assert.ok(reads<=before+6,'notifications coalesce bounded reads');
deleted=true;const priorNav=h.navigation.length;const row=h.tree.props.data.find(r=>r.kind==='event');h.tree.props.renderItem({item:row}).props.onPress();await h.flush();assert.equal(h.navigation.length,priorNav,'deleted event cannot navigate');
fail=true;listener();await h.flush();assert.ok(nodes(h.tree).find(n=>n.props.accessibilityLabel==='Reintentar actividad'));fail=false;press('Reintentar actividad');await h.flush();
assert.equal(activityDescription(event('c')),'Nota editada');assert.equal(activityDescription(event('d','metadata')),'Metadata actualizada: sinopsis, géneros');assert.ok(!activityDescription(event('c')).includes('Personal notes'));
const beforeResume=reads;appStateListener('active');await h.flush();assert.equal(reads,beforeResume+1,'foreground resumes refresh local grouping once without HTTP');
const oldTZ=process.env.TZ;try{process.env.TZ='UTC';assert.equal(activityDay(Date.UTC(2026,10,16,2)).key,'2026-11-16');process.env.TZ='America/Argentina/Buenos_Aires';assert.equal(activityDay(Date.UTC(2026,10,16,2)).key,'2026-11-15');assert.equal(activityRows(entries).filter(r=>r.kind==='day').length,1);}finally{if(oldTZ===undefined)delete process.env.TZ;else process.env.TZ=oldTZ;}
h.slots.forEach(slot=>slot?.cleanup?.());assert.equal(listener,null);assert.equal(appStateListener,null);
let complete;const staleService={...service,page:()=>new Promise(resolve=>complete=resolve)};const late=host(()=>UpdatesScreen({service:staleService}),value);await late.flush();late.slots.forEach(slot=>slot?.cleanup?.());late.dirty=false;complete({events:entries});await new Promise(setImmediate);await new Promise(setImmediate);assert.equal(late.dirty,false,'late page cannot update an unmounted screen');

console.log('PASS S6.5 actual FlatList: paged/virtual rows, local day/timezone grouping, filters, deterministic IDs/dedup, no render reads/global start, confirmed-change subscriptions, safe navigation/deleted item, error/retry and cleanup. Hook-host only.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>Module._load=originalLoad);

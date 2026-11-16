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
    return [h.slots[i], next => { h.slots[i]=typeof next === "function" ? next(h.slots[i]) : next; h.updates=(h.updates??0)+1;h.dirty=true; }]; },
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


const {fixture,createV6}=require('./sqlite-fixtures.cjs');
const {evolveDatabaseSchema}=require('../../../src/storage/databaseSchema.ts');
const {selectMetadataSource}=require('../../../src/storage/mediaMetadataRepo.ts');
const {RefreshError}=require('../../../src/application/metadataRefreshError.ts');
const {createMetadataRefreshCoordinator}=require('../../../src/application/metadataRefreshCoordinator.ts');
const {createMetadataRefreshRepository}=require('../../../src/storage/metadataRefreshRepo.ts');
const real={now:Date.now,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout,fetch:global.fetch,window:global.window,navigator:global.navigator,dev:global.__DEV__};
let clock=Date.UTC(2026,10,16),serial=0,http=0,header='60',credentialGeneration=1,credential='configured',token='fixture-token',credentialListener=null;
const timers=new Map(),events=new Map();let reads=0;
global.setTimeout=(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:clock+ms});return id;};global.clearTimeout=id=>timers.delete(id);Date.now=()=>clock;
const fire=async(ms,h)=>{clock+=ms;const due=[...timers].filter(([,t])=>t.at<=clock);for(const [id,t]of due){if(timers.delete(id))t.fn();}if(h)await h.flush();};
const tick=async()=>{for(let i=0;i<20;i++)await new Promise(setImmediate)};
const unmount=h=>{h.slots.forEach(slot=>slot?.cleanup?.());h.dirty=false;};
const button=h=>nodes(h.tree).find(n=>n.props.accessibilityLabel==='Actualizar metadata');
const assertOneTimer=()=>assert.equal(timers.size,1,'only one panel deadline timer');
(async()=>{const f=fixture(),harnessLoad=Module._load;try{
 createV6(f);await evolveDatabaseSchema(f.db,6);
 global.__DEV__=true;global.window={addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener:(name,fn)=>events.get(name)?.delete(fn)};
 Object.defineProperty(global,'navigator',{value:{onLine:true},configurable:true});
 global.fetch=async()=>{http++;return new Response('{}',{status:429,headers:header===null?{}:{'Retry-After':header}})};
 Module._load=function(r,p,m){
  if(r.endsWith('/db'))return {initDb:async()=>f.db};
  if(r==='react-native')return {...harnessLoad.call(this,r,p,m),Platform:{OS:'web'}};
  if(r.endsWith('tmdbCredentialRuntime'))return {tmdbCredentialService:{initialize:async()=>{},resolveToken:async()=>token,getSnapshot:()=>({status:credential,generation:credentialGeneration}),subscribe:fn=>{credentialListener=fn;return()=>{credentialListener=null;}}}};
  return harnessLoad.call(this,r,p,m);
 };
 const {getProductMetadataRefresh}=require('../../../src/application/productMetadataRefresh.ts');
 const product=await getProductMetadataRefresh(),base=product.service;
 const service={...base,inspect:async id=>{reads++;return base.inspect(id);}};
 const {SavedMetadataRefresh}=require('../../../src/components/browsing/SavedMetadataRefresh.tsx');
 let current=await product.repository.read('tmdb');const h=host(()=>SavedMetadataRefresh({item:current,service}),current);await h.flush();
 assert.equal(button(h).props.disabled,false);assert.equal(http,0);
 button(h).props.onPress();await h.flush();assert.equal(http,1);assert.equal(button(h).props.disabled,true);assert.equal((await service.inspect('tmdb')).retryAt,clock+60000);assert.ok(text(h.tree).includes('Próximo intento manual permitido'));assertOneTimer();
 const beforeReads=reads;h.dirty=true;await h.flush();h.dirty=true;await h.flush();assert.equal(reads,beforeReads,'renders do not inspect');assertOneTimer();
 await fire(59999,h);assert.equal(button(h).props.disabled,true);assert.equal(reads,beforeReads);await fire(1,h);assert.equal(button(h).props.disabled,false);assert.equal(reads,beforeReads+1);assert.equal(http,1,'deadline does not perform HTTP');assert.equal(timers.size,0);
 // A later 429 extends the same source deadline; old timer must be replaced, not duplicated.
 await selectMetadataSource('multi',{provider:'tmdb',resourceNamespace:'tv',externalId:'2'},clock++,f.db);
 const regularFetch=global.fetch,pendingResponses=[];
 global.fetch=async()=>{http++;return new Promise(resolve=>pendingResponses.push(resolve));};
 button(h).props.onPress();await h.flush();const concurrent=product.coordinator.refresh('multi');await tick();assert.equal(pendingResponses.length,2);
 pendingResponses[0](new Response('{}',{status:429,headers:{'Retry-After':'60'}}));await h.flush();const originalDeadline=clock+60000;
 pendingResponses[1](new Response('{}',{status:429,headers:{'Retry-After':'180'}}));await concurrent;await h.flush();global.fetch=regularFetch;
 assertOneTimer();assert.equal([...timers.values()][0].at,originalDeadline);
 const afterExtended=http;assert.equal(afterExtended,3);
 await fire(60000,h);assert.equal(clock,originalDeadline);assert.equal(button(h).props.disabled,true);assertOneTimer();assert.equal([...timers.values()][0].at,clock+120000,'new 429 extends deadline and old timer only re-inspects');assert.equal(http,afterExtended);
 await fire(120000,h);assert.equal(button(h).props.disabled,false);assert.equal(http,afterExtended);
 header='120';button(h).props.onPress();await h.flush();assertOneTimer();
 // Connectivity and credentials invalidate status locally and clean/reschedule the one timer.
 navigator.onLine=false;for(const fn of events.get('offline'))fn();await h.flush();assert.equal(button(h).props.disabled,true);assert.ok(text(h.tree).includes('Sin conexión'));assert.equal(timers.size,0);
 navigator.onLine=true;for(const fn of events.get('online'))fn();await h.flush();assertOneTimer();
 credential='not-configured';credentialGeneration++;credentialListener();await h.flush();assert.equal(timers.size,0);assert.equal(button(h).props.disabled,true);
 credential='configured';token='replacement-fixture-token';credentialGeneration++;credentialListener();await h.flush();assertOneTimer();assert.equal(http,afterExtended+1,'availability events perform no HTTP');
 // Change identity while mounted: old timer/subscription cannot touch the new title.
 current=await product.repository.read('kitsu');h.dirty=true;await h.flush();assert.equal(timers.size,0);assert.equal(button(h).props.disabled,false);const afterIdentity=reads;await fire(120000,h);assert.equal(reads,afterIdentity);
 // Change active source on the same multi-provider local title.
 await selectMetadataSource('multi',{provider:'tmdb',resourceNamespace:'tv',externalId:'2'},clock++,f.db);current=await product.repository.read('multi');h.dirty=true;await h.flush();header='120';button(h).props.onPress();await h.flush();assertOneTimer();
 await selectMetadataSource('multi',{provider:'kitsu',resourceNamespace:'anime',externalId:'2'},clock++,f.db);current=await product.repository.read('multi');h.dirty=true;await h.flush();assert.equal(timers.size,0);assert.equal(button(h).props.disabled,false);const afterSource=reads;await fire(120000,h);assert.equal(reads,afterSource);assert.equal(http,afterExtended+2);
 // Unknown/indefinite wait explains the suspension without a date, timer or polling.
 header=null;button(h).props.onPress();await h.flush();assert.equal(http,afterExtended+3);assert.equal(button(h).props.disabled,true);assert.equal((await service.inspect('multi')).retryAt,undefined);assert.ok(text(h.tree).includes('sin fecha conocida'));assert.equal(timers.size,0);const unknownReads=reads;await fire(24*3600000,h);assert.equal(reads,unknownReads);assert.equal(http,afterExtended+3);
 current=await product.repository.read('tmdb');h.dirty=true;await h.flush();header='60';button(h).props.onPress();await h.flush();assertOneTimer();
 unmount(h);assert.equal(timers.size,0);assert.equal(credentialListener,null);assert.ok([...events.values()].every(set=>set.size===0));const updates=h.updates,count=reads;await fire(60000);await tick();assert.equal(reads,count);assert.equal(h.updates,updates,'no updates after unmount');
 // Automatic 15-minute cooldown is not the manual HTTP deadline (real coordinator + SQLite).
 let automaticLoads=0;const cap={fields:[],scope:()=> 'cooldown-test',eligibility:()=>({enabled:true}),load:async()=>{automaticLoads++;throw new RefreshError('rate-limited',60000)}};
 const coordinator=createMetadataRefreshCoordinator({repository:createMetadataRefreshRepository(f.db),bindings:{tmdb:cap,kitsu:cap,mangaupdates:cap},now:()=>clock});
 await coordinator.refresh('tmdb',{automatic:true});assert.equal((await coordinator.inspect('tmdb')).retryAt,clock+60000);await fire(60000);assert.equal((await coordinator.inspect('tmdb')).enabled,true);assert.equal(automaticLoads,1);
 const {createAutomaticMetadataRefresh}=require('../../../src/application/automaticMetadataRefresh.ts');
 const automaticOpen=createAutomaticMetadataRefresh({coordinator,preferences:async()=>({value:{version:1,languages:['es'],hideSensitive:false,autoRefresh:{enabled:true,intervalDays:7}},updatedAt:0}),now:()=>clock,monotonicNow:()=>clock});
 assert.equal(await automaticOpen('tmdb',new AbortController().signal),null,'automatic cooldown still suppresses opening while manual is enabled');assert.equal(automaticLoads,1);
 const untrustedCoordinator=createMetadataRefreshCoordinator({repository:{...createMetadataRefreshRepository(f.db),providerBackoff:async()=>Number.MAX_SAFE_INTEGER},bindings:{tmdb:cap,kitsu:cap,mangaupdates:cap},now:()=>clock});
 const untrusted=await untrustedCoordinator.inspect('tmdb');assert.equal(untrusted.enabled,false);assert.equal(untrusted.retryAt,undefined);assert.ok(untrusted.reason.includes('sin fecha confiable'));
 // Delayed obsolete reads, callback after cleanup and unknown malformed dates cannot schedule timers.
 let pendingResolve,staleListener;
 const staleService={inspect:()=>new Promise(resolve=>pendingResolve=resolve),refresh:async()=>{throw Error('must not fetch')},subscribe:fn=>{staleListener=fn;return()=>{staleListener=null}}};
 current={...current,id:'old-read'};const sh=host(()=>SavedMetadataRefresh({item:current,service:staleService}),current);await sh.flush();const oldResolve=pendingResolve;
 current={...current,id:'new-read'};sh.dirty=true;await sh.flush();pendingResolve({enabled:true,running:false,checkedAt:null});await sh.flush();oldResolve({enabled:false,running:false,checkedAt:null,retryAt:clock+60000});await sh.flush();assert.equal(button(sh).props.disabled,false);assert.equal(timers.size,0);
 staleListener(current.id);await sh.flush();const lateResolve=pendingResolve;unmount(sh);const staleUpdates=sh.updates;lateResolve({enabled:false,running:false,checkedAt:null,retryAt:clock+60000});await tick();assert.equal(timers.size,0);assert.equal(sh.updates,staleUpdates);
 console.log('PASS S5 correction: actual 429 transport -> shared clients/coordinator -> real isolated SQLite -> product inspect -> mounted panel; known deadline/exact expiry/no HTTP, longer deadline, indefinite wait, source/identity switch, unmount/stale reads, credential/network changes, one timer/no render reads and independent automatic cooldown. Hook-host and fake clock/HTTP, no visual acceptance.');
}finally{Module._load=originalLoad;Date.now=real.now;global.setTimeout=real.setTimeout;global.clearTimeout=real.clearTimeout;global.fetch=real.fetch;global.window=real.window;Object.defineProperty(global,'navigator',{value:real.navigator,configurable:true});global.__DEV__=real.dev;f.close();}})().catch(error=>{console.error(error);process.exitCode=1});

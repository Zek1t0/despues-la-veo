const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
let active, theme, canGoBack=true;
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
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request === "react")return react;
  if(request === "react-native")return { ...Object.fromEntries(["FlatList","ActivityIndicator","Image","Pressable","ScrollView","Text","TextInput","View"].map(x=>[x,x])),
    Platform:{OS:"web"},Alert:{alert(){}},useWindowDimensions:()=>({width:800,height:800}),StyleSheet:{create:x=>x,absoluteFillObject:{},hairlineWidth:1} };
  if(request === "expo-router")return {Stack:{Screen:"Stack.Screen"},useLocalSearchParams:()=>({id:active.item.id}),useRouter:()=>({push:r=>active.navigation.push(r),back(){}})};
  if(request === "@react-navigation/native")return {useFocusEffect:callback=>react.useEffect(callback,[callback])};
  if(request === "react-native-safe-area-context")return {useSafeAreaInsets:()=>({bottom:0})};
  if(request === "@expo/vector-icons")return {Ionicons:"Ionicons"};
  if(request.endsWith("AppThemeProvider"))return {useAppTheme:()=>({theme})};
  if(request.endsWith("titleDetailPinSnapshot"))return {getTitleDetailPinSnapshot:async()=>{active.reads++;return {item:active.item,context:null,pinnedAt:null};}};
  if(request.endsWith("savedTitlesRepo"))return {deleteSavedTitle:async()=>{},setPersonalRating:async()=>{},updateSavedTitleMetadata:async(id,patch)=>{active.patches.push(patch);active.item={...active.item,...patch};return active.item;}};
  if(request.endsWith("manualContentEntries"))return {isManualContentEditable:async()=>false};
  if(request.endsWith("/GranularPreview"))return {GranularPreview:"GranularPreview"};
  if(request === "expo-sqlite" || request.endsWith("/db"))throw Error("Personal DB forbidden in local detail UI fixtures");
  if(request.endsWith("titlePinsRepo"))return {setTitlePinState:async()=>{}};
  if(request.includes("tmdbApi"))throw Error("Local detail must never import a provider API");
  return originalLoad.call(this,request,parent,isMain);
};

theme=require('../../../src/theme/resolver.ts').resolveTheme('light','original');
const inherited=Module._load;let preference={value:{version:1,languages:['es'],autoRefresh:{enabled:true,intervalDays:7},hideSensitive:true},updatedAt:1};const listeners=new Set(),writes=[];let deferredPreference=null,raw=[],mode='detail',tagMode='grid',network=0,providerCalls=0;
const oldFetch=global.fetch;global.fetch=async()=>{network++;throw Error('Filtering must never fetch');};
const publish=value=>{preference={...preference,value:{...preference.value,hideSensitive:value},updatedAt:preference.updatedAt+1};for(const fn of listeners)fn(preference);};
Module._load=function(r,p,m){
 if(r.endsWith('mediaPreferencesRepo'))return {getMediaPreferences:async()=>deferredPreference?deferredPreference:preference,subscribeMediaPreferences:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},setMediaHideSensitive:async value=>{writes.push(value);publish(value)}};
 if(r.endsWith('TmdbCredentialProvider'))return {useTmdbCredential:()=>null};
 if(r.endsWith('tmdbApi'))return {searchMulti:async()=>{throw Error('no TMDB')},searchMovies:async()=>{},searchTv:async()=>{}};
 if(r.endsWith('viewPreferencesRepo'))return {getViewPreference:async key=>key==='library.viewMode'||key==='search.viewMode'?mode:key==='tags.viewMode'?tagMode:key==='tags.sort'?'name-asc':key==='library.sort'?'title-asc':'all',setViewPreference:async()=>{}};
 if(r.endsWith('savedTitlesRepo'))return {...inherited.call(this,r,p,m),listSavedTitles:async()=>raw};
 if(r.endsWith('tagScreenSnapshot'))return {getTagScreenSnapshot:async()=>({items:raw,pins:[],context:{contextType:'tag',contextKey:'Review'}})};
 if(r.endsWith('libraryScreenSnapshot'))return {getLibraryScreenSnapshot:async()=>({items:raw,pins:[]})};
 if(r==='react-native')return {...inherited.call(this,r,p,m),Switch:'Switch'};
 if(r==='expo-router'){const old=inherited.call(this,r,p,m);return {...old,Tabs:{Screen:'Tabs.Screen'},useRouter:()=>({canGoBack:()=>canGoBack,replace:r=>active.navigation.push(r),push:r=>active.navigation.push(r),back:()=>active.navigation.push('back')})};}
 return inherited.call(this,r,p,m);
};
const {initialMetadataState}=require('../../../src/core/mediaMetadataState.ts');const {publishLibraryInvalidation}=require('../../../src/storage/libraryInvalidation.ts');
const {SensitiveContentNotice}=require('../../../src/components/browsing/SensitiveContentNotice.tsx');const {MediaPoster}=require('../../../src/components/browsing/MediaPoster.tsx');
const Detail=require('../../../app/title/[id].tsx').default,Library=require('../../../app/(tabs)/libreria.tsx').default,Tags=require('../../../app/(tabs)/etiquetas.tsx').default;
const {SearchScreen}=require('../../../app/(tabs)/buscar.tsx');const Settings=require('../../../app/settings/sensitive-content.tsx').default;
const stop=h=>h.slots.forEach(slot=>slot?.cleanup?.());const list=h=>nodes(h.tree).find(n=>n.type==='FlatList');const notice=h=>nodes(h.tree).find(n=>n.type===SensitiveContentNotice);
const noArt=h=>{assert.ok(!nodes(h.tree).some(n=>n.type===MediaPoster||n.type?.name==='MediaBanner'||n.type?.name==='SavedMetadataRefresh'));assert.ok(!JSON.stringify(h.tree).includes('original.jpg'));};
function make(id,flag){const ref={provider:'kitsu',resourceNamespace:'anime',externalId:id};const base={...item('audiovisual','anime','tv',[ref]),id};return {...base,metadataState:{...initialMetadataState(base,[ref]),documents:[{changedAt:1,metadata:{version:1,provenance:{reference:ref,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{canonicalTitle:'Title '+id,sensitive:flag,posterImages:[{url:'https://media.kitsu.app/anime/poster_images/1/original.jpg',variant:'original'}],bannerImages:[{url:'https://media.kitsu.io/anime/cover_images/1/original.jpg',variant:'original'}]}}}]}};}
(async()=>{raw=[make('1',true),make('2',false),make('3',null),{...item('audiovisual',null,'movie'),id:'manual'}];const original=JSON.stringify(raw);
const prefServices={read:async()=>preference,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
for(mode of ['detail','grid']){publish(true);const bindings={getLibraryScreenSnapshot:async()=>({items:raw,pins:[]}),deleteSavedTitle:async()=>{},upsertSavedTitle:async()=>{throw Error('filter cannot write')},setTitlePinState:async()=>{},getViewPreference:async key=>key==='library.viewMode'?mode:key==='library.sort'?'title-asc':'all',setViewPreference:async()=>{},useFocusEffect:fn=>react.useEffect(fn,[fn]),useRouter:()=>({push(){}}),languagePreferences:prefServices};const h=host(()=>Library({bindings}),raw[0]);await h.flush();assert.equal(list(h).props.data.length,3);assert.ok(!list(h).props.data.some(i=>i.id==='1'));publish(false);await h.flush();assert.equal(list(h).props.data.length,4);stop(h);}
for(tagMode of ['grid','list'])for(mode of ['detail','grid']){publish(true);const h=host(()=>Tags(),raw[0]);await h.flush();const group=list(h).props.data[0];assert.equal(group.count,3);assert.ok(!group.items.some(i=>i.id==='1'));list(h).props.renderItem({item:group}).props.onPress();await h.flush();assert.equal(list(h).props.data.length,3);publish(false);await h.flush();assert.equal(list(h).props.data.length,4);stop(h);}
// Real search hook with a deterministic debounce clock and injected capability.
const realSet=global.setTimeout,realClear=global.clearTimeout;let timer=0;const timers=new Map();global.setTimeout=(fn)=>{timers.set(++timer,fn);return timer};global.clearTimeout=id=>timers.delete(id);
try{for(mode of ['detail','grid']){publish(true);const remote=raw.slice(0,3).map(i=>({reference:i.providerReferences[0],metadata:i.metadataState.documents[0].metadata,displayTitle:i.title,releaseLabel:null,posterUrl:null,description:null,kindLabel:'Anime'}));const category={id:'anime',source:'kitsu',label:'Anime'};const binding={category,capability:{search:async()=>{providerCalls++;return remote}},destination:i=>'/kitsu/anime/'+i.reference.externalId};const h=host(()=>SearchScreen({categories:[category],resolveCategory:()=>binding,initialCategory:'anime',bindings:{getViewPreference:async()=>mode,setViewPreference:async()=>{},openResult(){},languagePreferences:prefServices}}),raw[0]);await h.flush();nodes(h.tree).find(n=>n.type==='TextInput').props.onChangeText('Test');await h.flush();for(const [id,fn]of timers){timers.delete(id);fn();}await h.flush();assert.equal(list(h).props.data.length,2);const calls=providerCalls;publish(false);await h.flush();assert.equal(list(h).props.data.length,3);assert.equal(providerCalls,calls,'filter preference never reissues search');stop(h);}}finally{global.setTimeout=realSet;global.clearTimeout=realClear;}
assert.equal(JSON.stringify(raw),original);assert.equal(network,0);
// A deep-linked saved detail contains no art while preference hydration is pending.
publish(true);let release;deferredPreference=new Promise(resolve=>release=resolve);const h=host(()=>Detail(),raw[0]);await h.flush();assert.ok(notice(h).props.pending);noArt(h);deferredPreference=null;release(preference);await h.flush();assert.ok(notice(h));noArt(h);
let warning=SensitiveContentNotice(notice(h).props);assert.ok(nodes(warning).some(n=>n.props.accessibilityLabel==='Ver contenido'));assert.ok(nodes(warning).some(n=>n.props.accessibilityLabel==='Volver'));
notice(h).props.onReveal();await h.flush();assert.ok(!notice(h));assert.ok(nodes(h.tree).some(n=>n.type===MediaPoster));
const panel=nodes(h.tree).find(n=>n.type?.name==='SavedMetadataRefresh');let opens=0;const panelService={inspect:async()=>({enabled:true,running:false,checkedAt:null}),subscribe:()=>()=>{},refresh:async()=>({status:'unchanged'}),open:async()=>{opens++;return null;}};
const ph=host(()=>panel.type({...panel.props,service:panelService}),h.item);await ph.flush();stop(ph);const ph2=host(()=>panel.type({...panel.props,service:panelService}),h.item);await ph2.flush();assert.equal(opens,1,'visibility remount does not create another automatic opening');stop(ph2);active=h;
const notes=()=>nodes(h.tree).find(n=>n.type==='TextInput'&&n.props.placeholder==='Escribí una nota…');notes().props.onChangeText('Draft stays personal');await h.flush();publish(false);await h.flush();assert.equal(notes().props.value,'Draft stays personal');publish(true);await h.flush();assert.ok(notice(h));noArt(h);notice(h).props.onReveal();await h.flush();assert.equal(notes().props.value,'Draft stays personal');assert.equal(h.patches.length,0);
// Source changes and metadata changes invalidate the local reveal; inactive marks never leak.
const current=h.item,tmdb={provider:'tmdb',resourceNamespace:'movie',externalId:'2'};h.item={...current,providerReferences:[...current.providerReferences,tmdb],metadataState:{...current.metadataState,selection:{reference:tmdb,updatedAt:2}}};active=h;publishLibraryInvalidation([h.item.id]);await h.flush();assert.ok(!notice(h));
h.item={...h.item,metadataState:{...h.item.metadataState,selection:{reference:current.providerReferences[0],updatedAt:3}}};active=h;publishLibraryInvalidation([h.item.id]);await h.flush();assert.ok(notice(h));noArt(h);notice(h).props.onReveal();await h.flush();h.item={...h.item,metadataState:{...h.item.metadataState,documents:h.item.metadataState.documents.map(d=>({...d,changedAt:4}))}};active=h;publishLibraryInvalidation([h.item.id]);await h.flush();assert.ok(notice(h));noArt(h);
notice(h).props.onBack();assert.equal(h.navigation.at(-1),'back');notice(h).props.onReveal();await h.flush();h.item=make('9',true);h.dirty=true;h.render();noArt(h);await h.flush();assert.ok(notice(h));noArt(h);stop(h);
const reopened=host(()=>Detail(),raw[0]);await reopened.flush();assert.ok(notice(reopened));noArt(reopened);canGoBack=false;notice(reopened).props.onBack();assert.equal(reopened.navigation.at(-1),'/(tabs)/libreria');canGoBack=true;stop(reopened);
// Read failures remain guarded; retry hydrates the preference before revealing.
let rejectRead;deferredPreference=new Promise((_,reject)=>rejectRead=reject);const failed=host(()=>Detail(),raw[0]);await failed.flush();rejectRead(Error('storage unavailable'));await failed.flush();assert.ok(notice(failed).props.error);noArt(failed);deferredPreference=null;notice(failed).props.onRetry();await failed.flush();assert.ok(notice(failed));assert.equal(notice(failed).props.error,null);noArt(failed);stop(failed);
for(const scheme of ['light','dark']){theme=require('../../../src/theme/resolver.ts').resolveTheme(scheme,'original');const tree=SensitiveContentNotice({pending:false,error:null,onReveal(){},onBack(){},onRetry(){}});assert.equal(tree.props.style.backgroundColor,theme.global.background);for(const n of nodes(tree).filter(n=>n.type==='Text'))assert.ok(n.props.style.color);assert.equal(nodes(tree).filter(n=>n.props.accessibilityRole==='button').length,2);}
const settings=host(()=>Settings(),raw[0]);await settings.flush();const toggle=()=>nodes(settings.tree).find(n=>n.type==='Switch');toggle().props.onValueChange(false);await settings.flush();assert.equal(toggle().props.value,false);assert.deepEqual(writes,[false]);stop(settings);assert.equal(listeners.size,0);assert.equal(network,0);
console.log('PASS S7 UI: actual Library detail/grid, Tags grid/list and collections, real search debounce/request once across toggles, settings, pending/deep-link gate with no art/auto panel, reveal/back/remount, identity/source/metadata/preference invalidation, draft preserved, no filter HTTP/private mutations. Hook-host only, no visual acceptance.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{Module._load=originalLoad;global.fetch=oldFetch;});

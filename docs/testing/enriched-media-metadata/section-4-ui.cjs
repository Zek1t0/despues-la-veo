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
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request === "react")return react;
  if(request === "react-native")return { ...Object.fromEntries(["FlatList","ActivityIndicator","Image","Pressable","ScrollView","Text","TextInput","View"].map(x=>[x,x])),
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

const wrappedLoad=Module._load;
let preference={value:{version:1,languages:['es','en','ja-Latn'],autoRefresh:{enabled:true,intervalDays:7},hideSensitive:false},updatedAt:1};
const preferenceListeners=new Set(),languageWrites=[];
let detailOwner;
Module._load=function(request,parent,main){
 if(request.endsWith('libraryScreenSnapshot'))return {getLibraryScreenSnapshot:async()=>{throw Error('Use injected isolated library snapshot');}};
 if(request.endsWith('viewPreferencesRepo'))return {getViewPreference:async()=>{throw Error('Use injected preferences');},setViewPreference:async()=>{}};
 if(request.endsWith('mediaPreferencesRepo'))return {
  getMediaPreferences:async()=>preference,
  subscribeMediaPreferences:listener=>{preferenceListeners.add(listener);return()=>preferenceListeners.delete(listener);},
  setMediaLanguages:async languages=>{languageWrites.push(languages);preference={...preference,value:{...preference.value,languages},updatedAt:preference.updatedAt+1};for(const listener of preferenceListeners)listener(preference);},
 };
 if(request.endsWith('mediaMetadataRepo')&&parent.filename.includes('app'))return {selectMetadataSource:async(id,reference)=>{
  const state={...detailOwner.item.metadataState,selection:{reference,updatedAt:10}};
  detailOwner.item={...detailOwner.item,...projectMediaMetadata(state),metadataState:state};
  publishLibraryInvalidation([id]);
 }};
 return wrappedLoad.call(this,request,parent,main);
};
const {projectMediaMetadata}=require('../../../src/core/mediaMetadataState.ts');
const {publishLibraryInvalidation}=require('../../../src/storage/libraryInvalidation.ts');
const Screen=require('../../../app/title/[id].tsx').default;
const {useMediaLanguages}=require('../../../src/components/browsing/useMediaLanguages.ts');
const LanguageSettings=require('../../../app/settings/metadata-languages.tsx').default;
const stopHost=h=>h.slots.forEach(slot=>slot?.cleanup?.());
(async()=>{
 const k={provider:'kitsu',resourceNamespace:'anime',externalId:'1'},t={provider:'tmdb',resourceNamespace:'movie',externalId:'2'};
 const base=item('audiovisual','anime','tv',[k,t]);
 const snap={...base,year:2000,posterUrl:null,overview:'Historical',voteAverage:null,genres:[]};
 const doc=(ref,title,english)=>({metadata:{version:1,provenance:{reference:ref,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{canonicalTitle:title,titles:[{value:english,language:'en',script:null,kind:'localized'}]}},changedAt:1});
 const state={version:1,baseline:{snapshot:snap,reference:k,updatedAt:1},selection:{reference:k,updatedAt:1},documents:[doc(k,'Kitsu Canon','English Kitsu'),doc(t,'TMDB Canon','English TMDB')]};
 const h=host(Screen,{...base,...projectMediaMetadata(state),metadataState:state});detailOwner=h;await h.flush();
 assert.ok(text(h.tree).includes('English Kitsu'),'default es absent falls back to en in real detail');
 const notes=()=>nodes(h.tree).find(n=>n.type==='TextInput'&&n.props.placeholder==='Escribí una nota…');
 notes().props.onChangeText('Unsaved draft');await h.flush();
 const selector=nodes(h.tree).find(n=>n.type?.name==='MetadataSourceSelector');assert.ok(selector);
 const sh=host(()=>selector.type(selector.props),h.item);await sh.flush();
 const option=nodes(sh.tree).find(n=>n.props.accessibilityRole==='radio'&&n.props.accessibilityLabel.startsWith('TMDB'));
 active=h;option.props.onPress();await h.flush();await sh.flush();
 assert.ok(text(h.tree).includes('English TMDB'));assert.equal(notes().props.value,'Unsaved draft','actual mounted detail keeps draft across poscommit source invalidation');
 assert.equal(h.item.updatedAt,2);assert.equal(h.item.personalRating,80);assert.equal(h.patches.length,0);
 preference={...preference,value:{...preference.value,languages:['de']},updatedAt:3};for(const listener of preferenceListeners)listener(preference);await h.flush();
 assert.ok(text(h.tree).includes('TMDB Canon'));assert.equal(notes().props.value,'Unsaved draft','language change retains draft');
 stopHost(h);stopHost(sh);
 // Hook hydration race: new committed preference beats older initial read; unmount suppresses late callbacks.
 let release,notify,unsubscribed=false;
 const services={read:()=>new Promise(resolve=>release=resolve),subscribe:fn=>{notify=fn;return()=>{unsubscribed=true;};}};
 const hook=host(()=>useMediaLanguages(true,services),base);await hook.flush();notify({...preference,updatedAt:20});await hook.flush();
 release({...preference,value:{...preference.value,languages:['fr']},updatedAt:2});await hook.flush();assert.deepEqual(hook.tree.languages,['de']);stopHost(hook);assert.equal(unsubscribed,true);
 preference={...preference,value:{...preference.value,languages:['es','en','ja-Latn']},updatedAt:30};
 const settings=host(LanguageSettings,base);await settings.flush();
 nodes(settings.tree).find(n=>n.props.accessibilityLabel==='Subir en').props.onPress();await settings.flush();
 await nodes(settings.tree).find(n=>n.props.accessibilityLabel==='Guardar idiomas').props.onPress();await settings.flush();assert.deepEqual(languageWrites.at(-1),['en','es','ja-Latn']);
 nodes(settings.tree).find(n=>n.type==='TextInput').props.onChangeText('en');await settings.flush();nodes(settings.tree).find(n=>n.props.accessibilityLabel==='Agregar idioma').props.onPress();await settings.flush();assert.ok(nodes(settings.tree).some(n=>n.props.accessibilityRole==='alert'));stopHost(settings);
 const LibraryScreen=require('../../../app/(tabs)/libreria.tsx').default;
 const raw={...base,...projectMediaMetadata(state),metadataState:state};let written;
 preference={...preference,value:{...preference.value,languages:['en']},updatedAt:40};
 const bindings={getLibraryScreenSnapshot:async()=>({items:[raw],pins:[]}),deleteSavedTitle:async()=>{},upsertSavedTitle:async value=>{written=value;},setTitlePinState:async()=>{},
 getViewPreference:async key=>key==='library.viewMode'?'detail':key==='library.sort'?'title-asc':'all',setViewPreference:async()=>{},
 useFocusEffect:callback=>react.useEffect(callback,[callback]),useRouter:()=>({push(){}}),languagePreferences:{read:async()=>preference,subscribe:listener=>{preferenceListeners.add(listener);return()=>preferenceListeners.delete(listener);}}};
 const library=host(()=>LibraryScreen({bindings}),raw);await library.flush();
 const list=nodes(library.tree).find(n=>n.type==='FlatList');assert.ok(list);const displayed=list.props.data[0];assert.equal(displayed.title,'English Kitsu');
 const row=list.props.renderItem({item:displayed});await nodes(row).find(n=>n.props.accessibilityLabel==='Marcar English Kitsu como terminado').props.onPress();await library.flush();
 assert.equal(written.title,'Kitsu Canon','personal status write never persists translated presentation title');assert.equal(written.resolvedTitle,undefined);assert.equal(written.status,'done');stopHost(library);
 console.log('PASS S4 UI hook-host: actual source selector -> mounted detail invalidation, live language switch and dirty notes preserved, source personals intact, hydration race/unsubscribe, settings reorder/save/duplicate validation. Mock UI/storage binding, no visual acceptance.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
let active;
const {contrastRatio, resolveTheme}=require('../../../src/theme/resolver.ts');
const {APPEARANCE_PALETTE_IDS}=require('../../../src/theme/types.ts');
let theme=resolveTheme('light','original');
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
const platform={OS:"web"};
let viewport={width:800,height:800,fontScale:1};
let queryImageCache=async()=>({});
Module._load=function(request,parent,isMain){
  if(request === "react")return react;
  if(request === "react-native")return { ...Object.fromEntries(["FlatList","ActivityIndicator","Modal","Pressable","ScrollView","Text","TextInput","View"].map(x=>[x,x])),
    Platform:platform,Image:{queryCache:urls=>queryImageCache(urls)},PixelRatio:{get:()=>1},
    AccessibilityInfo:{addEventListener:()=>({remove(){}}),isReduceMotionEnabled:async()=>true},
    Alert:{alert(){}},AppState:{addEventListener:()=>({remove(){}})},useWindowDimensions:()=>viewport,StyleSheet:{create:x=>x,absoluteFillObject:{},hairlineWidth:1} };
  if(request === "expo-router")return {Stack:{Screen:"Stack.Screen"},useFocusEffect:callback=>react.useEffect(callback,[callback]),useLocalSearchParams:()=>({id:active.item.id}),useRouter:()=>({push:r=>active.navigation.push(r),back(){}})};
  if(request === "@react-navigation/native")return {useFocusEffect:callback=>react.useEffect(callback,[callback])};
  if(request === "react-native-safe-area-context")return {useSafeAreaInsets:()=>({bottom:0,left:0,right:0})};
  if(request === "@expo/vector-icons")return {Ionicons:"Ionicons"};
  if(request.endsWith("AppThemeProvider"))return {useAppTheme:()=>({theme})};
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
let readPickerSnapshot=async()=>{throw Error('Use injected isolated library snapshot');};
Module._load=function(request,parent,main){
 if(request.endsWith('libraryScreenSnapshot'))return {getLibraryScreenSnapshot:()=>readPickerSnapshot()};
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
const {legacyMetadataSnapshot,projectMediaMetadata}=require('../../../src/core/mediaMetadataState.ts');
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
 const navigation=[], writes=[], pins=[], deletions=[];
 preference={...preference,value:{...preference.value,languages:['en']},updatedAt:40};
 const bindings={getLibraryScreenSnapshot:async()=>({items:[raw],pins:[]}),deleteSavedTitle:async id=>{deletions.push(id);},upsertSavedTitle:async value=>{written=value;},setTitlePinState:async(...args)=>{pins.push(args);},
 getViewPreference:async key=>key==='library.viewMode'?'detail':key==='library.sort'?'title-asc':'all',setViewPreference:async(key,value)=>{writes.push([key,value]);},
 useFocusEffect:callback=>react.useEffect(callback,[callback]),useRouter:()=>({push:route=>navigation.push(route)}),languagePreferences:{read:async()=>preference,subscribe:listener=>{preferenceListeners.add(listener);return()=>preferenceListeners.delete(listener);}}};
 const library=host(()=>LibraryScreen({bindings}),raw);await library.flush();
 const list=nodes(library.tree).find(n=>n.type==='FlatList');assert.ok(list);const displayed=list.props.data[0];assert.equal(displayed.title,'English Kitsu');
 const getList=()=>nodes(library.tree).find(n=>n.type==='FlatList');
 const panel=()=>nodes(library.tree).find(n=>n.type?.name==='ViewOptionsPanel');
 const section=id=>panel().props.sections.find(group=>group.id===id);
 section('appearance').onSelect('grid');
 section('sort').onSelect('rating-desc');
 section('status').onSelect('dropped');
 nodes(library.tree).find(n=>n.type==='TextInput').props.onChangeText('missing');
 await library.flush();
 assert.equal(getList().props.data.length,0);
 assert.match(text(getList().props.ListEmptyComponent),/No hay coincidencias/);
 nodes(library.tree).find(n=>n.props.label==='Limpiar filtros').props.onPress();
 await library.flush();
 assert.deepEqual(writes,[['library.viewMode','grid'],['library.sort','rating-desc']]);
 assert.equal(section('appearance').selectedId,'grid');
 assert.equal(section('sort').selectedId,'rating-desc');
 const grid=getList().props.renderItem({item:getList().props.data[0]});
 grid.props.onPress();
 assert.deepEqual(navigation[0],{pathname:'/title/[id]',params:{id:raw.id,pinContext:'library'}});
 section('appearance').onSelect('detail');
 await library.flush();
 const row=list.props.renderItem({item:displayed});
 for(const [status, personalRating, expectedState] of [
  ['planned',10,'Planeado'], ['watching',null,'Viendo'], ['done',80,'Terminado'], ['done',100,'Terminado'],
 ]){
  const entry={...displayed,status,personalRating};
  const rendered=list.props.renderItem({item:entry});
  const personalRow=nodes(rendered).find(n=>n.props.children.some(child=>child?.type?.name==='PersonalRatingBadge'));
  const [statePill,badge]=personalRow.props.children;
  assert.equal(statePill.props.text,expectedState);
  assert.equal(personalRow.props.style.flexWrap,'wrap');
  assert.equal(personalRow.props.style.height,undefined);
  const publicLine=nodes(rendered).find(n=>n.type?.name==='PublicRating');
  const parent=nodes(rendered).find(n=>n.props.children.includes(personalRow));
  assert.equal(parent.props.children[parent.props.children.indexOf(personalRow)+1],publicLine);
  for(const scheme of ['light','dark']) for(const palette of APPEARANCE_PALETTE_IDS){
   theme=resolveTheme(scheme,palette);
   const visualBadge=host(()=>badge.type(badge.props),entry);
   await visualBadge.flush();
   if(personalRating===null){
    assert.equal(visualBadge.tree,null);
    continue;
   }
   assert.equal(text(visualBadge.tree),`★ Mi ${personalRating/10},0`);
   const visualState=host(()=>statePill.type(statePill.props),entry);
   await visualState.flush();
   const [geometry,colors]=visualBadge.tree.props.style;
   const {backgroundColor,borderColor,...neutralGeometry}=visualState.tree.props.style;
   assert.deepEqual(geometry,neutralGeometry);
   assert.equal(colors.borderColor,borderColor);
   const badgeText=nodes(visualBadge.tree).find(n=>n.type==='Text');
   const stateText=nodes(visualState.tree).find(n=>n.type==='Text');
   assert.deepEqual(badgeText.props.style,stateText.props.style);
   const tint=colors.backgroundColor;
   const alpha=parseInt(tint.slice(7),16)/255;
   assert.ok(alpha>0&&alpha<0.25);
   const composite='#'+[1,3,5].map(i=>Math.round(
    parseInt(tint.slice(i,i+2),16)*alpha+
    parseInt(theme.global.surface.slice(i,i+2),16)*(1-alpha)
   ).toString(16).padStart(2,'0')).join('');
   assert.ok(contrastRatio(theme.global.textPrimary,composite)>=4.5);
   assert.ok(contrastRatio(theme.global.textPrimary,backgroundColor)>=4.5);
  }
  const noPublic=host(()=>publicLine.type({value:null}),entry);
  await noPublic.flush();
  assert.equal(noPublic.tree,null);
 }
 nodes(row).find(n=>n.props.accessibilityLabel==='Fijar en Biblioteca').props.onPress();
 await library.flush();
 assert.deepEqual(pins[0].slice(0,2),[raw.id,{contextType:'library',contextKey:''}]);
 const originalWindow=global.window;
 try {
  const remove=nodes(row).find(n=>n.props.accessibilityLabel==='Borrar English Kitsu').props.onPress;
  global.window={confirm:()=>false};
  await remove();
  assert.deepEqual(deletions,[]);
  global.window={confirm:()=>true};
  await remove();
  assert.deepEqual(deletions,[raw.id]);
 } finally {
  if(originalWindow===undefined)delete global.window;else global.window=originalWindow;
 }
 await nodes(row).find(n=>n.props.accessibilityLabel==='Marcar English Kitsu como terminado').props.onPress();await library.flush();
 assert.equal(written.title,'Kitsu Canon','personal status write never persists translated presentation title');assert.equal(written.resolvedTitle,undefined);assert.equal(written.status,'done');stopHost(library);
 const Picker=require('../../../app/library-picker.tsx').default;
 const manual={...item('comic','manga',null),id:'manual',title:'Guardado manual',manualIdentity:'manual-id',status:'planned'};
 const sensitive={...raw,id:'sensitive',status:'planned',tags:['Etiqueta privada'],metadataState:{...state,
  baseline:{...state.baseline,snapshot:legacyMetadataSnapshot(state.baseline.snapshot)},
  documents:state.documents.map(document=>document.metadata.provenance.reference===k
   ? {...document,metadata:{...document.metadata,fields:{...document.metadata.fields,sensitive:true}}} : document)}};
 let pending=[];
 readPickerSnapshot=()=>new Promise(resolve=>pending.push(resolve));
 const picker=host(Picker,manual);
 const originalFetch=global.fetch;
 let requests=0;
 global.fetch=()=>{requests++;throw Error('Picker must not use the network');};
 try {
  await picker.flush();
  const named=name=>nodes(picker.tree).filter(node=>node.type?.name===name);
  const action=label=>named('PickerAction').find(node=>node.props.label===label);
  const cards=()=>named('CandidateCard');
  assert.equal(cards().length,0);
  const longTitle={...manual,id:'long-title',title:'Un título manual muy largo que debe seguir legible al ampliar el texto'};
  pending.shift()({items:[manual,sensitive,longTitle],pins:[]});
  await picker.flush();
  assert.deepEqual(cards().map(node=>node.props.featured),[true,false,false]);
  assert.equal(cards()[0].props.wide,true);
  assert.equal((text(picker.tree).match(/¿Qué veo hoy\?/g)??[]).length,1);
  assert.match(text(picker.tree),/Tu propuesta destacada.*1\s+de\s+3.*Otras propuestas/s);
  assert.ok(nodes(picker.tree).indexOf(action('Sorpréndeme'))>nodes(picker.tree).indexOf(cards()[2]));
  named('PickerAction').find(node=>node.props.accessibilityLabel?.startsWith('Estado:')).props.onPress();
  await picker.flush();
  assert.equal(named('ViewOptionsPanel')[0].props.initialExpandedSection,'status');
  named('ViewOptionsPanel')[0].props.onClose();
  await picker.flush();
  const proposalIds=cards().map(node=>node.props.candidate.item.id);
  cards()[1].props.onPress();
  await picker.flush();
  assert.deepEqual(cards().map(node=>node.props.candidate.item.id),[proposalIds[1],proposalIds[0],proposalIds[2]]);
  assert.match(text(picker.tree),/2\s+de\s+3/);
  viewport={...viewport,fontScale:2};picker.render();
  assert.ok(cards().every(node=>!node.props.wide));
  viewport={...viewport,width:390};picker.render();
  assert.equal(cards()[0].props.stacked,true);
  viewport={...viewport,fontScale:1};picker.render();
  assert.equal(cards()[0].props.stacked,false);
  viewport={...viewport,width:800};picker.render();
  action('Sorpréndeme').props.onPress();
  await picker.flush();
  assert.equal(cards().length,1);
  assert.equal(cards()[0].props.featured,true,'surprise uses the featured daily card');
  assert.doesNotMatch(text(picker.tree),/Otras propuestas/);
  action('Repetir sorpresa').props.onPress();
  await picker.flush();
  assert.equal(cards().length,1);
  action('Volver a las propuestas').props.onPress();
  await picker.flush();
  const manualCard=cards().find(node=>node.props.candidate.item.id==='manual');
  if(!manualCard.props.featured){manualCard.props.onPress();await picker.flush();}
  active=picker;
  cards()[0].props.onPress();
  assert.deepEqual(picker.navigation.at(-1),{pathname:'/title/[id]',params:{id:'manual',pinContext:'library'}});
  preference={...preference,updatedAt:100,value:{...preference.value,hideSensitive:true}};
  for(const listener of preferenceListeners)listener(preference);
  await picker.flush();
  assert.deepEqual(cards().map(node=>node.props.candidate.item.id).sort(),['long-title','manual']);
  const panel=named('ViewOptionsPanel')[0];
  assert.ok(!panel.props.sections.flatMap(group=>group.options).some(option=>option.id==='Etiqueta privada'));
  panel.props.sections.find(group=>group.id==='status').onSelect('done');
  await picker.flush();
  assert.ok(!action('Sorpréndeme'));
  assert.match(text(picker.tree),/Ningún título cumple/);
  action('Limpiar filtros').props.onPress();
  await picker.flush();
  nodes(picker.tree).find(node=>node.type==='TextInput').props.onChangeText('0');
  await picker.flush();
  assert.equal(cards().length,0);
  assert.match(text(picker.tree),/Ingresá minutos enteros positivos/);
  nodes(picker.tree).find(node=>node.type==='TextInput').props.onChangeText('30');
  await picker.flush();
  assert.equal(cards().length,0);
  action('Quitar límite de tiempo').props.onPress();
  await picker.flush();
  assert.equal(cards().length,2);
  publishLibraryInvalidation(['manual']);
  publishLibraryInvalidation(['manual']);
  await picker.flush();
  assert.equal(cards().length,0);
  const [old,current]=pending.splice(0);
  current({items:[],pins:[]});
  old({items:[manual],pins:[]});
  await picker.flush();
  assert.equal(cards().length,0);
  assert.match(text(picker.tree),/No hay títulos visibles/);
  readPickerSnapshot=async()=>{throw Error('Read failed');};
  publishLibraryInvalidation(['manual']);
  await picker.flush();
  assert.match(text(picker.tree),/No se pudo leer la Biblioteca/);
  const withArt={...manual,manualIdentity:undefined,medium:'audiovisual',contentFamily:null,primaryFormat:'movie',
   providerReferences:[t],posterUrl:'https://image.tmdb.org/t/p/w342/cover.jpg'};
  readPickerSnapshot=async()=>({items:[withArt],pins:[]});
  action('Reintentar Biblioteca').props.onPress();
  await picker.flush();
  assert.equal(cards().length,1);
  const candidateNode=cards()[0];
  const candidate=host(()=>candidateNode.type(candidateNode.props),withArt);
  await candidate.flush();
  assert.equal(nodes(candidate.tree).find(node=>node.type?.name==='MediaPoster').props.cacheOnly,true);
  action('Cargar portadas con conexión').props.onPress();
  await picker.flush();
  assert.equal(cards()[0].props.onlineArt,true);
  assert.equal(requests,0);
 } finally {
  stopHost(picker);
  global.fetch=originalFetch;
 }
 const {ViewOptionsPanel}=require('../../../src/components/browsing/ViewOptionsPanel.tsx');
 let selected='', resets=0;
 const groups=[
  {id:'genre',title:'Género',presentation:'compact',selectedId:'',
   options:[{id:'',title:'Cualquiera'},...Array.from({length:25},(_,i)=>({id:String(i),title:'Género '+i}))],onSelect:id=>{selected=id;}},
  {id:'status',title:'Estado',presentation:'compact',selectedId:'planned',
   options:[{id:'planned',title:'Planeado'}],onSelect(){}},
 ];
 const filters=host(()=>ViewOptionsPanel({visible:true,collapsible:true,sections:groups,onClose(){},onReset(){resets++;}}),manual);
 await filters.flush();
 const panelNodes=()=>nodes(filters.tree);
 const toggle=label=>panelNodes().find(n=>n.props.accessibilityLabel===label);
 const options=()=>panelNodes().filter(n=>n.type?.name==='CompactOption');
 assert.equal(options().length,1,'only reset is rendered while all groups are closed');
 toggle('Género: Cualquiera').props.onPress();
 await filters.flush();
 assert.equal(options().length,27);
 const last=options().find(n=>n.props.title==='Género 24');
 last.props.onPress(last.props.id);
 assert.equal(selected,'24');
 toggle('Estado: Planeado').props.onPress();
 await filters.flush();
 assert.equal(options().length,2,'opening the next group collapses the long list');
 options().find(n=>n.props.id==='reset').props.onPress();
 assert.equal(resets,1);
 stopHost(filters);
 const statusFirst=host(()=>ViewOptionsPanel({visible:true,collapsible:true,initialExpandedSection:'status',
  sections:groups,onClose(){}}),manual);
 await statusFirst.flush();
 assert.equal(nodes(statusFirst.tree).find(n=>n.props.accessibilityLabel==='Estado: Planeado').props.accessibilityState.expanded,true);
 assert.equal(nodes(statusFirst.tree).find(n=>n.props.accessibilityLabel==='Género: Cualquiera').props.accessibilityState.expanded,false);
 stopHost(statusFirst);

 const {MediaPoster}=require('../../../src/components/browsing/MediaPoster.tsx');
 const small='https://image.tmdb.org/t/p/w92/cover.jpg';
 const large='https://image.tmdb.org/t/p/w342/cover.jpg';
 const blocked='https://example.invalid/cover.jpg';
 const art={identity:'poster',imageProvider:'tmdb',context:'list',cacheOnly:true,
  metadata:{provenance:{reference:t},fields:{posterImages:[
   {url:small,width:92,variant:'small'},{url:large,width:342,variant:'large'},{url:blocked,width:100,variant:'blocked'},
  ]}}, style:{width:64,height:96}};
 const cacheCalls=[];
 queryImageCache=async urls=>{cacheCalls.push(urls);return {[large]:'disk'};};
 platform.OS='android';
 const poster=host(()=>MediaPoster(art),manual);
 await poster.flush();
 poster.tree.props.onLayout({nativeEvent:{layout:{width:64}}});
 await poster.flush();
 const detailPoster=nodes(poster.tree).find(n=>n.type?.name==='DetailPoster');
 assert.deepEqual(cacheCalls,[[small,large]]);
 assert.equal(detailPoster.props.posterUrl,large,'reuse another admitted variant already cached by Biblioteca');
 assert.equal(detailPoster.props.cacheOnly,true);
 const androidPoster=host(()=>detailPoster.type(detailPoster.props),manual);
 await androidPoster.flush();
 assert.deepEqual(androidPoster.tree.props.source,{uri:large,cache:'only-if-cached'});
 platform.OS='web';
 const webPoster=host(()=>detailPoster.type(detailPoster.props),manual);
 await webPoster.flush();
 assert.equal(webPoster.tree.type.name,'PosterPlaceholder');
 stopHost(poster);
 console.log('PASS UI hook-host: Biblioteca, ficha y selector local; filtros, sorpresa, navegación y descarte de lecturas obsoletas. Sin aceptación visual.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;});

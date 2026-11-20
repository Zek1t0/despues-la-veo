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



let dimensions={width:320,height:700,fontScale:1};const inherited=Module._load;
const Tabs=Object.assign(()=>{}, {Screen:'Tabs.Screen'});
Module._load=function(r,p,m){if(r==='expo-router')return {...inherited.call(this,r,p,m),Tabs};if(r==='react-native')return {...inherited.call(this,r,p,m),useWindowDimensions:()=>dimensions};return inherited.call(this,r,p,m);};
const Layout=require('../../../app/(tabs)/_layout.tsx').default;
for(const width of [320,390,800])for(const fontScale of [1,1.6,2]){
 dimensions={width,height:700,fontScale};const tree=Layout();const names=nodes(tree).filter(n=>n.type==='Tabs.Screen').map(n=>n.props.name);
 assert.deepEqual(names,['libreria','buscar','etiquetas','actualizaciones','ajustes']);
 const options=tree.props.screenOptions({route:{name:'actualizaciones'}});assert.equal(options.tabBarAccessibilityLabel,'Actualizaciones');assert.ok(options.tabBarStyle.height>=58);const label=options.tabBarLabel({color:'theme-token'});assert.equal(text(label),'Actividad');assert.equal(label.props.style.color,'theme-token');assert.equal(label.props.numberOfLines,undefined);assert.equal(label.props.maxFontSizeMultiplier,undefined);
 const icon=options.tabBarIcon({color:'theme-token',focused:true,size:22});assert.equal(icon.props.name,'refresh-circle');
}
console.log('PASS S6.3 actual tabs component: Library first, fifth tab between Tags/Settings, visible accessible labels, themed Ionicons, 320/390/800 widths and 1/1.6/2 font scale without shrinking/capping fonts. Hook-host, no visual acceptance.');
Module._load=originalLoad;

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
  if(request === "react-native")return { ...Object.fromEntries(["ActivityIndicator","Image","Pressable","ScrollView","Text","TextInput","View"].map(x=>[x,x])),
    Platform:{OS:"web"},Alert:{alert(){}},useWindowDimensions:()=>({width:800,height:800}),StyleSheet:{create:x=>x,absoluteFillObject:{},hairlineWidth:1} };
  if(request === "expo-router")return {Stack:{Screen:"Stack.Screen"},useLocalSearchParams:()=>({id:active.item.id}),useRouter:()=>({push:r=>active.navigation.push(r),back(){}})};
  if(request === "@react-navigation/native")return {useFocusEffect:callback=>react.useEffect(callback,[callback])};
  if(request === "react-native-safe-area-context")return {useSafeAreaInsets:()=>({bottom:0})};
  if(request === "@expo/vector-icons")return {Ionicons:"Ionicons"};
  if(request.endsWith("AppThemeProvider"))return {useAppTheme:()=>({theme:{global:{},semantic:{},structural:{}}})};
  if(request.endsWith("titleDetailPinSnapshot"))return {getTitleDetailPinSnapshot:async()=>{active.reads++;return {item:active.item,context:null,pinnedAt:null};}};
  if(request.endsWith("savedTitlesRepo"))return {deleteSavedTitle:async()=>{},setPersonalRating:async()=>{},updateSavedTitleMetadata:async(id,patch)=>{active.patches.push(patch);active.item={...active.item,...patch};return active.item;}};
  if(request.endsWith("titlePinsRepo"))return {setTitlePinState:async()=>{}};
  if(request.includes("tmdbApi"))throw Error("Local detail must never import a provider API");
  return originalLoad.call(this,request,parent,isMain);
};
const Screen=require("../../../app/title/[id].tsx").default;
const {TitleGridCard}=require("../../../src/components/browsing/TitleGridCard.tsx");
const {mediaClassificationLabel,titleStatusLabel}=require("../../../src/core/presentationLabels.ts");
const {savedTitleOpenAccessibilityLabel}=require("../../../src/components/browsing/savedTitleAccessibility.ts");
async function main(){
  const refs=[{provider:"tmdb",resourceNamespace:"movie",externalId:"123"},{provider:"synthetic-test",resourceNamespace:"work",externalId:"a"}];
  for(const value of [item("audiovisual",null,"movie"),item("audiovisual","anime","movie"),item("audiovisual","anime","ova",refs),item("audiovisual","anime",null,refs),
    item("comic","manga",null),item("comic","manhwa","webtoon"),item("comic",null,null),item("literature",null,"novel"),item("literature",null,"light-novel")]){
    const h=host(Screen,value);await h.flush();assert.ok(h.reads>0);
    const chips=nodes(h.tree).filter(x=>typeof x.type === "function" && x.type.name === "Chip");
    assert.equal(chips.find(x=>x.props.active).props.label,value.medium === "audiovisual" ? "Viendo":"Leyendo");
    chips.find(x=>x.props.active).props.onPress(); await h.flush();
    assert.equal(h.patches.at(-1).status,"watching","medium-aware wording preserves the persisted token");
    assert.ok(text(h.tree).includes(mediaClassificationLabel(value)));assert.ok(text(h.tree).includes("2020"));
    assert.ok(text(h.tree).includes(value.medium === "audiovisual" ? "Estreno / inicio":"Inicio / publicación"));
    assert.ok(text(h.tree).includes("Local persisted summary")); assert.ok(text(h.tree).includes("Tu puntuación"));
    const stack=nodes(h.tree).find(x=>x.type === "Stack.Screen");active=h;
    const link=stack.props.options.headerRight();
    if(value.providerReferences.length){assert.ok(link);link.props.onPress();assert.equal(h.navigation[0],"/tmdb/movie/123");assert.equal(value.primaryFormat,h.item.primaryFormat);}
    else {assert.equal(link,null);assert.equal(nodes(h.tree).filter(x=>x.type === "Text" && text(x)==="TMDB").length,0);}
    const grid=host(()=>TitleGridCard({title:value.title,kindLabel:mediaClassificationLabel(value),statusLabel:titleStatusLabel(value.status,value.medium),posterUrl:null,
      accessibilityLabel:savedTitleOpenAccessibilityLabel(value),personalRating:80,isPinned:true,onPress(){}}),value);
    await grid.flush();const label=grid.tree.props.accessibilityLabel;
    assert.equal(label.split(mediaClassificationLabel(value)).length-1,1);
    assert.equal(label.split(titleStatusLabel(value.status,value.medium)).length-1,1);
    assert.equal(label.split("Mi puntuación").length-1,1);
    assert.ok(nodes(grid.tree).some(x=>x.props.importantForAccessibility === "no-hide-descendants"));
    assert.ok(text(grid.tree).includes(titleStatusLabel(value.status,value.medium)));
    const rowLabel=savedTitleOpenAccessibilityLabel(value,true);
    for(const announced of [mediaClassificationLabel(value),titleStatusLabel(value.status,value.medium),"Mi puntuación"]) assert.equal(rowLabel.split(announced).length-1,1);
  }
  const sparse=host(Screen,{...item("comic","manga",null),year:null,posterUrl:null,overview:null,genres:[]});await sparse.flush();assert.ok(text(sparse.tree).includes("Sin fecha"));
  const poster=nodes(sparse.tree).find(x=>typeof x.type==="function" && x.type.name==="LocalPoster");
  const posterHost=host(()=>poster.type({posterUrl:"https://example.invalid/poster.jpg"}),sparse.item);await posterHost.flush();
  assert.equal(posterHost.tree.type,"Image");posterHost.tree.props.onError();await posterHost.flush();
  assert.equal(posterHost.tree.type.name,"PosterPlaceholder");
  const ratingOnly=host(Screen,{...item("audiovisual",null,null),voteAverage:7.5});await ratingOnly.flush();assert.ok(text(ratingOnly.tree).includes("TMDB"));assert.ok(text(ratingOnly.tree).includes("7.5"));
  const ambiguous=host(Screen,item("audiovisual","anime","ova",[refs[0],{...refs[0],resourceNamespace:"tv"}]));await ambiguous.flush();assert.equal(nodes(ambiguous.tree).find(x=>x.type==="Stack.Screen").props.options.headerRight(),null);
  for(const filename of ["app/(tabs)/libreria.tsx","app/(tabs)/etiquetas.tsx"]){
    const source=fs.readFileSync(filename,"utf8");assert.match(source,/accessibilityElementsHidden/);assert.match(source,/statusLabel=\{titleStatusLabel\(item.status, item.medium\)\}/);
    assert.match(source,/importantForAccessibility="no-hide-descendants"/);assert.match(source,/params: \{ id: item.id/);
    assert.match(source,/aria-hidden/);
    assert.match(source,/accessibilityLabel=\{savedTitleOpenAccessibilityLabel\(item, true\)\}/);
  }
  console.log("Section 3 actual local-detail/card hook-host: medium labels, offline metadata, rating applicability, OVA/null TMDB links and accessibility passed.");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;});

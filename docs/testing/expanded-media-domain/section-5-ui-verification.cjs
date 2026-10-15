const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const previousFetch = global.fetch; let networkCalls = 0;
global.fetch = async () => { networkCalls++; throw Error("Review must not request a provider/catalog network"); };
const { DatabaseSync } = require("node:sqlite");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
require.extensions[".css"] = () => {};
let active, productionImports = 0, personalInit = 0, preferencesTouched = 0, credentialMounts = 0;
const opened = [], databases = [];
const previousDev = global.__DEV__, previousFlag = process.env.EXPO_PUBLIC_MEDIA_REVIEW;
const same = (a,b) => a && b && a.length === b.length && a.every((x,i) => Object.is(x,b[i]));
const react = {
  Fragment:"Fragment", createElement(type, props, ...children) { return {type,props:{...props,children}}; },
  createContext(value) { return {Provider:"Context.Provider",value}; }, useContext(context) { return context.value; },
  useState(initial) { const h=active,i=h.cursor++; if(!(i in h.slots))h.slots[i]=typeof initial==="function"?initial():initial;
    return [h.slots[i],next=>{h.slots[i]=typeof next==="function"?next(h.slots[i]):next;h.dirty=true;}]; },
  useRef(initial) { const i=active.cursor++; return active.slots[i]??={current:initial}; },
  useMemo(factory,deps) { const i=active.cursor++,old=active.slots[i]; if(!old||!same(old.deps,deps))active.slots[i]={deps,value:factory()}; return active.slots[i].value; },
  useCallback(fn,deps) { return react.useMemo(()=>fn,deps); },
  useEffect(effect,deps) { const h=active,i=h.cursor++,old=h.slots[i]; if(!old||!same(old.deps,deps)){h.slots[i]={deps,cleanup:old?.cleanup};h.effects.push(()=>{h.slots[i].cleanup?.();h.slots[i].cleanup=effect();});} },
};
function host(render){return {slots:[],cursor:0,effects:[],dirty:true,tree:null,
  render(){active=this;this.cursor=0;this.dirty=false;this.tree=render();this.effects.splice(0).forEach(fn=>fn());},
  async flush(){for(let i=0;i<35;i++){if(this.dirty)this.render();await new Promise(setImmediate);}assert.equal(this.dirty,false);},
  unmount(){this.slots.forEach(slot=>slot?.cleanup?.());},
};}
function nodes(value,result=[]){if(Array.isArray(value))value.forEach(x=>nodes(x,result));else if(value?.props){result.push(value);nodes(value.props.children,result);}return result;}
const text=value=>Array.isArray(value)?value.map(text).join(" "):value?.props?text(value.props.children):typeof value==="string"?value:"";
const theme={global:{},semantic:{},structural:{}};
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==="react")return react;
  if(request==="react/jsx-runtime")return {jsx:(type,props)=>react.createElement(type,props,...[].concat(props.children??[])),jsxs:(type,props)=>react.createElement(type,props,...[].concat(props.children??[])),Fragment:"Fragment"};
  if(request==="react-native")return {...Object.fromEntries(["ActivityIndicator","Image","Pressable","Text","TextInput","ScrollView","View","FlatList"].map(x=>[x,x])),
    Platform:{OS:"web"},Alert:{alert(){}},useColorScheme:()=>"dark",useWindowDimensions:()=>({width:800,height:800}),StyleSheet:{create:x=>x,absoluteFillObject:{}}};
  if(request==="expo-router")return {Stack:{Screen:"Stack.Screen"},Tabs:{Screen:"Tabs.Screen"},useRouter(){throw Error("Review must inject navigation");},useLocalSearchParams(){throw Error("Review must inject params");}};
  if(request==="@react-navigation/native")return {useFocusEffect(){throw Error("Review must inject focus lifecycle");}};
  if(request==="react-native-safe-area-context")return {SafeAreaProvider:"SafeAreaProvider",useSafeAreaInsets:()=>({bottom:0})};
  if(request==="@expo/vector-icons")return {Ionicons:"Ionicons"};
  if(request.endsWith("ProductionRootLayout")){productionImports++;return {default:function ProductionRoot(){return null;}};}
  if(request.endsWith("TmdbCredentialProvider"))return {TmdbCredentialProvider(){credentialMounts++;throw Error("Credential provider mounted");}};
  if(request.endsWith("AppThemeProvider") && (parent.filename.includes(`${require("node:path").sep}app${require("node:path").sep}`)||parent.filename.includes("browsing")))return {useAppTheme:()=>({theme})};
  if(request.endsWith("appearancePreferencesRepo"))return {getAppearancePreference:async()=>{preferencesTouched++;throw Error("Personal theme read");},setAppearancePreference:async()=>{preferencesTouched++;throw Error("Personal theme write");}};
  if(request==="./db"&&parent.filename.includes("storage"))return {initDb:async()=>{personalInit++;throw Error("Personal DB init");}};
  if(request==="expo-sqlite")return {openDatabaseAsync:async name=>{
    opened.push(name);const sqlite=new DatabaseSync(":memory:");databases.push(sqlite);const params=x=>x.length===1&&Array.isArray(x[0])?x[0]:x;
    return {async execAsync(sql){sqlite.exec(sql);},async getFirstAsync(sql,...x){return sqlite.prepare(sql).get(...params(x))??null;},async getAllAsync(sql,...x){return sqlite.prepare(sql).all(...params(x));},
      async runAsync(sql,...x){return {changes:Number(sqlite.prepare(sql).run(...params(x)).changes)};},async withTransactionAsync(fn){sqlite.exec("BEGIN");try{await fn();sqlite.exec("COMMIT");}catch(error){sqlite.exec("ROLLBACK");throw error;}},async closeAsync(){sqlite.close();}};
  },deleteDatabaseAsync:async()=>{}};
  return originalLoad.call(this,request,parent,isMain);
};
global.__DEV__=true;process.env.EXPO_PUBLIC_MEDIA_REVIEW="1";
const Root=require("../../../app/_layout.tsx").default;
const Route=require("../../../app/dev/media-review.tsx").default;
const Library=require("../../../app/(tabs)/libreria.tsx").default;
const Detail=require("../../../app/title/[id].tsx").default;
async function main(){
  for(const development of [false,true])for(const flag of [undefined,"0","1"]){
    global.__DEV__=development;if(flag===undefined)delete process.env.EXPO_PUBLIC_MEDIA_REVIEW;else process.env.EXPO_PUBLIC_MEDIA_REVIEW=flag;
    const imports=productionImports,tree=Root();
    if(development&&flag==="1"){assert.equal(productionImports,imports);assert.equal(tree.type.name,"ReviewRoot");}
    else{assert.equal(productionImports,imports+1);assert.equal(tree.type.name,"ProductionRoot");assert.equal(Route().type,"Text");}
  }
  assert.equal(opened.length,0,"root selection alone does not open either DB");
  global.__DEV__=true;process.env.EXPO_PUBLIC_MEDIA_REVIEW="1";
  const rootElement=Root(),root=host(()=>rootElement.type(rootElement.props));await root.flush();
  const session=root.slots.find(value=>value?.names?.primary);
  assert.ok(session);assert.equal(opened.length,2);assert.notEqual(opened[0],opened[1]);assert.ok(opened.every(name=>name.startsWith("media-review-")));
  const provider=nodes(root.tree).find(node=>typeof node.type==="function"&&node.type.name==="AppThemeProvider");assert.ok(provider);
  const themeHost=host(()=>provider.type(provider.props));await themeHost.flush();
  const context=themeHost.tree.props.value;assert.equal(context.hydrationStatus,"ready");assert.equal(context.effectiveScheme,"dark");
  await context.setScheme("light");await themeHost.flush();assert.equal(themeHost.tree.props.value.effectiveScheme,"light");assert.equal(preferencesTouched,0);
  await session.seed();
  const focus=effect=>react.useEffect(effect,[effect]);let navigation=[];
  const router={push:route=>navigation.push(route),back:()=>navigation.push("back")};
  const libraryBindings={...session.source,useRouter:()=>router,useFocusEffect:focus};
  const library=host(()=>Library({bindings:libraryBindings}));await library.flush();
  let list=nodes(library.tree).find(node=>node.type==="FlatList");assert.equal(list.props.data.length,20);
  const manga=list.props.data.find(item=>item.contentFamily==="manga");
  const row=list.props.renderItem({item:manga});const activation=nodes(row).find(node=>node.props.accessibilityLabel?.startsWith("Abrir Manga"));
  assert.ok(activation);activation.props.onPress();assert.equal(navigation.at(-1).params.id,manga.id);
  const detailBindings={...session.source,useParams:()=>({id:manga.id,pinContext:"library"}),useRouter:()=>router,useFocusEffect:focus};
  const detail=host(()=>Detail({bindings:detailBindings}));await detail.flush();assert.ok(text(detail.tree).includes(manga.title));
  const chip=nodes(detail.tree).find(node=>node.type?.name==="Chip"&&node.props.label==="Leyendo");chip.props.onPress();await detail.flush();
  assert.equal((await session.source.getTitleDetailPinSnapshot(manga.id,{})).item.status,"watching");
  const pin=nodes(detail.tree).find(node=>node.type==="Pressable"&&text(node).includes("Fijar en Biblioteca"));pin.props.onPress();await detail.flush();
  assert.ok((await session.source.getTitleDetailPinSnapshot(manga.id,{})).pinnedAt);
  assert.equal(nodes(detail.tree).some(node=>node.type==="Stack.Screen"),false,"no productive remote route/header");
  const panel=nodes(library.tree).find(node=>node.type?.name==="ViewOptionsPanel");
  const appearance=panel.props.sections.find(section=>section.id==="appearance");appearance.onSelect("grid");await library.flush();
  list=nodes(library.tree).find(node=>node.type==="FlatList");const grid=list.props.renderItem({item:manga});assert.equal(grid.type.name,"TitleGridCard");
  assert.ok(grid.props.statusLabel);assert.ok(grid.props.accessibilityLabel.includes(manga.title));
  const before=fs.readFileSync("src/components/search/searchCategories.ts","utf8");assert.equal(before.includes("fixture-review"),false);
  assert.equal(personalInit,0);assert.equal(networkCalls,0);assert.equal(preferencesTouched,0);assert.equal(credentialMounts,0);
  library.unmount();detail.unmount();themeHost.unmount();root.unmount();await session.close();
  console.log("Section 5 actual root/review/theme/library/detail hook-host: opt-in/release selection, two DB opens, zero personal init/preferences/credentials, reused edits/pins/views and no production route leakage passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
  Module._load=originalLoad;global.fetch=previousFetch;global.__DEV__=previousDev;if(previousFlag===undefined)delete process.env.EXPO_PUBLIC_MEDIA_REVIEW;else process.env.EXPO_PUBLIC_MEDIA_REVIEW=previousFlag;
});

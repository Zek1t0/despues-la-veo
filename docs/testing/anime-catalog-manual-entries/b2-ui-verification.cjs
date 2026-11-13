const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const previousFetch = global.fetch; let networkCalls = 0;
global.fetch = async () => { networkCalls++; throw Error("Review must not request a provider/catalog network"); };
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
require.extensions[".css"] = () => {};
let active;
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
Module._load=function(request,parent,main){
  if(request==='react')return react;
  if(request==='react/jsx-runtime')return {jsx:(type,props)=>react.createElement(type,props,...[].concat(props.children??[])),jsxs:(type,props)=>react.createElement(type,props,...[].concat(props.children??[])),Fragment:'Fragment'};
  if(request==='react-native')return Object.fromEntries(['ActivityIndicator','Pressable','ScrollView','Text','TextInput','View'].map(x=>[x,x]));
  if(request==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({bottom:20})};
  if(request.endsWith('AppThemeProvider'))return {useAppTheme:()=>({theme})};
  if(request==='expo-sqlite'||request.endsWith('/db'))throw Error('No database access from form');
  return originalLoad.call(this,request,parent,main);
};
const {ManualEntryForm}=require('../../../src/components/ManualEntryForm.tsx');
const base={id:'existing',title:'Árbol azul',medium:'audiovisual',contentFamily:'anime',primaryFormat:'movie',year:2001,overview:'saved',providerReferences:[],manualIdentity:'token'};
function button(h,label){const node=nodes(h.tree).find(n=>n.type==='Pressable'&&text(n).trim()===label);assert.ok(node,`button ${label}`);return node;}
function field(h,label){const node=nodes(h.tree).find(n=>n.type==='TextInput'&&n.props.accessibilityLabel===label);assert.ok(node);return node;}
async function press(h,label){button(h,label).props.onPress();await h.flush();}
async function input(h,label,value){field(h,label).props.onChangeText(value);await h.flush();}
async function main(){
  let writes=[],navigations=[],inspections=[],canceled=0,fail=false,release;
  const services={get:async()=>base,eligible:async()=>true,list:async()=>[],
    save:async(value,id)=>{writes.push({value,id});if(fail)throw Error('write failed');if(release===null)await new Promise(resolve=>{release=resolve;});return 'created';},
    inspect:id=>inspections.push(id),done:id=>navigations.push(id),cancel:()=>canceled++};
  const h=host(()=>ManualEntryForm({services}));await h.flush();
  await press(h,'Guardar');assert.ok(text(h.tree).includes('Elegí'));assert.equal(writes.length,0);
  await press(h,'Película, serie o video');await press(h,'Guardar');assert.ok(text(h.tree).includes('Ingresá'));
  await input(h,'Título obligatorio','  Draft  ');await input(h,'Año opcional','1.5');await press(h,'Guardar');assert.equal(writes.length,0);
  await input(h,'Año opcional','');await press(h,'Anime');await press(h,'Película');await press(h,'Cómic');
  assert.ok(text(h.tree).includes('no es compatible'));await press(h,'Guardar');assert.equal(writes.length,0);
  // Both old selections remain visible and selected until explicitly revised.
  assert.equal(button(h,'Anime').props.accessibilityState.selected,true);assert.equal(button(h,'Película').props.accessibilityState.selected,true);
  const unspecified=()=>nodes(h.tree).filter(n=>n.type==='Pressable'&&text(n).trim()==='Sin especificar');
  unspecified()[0].props.onPress();await h.flush();unspecified()[1].props.onPress();await h.flush();
  fail=true;await press(h,'Guardar');assert.ok(text(h.tree).includes('write failed'));assert.equal(field(h,'Título obligatorio').props.value,'  Draft  ');
  assert.equal(navigations.length,0);fail=false;release=null;
  const saveButton=button(h,'Guardar');saveButton.props.onPress();saveButton.props.onPress();await h.flush();
  assert.equal(writes.length,2,'one failed attempt + one pending write, double click suppressed');
  assert.equal(button(h,'Guardando…').props.disabled,true);release();await h.flush();assert.deepEqual(navigations,['created']);
  await press(h,'Abrir título guardado');assert.equal(writes.length,2,'confirmed operation cannot insert again');
  h.unmount();
  // Inspection pushes detail over the mounted editor; returning reuses this host/draft.
  const duplicateServices={...services,list:async()=>[base,{...base,id:'provider',providerReferences:[{provider:'tmdb',resourceNamespace:'movie',externalId:'1'}]}]};
  const d=host(()=>ManualEntryForm({services:duplicateServices}));await d.flush();await input(d,'Título obligatorio','  arbol  azul ');await press(d,'Película, serie o video');
  await input(d,'Resumen opcional','Keep my draft');await press(d,'Guardar');
  assert.ok(text(d.tree).includes('parecidos'));const before=writes.length;
  const inspect=nodes(d.tree).filter(n=>n.type==='Pressable'&&text(n).startsWith('Ver Árbol'));assert.equal(inspect.length,2);
  inspect[0].props.onPress();await d.flush();assert.deepEqual(inspections,['existing']);assert.equal(field(d,'Resumen opcional').props.value,'Keep my draft');
  assert.equal(writes.length,before);await press(d,'Crear por separado');assert.equal(writes.length,before+1);
  assert.equal(writes.at(-1).value.title,'arbol  azul');assert.equal(writes.at(-1).value.year,null);d.unmount();
  const e=host(()=>ManualEntryForm({id:'existing',services:duplicateServices}));await e.flush();
  assert.equal(field(e,'Título obligatorio').props.value,base.title);await input(e,'Resumen opcional','Edit');await press(e,'Guardar');
  const editMatches=nodes(e.tree).filter(n=>n.type==='Pressable'&&text(n).startsWith('Ver Árbol'));assert.equal(editMatches.length,1,'exclude current item');
  await press(e,'Guardar cambios igualmente');assert.equal(writes.at(-1).id,'existing');e.unmount();
  const c=host(()=>ManualEntryForm({services}));await c.flush();await input(c,'Título obligatorio','Cancel draft');const count=writes.length;
  await press(c,'Cancelar');await press(c,'Seguir editando');assert.equal(field(c,'Título obligatorio').props.value,'Cancel draft');
  await press(c,'Cancelar');await press(c,'Descartar y salir');assert.equal(canceled,1);assert.equal(writes.length,count);c.unmount();
  const denied=host(()=>ManualEntryForm({id:'provider',services:{...services,eligible:async()=>false}}));await denied.flush();
  assert.equal(nodes(denied.tree).some(n=>n.type==='TextInput'),false);assert.ok(text(denied.tree).includes('no permite'));denied.unmount();
  assert.equal(networkCalls,0);
  const route=fs.readFileSync('app/manual-entry.tsx','utf8');assert.ok(route.includes('router.replace({ pathname: "/title/[id]"'));
  assert.ok(route.includes('router.push({ pathname: "/title/[id]"'));
  console.log('PASS actual shared form hook-host: explicit medium, validation, classification review, failed draft recovery, busy/double submit, confirmed retry, local duplicate inspection/draft/separate/self exclusion, editing, cancel, denied eligibility; zero network/database');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;global.fetch=previousFetch;});

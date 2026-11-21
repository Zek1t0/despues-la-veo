const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {fixture,createV6}=require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema=require('../../../src/storage/databaseSchema.ts');
const manual=require('../../../src/storage/manualContentEntries.ts');
const progress=require('../../../src/storage/personalProgressRepo.ts');
const {getSavedTitleWithReferencesByIdWithDb:read}=require('../../../src/storage/savedTitleStorage.ts');
require('../../../src/storage/db.ts').initDb=async()=>{throw Error('TEST personal DB forbidden')};
global.fetch=()=>{throw Error('TEST network forbidden')};
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,f);
let active;
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
useState(initial){const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=initial;return[h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;h.dirty=true}]},
useRef(initial){const h=active,i=h.cursor++;return h.slots[i]??={current:initial}},
useEffect(effect,deps){const h=active,i=h.cursor++,old=h.slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n]))){h.slots[i]={deps};h.effects.push(effect)}}};
const load=Module._load;Module._load=function(request,parent,main){
 if(request==='react')return react;
 if(request==='react-native')return Object.fromEntries(['ActivityIndicator','Pressable','ScrollView','Text','TextInput','View'].map(n=>[n,n]));
 if(request==='react-native-safe-area-context')return{useSafeAreaInsets:()=>({bottom:0})};
 if(request.endsWith('AppThemeProvider'))return{useAppTheme:()=>({theme:{global:{},semantic:{}}})};
 return load.call(this,request,parent,main);
};
const {ManualEntryForm}=require('../../../src/components/ManualEntryForm.tsx');Module._load=load;
function nodes(v,r=[]){if(Array.isArray(v))v.forEach(x=>nodes(x,r));else if(v?.props){r.push(v);nodes(v.props.children,r)}return r}
function text(v){return Array.isArray(v)?v.map(text).join(' '):v?.props?text(v.props.children):typeof v==='string'?v:''}
function host(services){return{slots:[],cursor:0,effects:[],dirty:true,tree:null,
 async flush(){for(let i=0;i<15;i++){if(this.dirty){active=this;this.cursor=0;this.dirty=false;this.tree=ManualEntryForm({id:'manual',services});this.effects.splice(0).forEach(e=>e())}await new Promise(setImmediate)}assert.equal(this.dirty,false)},
 async click(label){const button=nodes(this.tree).find(n=>n.type==='Pressable'&&text(n)===label);assert.ok(button,label);assert.ok(!button.props.disabled);button.props.onPress();await this.flush()}}}
(async()=>{
 const f=fixture();try{
  createV6(f);await schema.evolveDatabaseSchema(f.db,6);
  const title=await read(f.db,'manual');const initial={medium:title.medium,contentFamily:title.contentFamily,primaryFormat:title.primaryFormat};
  await progress.setPersonalProgress({itemId:'manual',expected:null,expectedClassification:initial,position:{mode:'episode',episode:12}},f.db,100);
  const saved=await progress.getPersonalProgressWithDb(f.db,'manual');let done=0;
  const services={get:id=>read(f.db,id),eligible:async()=>true,list:async()=>[],save:(input,id,decision)=>manual.saveManualContent(input,id,f.db,decision),inspect(){},done(){done++},cancel(){}};
  const h=host(services);await h.flush();await h.click('Cómic');await h.click('Guardar');assert.equal(done,0);assert.ok(text(h.tree).includes('Conservar progreso y guardar'));
  await h.click('Cancelar decisión y seguir editando');assert.equal((await read(f.db,'manual')).medium,'audiovisual');assert.deepEqual(await progress.getPersonalProgressWithDb(f.db,'manual'),saved);
  await h.click('Guardar');await h.click('Conservar progreso y guardar');assert.equal(done,1);assert.equal((await read(f.db,'manual')).medium,'comic');assert.deepEqual(await progress.getPersonalProgressWithDb(f.db,'manual'),saved);
  // An already preserved incompatible cursor does not demand another decision on an unrelated edit.
  const preserved=host(services);await preserved.flush();await preserved.click('Guardar');assert.equal(done,2);
  const input={title:title.title,medium:'audiovisual',contentFamily:null,primaryFormat:null,year:title.year,overview:title.overview};await manual.saveManualContent(input,'manual',f.db);
  const reset=host(services);await reset.flush();await reset.click('Cómic');await reset.click('Guardar');await reset.click('Restablecer progreso y guardar');assert.equal(done,3);assert.equal((await progress.getPersonalProgressWithDb(f.db,'manual')).position,null);
  console.log('PASS manual form hook-host + real TEST SQLite: incompatibility, cancel, preserve, reset and repeated unrelated edit; no tracking UI or personal DB/network.');
 }finally{f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

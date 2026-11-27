const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {fixture,createV6}=require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema=require('../../../src/storage/databaseSchema.ts'),repo=require('../../../src/storage/personalProgressRepo.ts');
const exportsRepo=require('../../../src/storage/libraryBackupExport.ts'),titlesRepo=require('../../../src/storage/savedTitlesRepo.ts');
const {createLibraryBackupV10}=require('../../../src/core/libraryBackupV10.ts');
const appearance={status:'confirmed',preference:require('../../../src/theme/appearancePreference.ts').DEFAULT_APPEARANCE_PREFERENCE};
require('../../../src/storage/db.ts').initDb=async()=>{throw Error('TEST personal DB forbidden')};global.fetch=()=>{throw Error('TEST network forbidden')};
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,f);
let active,db,download,confirmed=true,reserves=0,activations=0,discards=0;const alerts=[];
const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useCallback:fn=>fn,useState(value){const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof value==='function'?value():value;return[h.slots[i],next=>{h.slots[i]=typeof next==='function'?next(h.slots[i]):next;h.dirty=true}]},useRef(value){const h=active,i=h.cursor++;return h.slots[i]??={current:value}},useEffect(effect,deps=[]){const h=active,i=h.cursor++;if(!h.slots[i]){h.slots[i]=true;h.effects.push(()=>{const cleanup=effect();if(cleanup)h.cleanups.push(cleanup)})}}};
const Theme={theme:{global:{textPrimary:'black',textSecondary:'gray'},semantic:{}},backupAvailability:appearance,reserveDeferred(){reserves++;return{}},async activateDeferred(){assert.ok(await repo.getPersonalProgressWithDb(db,'tmdb'));activations++;return{status:'applied'}},discardDeferred(){discards++}};
const load=Module._load;Module._load=function(name,parent,main){
 if(name==='react')return React;if(name==='react-native')return{Text:'Text',View:'View',ScrollView:'ScrollView',Pressable:'Pressable',ActivityIndicator:'Spinner',Platform:{OS:'web'},Alert:{alert:(...args)=>alerts.push(args)}};
 if(name==='@react-navigation/native')return{useFocusEffect:fn=>React.useEffect(fn,[])};
 if(name==='expo-router')return{router:{push(){}}};if(name==='expo-file-system')return{File:class{},Paths:{}};if(name==='expo-sharing'||name==='expo-document-picker')return{};
 if(name.endsWith('AppThemeProvider'))return{useAppTheme:()=>Theme};
 if(name.endsWith('TmdbCredentialProvider'))return{useTmdbCredential:()=>({snapshot:{status:'missing'},retryInitialization:async()=>{}})};
 if(name.endsWith('tmdbCredentialUi'))return{presentTmdbCredentialStatus:()=>({label:'TEST missing'}),TMDB_SETTINGS_ROUTE:'/TEST'};
 if(name.endsWith('storage/libraryBackupExport'))return{getLibraryBackupExportData:availability=>exportsRepo.getLibraryBackupExportData(availability,db)};
 if(name.endsWith('storage/savedTitlesRepo'))return{mergeLibraryBackup:(payload,gen)=>titlesRepo.mergeLibraryBackup(payload,gen,db)};
 if(name.endsWith('progress/ProgressImportReview'))return{ProgressImportReview:'Review'};
 if(name.endsWith('granular/GranularImportReview'))return{GranularImportReview:'GranularReview'};
 if(name.endsWith('progress/exportProgressReport'))return{exportProgressReport:async()=>{}};
 return load.call(this,name,parent,main);
};
const Settings=require('../../../app/(tabs)/ajustes.tsx').default;Module._load=load;
function nodes(v,r=[]){if(Array.isArray(v))v.forEach(x=>nodes(x,r));else if(v?.props){r.push(v);nodes(v.props.children,r)}return r}
function text(v){return Array.isArray(v)?v.map(text).join(' '):v?.props?text(v.props.children):typeof v==='string'?v:''}
function host(){return{slots:[],cursor:0,dirty:true,effects:[],cleanups:[],async flush(){for(let i=0;i<12;i++){if(this.dirty){active=this;this.cursor=0;this.dirty=false;this.tree=Settings();this.effects.splice(0).forEach(fn=>fn())}await new Promise(setImmediate)}},async import(raw){await nodes(this.tree).find(n=>n.type==='input').props.onChange({target:{value:'TEST.json',files:[{text:async()=>JSON.stringify(raw)}]}});await this.flush()},async export(){await nodes(this.tree).find(n=>n.props.label==='Exportar biblioteca').props.onPress();await this.flush()}}}
(async()=>{const a=fixture(),b=fixture();try{
 createV6(a);await schema.evolveDatabaseSchema(a.db,6);await schema.evolveDatabaseSchema(b.db,0);db=b.db;
 const title=await require('../../../src/storage/savedTitleStorage.ts').getSavedTitleWithReferencesByIdWithDb(a.db,'tmdb');
 await repo.setPersonalProgress({itemId:'tmdb',expected:null,expectedClassification:title,position:{mode:'episode',episode:10}},a.db,100);
 const data=await exportsRepo.getLibraryBackupExportData(appearance,a.db),raw=createLibraryBackupV10(data.items,data.pins,appearance,undefined,data);
 global.window={confirm:()=>confirmed};global.document={createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}};const create=URL.createObjectURL,revoke=URL.revokeObjectURL;URL.createObjectURL=blob=>{download=blob;return'TEST'};URL.revokeObjectURL=()=>{};
 const h=host();await h.flush();await h.import(raw);assert.equal(activations,1);assert.equal(reserves,1);assert.ok(nodes(h.tree).some(n=>n.type==='Review'));assert.ok(text(h.tree).includes('Progreso: 1 insertados'));
 await repo.setPersonalProgress({itemId:'tmdb',expected:await repo.getPersonalProgressWithDb(db,'tmdb'),expectedClassification:title,position:{mode:'episode',episode:7}},db,200);
 await h.import(raw);assert.equal(activations,2);assert.ok(text(h.tree).includes('conflictos de progreso pendientes'));assert.equal(nodes(h.tree).find(n=>n.type==='Review').props.report.result.conflicts.length,1);
 await h.export();assert.equal(JSON.parse(await download.text()).version,11);assert.deepEqual(JSON.parse(await download.text()).granular,{enabled:[],groups:[],units:[],decisions:[]});assert.equal(JSON.parse(await download.text()).progress[0].position.episode,7);
 confirmed=false;const before=reserves;await h.import(raw);assert.equal(reserves,before);confirmed=true;
 const transaction=db.withTransactionAsync;db.withTransactionAsync=fn=>transaction(async()=>{await fn();throw Error('TEST rollback')});await h.import(raw);db.withTransactionAsync=transaction;assert.equal(activations,2);assert.ok(discards>0);assert.ok(alerts.length>0);assert.equal((await repo.getPersonalProgressWithDb(db,'tmdb')).position.episode,7);
 h.cleanups.forEach(fn=>fn());await h.flush();assert.ok(!nodes(h.tree).some(n=>n.type==='Review'));
 URL.createObjectURL=create;URL.revokeObjectURL=revoke;delete global.window;delete global.document;
 fs.writeFileSync(__dirname+'/s3-settings-results.json',JSON.stringify({status:'PASS',checks:['real Settings v10 import','appearance activation after commit','rollback discards deferred appearance','conservative conflict outcome','export v11','cancel','focus cleanup']},null,2)+'\n');console.log('PASS actual Settings hook-host with SQLite TEST: v10 import and v11 export, deferred appearance postcommit/rollback, conflict messaging, cancel and report cleanup.');
}finally{a.close();b.close()}})().catch(error=>{console.error(error);process.exitCode=1});

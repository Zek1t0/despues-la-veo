const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,f);
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
let active,platform='web',shared=[],downloaded=[],deleted=0;
const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(value){const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof value==='function'?value():value;return[h.slots[i],next=>{h.slots[i]=typeof next==='function'?next(h.slots[i]):next;h.dirty=true}]},useRef(value){const h=active,i=h.cursor++;return h.slots[i]??={current:value}}};
const Button=()=>null;global.requestAnimationFrame=fn=>{fn();return 1};let network=0;global.fetch=()=>{network++;throw Error('TEST no network')};
const original=Module._load;Module._load=function(name,parent,main){
 if(name==='react')return React;if(name==='react-native')return{View:'View',Text:'Text',Platform:{get OS(){return platform}}};
 if(name.endsWith('AppThemeProvider'))return{useAppTheme:()=>({theme:{global:{textPrimary:'black',textSecondary:'gray',border:'gray'},semantic:{dangerText:'red'}}})};
 if(name.endsWith('organization/OrganizationUI'))return{OrganizationButton:Button};
 if(name==='expo-file-system')return{Paths:{cache:'TEST-cache'},File:class {exists=true;uri='TEST-cache/report';write(value){this.value=value}delete(){deleted++}}};
 if(name==='expo-sharing')return{isAvailableAsync:async()=>true,shareAsync:async(uri)=>shared.push(uri)};
 return original.call(this,name,parent,main);
};
const {ProgressImportReview:Review}=require('../../../src/components/progress/ProgressImportReview.tsx');const {exportProgressReport}=require('../../../src/components/progress/exportProgressReport.ts');Module._load=original;
function nodes(tree,out=[]){if(Array.isArray(tree))tree.forEach(v=>nodes(v,out));else if(tree?.props){out.push(tree);nodes(tree.props.children,out)}return out}
function text(tree){return (Array.isArray(tree)?tree.map(text).join(' '):tree?.props?text(tree.props.children):typeof tree==='string'||typeof tree==='number'?String(tree):'').replace(/\s+/g,' ')}
function host(data){return{slots:[],cursor:0,dirty:true,tree:null,data,async flush(){for(let i=0;i<10;i++){if(this.dirty){active=this;this.cursor=0;this.dirty=false;this.tree=Review(this.data)}await new Promise(setImmediate)}},button(label){const b=nodes(this.tree).find(n=>n.type===Button&&n.props.label===label);assert.ok(b,label);return b},async click(label){const b=this.button(label);assert.ok(!b.props.disabled,label);b.props.onPress();await this.flush()}}}
(async()=>{
 const conflicts=Array.from({length:12},(_,i)=>({itemId:`TEST-${i}`,title:`TEST title ${i}`,identity:'TEST',local:{version:1,itemId:`TEST-${i}`,position:{mode:'episode',episode:7},updatedAt:10},incoming:{version:1,itemId:`TEST-${i}`,position:i===11?null:{mode:'episode',episode:10},updatedAt:20}}));
 let calls=0,hold,release,fail=false,report,closed=false;
 const h=host({report:{importedAt:'TEST',result:{inserted:0,preservedEqual:0,conflicts,invalid:[],failed:[],changedIds:[]}},apply:async candidate=>{calls++;if(hold)await hold;if(fail)throw Error('TEST stale base');return{...candidate.incoming,updatedAt:21}},exportReport:async value=>{report=value},close:()=>closed=true});await h.flush();
 assert.ok(text(h.tree).includes('12 pendientes'));assert.equal(nodes(h.tree).filter(n=>n.type===Button&&n.props.label==='Conservar local').length,10);
 await h.click('Aplicar posición del backup');await h.click('Cancelar aplicación');assert.equal(calls,0);
 await h.click('Aplicar posición del backup');hold=new Promise(resolve=>release=resolve);const confirm=h.button('Confirmar aplicación');confirm.props.onPress();confirm.props.onPress();await h.flush();assert.equal(calls,1);assert.equal(h.button('Confirmar aplicación').props.disabled,true);release();hold=null;await h.flush();assert.ok(text(h.tree).includes('1 aplicados'));
 await h.click('Conservar local');assert.equal(calls,1);assert.ok(text(h.tree).includes('1 locales conservados'));
 await h.click('Más conflictos');assert.ok(text(h.tree).includes('TEST title 11'));assert.ok(text(h.tree).includes('Restablecido'));fail=true;await h.click('Aplicar posición del backup');await h.click('Confirmar aplicación');assert.ok(text(h.tree).includes('TEST stale base'));assert.ok(text(h.tree).includes('10 pendientes'));await h.click('Cancelar aplicación');
 await h.click('Exportar informe completo JSON');assert.equal(report.result.conflicts.length,12);assert.equal(Object.keys(report.resolutions).length,2);
 await h.click('Cerrar informe de progreso');await h.click('Conservar informe');assert.equal(closed,false);await h.click('Cerrar informe de progreso');await h.click('Descartar informe');assert.equal(closed,true);
 const settings=fs.readFileSync('app/(tabs)/ajustes.tsx','utf8');assert.match(settings,/createLibraryBackupV10/);assert.match(settings,/reportActive.current = false; setProgressReport\(null\)/);assert.match(settings,/if \(reportActive.current\) setProgressReport/);assert.match(settings,/informe temporal anterior ser/);assert.match(settings,/conflictos de progreso pendientes/);assert.match(settings,/payload.version === 10/);
 let blob;const create=URL.createObjectURL,revoke=URL.revokeObjectURL;URL.createObjectURL=value=>{blob=value;return'TEST-blob'};URL.revokeObjectURL=()=>{};
 global.document={createElement:()=>({click(){downloaded.push(this.download)},remove(){}}),body:{appendChild(){}}};await exportProgressReport(report);assert.equal(downloaded.length,1);assert.equal(JSON.parse(await blob.text()).result.conflicts.length,12);
 platform='android';await exportProgressReport(report);assert.equal(shared.length,1);assert.equal(deleted,1);delete global.document;URL.createObjectURL=create;URL.revokeObjectURL=revoke;
 assert.equal(network,0);fs.writeFileSync(__dirname+'/s3-ui-results.json',JSON.stringify({status:'PASS',conflicts:12,networkRequests:network,checks:['pagination','cancel','double-send','confirmed-only','stale error','keep local','full JSON','close','replacement notice','focus cleanup','Web download','Android share/cache cleanup']},null,2)+'\n');console.log('PASS S3 review hook-host: 12 conflicts, pagination, confirmation/cancel, double send, stale failure, local decisions, complete export, disposal and local Web/Android transports. No physical acceptance.');
})().catch(error=>{console.error(error);process.exitCode=1});

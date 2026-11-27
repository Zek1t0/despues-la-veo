const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {fixture,createV6}=require('../enriched-media-metadata/sqlite-fixtures.cjs');
const schema=require('../../../src/storage/databaseSchema.ts'),repo=require('../../../src/storage/personalProgressRepo.ts');
const presentation=require('../../../src/core/personalProgressPresentation.ts');
const readTitle=require('../../../src/storage/savedTitleStorage.ts').getSavedTitleWithReferencesByIdWithDb;
require('../../../src/storage/db.ts').initDb=async()=>{throw Error('TEST forbids personal DB')};
let requests=0;global.fetch=()=>{requests++;throw Error('TEST no network')};
global.requestAnimationFrame=fn=>{fn();return 1};global.cancelAnimationFrame=()=>{};
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,f);
let active;
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState(initial){const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return[h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;h.dirty=true}]},
 useRef(initial){const h=active,i=h.cursor++;return h.slots[i]??={current:initial}},
 useEffect(effect,deps){const h=active,i=h.cursor++,old=h.slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n]))){h.slots[i]={deps};h.effects.push(effect)}}};
const theme={global:{textPrimary:'#eee',textSecondary:'#bbb',surface:'#111',border:'#444',accent:'#a0f',surfaceSecondary:'#222'},semantic:{dangerText:'#f99'},structural:{}};
const Button=()=>null,Input=()=>null;
let organizationState,dimensions={width:320,fontScale:1};
const load=Module._load;Module._load=function(request,parent,main){
 if(request==='react')return react;
 if(request==='react-native')return {Text:'Text',View:'View',Pressable:'Pressable',Platform:{OS:'web'},useWindowDimensions:()=>dimensions,StyleSheet:{create:x=>x,absoluteFillObject:{}}};
 if(request==='@expo/vector-icons')return{Ionicons:'Icon'};
 if(request==='expo-router')return{useLocalSearchParams:()=>({id:'TEST-collection'}),useRouter:()=>({push(){}})};
 if(request==='react-native-safe-area-context')return{useSafeAreaInsets:()=>({bottom:0})};
 if(request.endsWith('/useOrganization'))return{useOrganization:()=>organizationState};
 if(request.endsWith('/MediaPoster'))return{MediaPoster:'MediaPoster'};
 if(request.endsWith('/PersonalRatingBadge'))return{PersonalRatingBadge:'PersonalRatingBadge'};
 if(request.endsWith('AppThemeProvider'))return{useAppTheme:()=>({theme})};
 if(request.endsWith('organization/OrganizationUI'))return{OrganizationButton:Button,OrganizationInput:Input,OrganizationPage:'Page',OrganizationCard:'Card',OrganizationText:'Text',OrganizationError:'Error'};
 return load.call(this,request,parent,main);
};
const {PersonalProgressSection:Section}=require('../../../src/components/progress/PersonalProgressSection.tsx');
const {PersonalProgressPosition:Position}=require('../../../src/components/progress/PersonalProgressPosition.tsx');
const {PersonalProgressSummary:Summary}=require('../../../src/components/progress/PersonalProgressSummary.tsx');
const {TitleGridCard}=require('../../../src/components/browsing/TitleGridCard.tsx');
const CollectionScreen=require('../../../app/organize/collections/[id].tsx').default;Module._load=load;
function nodes(v,r=[]){if(Array.isArray(v))v.forEach(x=>nodes(x,r));else if(v?.props){r.push(v);nodes(v.props.children,r)}return r}
function text(v){if(v?.type===Position)return v.props.position?presentation.progressPositionLabel(v.props.position)+' '+text(Position(v.props)):'';return Array.isArray(v)?v.map(text).join(' '):v?.props?text(v.props.children):typeof v==='string'?v:''}
function host(data,render=Section){return{slots:[],cursor:0,effects:[],dirty:true,tree:null,data,
 async flush(){for(let i=0;i<15;i++){if(this.dirty){active=this;this.cursor=0;this.dirty=false;this.tree=render(this.data);this.effects.splice(0).forEach(e=>e())}await new Promise(setImmediate)}assert.equal(this.dirty,false)},
 button(label){const n=nodes(this.tree).find(n=>n.type===Button&&(n.props.label===label||n.props.accessibilityLabel===label));assert.ok(n,label);return n},
 async click(label){const n=this.button(label);assert.ok(!n.props.disabled,`enabled: ${label}`);n.props.onPress();await this.flush()},
 async fill(label,value){const n=nodes(this.tree).find(n=>n.type===Input&&(n.props.label===label||n.props.accessibilityLabel===label));assert.ok(n,label);n.props.onChangeText(value);await this.flush()}}}
const c={medium:'audiovisual',contentFamily:'anime',primaryFormat:'tv'};
const results=[];async function test(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS',name)}
(async()=>{
 const f=fixture();try{
  createV6(f);await schema.evolveDatabaseSchema(f.db,6);const id='kitsu';
  const initialTitle=await readTitle(f.db,id);
  let calls=0,fail=false,hold=null;
  function make(overrides={}){let h;const data={itemId:id,classification:c,progress:null,onRetry:()=>{void repo.getPersonalProgress(id,f.db).then(p=>{h.data.progress=p;h.dirty=true})},
   save:async intent=>{calls++;if(hold)await hold;if(fail)throw Error('TEST write error');return repo.setPersonalProgress(intent,f.db)},onConfirmed:p=>{h.data.progress=p;h.dirty=true},...overrides};h=host(data);return h}
  await test('four variant labels and compact summaries; no percentages',async()=>{
   for(const [position,label,compact]of [[{mode:'episode',episode:245},'Episodio 245','Ep. 245'],[{mode:'season-episode',season:3,episode:7},'Temporada 3 · Episodio 7','T3 · E07'],[{mode:'chapter',chapter:'128.5'},'Capítulo 128.5','Cap. 128.5'],[{mode:'special',label:'Prólogo 🐱'},'Posición especial: «Prólogo 🐱»','Especial: Prólogo 🐱']]){
    const progress={version:1,itemId:id,position,updatedAt:1};const h=make({progress});await h.flush();assert.ok(text(h.tree).includes(label));const summary=Summary({progress});assert.equal(text(summary).trim(),compact);assert.ok(!text(h.tree).includes('%'));
   }
   assert.equal(Summary({progress:null}),null);assert.equal(Summary({progress:{version:1,itemId:id,position:null,updatedAt:1}}),null);
  });
  await test('position composition: split seasons, exact decimals, Unicode and contextual reset',async()=>{
   for(const [position,values]of [[{mode:'season-episode',season:3,episode:12},['TEMPORADA','03','EPISODIO','12']],[{mode:'episode',episode:245},['EPISODIO','245']],[{mode:'chapter',chapter:'999999.999999'},['CAPÍTULO','999999.999999']],[{mode:'special',label:'序章 · Prólogo 🐱'},['POSICIÓN ESPECIAL','序章 · Prólogo 🐱']]]){
    const tree=Position({position});const visible=text(tree);for(const value of values)assert.ok(visible.includes(value),value);
    assert.equal(tree.props.accessibilityLabel,presentation.progressPositionLabel(position));
    for(const node of nodes(tree).filter(n=>n.type==='Text'))assert.equal(node.props.numberOfLines,undefined);
    assert.ok(nodes(tree).some(n=>n.type==='Text'&&n.props.style.fontVariant?.includes('tabular-nums')));
   }
   const h=make({progress:{version:1,itemId:id,position:{mode:'episode',episode:10},updatedAt:1}});await h.flush();
   assert.ok(!nodes(h.tree).some(n=>n.type===Button&&n.props.label==='Restablecer'));assert.equal(h.button('Editar').props.accessibilityLabel,'Editar progreso');
   await h.click('Más opciones de progreso');assert.ok(h.button('Restablecer'));await h.click('Más opciones de progreso');assert.ok(!nodes(h.tree).some(n=>n.type===Button&&n.props.label==='Restablecer'));
  });
  const h=make();await h.flush();
  await test('empty/register exact value; confirmed update and double click lock',async()=>{
   assert.ok(text(h.tree).includes('Sin progreso registrado'));await h.click('Registrar progreso');await h.click('Episodio continuo');await h.fill('Último episodio','245');await h.click('Guardar progreso');assert.equal(h.data.progress.position.episode,245);
   let release;hold=new Promise(resolve=>release=resolve);const action=h.button('Sumar episodio');const before=calls;action.props.onPress();action.props.onPress();await h.flush();assert.equal(calls,before+1);assert.ok(text(h.tree).includes('Episodio 245'));release();hold=null;await h.flush();assert.equal(h.data.progress.position.episode,246);
  });
  await test('editor error retains draft; retry and season within same season',async()=>{
   await h.click('Editar');await h.fill('Último episodio','240');fail=true;await h.click('Guardar progreso');assert.ok(text(h.tree).includes('TEST write error'));assert.equal(h.data.progress.position.episode,246);fail=false;await h.click('Guardar progreso');assert.equal(h.data.progress.position.episode,240);
   await h.click('Editar');await h.click('Temporada y episodio');assert.ok(text(h.tree).includes('requiere una posición nueva'));await h.click('Conservar numeración');await h.click('Temporada y episodio');await h.click('Cambiar numeración');await h.fill('Temporada','3');await h.fill('Último episodio','7');await h.click('Guardar progreso');await h.click('Sumar episodio');assert.deepEqual(h.data.progress.position,{mode:'season-episode',season:3,episode:8});
  });
  await test('obsolete base preserves draft and requires refresh/review',async()=>{
   await h.click('Editar');await h.fill('Último episodio','4');const base=h.data.progress;
   await repo.setPersonalProgress({itemId:id,expected:base,expectedClassification:c,position:{mode:'episode',episode:500}},f.db);
   await h.click('Guardar progreso');assert.ok(text(h.tree).includes('cambió'));assert.equal(nodes(h.tree).find(n=>n.type===Input&&n.props.label==='Último episodio').props.value,'4');
   await h.click('Actualizar progreso');await h.click('Revisé la posición actual; conservar mi borrador');await h.click('Guardar progreso');assert.equal(h.data.progress.position.episode,4);
   await h.click('Editar');h.data.progress={...h.data.progress,updatedAt:h.data.progress.updatedAt+1};h.dirty=true;await h.flush();assert.equal(h.button('Guardar progreso').props.disabled,true);await h.click('Cancelar');await h.click('Descartar borrador');
  });
  await test('reset, Escape/cancel preserve and decimal/special editing offline',async()=>{
   // Reconcile the synthetic notification used above with the actual TEST row.
   h.data.progress=await repo.getPersonalProgress(id,f.db);h.dirty=true;await h.flush();
   await h.click('Más opciones de progreso');await h.click('Restablecer');await h.click('Cancelar restablecimiento');assert.ok(h.data.progress.position);await h.click('Más opciones de progreso');await h.click('Restablecer');await h.click('Confirmar restablecimiento');assert.equal(h.data.progress.position,null);assert.ok(text(h.tree).includes('Progreso restablecido'));
   await h.click('Registrar progreso');h.tree.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});await h.flush();await h.click('Seguir editando');await h.click('Posición especial');await h.fill('Posición especial','  Prólogo 🐱  ');await h.click('Guardar progreso');assert.equal(h.data.progress.position.label,'Prólogo 🐱');assert.ok(!nodes(h.tree).some(n=>n.props.label==='Sumar episodio'));
   const manga=make({itemId:'mu',classification:{medium:'comic',contentFamily:'manga',primaryFormat:null}});await manga.flush();await manga.click('Activar seguimiento manual');await manga.click('Capítulo decimal');await manga.fill('Último capítulo','00128,500');await manga.click('Guardar progreso');assert.equal(manga.data.progress.position.chapter,'128.5');assert.ok(!nodes(manga.tree).some(n=>n.props.label==='Sumar episodio'));
  });
  await test('ordinary movie absent; preserved incompatible, max, loading and read failure',async()=>{
   const movie=make({classification:{medium:'audiovisual',contentFamily:null,primaryFormat:'movie'}});await movie.flush();assert.equal(movie.tree,null);
   const p={version:1,itemId:id,position:{mode:'episode',episode:999999},updatedAt:1};const max=make({progress:p});await max.flush();assert.ok(!nodes(max.tree).some(n=>n.props.label==='Sumar episodio'));
   const incompatible=make({progress:p,classification:{medium:'comic',contentFamily:'manga',primaryFormat:null}});await incompatible.flush();assert.ok(text(incompatible.tree).includes('Episodio 999999'));assert.ok(text(incompatible.tree).includes('sin convertirla'));assert.ok(!nodes(incompatible.tree).some(n=>n.props.label==='Sumar episodio'));
   const unread=make({progress:p,loading:true,readError:Error('read')});await unread.flush();assert.ok(text(unread.tree).includes('Cargando'));assert.equal(unread.button('Editar').props.disabled,true);
  });
  await test('accredited scale only, source/scope/total/mode boundaries',async()=>{
   const ref={provider:'kitsu',resourceNamespace:'anime',externalId:'1'},p={version:1,itemId:id,position:{mode:'episode',episode:8},updatedAt:1};
   const scale={itemId:id,total:12,reference:ref,activeReference:ref,numbering:'continuous-from-one',evidence:'verified-resource-numbering',source:'TEST verified'};
   assert.equal(presentation.progressPositionScale(p),null);assert.equal(presentation.progressPositionScale(p,scale).label,'Posición 8 de 12');
   for(const patch of [{total:0},{total:null},{total:7},{itemId:'other'},{evidence:'episodeCount'},{activeReference:{...ref,externalId:'2'}}])assert.equal(presentation.progressPositionScale(p,{...scale,...patch}),null);
   for(const position of [{mode:'chapter',chapter:'8.5'},{mode:'special',label:'TEST'},{mode:'season-episode',season:1,episode:8}])assert.equal(presentation.progressPositionScale({...p,position},scale),null);
  });
  await test('Library/grid/collection composition and personal fields preserved',async()=>{
   const library=fs.readFileSync('app/(tabs)/libreria.tsx','utf8'),grid=fs.readFileSync('src/components/browsing/TitleGridCard.tsx','utf8'),collection=fs.readFileSync('app/organize/collections/[id].tsx','utf8');
   const p={version:1,itemId:id,position:{mode:"episode",episode:5},updatedAt:1};
   for(const [progress,marked,incompatible,want] of [
     [null,0,false,[]],[null,2,false,['2 unidades marcadas']],
     [p,0,false,['Última posición manual']],[p,2,false,['Última posición manual','2 unidades marcadas']],
     [p,0,true,['Revisar clasificación']],
   ]){
     const card=host({title:'TEST',kindLabel:'Serie',accessibilityLabel:'Abrir TEST',onPress(){},
       progress,granularMarked:marked,progressIncompatible:incompatible},TitleGridCard);
     await card.flush();
     const label=nodes(card.tree).find(node=>node.props?.accessibilityRole==='button')?.props.accessibilityLabel;
     for(const fragment of want)assert.ok(label?.includes(fragment),fragment);
     if(!progress)assert.ok(!label?.includes('Última posición manual'));
     if(!marked)assert.ok(!label?.includes('unidades marcadas'));
   }
   for(const code of [library,collection])assert.match(code,/<PersonalProgressSummary\b/);assert.match(library,/progress=\{progressById\[item.id\]\}/);assert.match(grid,/<\/View>\s*\{\(!!progress\?\.position \|\| granularMarked > 0\) && <View/);
   assert.equal((grid.match(/<Pressable\b/g)||[]).length,1);assert.match(grid,/Última posición manual:/);
   const title=await readTitle(f.db,id);for(const key of ['status','personalRating','updatedAt','notes','tags'])assert.deepEqual(title[key],initialTitle[key]);assert.equal(requests,0);
  });
  await test('session draft recovery and Escape capture before TextInput bubbling',async()=>{
   const current=await repo.getPersonalProgress(id,f.db);const departing=make({progress:current});await departing.flush();await departing.click('Editar');
   await departing.click('Episodio continuo');await departing.click('Cambiar numeración');await departing.fill('Último episodio','123');
   const reopened=make({progress:current});await reopened.flush();assert.equal(nodes(reopened.tree).find(n=>n.type===Input&&n.props.label==='Último episodio').props.value,'123');
   let keyHandler,capture;global.document={addEventListener:(name,fn,c)=>{if(name==='keydown'){keyHandler=fn;capture=c}},removeEventListener(){}};global.window={addEventListener(){},removeEventListener(){}};
   // Trigger the active editor's effect with a confirmation transition.
   await reopened.click('Cancelar');await reopened.click('Seguir editando');assert.equal(capture,true);keyHandler({key:'Escape',preventDefault(){},stopPropagation(){}});await reopened.flush();assert.ok(text(reopened.tree).includes('¿Descartar este borrador'));
   await reopened.click('Descartar borrador');delete global.document;delete global.window;
  });
  await test('real grid and collection trees receive shared progress at narrow/large font layouts',async()=>{
   const item=await readTitle(f.db,id),p=await repo.getPersonalProgress(id,f.db);
   organizationState={snapshot:{items:[item],collections:[{id:'TEST-collection',name:'TEST collection'}],memberships:[{collectionId:'TEST-collection',itemId:id,addedAt:1}],progressById:{[id]:p},preferences:{value:{hideSensitive:false,languages:['es']}}},error:null,busy:false,refresh(){},run(){throw Error('No mutations in render')}};
   for(const width of [320,1280])for(const fontScale of [1,2]){
    dimensions={width,fontScale};const grid=host({title:item.title,kindLabel:'Serie',accessibilityLabel:'Abrir TEST',onPress(){},progress:p,personalRating:85},TitleGridCard);await grid.flush();
    assert.ok(nodes(grid.tree).some(n=>n.type===Summary&&n.props.progress===p));assert.match(grid.tree.props.accessibilityLabel,/Última posición manual:/);assert.equal(nodes(grid.tree).filter(n=>n.type==='Pressable').length,1);
    const collection=host({},CollectionScreen);await collection.flush();assert.ok(nodes(collection.tree).some(n=>n.type===Summary&&n.props.progress===p));assert.ok(nodes(collection.tree).some(n=>n.type===Button&&n.props.label==='Quitar'));
   }
  });
  await test('manual manga/manhwa/manhua create -> local detail -> decimal chapter',async()=>{
   const manual=require('../../../src/storage/manualContentEntries.ts');
   for(const family of ['manga','manhwa','manhua']){
    const itemId=`TEST-manual-${family}`;
    await f.db.withTransactionAsync(()=>manual.createManualContentWithDb(f.db,{title:`TEST ${family}`,medium:'comic',contentFamily:family,primaryFormat:null,year:null,overview:null},()=>itemId,()=>`TEST-portable-${family}`,100));
    const saved=await readTitle(f.db,itemId);
    const chapter=make({itemId,classification:saved});await chapter.flush();await chapter.click('Activar seguimiento manual');await chapter.click('Capítulo decimal');await chapter.fill('Último capítulo','0128,500');await chapter.click('Guardar progreso');
    assert.equal((await repo.getPersonalProgress(itemId,f.db)).position.chapter,'128.5');assert.equal((await readTitle(f.db,itemId)).status,'planned');
   }
   const route=fs.readFileSync('app/(tabs)/libreria.tsx','utf8');assert.match(route,/router.push\("\/manual-entry"\)/);assert.match(fs.readFileSync('app/manual-entry.tsx','utf8'),/saveManualContent\(input, itemId, undefined, decision\)/);
  });
  await test('search platform/development matrix remains unchanged and never requests network',async()=>{
   const {productionSearchCategories}=require('../../../src/components/search/searchCategories.ts');
   for(const [development,platform,expected]of [[true,'web',['movie','tv','anime']],[false,'web',['movie','tv']],[true,'android',['movie','tv','anime','manga','manhwa','manhua']],[false,'android',['movie','tv','manga','manhwa','manhua']],[true,'ios',['movie','tv']],[false,'ios',['movie','tv']]]){
    global.__DEV__=development;assert.deepEqual(productionSearchCategories(platform).map(c=>c.id),expected);
   }
   delete global.__DEV__;assert.equal(requests,0);
  });
  fs.writeFileSync(__dirname+'/s2-results.json',JSON.stringify({status:'PASS',networkRequests:requests,results},null,2)+'\n');
 }finally{f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

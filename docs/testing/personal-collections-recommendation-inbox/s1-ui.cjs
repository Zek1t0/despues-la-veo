const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true},fileName:f}).outputText,f);
let slots=[],cursor=0,snapshot,error=null,busy=false,params={},navigation=[],writes=[];
const frames=new Map();let nextFrame=0;global.requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame};global.cancelAnimationFrame=id=>frames.delete(id);const flushFrames=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())};
let effects=[];const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const keyListeners=new Set();global.document={addEventListener:(name,fn)=>{if(name==='keydown')keyListeners.add(fn)},removeEventListener:(name,fn)=>keyListeners.delete(fn)};
const platform={OS:"web"};
let viewport={width:1280,height:800,fontScale:1},scheme="light",palette="original";
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'Fragment',useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef:initial=>{const i=cursor++;return slots[i]??={current:initial};}};
react.useCallback=(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:fn,deps};return slots[i].value};
react.useEffect=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||!same(old.deps,deps))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()}})};
const load=Module._load;
Module._load=function(request,parent,main){
 if(request==='react')return react;
 if(request==='@expo/vector-icons')return {Ionicons:'Ionicons'};
 if(request==='react-native')return {useWindowDimensions:()=>viewport,Text:'Text',View:'View',Pressable:'Pressable',ScrollView:'ScrollView',TextInput:'TextInput',Image:'Image',PixelRatio:{get:()=>1},Platform:platform,Modal:'Modal',StyleSheet:{create:v=>v,absoluteFillObject:{position:'absolute',top:0,right:0,bottom:0,left:0}}};
 if(request==='expo-router')return {Stack:{Screen:'Stack.Screen'},useLocalSearchParams:()=>params,useRouter:()=>({push:v=>navigation.push(v),replace:v=>navigation.push(v)})};
 if(request==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,bottom:0})};
 if(request.endsWith('AppThemeProvider'))return {useAppTheme:()=>({theme:require('../../../src/theme/resolver.ts').resolveTheme(scheme,palette)})};
 if(request.endsWith('/useOrganization'))return {useOrganization:()=>({snapshot,error,busy,refresh:async()=>{},run:async action=>{try{await action();return true}catch(e){error=e.message;return false}}})};
 if(request.endsWith('/collectionsRepo'))return {createCollection:async(...a)=>writes.push(['create',...a]),editCollection:async(...a)=>writes.push(['edit',...a]),deleteCollection:async(...a)=>writes.push(['delete',...a]),setCollectionMember:async(...a)=>writes.push(['member',...a])};
 if(request==='expo-sqlite'||request.endsWith('/db'))throw Error('Personal DB forbidden in S1 UI TEST');
 return load.call(this,request,parent,main);
};
const nodes=(v,r=[])=>{if(Array.isArray(v))v.forEach(x=>nodes(x,r));else if(v?.props){r.push(v);nodes(v.props.children,r)}return r};
const render=(component,props={})=>{cursor=0;const tree=component(props);effects.splice(0).forEach(fn=>fn());return tree};
const reset=()=>{slots.forEach(slot=>slot?.cleanup?.());effects=[];frames.clear();slots=[];cursor=0;error=null;navigation=[];writes=[];busy=false;};
const button=(tree,label)=>{const found=nodes(tree).find(n=>n.props.accessibilityLabel===label || n.props.label===label);assert.ok(found,label);return found};
const root='../../../';
const Organize=require(root+'app/organize/index.tsx').default;
const List=require(root+'app/organize/collections/index.tsx').default;
const Detail=require(root+'app/organize/collections/[id].tsx').default;
const Title=require(root+'app/organize/collections/title.tsx').default;
const {CollectionOptionsMenu}=require(root+'src/components/organization/CollectionOptionsMenu.tsx');
const {CollectionForm}=require(root+'src/components/organization/CollectionForm.tsx');
const {CollectionCover}=require(root+'src/components/organization/CollectionCover.tsx');
const {initialMetadataState}=require(root+'src/core/mediaMetadataState.ts');
const {DEFAULT_MEDIA_PREFERENCES}=require(root+'src/core/mediaPreferences.ts');
const base={id:'visible',title:'TEST '+('nombre largo '.repeat(12)),medium:'audiovisual',contentFamily:null,primaryFormat:'movie',providerReferences:[],personalRating:80,status:'watching',notes:'TEST note',tags:[],genres:[],year:null,posterUrl:null,overview:null,voteAverage:null,createdAt:1,updatedAt:2};
const ref={provider:'kitsu',resourceNamespace:'anime',externalId:'1'};
const hidden={...base,id:'hidden',title:'TEST HIDDEN',providerReferences:[ref]};hidden.metadataState=initialMetadataState(hidden,[ref]);hidden.metadataState.selection={reference:ref,updatedAt:1};hidden.metadataState.documents=[{metadata:{version:1,provenance:{reference:ref,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{sensitive:true}},changedAt:1}];
snapshot={collections:[{id:'c1',name:'TEST colección extensa '.repeat(8),description:'Descripción extensa '.repeat(12),createdAt:1,updatedAt:1},{id:'empty',name:'Vacía',description:null,createdAt:1,updatedAt:1}],memberships:[{collectionId:'c1',itemId:'hidden',addedAt:10,updatedAt:10},{collectionId:'c1',itemId:'visible',addedAt:1,updatedAt:1}],items:[base,hidden],preferences:{value:{...DEFAULT_MEDIA_PREFERENCES,hideSensitive:true},updatedAt:1}};
const {OrganizationButton,OrganizationText}=require(root+'src/components/organization/OrganizationUI.tsx');
(async()=>{
 reset();const organize=render(Organize);const destinations=nodes(organize).filter(n=>n.props.accessibilityRole==='button');assert.equal(destinations.length,2,'S2 activates Inbox without altering Colecciones');destinations[0].props.onPress();assert.deepEqual(navigation,['/organize/collections']);
 destinations[1].props.onPress();assert.equal(navigation[1],'/organize/recommendations');assert.ok(!nodes(organize).some(n=>n.props.children?.includes('Próximamente')));
 reset();let list=render(List);const cover=nodes(list).find(n=>n.type===CollectionCover);assert.deepEqual(cover.props.members.map(i=>i.id),['visible']);
 const card=nodes(list).find(n=>n.props.accessibilityRole==='button');assert.equal(card.type,'Pressable');assert.equal(card.props.style({pressed:false}).flexDirection,'row');assert.equal(card.props.style({pressed:false}).maxWidth,'49%');assert.ok(!nodes(card.props.children).some(n=>n.props.onPress),'no nested redundant open button');
 card.props.onPress();assert.equal(navigation[0].params.id,'c1');
 assert.ok(nodes(card).some(n=>n.props.numberOfLines===2),'description preview capped at two visual lines');
 const newAction=button(list,'Nueva colección');assert.equal(list.props.headerRight,undefined);assert.equal(newAction.props.icon,'add');assert.equal(!!newAction.props.iconOnly,false);
 newAction.props.onPress();list=render(List);assert.ok(nodes(list).some(n=>n.type===CollectionForm));
 for(const value of [{width:320,height:800,fontScale:1},{width:360,height:800,fontScale:1},{width:400,height:800,fontScale:2},{width:1280,height:800,fontScale:2}]){viewport=value;reset();list=render(List);const card=nodes(list).find(n=>n.props.accessibilityRole==='button');assert.equal(card.props.style({pressed:false}).width,'100%');assert.equal(!!button(list,'Nueva colección').props.iconOnly,false);}
 viewport={width:1280,height:800,fontScale:1};
 reset();params={id:'c1'};let detail=render(Detail);assert.ok(!nodes(detail).some(n=>String(n.props.accessibilityLabel).includes('HIDDEN')));assert.deepEqual(nodes(detail).find(n=>n.type===CollectionCover).props.members.map(i=>i.id),['visible']);
 button(detail,'Título A–Z').props.onPress();detail=render(Detail);assert.equal(button(detail,'Título A–Z').props.selected,true);
 const open=button(detail,`Abrir ${base.title}`),remove=button(detail,`Quitar ${base.title} de la colección`);
 assert.ok(!nodes(open.props.children).includes(remove),'Quitar is outside the navigation hit target');
 remove.props.onPress();await Promise.resolve();assert.deepEqual(writes,[['member','c1','visible',false]]);assert.equal(navigation.length,0,'remove never opens the title');
 open.props.onPress();assert.equal(navigation[0].params.id,'visible');
 assert.equal(button(detail,'Agregar títulos').props.variant,'primary');const options=nodes(detail).find(n=>n.type===CollectionOptionsMenu);assert.ok(options);const mainActions=nodes(detail).find(n=>n.type==='View'&&n.props.children?.some(child=>child?.props?.label==='Agregar títulos'));assert.ok(!nodes(mainActions).some(n=>n.type===CollectionOptionsMenu),'options are separate from main actions');
 assert.ok(!nodes(detail).some(n=>n.props.label==='Eliminar colección'),'delete is contextual');
 options.props.onDelete();detail=render(Detail);assert.ok(button(detail,'Confirmar eliminación de colección'));button(detail,'Cancelar eliminación').props.onPress();detail=render(Detail);assert.ok(!nodes(detail).some(n=>n.props.label==='Confirmar eliminación de colección'));
 button(detail,'Agregar títulos').props.onPress();detail=render(Detail);assert.equal(button(detail,`${base.title} ya pertenece a la colección`).props.disabled,true);
 assert.ok(nodes(detail).some(n=>n.props.context==='list'&&n.props.identity==='visible'),'member and selector use real MediaPoster');
 button(detail,'Buscar títulos de Biblioteca').props.onChangeText('no match');detail=render(Detail);assert.ok(nodes(detail).some(n=>n.props.children?.includes('No hay títulos visibles con esta búsqueda.')));
 reset();params={id:'empty'};detail=render(Detail);assert.ok(nodes(detail).some(n=>n.props.children?.includes('Esta colección está vacía. Agregá títulos desde tu Biblioteca.')));
 reset();params={itemId:'visible'};const title=render(Title);const selected=button(title,`Quitar de ${snapshot.collections[0].name}`);assert.equal(selected.props.accessibilityRole,'checkbox');assert.equal(selected.props.accessibilityState.checked,true);selected.props.onPress();await Promise.resolve();assert.deepEqual(writes,[['member','c1','visible',false]]);assert.equal(button(title,'Añadir a Vacía').props.accessibilityState.checked,false);
 reset();let done=0;const props={busy:false,run:async fn=>{await fn();return true},done:()=>done++};let form=render(CollectionForm,props);
 button(form,'Nombre de la colección').props.onChangeText('TEST nueva');button(form,'Descripción (opcional)').props.onChangeText('TEST descripción');form=render(CollectionForm,props);assert.equal(button(form,'Crear colección').props.variant,'primary');button(form,'Crear colección').props.onPress();await new Promise(setImmediate);assert.equal(writes[0][0],'create');assert.equal(writes[0][2],'TEST nueva');assert.equal(done,1);
 reset();const failed={...props,run:async()=>false};form=render(CollectionForm,failed);button(form,'Nombre de la colección').props.onChangeText('TEST retained');form=render(CollectionForm,failed);button(form,'Crear colección').props.onPress();await new Promise(setImmediate);form=render(CollectionForm,failed);assert.equal(button(form,'Nombre de la colección').props.value,'TEST retained');
 reset();const pendingForm=render(CollectionForm,{...props,busy:true});assert.equal(button(pendingForm,'Guardando…').props.disabled,true);assert.equal(button(pendingForm,'Cancelar').props.disabled,true);
 const {APPEARANCE_PALETTE_IDS}=require(root+'src/theme/types.ts');
 for(scheme of ['light','dark'])for(palette of APPEARANCE_PALETTE_IDS){
  for(viewport of [{width:320,height:800,fontScale:1},{width:320,height:800,fontScale:2},{width:1280,height:800,fontScale:1}]){
   reset();const b=render(OrganizationButton,{label:'TEST acción larga '.repeat(8),onPress(){},variant:'primary'});assert.equal(b.props.style({pressed:false}).minHeight,44);assert.equal(b.props.style({pressed:false}).maxWidth,'100%');b.props.onFocus();const focused=render(OrganizationButton,{label:'TEST',onPress(){}});assert.notEqual(focused.props.style({pressed:false}).borderColor,undefined);
   reset();list=render(List);for(const card of nodes(list).filter(n=>n.props.accessibilityRole==='button')){assert.equal(card.props.style({pressed:false}).flexDirection,'row');assert.ok(card.props.style({pressed:false}).backgroundColor);}
   reset();params={id:'c1'};detail=render(Detail);const header=nodes(detail).find(n=>n.type==='View'&&n.props.children?.some(child=>child?.type===CollectionCover));assert.ok(header);assert.equal(header.props.style.flexDirection,viewport.width/viewport.fontScale<380?'column':'row');
  }
 }
 for(const width of [40,72,96]){reset();const placeholder=render(CollectionCover,{members:[base],width});assert.equal(placeholder.type.name,'PosterPlaceholder');assert.equal(placeholder.props.style.height/placeholder.props.style.width,1.5);}

 const key=(name,shift=false)=>{let prevented=false;for(const listener of [...keyListeners])listener({key:name,shiftKey:shift,preventDefault(){prevented=true},stopPropagation(){}});return prevented};
 for(scheme of ['light','dark'])for(viewport of [{width:320,height:700,fontScale:1},{width:320,height:700,fontScale:2},{width:360,height:700,fontScale:1},{width:400,height:700,fontScale:2},{width:1280,height:900,fontScale:1}]){
  reset();platform.OS='web';let focus='',deletions=0;
  const triggerRef={current:{focus:()=>{focus='trigger'},measureInWindow:fn=>fn(viewport.width-60,70,44,44)}};
  const props={triggerRef,disabled:false,onDelete:()=>{deletions++}};
  const bind=tree=>{button(tree,'Eliminar colección').props.ref.current={focus:()=>{focus='delete'}};button(tree,'Cancelar menú de colección').props.ref.current={focus:()=>{focus='cancel'}}};
  let menu=render(CollectionOptionsMenu,props);assert.equal(nodes(menu).find(n=>n.type==='Modal').props.visible,false);
  const trigger=button(menu,'Más opciones de colección');assert.equal(trigger.props.style({pressed:false}).minHeight,44);assert.equal(trigger.props['aria-haspopup'],'menu');
  trigger.props.onPress();menu=render(CollectionOptionsMenu,props);bind(menu);
  let modal=nodes(menu).find(n=>n.type==='Modal');assert.equal(modal.props.visible,true);modal.props.onShow();assert.equal(focus,'delete');
  const panel=nodes(menu).find(n=>n.props.accessibilityRole==='menu');assert.equal(panel.props.style.position,'absolute');assert.ok(panel.props.style.left>=16);assert.ok(panel.props.style.left+panel.props.style.width<=viewport.width-16);assert.ok(panel.props.style.top>=16);assert.ok(panel.props.style.top+104<=viewport.height-16);
  const deleteAction=button(menu,'Eliminar colección');assert.equal(deleteAction.props.style.backgroundColor,require(root+'src/theme/resolver.ts').resolveTheme(scheme,palette).global.surface,'destructive action has neutral surface');
  assert.equal(key('Tab'),true);assert.equal(focus,'cancel');assert.equal(key('Tab',true),true);assert.equal(focus,'delete');key('End');assert.equal(focus,'cancel');key('Home');assert.equal(focus,'delete');key('ArrowUp');assert.equal(focus,'cancel');key('ArrowDown');assert.equal(focus,'delete');
  button(menu,'Cancelar menú de colección').props.onPress();menu=render(CollectionOptionsMenu,props);flushFrames();assert.equal(nodes(menu).find(n=>n.type==='Modal').props.visible,false);assert.equal(focus,'trigger');assert.equal(deletions,0);
  button(menu,'Más opciones de colección').props.onPress();menu=render(CollectionOptionsMenu,props);bind(menu);assert.equal(key('Escape'),true);menu=render(CollectionOptionsMenu,props);flushFrames();assert.equal(focus,'trigger');assert.equal(nodes(menu).find(n=>n.type==='Modal').props.visible,false);
  button(menu,'Más opciones de colección').props.onPress();menu=render(CollectionOptionsMenu,props);bind(menu);const outside=nodes(menu).find(n=>n.type==='Pressable'&&n.props.accessible===false);outside.props.onPress();menu=render(CollectionOptionsMenu,props);flushFrames();assert.equal(nodes(menu).find(n=>n.type==='Modal').props.visible,false);
  button(menu,'Más opciones de colección').props.onPress();menu=render(CollectionOptionsMenu,props);bind(menu);button(menu,'Eliminar colección').props.onPress();menu=render(CollectionOptionsMenu,props);assert.equal(deletions,1);assert.equal(nodes(menu).find(n=>n.type==='Modal').props.visible,false);
  assert.equal(keyListeners.size,0,'keyboard handler cleaned on close');
  platform.OS='android';button(menu,'Más opciones de colección').props.onPress();menu=render(CollectionOptionsMenu,props);nodes(menu).find(n=>n.type==='Modal').props.onRequestClose();menu=render(CollectionOptionsMenu,props);assert.equal(nodes(menu).find(n=>n.type==='Modal').props.visible,false);platform.OS='web';
  reset();params={id:'c1'};detail=render(Detail);const options=nodes(detail).find(n=>n.type===CollectionOptionsMenu);let restored=0,confirmationFocused=0;
  options.props.triggerRef.current={focus:()=>restored++};options.props.onDelete();detail=render(Detail);button(detail,'Cancelar eliminación').props.buttonRef.current={focus:()=>confirmationFocused++};flushFrames();assert.equal(confirmationFocused,1);
  assert.equal(writes.length,0,'menu selection only asks for confirmation');button(detail,'Cancelar eliminación').props.onPress();detail=render(Detail);flushFrames();assert.equal(restored,1);assert.equal(writes.length,0);
  nodes(detail).find(n=>n.type===CollectionOptionsMenu).props.onDelete();detail=render(Detail);button(detail,'Confirmar eliminación de colección').props.onPress();await new Promise(setImmediate);assert.deepEqual(writes,[['delete','c1']]);assert.deepEqual(navigation,['/organize/collections']);
 }

 reset();viewport={width:320,height:700,fontScale:2};let edgeTree;const edgeTrigger={current:{measureInWindow:fn=>fn(5,650,44,44),focus(){}}};
 edgeTree=render(CollectionOptionsMenu,{triggerRef:edgeTrigger,disabled:true,onDelete(){throw Error('disabled')}});button(edgeTree,'Más opciones de colección').props.onPress();edgeTree=render(CollectionOptionsMenu,{triggerRef:edgeTrigger,disabled:true,onDelete(){}});assert.equal(nodes(edgeTree).find(n=>n.type==='Modal').props.visible,false);
 edgeTree=render(CollectionOptionsMenu,{triggerRef:edgeTrigger,disabled:false,onDelete(){}});button(edgeTree,'Más opciones de colección').props.onPress();edgeTree=render(CollectionOptionsMenu,{triggerRef:edgeTrigger,disabled:false,onDelete(){}});const edgePanel=nodes(edgeTree).find(n=>n.props.accessibilityRole==='menu');assert.equal(edgePanel.props.style.left,16);assert.ok(edgePanel.props.style.top+104<650,'menu opens above a bottom-edge trigger');
 reset();snapshot=undefined;error='TEST lectura fallida';list=render(List);assert.ok(nodes(list).some(n=>n.props.error===error&&n.props.retry));assert.ok(!nodes(list).some(n=>n.props.label==='Nueva colección'));
 console.log('PASS S1 UI: navigation tiles/active S2 Inbox; compact visible creation action above grid; whole horizontal collection cards, 2-column/1-column layouts; descriptions 2 lines; contextual delete confirmation; grouped actions and sort; real poster rows and selector membership indicator; independent Quitar/open events; checkbox memberships; drafts/errors; 320/1280px and 100/200% typography properties across all light/dark palettes. Popover: outside/Escape/cancel/back close, focus return/trap, arrows/Tab/Home/End, no deletion before confirmation, 320/400px and desktop in light/dark. No personal DB. Component harness, not real-browser/Android acceptance.');
})().catch(e=>{console.error(e);process.exitCode=1});

const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true},fileName:f}).outputText,f);
let active,params={},width=1280,fontScale=1,scheme='light',palette='original',snapshot,error=null,busy=false,writes=[],network=0,done=[],fail=false,clock=0,timerId=0;
let tmdbCredential=null;
const platform={OS:'web'};let muLoads=0;
global.alert=()=>{};
const timers=new Map();const nativeTimeout=global.setTimeout,nativeClear=global.clearTimeout;
global.setTimeout=(fn,delay)=>{timers.set(++timerId,{fn,at:clock+delay});return timerId};global.clearTimeout=id=>timers.delete(id);
const advance=ms=>{clock+=ms;for(const [id,t]of [...timers])if(t.at<=clock){timers.delete(id);t.fn()}};
global.fetch=()=>{network++;throw Error('No live network in S2 UI TEST')};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={Fragment:'Fragment',createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState(initial){const h=active,i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return[h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;h.dirty=true}]},
 useRef(initial){const i=active.cursor++;return active.slots[i]??={current:initial}},
 useMemo(fn,deps){const i=active.cursor++,old=active.slots[i];if(!old||!same(old.deps,deps))active.slots[i]={deps,value:fn()};return active.slots[i].value},
 useCallback(fn,deps){return react.useMemo(()=>fn,deps)},
 useEffect(fn,deps){const h=active,i=h.cursor++,old=h.slots[i];if(!old||!same(old.deps,deps)){h.slots[i]={deps,cleanup:old?.cleanup};h.effects.push(()=>{h.slots[i].cleanup?.();h.slots[i].cleanup=fn()})}}
};
function host(render){return{slots:[],cursor:0,effects:[],dirty:true,tree:null,navigation:[],render(){active=this;this.cursor=0;this.dirty=false;this.tree=render();this.effects.splice(0).forEach(f=>f())},async flush(){for(let i=0;i<12;i++){if(this.dirty)this.render();await new Promise(setImmediate)}assert.equal(this.dirty,false)},unmount(){this.slots.forEach(v=>v?.cleanup?.())}}}
const nodes=(v,r=[])=>{if(Array.isArray(v))v.forEach(x=>nodes(x,r));else if(v?.props){r.push(v);nodes(v.props.children,r)}return r};
const text=v=>Array.isArray(v)?v.map(text).join(' ').replace(/\s+/g,' '):v?.props?text(v.props.children):typeof v==='string'||typeof v==='number'?String(v):'';
const button=(tree,label)=>{const n=nodes(tree).find(n=>n.props.label===label||n.props.accessibilityLabel===label||n.type==='Pressable'&&text(n).trim()===label);assert.ok(n,label);return n};
const write=async(...args)=>{if(fail)throw Error('TEST recoverable error');writes.push(args)};
const run=async action=>{try{await action();return true}catch(e){error=e.message;return false}};
const originalLoad=Module._load;
Module._load=function(r,p,m){
 if(r==='react')return react;
 if(r==='react-native')return{...Object.fromEntries(['Text','View','TextInput','Pressable','ScrollView','Image','ActivityIndicator','FlatList'].map(v=>[v,v])),Platform:platform,Linking:{openURL:async()=>{network++;throw Error('No external links')}},Alert:{alert(){}},useWindowDimensions:()=>({width,height:800,fontScale}),StyleSheet:{create:v=>v,absoluteFillObject:{}}};
 if(r==='expo-router')return{Stack:{Screen:'Stack.Screen'},useLocalSearchParams:()=>params,useRouter:()=>({push:v=>active.navigation.push(v),replace:v=>active.navigation.push(v),back:()=>active.navigation.push('back')})};
 if(r==='@expo/vector-icons')return{Ionicons:'Ionicons'};
 if(r==='react-native-safe-area-context')return{useSafeAreaInsets:()=>({top:0,bottom:0})};
 if(r.endsWith('AppThemeProvider'))return{useAppTheme:()=>({theme:require('../../../src/theme/resolver.ts').resolveTheme(scheme,palette)})};
 if(r.endsWith('/useRecommendationInbox'))return{useRecommendationInbox:()=>({snapshot,error,busy,refresh:async()=>{},run})};
 if(r.endsWith('/recommendationInboxRepo'))return{createRecommendation:async(id,c)=>{const value=require('../../../src/core/recommendationInbox.ts').parseRecommendationCapture(c,true);await write('create',id,value)},editRecommendation:async(...a)=>write('edit',...a),linkRecommendation:async(...a)=>write('link',...a),transitionRecommendation:async(...a)=>write('state',...a)};
 if(r.endsWith('/recommendationIncorporation'))return{incorporateManualRecommendation:async(...a)=>{await write('manual',...a);return'TEST-local'},incorporateProviderRecommendation:async(...a)=>{assert.equal(a[3](),true,'context gate revalidated at save');await write('provider',...a);return'TEST-local'}};
 if(r.endsWith('/savedTitlesRepo'))return{getSavedTitleById:async()=>null,listSavedTitles:async()=>snapshot.items,getByProviderReference:async()=>null,saveProviderTitle:async()=>{throw Error('context bypass')}};
 if(r.endsWith('/manualContentEntries'))return{isManualContentEditable:async()=>false,saveManualContent:async()=>{throw Error('context bypass')}};
 if(r.endsWith('/mediaPreferencesRepo'))return{getMediaPreferences:async()=>snapshot.preferences,subscribeMediaPreferences:()=>()=>{}};
 if(r.endsWith('/viewPreferencesRepo'))return{getViewPreference:async()=> 'detail',setViewPreference:async()=>{}};
 if(r.endsWith('/TmdbCredentialProvider'))return{useTmdbCredential:()=>tmdbCredential};
 if(r.endsWith('/tmdbApi'))return{getMovieDetails:async()=>({id:77,title:'TEST remote',original_title:'TEST remote',release_date:'2020-01-01',overview:'TEST snapshot',poster_path:null,genres:[],vote_average:8,runtime:100}),getMovieCredits:async()=>({cast:[],crew:[]}),getWatchProviders:async()=>({results:{}}),posterUrl:()=>null,profileUrl:()=>null,providerLogoUrl:()=>null};
 if(r.endsWith('/mangaupdates/product'))return{loadMangaUpdatesProductDetail:async id=>{muLoads++;return{seriesId:id,title:'TEST comic',type:'Manga',year:'2020',description:'TEST snapshot',genres:[],originalImage:null,thumbnailImage:null}}};
 if(r==='./tmdbClient'&&p.filename.includes('tmdb'))return{tmdbFetch:async()=>{throw Error('No production HTTP in UI TEST')}};
 if(r.endsWith('/components/browsing'))return{TitleGridCard:'TitleGridCard',ViewOptionsPanel:'ViewOptionsPanel'};
 if(r==='expo-sqlite'||r.endsWith('/db'))throw Error('Personal DB forbidden in S2 UI TEST');
 return originalLoad.call(this,r,p,m);
};
const root='../../../',core=require(root+'src/core/recommendationInbox.ts');
const List=require(root+'app/organize/recommendations/index.tsx').default,Detail=require(root+'app/organize/recommendations/[id].tsx').default;
const {RecommendationForm}=require(root+'src/components/organization/RecommendationForm.tsx');
const {MediaPoster}=require(root+'src/components/browsing/MediaPoster.tsx');
const {DEFAULT_MEDIA_PREFERENCES}=require(root+'src/core/mediaPreferences.ts');
const {initialMetadataState}=require(root+'src/core/mediaMetadataState.ts');
const {OrganizationButton,OrganizationInput,OrganizationText}=require(root+'src/components/organization/OrganizationUI.tsx');
const ref={provider:'kitsu',resourceNamespace:'anime',externalId:'1'};
const item={id:'visible',title:'TEST homónimo',medium:'audiovisual',contentFamily:null,primaryFormat:'movie',providerReferences:[],year:2020,posterUrl:null,genres:[],status:'watching',tags:['TEST'],notes:'TEST personal',personalRating:80,createdAt:1,updatedAt:2};
const hidden={...item,id:'hidden',title:'TEST hidden title',providerReferences:[ref]};hidden.metadataState=initialMetadataState(hidden,[ref]);hidden.metadataState.selection={reference:ref,updatedAt:1};hidden.metadataState.documents=[{metadata:{version:1,provenance:{reference:ref,normalizerVersion:1,fetchedAt:null,checkedAt:null,sourceUpdatedAt:null},fields:{sensitive:true}},changedAt:1}];
const entry=(id,status='pending',linkedItemId=null)=>{const c=core.parseRecommendationCapture({name:'TEST homónimo',person:'TEST Ana',origin:'TEST café',comment:'TEST long comment '.repeat(20),reference:ref});return{id,...c,originalCapture:c,status,linkedItemId,createdAt:1,updatedAt:2}};
snapshot={recommendations:[entry('r1'),entry('r2','incorporated','hidden'),entry('r3','discarded')],items:[item,{...item,id:'other',year:2021},hidden],preferences:{value:{...DEFAULT_MEDIA_PREFERENCES,hideSensitive:true},updatedAt:1}};
(async()=>{
 // Punctuation-tolerant suggestions never change identity or confirm a match.
 const {localRecommendationCandidates}=require(root+'src/core/recommendationResolution.ts');
 const savedSnapshot=snapshot;
 const variants=[{...item,id:'spider-1',title:'Spider-Man'},{...item,id:'spider-2',title:'Spider Man: Un nuevo universo'},{...item,id:'woman',title:'Spider-Woman'},{...item,id:'accent',title:'MARÍA: una historia'},{...item,id:'alias',title:'Otra obra',localAliases:['Spider—Man 3']}];
 const capture=core.parseRecommendationCapture({name:'Spiderman'});
 for(const query of ['Spiderman','SPIDER-MAN','Spider Man','spíder.man','Spider—Man','Spider / Man'])assert.deepEqual(new Set(localRecommendationCandidates(capture,variants,query).map(v=>v.id)),new Set(['spider-1','spider-2','alias']),query);
 assert.equal(localRecommendationCandidates(capture,variants,'MARIA')[0].id,'accent');
 assert.deepEqual(new Set(localRecommendationCandidates(capture,variants,'spider').map(v=>v.id)),new Set(['spider-1','spider-2','woman','alias']),'fragments keep distinct works as separate suggestions');
 assert.equal(localRecommendationCandidates(capture,variants,'Spider Woman')[0].id,'woman');
 assert.equal(localRecommendationCandidates(capture,variants,'---').length,0,'empty compact needle must not match every title');
 const strongCapture={...capture,reference:ref};assert.equal(localRecommendationCandidates(strongCapture,[{...item,id:'strong',title:'ZZZ unrelated name',providerReferences:[ref]},...variants],'Spiderman')[0].id,'strong','canonical reference keeps precedence');
 snapshot={...savedSnapshot,recommendations:[{...entry('punctuation'),...capture,originalCapture:capture}],items:[...variants,{...hidden,title:'Spider-Man oculto'}]};params={id:'punctuation'};
 let punctuation=host(Detail);await punctuation.flush();assert.equal(writes.length,0);button(punctuation.tree,'Buscar en mi biblioteca').props.onPress();await punctuation.flush();assert.equal(nodes(punctuation.tree).filter(n=>n.props.label==='Vincular').length,3);assert.ok(!text(punctuation.tree).includes('Spider-Man oculto'));assert.equal(writes.length,0,'Spiderman finds Spider-Man without automatically linking');button(punctuation.tree,'Vincular con Spider-Man').props.onPress();await punctuation.flush();assert.deepEqual(writes.pop(),['link','punctuation','spider-1']);punctuation.unmount();snapshot=savedSnapshot;
 let h=host(List);await h.flush();assert.equal(button(h.tree,'Pendientes').props.selected,true);assert.ok(text(h.tree).includes('1 recomendaciones'));assert.equal(nodes(h.tree).filter(n=>n.type===MediaPoster).length,0,'unlinked row has no invented cover');assert.ok(nodes(h.tree).some(n=>n.props.numberOfLines===2));
 button(h.tree,'Nueva recomendación').props.onPress();await h.flush();assert.ok(nodes(h.tree).some(n=>n.type===RecommendationForm));button(h.tree,'Incorporadas').props.onPress();await h.flush();assert.equal(nodes(h.tree).filter(n=>n.type===MediaPoster).length,0,'hidden linked art is not rendered');assert.ok(!text(h.tree).includes(hidden.title));h.unmount();
 params={id:'r1'};h=host(Detail);await h.flush();assert.equal(writes.length,0);assert.ok(!text(h.tree).includes('Coincidencias locales'));button(h.tree,'Buscar en mi biblioteca').props.onPress();await h.flush();assert.ok(text(h.tree).includes('Coincidencias locales'));assert.equal(nodes(h.tree).filter(n=>n.props.label==='Vincular').length,2,'homonyms remain separate manual suggestions');assert.ok(!text(h.tree).includes(hidden.title));assert.equal(writes.length,0,'name never automatically links');
 button(h.tree,'Vincular con TEST homónimo').props.onPress();await h.flush();assert.deepEqual(writes.pop(),['link','r1','other']);button(h.tree,'Buscar en catálogo').props.onPress();assert.deepEqual(h.navigation.pop(),{pathname:'/organize/recommendations/catalog',params:{recommendationId:'r1'}});button(h.tree,'Crear título manual').props.onPress();assert.equal(h.navigation.pop().params.recommendationId,'r1');
 button(h.tree,'Descartar').props.onPress();await h.flush();assert.deepEqual(writes.pop(),['state','r1','discarded']);button(h.tree,'Ver captura original').props.onPress();await h.flush();assert.ok(text(h.tree).includes('Captura original'));h.unmount();
 params={id:'r3'};h=host(Detail);await h.flush();assert.ok(!nodes(h.tree).some(n=>n.props.label==='Buscar en catálogo'));button(h.tree,'Reabrir').props.onPress();await h.flush();assert.deepEqual(writes.pop(),['state','r3','pending']);h.unmount();
 const props={others:snapshot.recommendations,busy:false,run,done:id=>done.push(id),review:id=>done.push(`review-${id}`)};
 h=host(()=>RecommendationForm(props));await h.flush();button(h.tree,'Guardar recomendación').props.onPress();await h.flush();assert.ok(error.includes('Ingresá'));assert.equal(done.length,0);
 const originField=button(h.tree,'Dónde te lo recomendaron (opcional)');assert.equal(originField.props.placeholder,'WhatsApp, Discord, YouTube…');originField.props.onChangeText('TEST Discord');button(h.tree,'Persona (opcional)').props.onChangeText('TEST Ana');await h.flush();
 button(h.tree,'Enlace HTTP(S) (opcional)').props.onChangeText('https://kitsu.app/anime/1');await h.flush();assert.ok(text(h.tree).includes('Referencia reconocida'));assert.ok(text(h.tree).includes('Ya hay 3 recomendaciones'));assert.equal(network,0);
 button(h.tree,'Guardar recomendación').props.onPress();await h.flush();assert.equal(writes.at(-1)[0],'create');const id=writes.at(-1)[1];button(h.tree,'Guardar recomendación').props.onPress();await h.flush();assert.equal(writes.at(-1)[1],id,'intent survives retry');
 assert.equal(writes.at(-1)[2].origin,'TEST Discord');assert.equal(writes.at(-1)[2].person,'TEST Ana','origin label does not change persistence or who recommended it');
 fail=true;button(h.tree,'Nombre (opcional)').props.onChangeText('TEST retained');await h.flush();button(h.tree,'Guardar recomendación').props.onPress();await h.flush();assert.equal(button(h.tree,'Nombre (opcional)').props.value,'TEST retained');assert.equal(error,'TEST recoverable error');fail=false;h.unmount();
 const editing={...props,recommendation:snapshot.recommendations[0]};h=host(()=>RecommendationForm(editing));await h.flush();button(h.tree,'Guardar recomendación').props.onPress();await h.flush();assert.equal(writes.at(-1)[0],'edit');h.unmount();
 h=host(()=>RecommendationForm({...props,busy:true}));await h.flush();assert.equal(button(h.tree,'Guardando…').props.disabled,true);assert.equal(button(h.tree,'Cancelar').props.disabled,true);h.unmount();
 const {APPEARANCE_PALETTE_IDS}=require(root+'src/theme/types.ts');
 for(scheme of ['light','dark'])for(palette of APPEARANCE_PALETTE_IDS)for(width of [320,360,400,1280])for(fontScale of [1,2]){
  h=host(List);await h.flush();const row=nodes(h.tree).find(n=>n.type==='Pressable');assert.equal(row.props.style({pressed:false}).flexDirection,'row');assert.ok(row.props.style({pressed:false}).backgroundColor);h.unmount();
  h=host(()=>OrganizationButton({label:'TEST long action '.repeat(10),onPress(){}}));await h.flush();assert.equal(h.tree.props.style({pressed:false}).minHeight,44);assert.equal(h.tree.props.style({pressed:false}).maxWidth,'100%');h.unmount();
  h=host(()=>RecommendationForm(props));await h.flush();const originProps=button(h.tree,'Dónde te lo recomendaron (opcional)').props;h.unmount();
  h=host(()=>OrganizationInput(originProps));await h.flush();const originLabel=nodes(h.tree).find(n=>n.type===OrganizationText);assert.equal(originLabel.props.numberOfLines,undefined,'expanded label is not truncated');assert.equal(nodes(h.tree).find(n=>n.type==='TextInput').props.placeholder,'WhatsApp, Discord, YouTube…');h.unmount();
 }
 // Real search hook: typing, category changes and credential changes never submit for Inbox.
 const {SearchScreen}=require(root+'app/(tabs)/buscar.tsx');
 const catalog=require(root+'src/components/search/searchCategories.ts');const calls=[];
 const categories=catalog.SEARCH_CATEGORIES.filter(v=>['movie','tv'].includes(v.id));
 const result={reference:{provider:'tmdb',resourceNamespace:'movie',externalId:'77'},displayTitle:'TEST result',releaseLabel:'2020',posterUrl:null,description:null,kindLabel:'Película'};
 const resolveCategory=id=>{const c=categories.find(v=>v.id===id);return c?{category:c,capability:{search:async(q)=>{calls.push({id,q});return[result]}},destination:v=>catalog.searchResultDestination(c,v)}:null};
 // Stable resolved capability mirrors production constants, preventing artificial refetches.
 const resolved=Object.fromEntries(categories.map(c=>[c.id,resolveCategory(c.id)]));let credential={status:'configured',generation:1};
 h=host(()=>SearchScreen({categories,resolveCategory:id=>resolved[id],tmdb:{snapshot:credential,retryInitialization:async()=>credential},recommendationId:'r1'}));await h.flush();
 const input=()=>nodes(h.tree).find(n=>n.type==='TextInput');input().props.onChangeText('TEST query');await h.flush();advance(400);await h.flush();assert.equal(calls.length,0);
 button(h.tree,'Buscar en catálogo').props.onPress();await h.flush();advance(400);await h.flush();assert.equal(calls.length,1);
 const list=nodes(h.tree).find(n=>n.type==='FlatList');assert.equal(list.props.data.length,1);const row=list.props.renderItem({item:result,index:0});button(row,'Abrir Película TEST result').props.onPress();assert.equal(h.navigation.pop(),'/tmdb/movie/77?recommendationId=r1');
 input().props.onChangeText('TEST other');await h.flush();advance(400);await h.flush();assert.equal(calls.length,1);input().props.onChangeText('TEST query');await h.flush();advance(400);await h.flush();assert.equal(calls.length,1,'old text is not an implicit resubmit');
 button(h.tree,'Series').props.onPress();await h.flush();advance(400);await h.flush();assert.equal(calls.length,1);credential={status:'not-configured',generation:2};h.dirty=true;await h.flush();assert.equal(button(h.tree,'Buscar en catálogo').props.disabled,true);assert.ok(text(h.tree).includes('TMDB no está configurado'));
 button(h.tree,'Volver a la recomendación').props.onPress();assert.equal(h.navigation.pop().params.id,'r1');h.unmount();
 // The existing manual route binds atomic incorporation and an explicit existing-title link.
 const ManualRoute=require(root+'app/manual-entry.tsx').default;const {ManualEntryForm}=require(root+'src/components/ManualEntryForm.tsx');params={recommendationId:'r1'};h=host(ManualRoute);await h.flush();const services=nodes(h.tree).find(n=>n.type===ManualEntryForm).props.services;
 assert.deepEqual((await services.list()).map(v=>v.id),['visible','other']);await services.save({title:'TEST new'});assert.equal(writes.at(-1)[0],'manual');await services.linkExisting('visible');assert.deepEqual(writes.at(-1),['link','r1','visible']);services.done('visible');assert.equal(h.navigation.at(-1).params.id,'r1');h.unmount();
 // Execute the manual form's explicit candidate confirmation, not just its route binding.
 let manualLinks=0;const manualServices={get:async()=>null,eligible:async()=>false,list:async()=>[item],save:async()=>{throw Error('must confirm existing')},inspect(){},done:id=>done.push(id),cancel(){},linkExisting:async id=>{manualLinks++;assert.equal(id,'visible')}};
 h=host(()=>ManualEntryForm({services:manualServices}));await h.flush();button(h.tree,'Título obligatorio').props.onChangeText(item.title);button(h.tree,'Película, serie o video').props.onPress();await h.flush();button(h.tree,'Guardar').props.onPress();await h.flush();assert.equal(manualLinks,0);button(h.tree,'Vincular con TEST homónimo (2020)').props.onPress();await h.flush();assert.equal(manualLinks,1);assert.equal(done.at(-1),'visible');h.unmount();
 // Contextual Kitsu detail saves once and delegates return to the route; hidden art stays absent.
 const {KitsuAnimeDetail}=require(root+'src/providers/kitsu/AnimeDetail.tsx');const {parseAnime}=require(root+'src/providers/kitsu/validation.ts');let kitSaves=0,kitOpens=0;
 const anime=flag=>parseAnime({id:'1',type:'anime',attributes:{canonicalTitle:'TEST anime',subtype:'ONA',nsfw:flag}});
 let kitRecord=anime(false);const kitServices={recommendation:true,available:true,languagePreferences:{read:async()=>snapshot.preferences,subscribe:()=>()=>{}},load:async()=>kitRecord,saved:async()=>null,save:async()=>{kitSaves++;return'kit-local'},open(){kitOpens++},source:async()=>{throw Error('No source navigation')}};
 h=host(()=>KitsuAnimeDetail({id:'1',services:kitServices}));await h.flush();const kitSave=button(h.tree,'Guardar e incorporar recomendación');kitSave.props.onPress();kitSave.props.onPress();await h.flush();assert.equal(kitSaves,1);assert.equal(kitOpens,0,'route owns contextual return');h.unmount();
 kitRecord=anime(true);h=host(()=>KitsuAnimeDetail({id:'1',services:kitServices}));await h.flush();assert.ok(text(h.tree).includes('oculto por tu preferencia'));assert.ok(!nodes(h.tree).some(n=>n.type===MediaPoster));assert.equal(kitSaves,1);h.unmount();
 // Execute the production TMDB screen in recommendation context with isolated adapters.
 tmdbCredential={snapshot:{status:'configured',generation:1},retryInitialization:async()=>{}};params={type:'movie',id:'77',recommendationId:'r1'};
 const TmdbDetail=require(root+'app/tmdb/[type]/[id].tsx').default;h=host(TmdbDetail);await h.flush();const saveRemote=button(h.tree,'Guardar e incorporar recomendación');const writesBefore=writes.length;saveRemote.props.onPress();saveRemote.props.onPress();await h.flush();assert.equal(writes.length,writesBefore+1);assert.equal(writes.at(-1)[0],'provider');assert.equal(writes.at(-1)[1],'r1');assert.deepEqual(h.navigation.at(-1),{pathname:'/organize/recommendations/[id]',params:{id:'r1'}});h.unmount();
 const MuDetail=require(root+'app/mangaupdates/series/[id].tsx').default;params={id:'1',recommendationId:'r1'};h=host(MuDetail);await h.flush();assert.equal(muLoads,0,'closed Web gate never loads detail');assert.ok(!nodes(h.tree).some(n=>n.props.accessibilityLabel==='Guardar e incorporar recomendación'));button(h.tree,'Volver a la recomendación').props.onPress();assert.equal(h.navigation.at(-1).params.id,'r1');h.unmount();
 platform.OS='android';h=host(MuDetail);await h.flush();assert.equal(muLoads,1);button(h.tree,'Guardar e incorporar recomendación').props.onPress();await h.flush();assert.equal(writes.at(-1)[2].reference.provider,'mangaupdates');assert.equal(h.navigation.at(-1).params.id,'r1');h.unmount();platform.OS='web';
 snapshot=undefined;error='TEST read failure';h=host(List);await h.flush();assert.ok(nodes(h.tree).some(n=>n.props.error===error&&n.props.retry));assert.ok(!nodes(h.tree).some(n=>n.props.label==='Nueva recomendación'));h.unmount();assert.equal(network,0);
 console.log('PASS S2 UI hook-host: filters/counts/text-first rows, no hidden/invented art; explicit local suggestions/link and catalog/manual return context; capture validation/duplicate warnings/stable intent/errors/disabled controls; all light/dark palettes at 320/360/400/1280px and 100/200% layout properties; real search hook requires deliberate submission, clears stale authorization, respects credentials and retains recommendation ID; manual save/link bindings and error retry. No personal DB/network. Component harness only, not browser or physical Android acceptance.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{Module._load=originalLoad;global.setTimeout=nativeTimeout;global.clearTimeout=nativeClear});

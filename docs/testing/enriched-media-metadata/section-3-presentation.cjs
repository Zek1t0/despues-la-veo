const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const { metadataImageUrl } = require('../../../src/core/metadataImageUrl.ts');
const { providerImagePolicy, selectImageVariant, admittedImageUrl } = require('../../../src/core/mediaImagePresentation.ts');
const { parseAnime } = require('../../../src/providers/kitsu/validation.ts');
const { savedMediaPresentation, resolvePublicRating, publicRatingLabel } = require('../../../src/core/mediaPresentation.ts');
const { projectMediaMetadata } = require('../../../src/core/mediaMetadataState.ts');
const runtime = {platform:'web',development:true};
const policy = providerImagePolicy('kitsu',runtime);
const direct = 'https://media.kitsu.app/anime/poster_images/1/small.jpg';
const originalFetch=global.fetch; global.fetch=()=>{throw Error('No network in deterministic suite')};
try {
 for(const bad of ['http://media.kitsu.app/x','https://user:pw@media.kitsu.app/x','https://media.kitsu.app.evil.test/x',
  'https://evilmedia.kitsu.app/x','https://media.kitsu.app:444/x','https://media.kitsu.app./x',
  'https://media.kitsu.app%2eevil.test/x','https://media.kitsu.app\\@evil.test/x','https://media.kitsu.app/\nx',
  'https://localhost/x','https://a.localhost/x','https://a.local/x','https://a.internal/x','https://127.0.0.1/x',
  'https://2130706433/x','https://0x7f000001/x','https://0177.0.0.1/x','https://[::1]/x','https://[::ffff:127.0.0.1]/x',
  'https://169.254.169.254/x','https://10.0.0.1/x','https://192.168.1.1/x','https://224.0.0.1/x','https://0.0.0.0/x']) {
   assert.equal(metadataImageUrl(bad, policy),null,bad);
   // Even an imported self-approved host cannot turn identifiable IP/local destinations into images.
   try {const host=new URL(bad).hostname; if(/localhost|internal|\.local$|^[\d.]+$|:/.test(host)) assert.equal(metadataImageUrl(bad,{exactHosts:[host]}),null,bad);} catch {}
 }
 assert.equal(admittedImageUrl(direct,policy),direct);
 assert.equal(selectImageVariant([{url:direct,variant:"small",width:284}],policy,"card",180,1,{[direct]:{requiresRedirect:true}}),null);
 assert.equal(admittedImageUrl(direct,policy,{requiresRedirect:true}),null);
 assert.equal(admittedImageUrl(direct,policy,{requiresRedirect:true,destinations:['https://127.0.0.1/x']}),null);
 assert.equal(admittedImageUrl(direct,policy,{destinations:['https://evil.test/x']}),null);
 for(const platform of ['web','android','ios']) for(const development of [true,false])
  assert.equal(!!metadataImageUrl(direct,providerImagePolicy('kitsu',{platform,development})),development && platform!=='ios');
 assert.equal(metadataImageUrl('https://cdn.mangaupdates.com/x',providerImagePolicy('mangaupdates',runtime)),null);
 const twoHosts={exactHosts:['posters.example.test','banners.example.test']};
 assert.equal(selectImageVariant([{url:'https://banners.example.test/b',variant:'tiny',width:840}],twoHosts,'banner'), 'https://banners.example.test/b');
 const images=[110,284,390,550].map(width=>({url:`https://posters.example.test/${width}`,variant:String(width),width}));
 for(const [context,width,density,expected] of [['list',70,1,110],['card',180,2,390],['detail',120,3,390],['banner',800,2,550]])
  assert.equal(selectImageVariant(images,twoHosts,context,width,density),`https://posters.example.test/${expected}`);
 assert.equal(selectImageVariant([{url:'https://evil.test/x',variant:'original'}],policy,'card'),null);
 const live=JSON.parse(fs.readFileSync(__dirname+'/section-3-live-evidence.json','utf8')).requests[0];
 const anime=parseAnime({type:'anime',id:'1',attributes:{canonicalTitle:'Fixture',posterImage:live.posterImage,coverImage:live.coverImage,averageRating:'82.28'}},[],{imagePolicy:policy});
 assert.equal(anime.metadata.fields.posterImages.length,5); assert.equal(anime.metadata.fields.bannerImages.length,4);
 assert.equal(publicRatingLabel(resolvePublicRating('kitsu',anime.metadata)),'Puntuación pública · Kitsu: 8,2/10');
 assert.equal(publicRatingLabel(resolvePublicRating('tmdb',undefined,0)),'Puntuación pública · TMDB: 0,0/10');
 for(const legacy of [null,undefined,NaN,Infinity,-1,11]) assert.equal(resolvePublicRating('tmdb',undefined,legacy),null);
 for(const provider of ['mangaupdates',null,'manual']) assert.equal(resolvePublicRating(provider,anime.metadata,8),null);
 const tmdb={provider:'tmdb',resourceNamespace:'movie',externalId:'1'}, kitsu={provider:'kitsu',resourceNamespace:'anime',externalId:'1'};
 const base={title:'Historical',medium:'audiovisual',contentFamily:null,primaryFormat:'movie',year:2000,posterUrl:'https://image.tmdb.org/t/p/w342/old.jpg',overview:'old',voteAverage:7,genres:[]};
 const state={version:1,baseline:{snapshot:base,reference:tmdb,updatedAt:1},selection:{reference:tmdb,updatedAt:1},documents:[{metadata:anime.metadata,changedAt:2}]};
 const item={...base,id:'test',providerReferences:[tmdb,kitsu],metadataState:state,personalRating:9,tags:['tag'],notes:'note'};
 assert.equal(savedMediaPresentation(item).metadata,undefined); assert.equal(savedMediaPresentation(item).rating.originalValue,7);
 const changed={...item,metadataState:{...state,selection:{reference:kitsu,updatedAt:3}}};
 assert.equal(savedMediaPresentation(changed).rating.originalValue,'82.28'); assert.equal(projectMediaMetadata(changed.metadataState).posterUrl,null);
 assert.equal(item.notes,'note'); assert.equal(item.personalRating,9);
 const ambiguous={...item,metadataState:{...state,selection:{reference:null,updatedAt:3}}};
 assert.equal(savedMediaPresentation(ambiguous).rating,null); assert.equal(savedMediaPresentation(ambiguous).imageProvider,null);
 for(const value of [null,'',-1,101,NaN]) {
  const parsed=parseAnime({type:'anime',id:'1',attributes:{canonicalTitle:'partial',averageRating:value}},[],{imagePolicy:policy});
  assert.equal(resolvePublicRating('kitsu',parsed.metadata),null);
 }
 assert.equal(resolvePublicRating('kitsu',parseAnime({type:'anime',id:'1',attributes:{canonicalTitle:'zero',averageRating:'0'}}).metadata).originalValue,'0');
 console.log('PASS section 3: malicious URLs, gates, direct/redirect policy, two hosts, widths/densities, real-response shape replay, active sources, score original/null/zero, personal preservation. Deterministic; no live renderer.');
}finally {global.fetch=originalFetch;}

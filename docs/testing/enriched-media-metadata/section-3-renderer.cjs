const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), ts = require('typescript');
for(const ext of ['.ts','.tsx']) require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,f);
let active, platform='web', density=1;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState(initial){const h=active,i=h.cursor++; if(!(i in h.slots)) h.slots[i]=initial;return [h.slots[i],v=>{h.slots[i]=typeof v==='function'?v(h.slots[i]):v;h.dirty=true}];},
 useMemo(fn,deps){const h=active,i=h.cursor++;if(!h.slots[i]||!same(h.slots[i].deps,deps))h.slots[i]={deps,value:fn()};return h.slots[i].value;}};
function host(fn){return {slots:[],cursor:0,dirty:true,tree:null,render(){for(let n=0;n<5&&this.dirty;n++){active=this;this.cursor=0;this.dirty=false;this.tree=fn();}return this.tree;}};}
const original=Module._load;
Module._load=function(r,p,m){if(r==='react')return react;if(r==='react-native')return {Image:'Image',View:'View',Text:'Text',Platform:{get OS(){return platform}},PixelRatio:{get:()=>density},StyleSheet:{create:x=>x,absoluteFillObject:{position:'absolute',top:0,bottom:0,left:0,right:0}}};if(r==='@expo/vector-icons')return {Ionicons:'Icon'};if(r.endsWith('AppThemeProvider'))return {useAppTheme:()=>({theme:{global:{textSecondary:'secondary',surfaceSecondary:'surface',border:'border'}}})};return original.call(this,r,p,m);};
global.__DEV__=true;
const {DetailPoster}=require('../../../src/components/browsing/DetailPoster.tsx');
const {MediaPoster}=require('../../../src/components/browsing/MediaPoster.tsx');
let props={identity:'A',imageProvider:'tmdb',posterUrl:'https://image.tmdb.org/t/p/w342/a.jpg',style:{width:120,height:180}};
const h=host(()=>DetailPoster(props));assert.equal(h.render().type,'Image');const oldError=h.tree.props.onError;oldError();h.render();assert.notEqual(h.tree.type,'Image');
props={...props,identity:'B'};h.dirty=true;assert.equal(h.render().type,'Image');oldError();assert.equal(h.render().type,'Image','stale A callback cannot poison recycled B');
props={...props,posterUrl:'https://image.tmdb.org/t/p/w342/b.jpg'};h.dirty=true;h.render();h.tree.props.onLoad({nativeEvent:{source:{uri:'https://127.0.0.1/final'}}});assert.notEqual(h.render().type,'Image');
props={...props,identity:'A',posterUrl:'https://image.tmdb.org/t/p/w342/a.jpg'};h.dirty=true;assert.equal(h.render().type,'Image','A to B to A resets');
for(const url of [null,'https://evil.test/a','https://user@image.tmdb.org/a']){props={...props,posterUrl:url};h.dirty=true;assert.notEqual(h.render().type,'Image');}
const metadata={version:1,provenance:{reference:{provider:'kitsu',resourceNamespace:'anime',externalId:'1'}},fields:{posterImages:[{url:'https://media.kitsu.app/a',variant:'small',width:284},{url:'https://media.kitsu.app/b',variant:'large',width:550}]}};
const mp={identity:'1',imageProvider:'kitsu',metadata,context:'card',style:{width:180,height:270}};
const ph=host(()=>MediaPoster(mp));let tree=ph.render();assert.equal(tree.props.children[0].props.posterUrl,null,'wait for layout to avoid speculative download'); tree.props.onLayout({nativeEvent:{layout:{width:180}}}); tree=ph.render(); assert.equal(tree.props.children[0].props.posterUrl,'https://media.kitsu.app/a');
density=2;tree.props.onLayout({nativeEvent:{layout:{width:180}}});tree=ph.render();assert.equal(tree.props.children[0].props.posterUrl,'https://media.kitsu.app/b');
metadata.fields.posterImages=null;ph.dirty=true;assert.equal(ph.render().props.children[0].props.posterUrl,null);
platform='ios';metadata.fields.posterImages=[{url:'https://media.kitsu.app/b',variant:'large',width:550}];ph.dirty=true;assert.equal(ph.render().props.children[0].props.posterUrl,null);
// Banner absence must not mount a layout frame; supplied artwork keeps the shared policy.
const {MediaBanner}=require('../../../src/components/browsing/MediaBanner.tsx');
platform='web';density=1;
const bannerUrl='https://media.kitsu.app/banner-small.jpg';
const bannerMetadata=images=>({version:1,provenance:{reference:{provider:'kitsu',resourceNamespace:'anime',externalId:'1'}},fields:{bannerImages:images}});
let bannerProps={identity:'manual',imageProvider:null,style:{width:320,aspectRatio:4.2}};
const bh=host(()=>MediaBanner(bannerProps));
assert.equal(bh.render(),null,'manual without banner reserves no frame');
bannerProps={...bannerProps,identity:'historical-tmdb',imageProvider:'tmdb'};bh.dirty=true;
assert.equal(bh.render(),null,'historical TMDB without enriched banner reserves no frame');
for(const images of [undefined,null,[]]) {
 bannerProps={...bannerProps,identity:'absent-kitsu',imageProvider:'kitsu',metadata:bannerMetadata(images)};bh.dirty=true;
 assert.equal(bh.render(),null,'absent/null/empty Kitsu banner reserves no frame');
}
bannerProps={...bannerProps,identity:'valid-kitsu',metadata:bannerMetadata([
 {url:bannerUrl,variant:'small',width:840},{url:'https://media.kitsu.app/banner-large.jpg',variant:'large',width:1680}
])};bh.dirty=true;
assert.equal(bh.render().type,MediaPoster);assert.equal(bh.tree.props.context,'banner');
let bannerPoster=host(()=>bh.tree.type(bh.tree.props)),frame=bannerPoster.render();
frame.props.onLayout({nativeEvent:{layout:{width:320}}});frame=bannerPoster.render();
let detail=frame.props.children[0];assert.equal(detail.props.posterUrl,bannerUrl,'valid banner uses existing measured variant selection');
const bannerRenderer=host(()=>detail.type(detail.props));assert.equal(bannerRenderer.render().type,'Image');
bannerRenderer.tree.props.onError();
assert.equal(bannerRenderer.render().type.name,'PosterPlaceholder','admitted banner load failure keeps safe fallback');
// Leaving and returning to an artwork title remounts the child, including its error lifecycle.
bannerProps={...bannerProps,identity:'without-banner',metadata:bannerMetadata(null)};bh.dirty=true;
assert.equal(bh.render(),null,'with -> without removes banner frame');
bannerProps={...bannerProps,identity:'valid-again',metadata:bannerMetadata([{url:bannerUrl,variant:'small',width:840}])};bh.dirty=true;
assert.equal(bh.render().type,MediaPoster,'without -> with restores the shared component');
bannerPoster=host(()=>bh.tree.type(bh.tree.props));frame=bannerPoster.render();
frame.props.onLayout({nativeEvent:{layout:{width:320}}});frame=bannerPoster.render();detail=frame.props.children[0];
assert.equal(host(()=>detail.type(detail.props)).render().type,'Image','remounted banner is not poisoned by previous load error');
bannerProps={...bannerProps,identity:'rejected',metadata:bannerMetadata([{url:'https://unreviewed.example.test/banner',variant:'original'}])};bh.dirty=true;
assert.equal(bh.render().type,MediaPoster,'present but rejected artwork retains existing safe fallback');
bannerPoster=host(()=>bh.tree.type(bh.tree.props));frame=bannerPoster.render();
frame.props.onLayout({nativeEvent:{layout:{width:320}}});frame=bannerPoster.render();detail=frame.props.children[0];
assert.equal(detail.props.posterUrl,null,'rejected URL never reaches renderer');
assert.equal(host(()=>detail.type(detail.props)).render().type.name,'PosterPlaceholder');
bannerProps={...bannerProps,imageProvider:'tmdb'};bh.dirty=true;
assert.equal(bh.render(),null,'metadata from another provider supplies no banner');
const normalPoster=host(()=>MediaPoster({identity:'normal',imageProvider:'tmdb',style:{width:120,height:180}}));
assert.equal(normalPoster.render().type,'View','ordinary poster absence still reserves its normal frame');
console.log('PASS banner correction: manual/TMDB absence, Kitsu valid/omitted/null/empty, rejected URL, admitted load failure, title transitions, source isolation and unchanged normal poster fallback. Hook-host only; no visual acceptance.');
const {PublicRating}=require('../../../src/components/browsing/PublicRating.tsx');
const {resolvePublicRating}=require('../../../src/core/mediaPresentation.ts');
for(const original of [0,7.5]) {
 const score=PublicRating({value:resolvePublicRating('tmdb',undefined,original)});
 assert.ok(score.props.accessibilityLabel.startsWith('Puntuaci\u00f3n p\u00fablica'));
 assert.equal(score.props.style[0].color,'secondary','uses theme token');
}
assert.equal(PublicRating({value:null}),null);
console.log('PASS section 3 component harness: pre-render rejection, failure fallback, stale callbacks, identity/URL recycling, reported unsafe URI, responsive width/density, null, iOS gate. Mocked host; no physical/browser acceptance.');
Module._load=original;

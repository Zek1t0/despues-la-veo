const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }, fileName: f,
}).outputText, f);
let active;
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useMemo(fn, deps) { const h=active, i=h.cursor++, old=h.slots[i]; if (!old || deps.some((v,j)=>!Object.is(v,old.deps[j]))) h.slots[i]={deps,value:fn()}; return h.slots[i].value; },
  useState(initial) { const h=active,i=h.cursor++; if (!(i in h.slots)) h.slots[i]=initial; return [h.slots[i], next=>{ h.slots[i]=typeof next==="function"?next(h.slots[i]):next; h.dirty=true; }]; },
};
const load=Module._load, fetch=global.fetch;
Module._load=function(name,parent,main) {
  if(name==="react")return react;
  if(name==="react-native")return { Image:"Image",View:"View",Text:"Text",Pressable:"Pressable",StyleSheet:{create:x=>x,absoluteFillObject:{position:"absolute"},hairlineWidth:1} };
  if(name==="@expo/vector-icons")return {Ionicons:"Ionicons"};
  if(name.endsWith("AppThemeProvider"))return {useAppTheme:()=>({theme:{global:{},structural:{}}})};
  if(/storage|sqlite/i.test(name))throw Error("Visual errors must not access storage: "+name);
  return load.call(this,name,parent,main);
};
global.fetch=()=>{throw Error("No artwork or network allowed");};
function host(render) {return {slots:[],cursor:0,dirty:true,render(){for(let n=0;n<8;n++){active=this;this.cursor=0;this.dirty=false;this.tree=render();if(!this.dirty)return this.tree;}throw Error("Did not settle");}};}
function nodes(v,out=[]) {if(Array.isArray(v))v.forEach(x=>nodes(x,out));else if(v?.props){out.push(v);nodes(v.props.children,out);}return out;}
const {DetailPoster}=require("../../../src/components/browsing/DetailPoster.tsx");
const {TitleGridCard}=require("../../../src/components/browsing/TitleGridCard.tsx");
const {TagCollage}=require("../../../src/components/browsing/TagCollage.tsx");
// Original developer-owned SVG bytes are supplied to the test stub only. No requests or real decode.
const artwork=fs.readFileSync(__dirname+"/fixtures/developer-poster.svg","utf8");
assert.match(artwork,/<svg/);
const a="https://assets.example.invalid/developer-poster-a.png", b="https://assets.example.invalid/developer-poster-b.png";
let presses=0;
function exercise(component, props, imageOf=x=>nodes(x).find(n=>n.type==="Image")) {
  let input={...props,identity:"A",posterUrl:null};
  const h=host(()=>component(input));
  assert.equal(imageOf(h.render()),undefined,"null placeholder");
  input={...input,posterUrl:a};const initial=imageOf(h.render());assert.equal(initial.props.source.uri,a);assert.equal(initial.props.resizeMode,"cover");assert.equal(initial.props.accessible,false);
  if(initial.props.onLoad)initial.props.onLoad({nativeEvent:{source:{width:40,height:60}}});
  for(const error of ["HTTP 404","Network request failed","Image decode failed"]) {
    const old=imageOf(h.render());old.props.onError({nativeEvent:{error}});assert.equal(imageOf(h.render()),undefined,error);
    input={...input,posterUrl:input.posterUrl===a?b:a};assert.ok(imageOf(h.render()),"URL recovery");
    old.props.onError({nativeEvent:{error:"late"}});assert.ok(imageOf(h.render()),"stale callback ignored");
  }
  let old=imageOf(h.render());old.props.onError({nativeEvent:{error:"offline"}});assert.equal(imageOf(h.render()),undefined);
  input={...input,identity:"B"};assert.ok(imageOf(h.render()),"same URL new identity recovers");
  old.props.onError({nativeEvent:{error:"stale identity"}});assert.ok(imageOf(h.render()));
  const middle=imageOf(h.render());input={...input,identity:"A"};h.render();old.props.onError({nativeEvent:{error:"ABA"}});assert.ok(imageOf(h.render()),"ABA cannot reuse old generation");
  imageOf(h.render()).props.onError({nativeEvent:{error:"current"}});middle.props.onError({nativeEvent:{error:"old"}});assert.equal(imageOf(h.render()),undefined,"old callback cannot clear current failure");
  assert.equal(input.posterUrl===a||input.posterUrl===b,true,"visual error preserves URL");
  assert.ok(nodes(h.tree).some(n=>n.type?.name==="PosterPlaceholder"));
  return h;
}
try {
  for(const style of [{width:80,height:120,borderRadius:10},{width:70,height:105,borderRadius:12}]) {
    const h=exercise(DetailPoster,{style});assert.deepEqual(h.tree.props.style,style);
  }
  const grid=exercise(TitleGridCard,{title:"Developer art",kindLabel:"Manga",accessibilityLabel:"Abrir Developer art",onPress:()=>presses++});
  grid.tree.props.onPress();assert.equal(presses,1);assert.equal(grid.tree.props.focusable,true);assert.equal(grid.tree.props.accessibilityRole,"button");assert.equal(grid.tree.props.accessibilityLabel,"Abrir Developer art");
  const collage=host(()=>TagCollage({items:[{id:"A",posterUrl:a}]})).render();
  const cell=nodes(collage).find(n=>n.type?.name==="CollageCell");
  exercise(p=>cell.type({...cell.props,item:{id:p.identity,posterUrl:p.posterUrl}}),{});
  const next=host(()=>TagCollage({items:[{id:"B",posterUrl:a}]})).render();assert.notEqual(cell.props.key,nodes(next).find(n=>n.type?.name==="CollageCell").props.key,"collage remount identity");
  for(const file of ["app/(tabs)/buscar.tsx","app/(tabs)/libreria.tsx"]) {
    const source=fs.readFileSync(file,"utf8");assert.match(source,/<DetailPoster identity=/);assert.match(source,/keyExtractor=/);assert.match(source,/<TitleGridCard\s+identity=/);
  }
  for(const file of ["app/title/[id].tsx","app/mangaupdates/series/[id].tsx"]) {
    const source=fs.readFileSync(file,"utf8");assert.match(source,/usePosterImageError/);assert.match(source,/onError=\{onImageError\}/);
  }
  console.log("Section 3: deterministic Image events (HTTP/network/decode/offline), null/success, identity/URL/ABA recycling, stale callbacks, layout, accessibility, navigation and no storage/network imports passed. Not native rendering.");
} finally {Module._load=load;global.fetch=fetch;}

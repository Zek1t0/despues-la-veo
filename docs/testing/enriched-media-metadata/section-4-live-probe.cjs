// Explicit development probe; never called by the app, offline suites or language changes.
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createKitsuClient}=require('../../../src/providers/kitsu/client.ts');
const {KITSU_DEVELOPMENT_API_BASE}=require('../../../src/providers/kitsu/identity.ts');
const {KITSU_DEVELOPMENT_IMAGE_HOSTS}=require('../../../src/core/mediaImagePresentation.ts');
(async()=>{
 const evidence={kind:'real Node HTTP; not browser/Android acceptance',observedAt:new Date().toISOString(),requests:[]};
 const client=createKitsuClient({apiBase:KITSU_DEVELOPMENT_API_BASE,metadataOptions:{imagePolicy:KITSU_DEVELOPMENT_IMAGE_HOSTS},fetchImplementation:async(url,init)=>{
  const response=await fetch(url,init),body=await response.clone().json();
  const record=Array.isArray(body.data)?body.data[0]:body.data,a=record?.attributes??{};
  evidence.requests.push({url:String(url),status:response.status,finalUrl:response.url,redirected:response.redirected,attributeKeys:Object.keys(a),
   sample:{id:record?.id,titles:a.titles,endDate:a.endDate,status:a.status,episodeCount:a.episodeCount,episodeLength:a.episodeLength,totalLength:a.totalLength,ageRating:a.ageRating,ageRatingGuide:a.ageRatingGuide,updatedAt:a.updatedAt,descriptionLength:a.description?.length}});
  return response;
 }});
 const detail=await client.getAnime('1');await client.searchAnime('Cowboy Bebop');
 evidence.normalizedDetailFields=Object.keys(detail.metadata.fields);evidence.diagnostics=detail.metadataDiagnostics;
 fs.writeFileSync(__dirname+'/section-4-live-evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});

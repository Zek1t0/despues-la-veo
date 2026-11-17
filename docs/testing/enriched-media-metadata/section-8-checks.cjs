const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const commands=['npx tsc --noEmit','openspec validate add-enriched-media-metadata-and-library-updates --strict','git diff --check','npx expo export --platform web --output-dir .expo/s8-web-validation-20261116','node docs/testing/enriched-media-metadata/section-8-scope.cjs'];
const results=[];
for(const command of commands){
 const start=Date.now(),r=spawnSync(command,{shell:true,encoding:'utf8',timeout:180000,env:{...process.env,EXPO_OFFLINE:'1',EXPO_NO_DOTENV:'1'}});
 results.push({command,exitCode:r.status,signal:r.signal,durationMs:Date.now()-start,output:(r.stdout??'')+(r.stderr??''),...(r.error?{executionError:r.error.message}:{})});
 fs.writeFileSync('docs/testing/enriched-media-metadata/section-8-checks.json',JSON.stringify({previousExportAttempt:{exitCode:1,bundledModules:993,stage:'persist files',code:'EPERM',path:'.expo/s8-web-validation-20261116/_expo/static',diagnostic:'Direct recursive mkdir succeeded; one retry after creating the parent. No ACL/security changes.'},results},null,2)+'\n');
 console.log(`exit ${r.status}: ${command}`);
}
if(results.some(r=>r.exitCode!==0))process.exitCode=1;

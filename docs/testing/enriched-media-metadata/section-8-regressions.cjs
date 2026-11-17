const fs=require('node:fs'),{spawnSync,execFileSync}=require('node:child_process');
const directory='docs/testing/enriched-media-metadata/';
const base='6ddd893d1e809ec9c6378b37953d25d63743247b';
const current=JSON.parse(fs.readFileSync(directory+'section-7-results.json','utf8')).map(x=>({kind:'current',command:x.command,expectedExitCode:x.exitCode}));
const exceptions=[['enriched-media-metadata/section-2-storage.cjs',1],['expanded-media-domain/section-3-ui-verification.cjs',0],['expanded-media-domain/section-4-verification.cjs',0],['mangaupdates-cover-images/section-2-verification.cjs',0],['tmdb-user-credential/section-2-verification.cjs',1]];
const baseline=exceptions.map(([test,expectedExitCode])=>({kind:'S6-runtime-baseline',command:`node ${directory}section-8-baseline-probe.cjs ${base} docs/testing/${test}`,expectedExitCode}));
const adapted=[{kind:'controlled-clock',command:`node ${directory}section-7-storage-clock.cjs`,expectedExitCode:0},...exceptions.slice(1,4).map(([test])=>({kind:'legacy-UI-preference-fixture',command:`node -r ./${directory}section-7-legacy-fixture-preload.cjs docs/testing/${test}`,expectedExitCode:0}))];
const results=[];
for(const entry of [...current,...baseline,...adapted]){
 const [exe,...args]=entry.command.split(' '),start=Date.now();
 const r=spawnSync(exe,args,{encoding:'utf8',timeout:180000});
 const result={...entry,exitCode:r.status,signal:r.signal,durationMs:Date.now()-start,output:(r.stdout??'')+(r.stderr??''),...(r.error?{executionError:r.error.message}:{})};
 results.push(result);console.log(`${r.status===entry.expectedExitCode?'EXPECTED':'UNEXPECTED'} exit ${r.status}: ${entry.command}`);
 fs.writeFileSync(directory+'section-8-results.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baseline:base,results},null,2)+'\n');
}
console.log(`${current.length} current suites; ${results.filter(x=>x.kind==='current'&&x.exitCode===0).length} pass. ${results.filter(x=>x.exitCode!==x.expectedExitCode).length} unexpected outcomes. Original failures remain failures.`);
if(results.some(x=>x.exitCode!==x.expectedExitCode))process.exitCode=1;

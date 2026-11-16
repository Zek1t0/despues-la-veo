const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const commands=[
 'node docs/testing/enriched-media-metadata/section-7-baseline-storage.cjs',
 'node docs/testing/enriched-media-metadata/section-7-storage-clock.cjs',
 ...['expanded-media-domain/section-3-ui-verification.cjs','expanded-media-domain/section-4-verification.cjs','mangaupdates-cover-images/section-2-verification.cjs'].map(p=>'node -r ./docs/testing/enriched-media-metadata/section-7-legacy-fixture-preload.cjs docs/testing/'+p),
];
const results=commands.map((command,i)=>{const [exe,...args]=command.split(' ');const r=spawnSync(exe,args,{encoding:'utf8',timeout:180000});return {command,exitCode:r.status,expectedExitCode:i===0?1:0,output:(r.stdout??'')+(r.stderr??'')};});
fs.writeFileSync('docs/testing/enriched-media-metadata/section-7-fixture-results.json',JSON.stringify(results,null,2)+'\n');
for(const r of results)console.log(`${r.exitCode===r.expectedExitCode?'EXPECTED':'UNEXPECTED'} exit ${r.exitCode}: ${r.command}`);
if(results.some(r=>r.exitCode!==r.expectedExitCode))process.exitCode=1;

const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const prior=JSON.parse(fs.readFileSync('docs/testing/enriched-media-metadata/section-5-results.json','utf8')).map(x=>x.command);
const commands=[...new Set([...prior,'node docs/testing/enriched-media-metadata/section-5-retry-expiry.cjs',...['activity','retention','tabs','run-ui','feed','service'].map(name=>`node docs/testing/enriched-media-metadata/section-6-${name}.cjs`)])];
const selected=process.argv.includes('--prior')?commands.filter(c=>!c.includes('/section-6-')):commands;
const results=selected.map(command=>{const [exe,...args]=command.split(' ');const r=spawnSync(exe,args,{encoding:'utf8',timeout:180000});console.log((r.status===0?'PASS ':'FAIL ')+command);return {command,exitCode:r.status,output:(r.stdout??'')+(r.stderr??'')};});
fs.writeFileSync(`docs/testing/enriched-media-metadata/section-6-${process.argv.includes('--prior')?'prior-results':'results'}.json`,JSON.stringify(results,null,2)+'\n');console.log(`${results.filter(x=>x.exitCode===0).length}/${results.length} passing`);if(results.some(x=>x.exitCode!==0))process.exitCode=1;

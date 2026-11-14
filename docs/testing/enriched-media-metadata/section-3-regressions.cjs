const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const old=JSON.parse(fs.readFileSync(__dirname+'/section-2-poster-results.json','utf8'));
const commands=[...old.map(x=>x.command),'node docs/testing/enriched-media-metadata/section-2-poster-regression.cjs','node docs/testing/enriched-media-metadata/section-3-backups.cjs','node docs/testing/enriched-media-metadata/section-3-presentation.cjs','node docs/testing/enriched-media-metadata/section-3-renderer.cjs'];
const results=[];
for(const command of commands){const args=command.split(' ');const r=spawnSync(args.shift(),args,{encoding:'utf8',timeout:120000});const result={command,exitCode:r.status,output:(r.stdout??'')+(r.stderr??'')};results.push(result);console.log((r.status===0?'PASS ':'FAIL ')+command);if(r.status!==0)console.log(result.output.slice(-6000));}
fs.writeFileSync(__dirname+'/section-3-results.json',JSON.stringify(results,null,2)+'\n');
process.exitCode=results.some(r=>r.exitCode!==0)?1:0;

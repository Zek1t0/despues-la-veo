const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const commands=[...JSON.parse(fs.readFileSync(__dirname+'/section-3-results.json','utf8')).map(r=>r.command),...['editorial','languages','preferences','sources','ui'].map(n=>`node docs/testing/enriched-media-metadata/section-4-${n}.cjs`)];
const results=[];for(const command of commands){const [exe,...args]=command.split(' '),r=spawnSync(exe,args,{encoding:'utf8',timeout:120000});results.push({command,exitCode:r.status,output:(r.stdout??'')+(r.stderr??'')});console.log(`${r.status===0?'PASS':'FAIL'} ${command}`);if(r.status!==0)console.log(results.at(-1).output.slice(-4500));}
fs.writeFileSync(__dirname+'/section-4-results.json',JSON.stringify(results,null,2)+'\n');process.exitCode=results.some(r=>r.exitCode!==0)?1:0;

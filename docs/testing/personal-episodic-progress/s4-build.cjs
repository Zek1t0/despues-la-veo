const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const clean=text=>text.replaceAll(process.cwd(),'<REPO>').replaceAll(os.homedir(),'<HOME>').replaceAll(os.tmpdir(),'<TEST_TMP>');
const results=[];
for(const outputDir of ['dist/s3-web','dist/s3-web','dist/s4-web']){
 const command=`npx expo export --platform web --output-dir ${outputDir}`;
 const run=spawnSync('cmd.exe',['/d','/s','/c',command],{encoding:'utf8',timeout:180000});
 const output=clean((run.stdout??'')+(run.stderr??''));results.push({command,exitCode:run.status,output});
 console.log(`${run.status===0?'PASS':'FAIL'} ${command}`);
 fs.writeFileSync(path.join(__dirname,'s4-build-results.json'),JSON.stringify({results},null,2)+'\n');
}
if(results.some(r=>r.exitCode!==0))process.exitCode=1;

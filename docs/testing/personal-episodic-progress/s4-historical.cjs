const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const results=[];
for(const test of ['docs/testing/enriched-media-metadata/section-2-storage.cjs','docs/testing/personal-title-rating/section-2-integration-verification.cjs']){
 const source=spawnSync('git',['show',`d724f1a:${test}`],{encoding:'utf8'});if(source.status!==0)throw Error('Missing pre-change fixture');
 const script=`const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{spawnSync}=require('node:child_process'),read=fs.readFileSync;fs.readFileSync=(file,...args)=>{const relative=path.relative(process.cwd(),String(file)).replaceAll('\\\\','/');if(relative.startsWith('src/')){const original=spawnSync('git',['show','d724f1a:'+relative],{encoding:'utf8'});if(original.status!==0)throw Error('Missing historical source: '+relative);return original.stdout;}return read(file,...args)};const name=path.resolve(${JSON.stringify(test)}),m=new Module(name,module);m.filename=name;m.paths=Module._nodeModulePaths(path.dirname(name));m._compile(${JSON.stringify(source.stdout)},name);`;
 const run=spawnSync(process.execPath,['-e',script],{encoding:'utf8',timeout:120000});const output=(run.stdout??'')+(run.stderr??'');
 const expected=test.includes('metadata')?output.includes('0 !== 1'):output.includes('personalRatingPresentation');
 results.push({baseline:'d724f1a',test,exitCode:run.status,reproduced:run.status===1&&expected,assertion:test.includes('metadata')?'activity rows 0 !== 1, 100 ms event expired':'obsolete personalRatingPresentation accessibility regex'});
 console.log(`${results.at(-1).reproduced?'PASS':'FAIL'} historical reproduction: ${test}`);
}
fs.writeFileSync(path.join(__dirname,'s4-historical-results.json'),JSON.stringify({results},null,2)+'\n');if(results.some(r=>!r.reproduced))process.exitCode=1;

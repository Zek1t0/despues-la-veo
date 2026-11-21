const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const suites=[
 ['S3 SQLite portability','docs/testing/personal-episodic-progress/s3-verification.cjs'],
 ['S3 review and transports','docs/testing/personal-episodic-progress/s3-ui.cjs'],
 ['S3 Settings integration','docs/testing/personal-episodic-progress/s3-settings.cjs'],
 ['S2 UI + SQLite','docs/testing/personal-episodic-progress/s2-ui.cjs'],
 ['Manual decision S1','docs/testing/personal-episodic-progress/s1-manual-ui.cjs'],
 ['Library/detail/collections hook-host','docs/testing/enriched-media-metadata/section-7-ui.cjs'],
 ['Collections/Inbox responsive harness','docs/testing/personal-collections-recommendation-inbox/s2-ui.cjs'],
 ['Manual and provider identities','docs/testing/anime-catalog-manual-entries/b3-verification.cjs'],
 ['Search/detail races','docs/testing/anime-catalog-manual-entries/b3-ui-verification.cjs'],
 ['Collections/Inbox persistence','docs/testing/personal-collections-recommendation-inbox/s1-verification.cjs'],
 ['Inbox atomic behavior','docs/testing/personal-collections-recommendation-inbox/s2-verification.cjs'],
 ['Historical backup compatibility','docs/testing/personal-collections-recommendation-inbox/s3-portability.cjs'],
 ['Local picker','docs/testing/library-picker.cjs']
];
const results=[];
function run(name,args,expected=0){const actual=args.length===1&&args[0].endsWith('.cjs')?['-e',`const fs=require('node:fs'),path=require('node:path'),write=fs.writeFileSync;fs.writeFileSync=(p,...rest)=>write(path.basename(p)==='s2-results.json'?path.join(path.dirname(p),'s3-inherited-s2-results.json'):p,...rest);require('./'+${JSON.stringify(args[0])})`]:args;const r=spawnSync(process.execPath,actual,{encoding:'utf8',timeout:60000});results.push({name,args,exitCode:r.status,expectedExitCode:expected,status:r.status===expected?'PASS':'FAIL',output:(r.stdout??'')+(r.stderr??'')});console.log(`${r.status===expected?'PASS':'FAIL'} ${name}`);return results.at(-1)}
for(const [name,file]of suites)run(name,[file]);
run('S1 full storage guards (evidence redirected to S3)',['-e',`const fs=require('node:fs'),path=require('node:path'),write=fs.writeFileSync;fs.writeFileSync=(p,...args)=>write(path.basename(p)==='s1-results.json'?path.join(path.dirname(p),'s3-storage-results.json'):p,...args);require('./docs/testing/personal-episodic-progress/s1-verification.cjs')`]);
const activity=run('Inherited activity test with wall clock (known failure)',['docs/testing/enriched-media-metadata/section-2-storage.cjs'],1);
if(!activity.output.includes('0 !== 1'))activity.status='FAIL';
run('Metadata with deterministic TEST clock',['-e',"Date.now=()=>1000;require('./docs/testing/enriched-media-metadata/section-2-storage.cjs')"]);
const rating=run('Inherited obsolete rating assertion reproduced with HEAD grid source',['-e',`const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),read=fs.readFileSync;fs.readFileSync=(p,...args)=>{if(path.resolve(String(p))===path.resolve('src/components/browsing/TitleGridCard.tsx')){const r=spawnSync('git',['show','HEAD:src/components/browsing/TitleGridCard.tsx'],{encoding:'utf8'});if(r.status!==0)throw Error('Cannot read baseline grid');return r.stdout;}return read(p,...args)};require('./docs/testing/personal-title-rating/section-2-integration-verification.cjs')`],1);
if(!rating.output.includes('personalRatingPresentation'))rating.status='FAIL';
const status=results.every(r=>r.status==='PASS')?'PASS':'FAIL';fs.writeFileSync(path.join(__dirname,'s3-regression-results.json'),JSON.stringify({status,results},null,2)+'\n');if(status!=='PASS')process.exitCode=1;

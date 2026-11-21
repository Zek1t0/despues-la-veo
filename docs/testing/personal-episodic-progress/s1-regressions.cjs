const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const suites=[
 ['S1 domain + SQLite','docs/testing/personal-episodic-progress/s1-verification.cjs'],
 ['S1 manual decision UI TEST','docs/testing/personal-episodic-progress/s1-manual-ui.cjs'],
 ['Manual/identity historical','docs/testing/anime-catalog-manual-entries/b3-verification.cjs'],
 ['Existing search/detail hook-host','docs/testing/anime-catalog-manual-entries/b3-ui-verification.cjs'],
 ['Collections/Inbox S1','docs/testing/personal-collections-recommendation-inbox/s1-verification.cjs'],
 ['Collections/Inbox S2','docs/testing/personal-collections-recommendation-inbox/s2-verification.cjs'],
 ['Historical backup v1-v9','docs/testing/personal-collections-recommendation-inbox/s3-portability.cjs'],
 ['Backup conflicts','docs/testing/personal-collections-recommendation-inbox/s3-conflicts.cjs'],
 ['Backup failures','docs/testing/personal-collections-recommendation-inbox/s3-failures.cjs'],
 ['Local picker','docs/testing/library-picker.cjs'],
];
const results=[];
function run(name,args,expect=0){const r=spawnSync(process.execPath,args,{encoding:'utf8',timeout:60000});const output=(r.stdout??'')+(r.stderr??'');const passed=r.status===expect;
 results.push({name,args,exitCode:r.status,expectedExitCode:expect,status:passed?'PASS':'FAIL',output});console.log(`${passed?'PASS':'FAIL'} ${name}`);return r;}
for(const [name,file]of suites)run(name,[file]);
const oldTest='./docs/testing/enriched-media-metadata/section-2-storage.cjs';
// Read HEAD sources without checkout/index changes to identify an existing time-dependent failure.
const baseline=`require('./docs/testing/enriched-media-metadata/sqlite-fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{spawnSync}=require('node:child_process');
require.extensions['.ts']=(m,f)=>{const p=path.relative(process.cwd(),f).replaceAll('\\\\','/');const r=spawnSync('git',['show','HEAD:'+p],{encoding:'utf8'});if(r.status!==0)throw Error('Cannot read baseline '+p);m._compile(ts.transpileModule(r.stdout,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f)};
require(${JSON.stringify(oldTest)});`;
const old=run('Known activity retention assertion reproduced on HEAD (expected failure)',['-e',baseline],1);
if(!((old.stdout??'')+(old.stderr??'')).includes('0 !== 1')){results.at(-1).status='FAIL';console.error('Baseline did not reproduce the expected assertion');}
run('Metadata storage with deterministic TEST clock',['-e',`Date.now=()=>1000;require(${JSON.stringify(oldTest)})`]);
const rating='docs/testing/personal-title-rating/section-2-integration-verification.cjs';
const staleRating=run('Known obsolete rating source assertion (expected failure)',[rating],1);
const normalize=text=>text.replaceAll('\r\n','\n');
for(const file of [rating,'src/components/browsing/TitleGridCard.tsx']) {
 const head=spawnSync('git',['show','HEAD:'+file],{encoding:'utf8'});
 if(head.status!==0||normalize(head.stdout)!==normalize(fs.readFileSync(file,'utf8'))){results.at(-1).status='FAIL';console.error('Rating baseline source differs',file);}
}
if(!((staleRating.stdout??'')+(staleRating.stderr??'')).includes('personalRatingPresentation'))results.at(-1).status='FAIL';
const payload={status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',results};
fs.writeFileSync(path.join(__dirname,'s1-regression-results.json'),JSON.stringify(payload,null,2)+'\n');
if(payload.status!=='PASS')process.exitCode=1;

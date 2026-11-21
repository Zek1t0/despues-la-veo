const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const suites=[
 'personal-episodic-progress/s1-verification.cjs','personal-episodic-progress/s1-manual-ui.cjs',
 'personal-episodic-progress/s2-ui.cjs','personal-episodic-progress/s3-verification.cjs','personal-episodic-progress/s3-ui.cjs','personal-episodic-progress/s3-settings.cjs','personal-episodic-progress/s4-boundaries.cjs',
 'personal-collections-recommendation-inbox/s3-portability.cjs','personal-collections-recommendation-inbox/s3-conflicts.cjs','personal-collections-recommendation-inbox/s3-failures.cjs','personal-collections-recommendation-inbox/s3-settings.cjs',
 'personal-collections-recommendation-inbox/s1-verification.cjs','personal-collections-recommendation-inbox/s2-verification.cjs','personal-collections-recommendation-inbox/s1-ui.cjs','personal-collections-recommendation-inbox/s2-ui.cjs',
 'universal-media-identity/section-1-verification.cjs','universal-media-identity/section-2-sqlite-v4-verification.cjs','universal-media-identity/section-3-persistence-verification.cjs','universal-media-identity/section-4-backup-v5-verification.cjs','universal-media-identity/section-5-runtime-consumers-verification.cjs',
 'anime-catalog-manual-entries/b3-verification.cjs','anime-catalog-manual-entries/b3-ui-verification.cjs',
 'enriched-media-metadata/section-2-storage.cjs','enriched-media-metadata/section-2-backups.cjs','enriched-media-metadata/section-3-backups.cjs','enriched-media-metadata/section-6-activity.cjs','enriched-media-metadata/section-6-feed.cjs','enriched-media-metadata/section-6-tabs.cjs','enriched-media-metadata/section-7-ui.cjs',
 'expanded-media-domain/section-8-verification.cjs','personal-title-rating/section-2-integration-verification.cjs','provider-abstraction/section-3-buscar-verification.cjs','library-picker.cjs'
];
const clean=text=>[process.cwd(),os.tmpdir(),os.homedir()].reduce((text,root)=>text.replaceAll(root,'<TEST_ROOT>').replaceAll(JSON.stringify(root).slice(1,-1),'<TEST_ROOT>'),text);
const results=[];
for(const suite of suites){
 const script=`const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),write=fs.writeFileSync;fs.writeFileSync=(file,data,...rest)=>{const name=path.basename(String(file));if(name.endsWith('-results.json')){file=path.join('docs/testing/personal-episodic-progress','s4-inherited-'+name);if(typeof data==='string')data=[process.cwd(),os.tmpdir(),os.homedir()].reduce((text,root)=>text.replaceAll(root,'<TEST_ROOT>').replaceAll(JSON.stringify(root).slice(1,-1),'<TEST_ROOT>'),data)}return write(file,data,...rest)};require('./docs/testing/'+${JSON.stringify(suite)});`;
 const run=spawnSync(process.execPath,['-e',script],{encoding:'utf8',timeout:120000});
 results.push({suite,exitCode:run.status,status:run.status===0?'PASS':'FAIL',output:clean((run.stdout??'')+(run.stderr??''))});console.log(`${run.status===0?'PASS':'FAIL'} ${suite}`);
 fs.writeFileSync(path.join(__dirname,'s4-regression-results.json'),JSON.stringify({status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',results},null,2)+'\n');
}
if(results.some(r=>r.status!=='PASS'))process.exitCode=1;

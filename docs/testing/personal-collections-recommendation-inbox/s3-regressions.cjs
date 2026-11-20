const fs=require('node:fs'),{spawnSync}=require('node:child_process');
// One focused suite per affected boundary; no network, production DB or historical all-tests runner.
const tests=[
 'personal-collections-recommendation-inbox/s3-portability.cjs',
 'personal-collections-recommendation-inbox/s3-conflicts.cjs',
 'personal-collections-recommendation-inbox/s3-failures.cjs',
 'personal-collections-recommendation-inbox/s3-settings.cjs',
 'personal-collections-recommendation-inbox/s1-verification.cjs',
 'personal-collections-recommendation-inbox/s2-verification.cjs',
 'personal-collections-recommendation-inbox/s1-ui.cjs',
 'personal-collections-recommendation-inbox/s2-ui.cjs',
 'universal-media-identity/section-4-backup-v5-verification.cjs',
 'enriched-media-metadata/section-2-backups.cjs',
 'expanded-media-domain/section-8-verification.cjs',
 'enriched-media-metadata/section-6-activity.cjs',
 'enriched-media-metadata/section-6-feed.cjs',
 'enriched-media-metadata/section-6-tabs.cjs',
 'enriched-media-metadata/section-7-ui.cjs',
 'provider-abstraction/section-3-buscar-verification.cjs',
 'library-picker.cjs',
];
const results=[];
for(const test of tests){const start=Date.now();const r=spawnSync(process.execPath,['docs/testing/'+test],{encoding:'utf8',timeout:120000});results.push({test,exitCode:r.status,durationMs:Date.now()-start,output:(r.stdout??'')+(r.stderr??''),...(r.error?{error:r.error.message}:{})});fs.writeFileSync('docs/testing/personal-collections-recommendation-inbox/s3-results.json',JSON.stringify(results,null,2)+'\n');console.log(`${r.status===0?'PASS':'FAIL'} ${test}`)}
if(results.some(r=>r.exitCode!==0))process.exitCode=1;

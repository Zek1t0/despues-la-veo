const fs = require('node:fs');
(async () => {
 const results = { observedAt: new Date().toISOString(), kind: 'real HTTP, not synthetic fixtures', requests: [] };
 const base = process.argv[2] ?? 'https://kitsu.app/api/edge';
 const fields = 'canonicalTitle,titles,subtype,startDate,synopsis,categories,posterImage,coverImage,averageRating';
 for (const path of ['/anime/1?', '/anime?filter%5Btext%5D=cowboy%20bebop&page%5Blimit%5D=1&']) {
  const url = base + path + new URLSearchParams({'fields[anime]':fields,include:'categories','fields[categories]':'title'});
  try {
   const r = await fetch(url,{redirect:'error',headers:{Accept:'application/vnd.api+json'},signal:AbortSignal.timeout(15000)});
   const j=await r.json(), d=Array.isArray(j.data)?j.data[0]:j.data;
   const a=d.attributes;
   results.requests.push({url,status:r.status,finalUrl:r.url,id:d.id,keys:Object.keys(a),averageRating:a.averageRating,posterImage:a.posterImage,coverImage:a.coverImage});
   if(path.startsWith('/anime/1')) for(const image of [a.posterImage.small,a.coverImage.tiny]) {
    const ir=await fetch(image,{redirect:'error',signal:AbortSignal.timeout(15000)});
    results.requests.push({url:image,status:ir.status,finalUrl:ir.url,type:ir.headers.get('content-type'),redirected:ir.redirected});
    await ir.body?.cancel();
   }
  } catch(e) { results.requests.push({url,error:String(e),cause:String(e.cause)}); }
 }
 for(const url of ['https://kitsu.app/terms','https://kitsu.io/terms']) try {
  const r=await fetch(url,{signal:AbortSignal.timeout(15000)}); const t=await r.text();
  results.requests.push({url,status:r.status,finalUrl:r.url,contentType:r.headers.get('content-type'),title:t.match(/<title>(.*?)<\/title>/s)?.[1],termsTextAvailable:!t.includes('Just a moment') && /terms of (service|use)/i.test(t)});
 }catch(e){results.requests.push({url,error:String(e)});}
 fs.writeFileSync(base.includes('kitsu.io') ? 'docs/testing/enriched-media-metadata/section-3-live-io-evidence.json' : 'docs/testing/enriched-media-metadata/section-3-live-evidence.json',JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
})();

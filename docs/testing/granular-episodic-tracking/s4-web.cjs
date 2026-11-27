const assert=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {spawn}=require('node:child_process');
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out=path.resolve(process.env.S4_EVIDENCE_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'TEST-S4-visual-')));
const port=Number(process.env.S4_METRO_PORT||8206);
const children=[], logs=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(fn,label){
 const until=Date.now()+90000;
 while(Date.now()<until){try{const value=await fn();if(value)return value;}catch{}await sleep(350);}
 throw Error('Timeout TEST: '+label+' '+logs.join('').slice(-500));
}
function start(file,args,env){
 const child=spawn(file,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 children.push(child);child.on('error',error=>logs.push(error.message));child.stdout.on('data',v=>logs.push(String(v)));child.stderr.on('data',v=>logs.push(String(v)));
 return child;
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 start(process.execPath,[require.resolve('expo/bin/cli'),'start','--web','--localhost','--port',String(port)],{
  ...process.env,EXPO_PUBLIC_MEDIA_REVIEW:'1',EXPO_NO_DOTENV:'1',EXPO_OFFLINE:'1',CI:'1'});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'TEST-S4-chrome-'));
 start(chrome,['--headless=new','--no-first-run','--disable-gpu','--disable-background-networking',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
  '--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],process.env);
 const debug=await wait(()=>fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').match(/^\d+/)[0],'puerto Chrome');
 const page=await wait(async()=> (await (await fetch('http://127.0.0.1:'+debug+'/json/list',{signal:AbortSignal.timeout(2500)})).json()).find(p=>p.type==='page'),'Chrome CDP');
 await wait(async()=> (await fetch('http://localhost:'+port+'/status',{signal:AbortSignal.timeout(2500)})).ok,'Metro');
 const ws=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let serial=0;
 const pending=new Map();
 ws.addEventListener('message',event=>{const response=JSON.parse(event.data), done=pending.get(response.id);if(done){pending.delete(response.id);done(response);}});
 async function cdp(method,params={}){
  const id=++serial;
  const result=await new Promise(resolve=>{pending.set(id,resolve);ws.send(JSON.stringify({id,method,params}));});
  if(result.error)throw Error(result.error.message);return result.result;
 }
 const evaluate=async expression=>{
  const response=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(response.exceptionDetails)throw Error('Evaluación fallida: '+(response.exceptionDetails.exception?.description||response.exceptionDetails.text));
  return response.result.value;
 };
 const body=()=>evaluate('document.body?.innerText||""');
 const has=value=>wait(async()=> (await body()).includes(value),value).catch(async error=>{throw Error(error.message+' | '+(await body()).slice(0,300));});
 const click=async label=>{
  await wait(()=>evaluate(`(()=>{const target=[...document.querySelectorAll('[role=button],[role=checkbox],button')].find(e=>(e.getAttribute('aria-label')||e.textContent.trim())===${JSON.stringify(label)});if(!target||target.getAttribute('aria-disabled')==='true')return false;target.scrollIntoView({block:'nearest'});target.click();return true;})()`),label);
 };
 const fill=(label,value)=>evaluate(`(()=>{const input=[...document.querySelectorAll('input')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)});if(!input)throw Error('Sin input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const size=(width,height)=>cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 const screenshot=async name=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Page.enable');
 const downloads=fs.mkdtempSync(path.join(out,"downloads-"));
 await cdp('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await size(1100,950);
 await cdp('Page.navigate',{url:'http://localhost:'+port+'/dev/granular-review?backup=1'});
 await has('Bases A y B listas.');
 await click('Exportar backup v11 TEST');await has('Exportado v11 de A.');
 const downloaded=await wait(()=>{
  const file=fs.readdirSync(downloads).find(name=>name.endsWith('.json'));
  return file&&JSON.parse(fs.readFileSync(path.join(downloads,file)));
 },'backup descargado');
 assert.equal(downloaded.version,11);assert.equal(downloaded.granular.decisions.length,3);
 await click('Restaurar en base B');await has('Guía parcial');await has('3 decisiones importadas');await screenshot('s4-restauracion-parcial');
 await click('Importar decisiones opuestas');await has('3 conflictos pendientes');await has('29/02/2024');await screenshot('s4-conflictos');
 await click('Exportar informe granular completo');
 const report=await wait(()=>fs.readdirSync(downloads).filter(name=>name.endsWith('.json')).map(name=>JSON.parse(fs.readFileSync(path.join(downloads,name)))).find(value=>value.granular?.conflicts),'informe de conflictos');
 assert.equal(report.granular.conflicts.length,3);
 await click('Conservar marca local');await has('Se conservó la decisión local.');
 await click('Aplicar marca del backup');await click('Confirmar decisión granular');await has('Se aplicó la decisión del backup.');
 await has('1 conflicto pendiente · 0 omisiones');
 await click('Cambiar base de E3 TEST');await has('Se editó E3 en B.');
 await click('Aplicar marca del backup');await click('Confirmar decisión granular');await has('La decisión o identidad cambió');await screenshot('s4-obsoleto');
 await click('Cancelar aplicación granular');
 await click('Cerrar informe granular');await click('Descartar informe granular');
 await wait(async()=>!(await body()).includes('Revisión de marcas importadas'),'cierre de revisión temporal');
 await click('Restaurar sobre caché TEST');await has('Restauración sobre caché lista.');
 await cdp('Network.enable');
 await cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await click('Guía TMDB');await click('T1');await has('15 conocidos');
 assert.doesNotMatch(await body(),/\d+\s*%/);
 await screenshot('s4-cache-temporada-15');
 await click('T2');await has('1 conocidos');await has('Temporada 2');
 await screenshot('s4-cache-temporada-restaurada');
 await click('Ver episodios');await has('TMDB · Temporada 2');await has('1 conocidos');await has('T2 · E01');
 await click('Cuadrícula');await click('T1');await has('15 conocidos');
 assert.doesNotMatch(await body(),/\d+\s*%/);
 await has('T1 · E15');
 await click('Marcadas');await has('T1 · E13');
 await wait(async()=>!(await body()).includes('T1 · E14'),'filtro de marcas en cuadrícula');
 await click('Lista');await has('15 conocidos');await has('Consumo: 29/02/2024');
 await click('Sin marcar');await has('T1 · E14');
 await wait(async()=>!(await body()).includes('T1 · E13'),'filtro de pendientes en lista');
 console.log('PASS Chrome TEST v11: archivo, segunda base, parcialidad, fechas, decisiones, obsolescencia e informe.');ws.close();
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>{for(const child of children)child.kill();});

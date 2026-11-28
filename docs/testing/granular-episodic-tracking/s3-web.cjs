const assert=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {spawn}=require('node:child_process');
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out=process.env.S3_EVIDENCE_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'TEST-S3-visual-'));
const port=Number(process.env.S3_METRO_PORT||8193);
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
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'TEST-S3-chrome-'));
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
 const duplicateKeys=[];
 ws.addEventListener('message',event=>{
  const response=JSON.parse(event.data),done=pending.get(response.id);
  if(done){pending.delete(response.id);done(response);}
  if(response.method==='Runtime.consoleAPICalled'){
   const message=response.params.args.map(arg=>arg.value??'').join(' ');
   if(/same key|unique .?key.? prop/i.test(message))duplicateKeys.push(message);
  }
 });
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
 const navigate=async query=>{await cdp('Page.navigate',{url:'http://localhost:'+port+'/dev/granular-review?'+query});await has('Abrir lista TEST');};
 await cdp('Page.enable');
 await size(1100,950);
 if(process.env.GRANULAR_RUNTIME_TEST==='1'){
  await cdp('Runtime.enable');
  await cdp('Page.navigate',{url:'http://localhost:'+port});
  await has('TEST · revisión de medios · DBs aisladas');
  for(const title of ['Mapa de una calle inventada','Cuaderno de estaciones falsas','Señal de vidrio','La biblioteca de las bisagras']){
   await click('Abrir fixture '+title);
   await click('Guardar en biblioteca de prueba');
   await click('Abrir detalle local guardado');
   await has('Notas');
   assert.ok((await body()).includes(title));
   await click('Fixtures');
  }
  assert.deepEqual(duplicateKeys,[]);
  console.log('PASS Chrome TEST: cuatro fichas locales, sin avisos de claves duplicadas.');
  ws.close();
  return;
 }
 for(const contract of ['accredited','partial']){
  await navigate('size=12&contract='+contract);
  await click('Tema claro TEST');await has('Tema TEST: claro');
  await click('Guía TMDB');await click('Consultar temporadas');await click('T1');
  await click('Actualizar temporada');
  if(contract==='partial'){
   await has('Guía parcial');
   assert.equal(await evaluate("document.querySelectorAll('[role=progressbar]').length"),0);
   await screenshot('s3-guia-parcial-claro');
  }else{
   await has('0 de 11 estrenados');
   assert.equal(await evaluate("document.querySelectorAll('[role=progressbar]').length"),1);
   await screenshot('s3-ficha-tmdb-claro');
   await click('Ver episodios');
   await has('0 de 11 estrenados');await click('Marcar T1 · E01');await click('Confirmar lote');
   await has('1 de 11 estrenados');await screenshot('s3-cobertura-test');
   await evaluate(`(()=>{const Original=Date;const shifted=Original.now()+7*24*60*60*1000;window.__restoreS3Clock=()=>{window.Date=Original;};
     window.Date=class extends Original{constructor(...args){super(...(args.length?args:[shifted]));}static now(){return shifted;}};
     window.dispatchEvent(new Event('focus'));})()`);
   await has('Guía desactualizada');
   assert.equal(await evaluate("document.querySelectorAll('[role=progressbar]').length"),0);
   await has('T1 · E01');
   await evaluate("window.__restoreS3Clock();window.dispatchEvent(new Event('focus'))");
   await has('1 de 11 estrenados');
  }
 }
 await navigate('size=12&race=1');
 await click('Abrir lista TEST');await has('Ep. 5');
 await click('Grupo TEST');await click('Todos los grupos');await has('Ep. 5');
 assert.ok(!(await body()).includes('Fallo de lectura TEST del grupo.'));
 await click('Grupo TEST');
 await has('Fallo de lectura TEST del grupo.');
 assert.equal(await evaluate("document.querySelectorAll('[data-testid=granular-unit-row]').length"),0);
 await click('Todos los grupos');await has('Ep. 5');
 for(const action of ['cambiar desde','cambiar hasta','modo','grupo','cancelar','otro editor']){
  await click('Crear rango');await fill('Desde','1');await fill('Hasta','5');
  await click('Vista previa');
  switch(action){
   case 'cambiar desde': await fill('Desde','2');break;
   case 'cambiar hasta': await fill('Hasta','6');break;
   case 'modo': await click('Temporada y episodio');break;
   case 'grupo': await evaluate("Array.from(document.querySelectorAll('[aria-label]')).filter(e=>e.getAttribute('aria-label')==='Grupo TEST').at(-1).click()");break;
   case 'cancelar': await click('Cancelar edición');break;
   case 'otro editor': await click('Agregar unidad');break;
  }
  await sleep(1100);
  assert.ok(!(await body()).includes('5 solicitadas'),action);
  if(action!=='cancelar')await click('Cancelar edición');
 }
 await navigate('size=12');
 await click('Tema oscuro TEST');await has('Tema TEST: oscuro');
 await has('Última posición manual');
 await screenshot('s3-ficha');
 await click('Abrir lista TEST');await has('Ep. 5');await screenshot('s3-lista');
 await click('Opciones de Ep. 1');await has('Retirar');await click('Opciones de Ep. 1');
 await click('Cuadrícula');await has('Ep. 5');await screenshot('s3-cuadricula');
 assert.equal(await evaluate("[...document.querySelectorAll('[data-testid=granular-unit-row]')].some(e=>e.innerText.startsWith('Ep. 2'))"),false);
 await click('Seleccionar varias');
 assert.equal(await evaluate(`(()=>{const target=document.querySelector('[aria-label="Seleccionar Ep. 1"]');target.focus();return document.activeElement===target;})()`),true);
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await has('1 seleccionada');
 await click('Seleccionar Ep. 5');
 await screenshot('s3-modo-seleccion');
 await click('Marcar selección');
 await has('2 unidades');
 await screenshot('s3-seleccion');
 await click('Confirmar lote');await has('2 unidades confirmadas.');
 await click('Salir de selección');
 await click('Marcadas');await wait(async()=>await evaluate("document.querySelectorAll('[data-testid=granular-unit-row]').length" )===2,'filtro de marcas');await click('Todas');
 await click('Crear rango');await fill('Desde','1');await fill('Hasta','5');await click('Vista previa');await has('5 solicitadas');
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
 await size(320,850);await sleep(300);await evaluate(`document.querySelector('[aria-label="Confirmar y omitir coincidencias"]')?.scrollIntoView({block:'center'})`);await screenshot('s3-rango-320');
 await size(1100,950);
 await click('Cancelar edición');
 await click('Guía TMDB');await click('Consultar temporadas');await has('Especiales');
 await click('T1');await click('Actualizar temporada');await has('estrenados');
 assert.ok(!(await body()).includes('TEST Sinopsis oculta'));
 await click('Anunciadas');await has('T1 · E12');
 await click('Marcar T1 · E12');await has('Confirmar anunciado: T1 · E12');
 assert.equal(await evaluate("document.querySelector('[aria-label=\"Confirmar lote\"]')?.getAttribute('aria-disabled')"),'true');
 await click('Confirmar anunciado: T1 · E12');await click('Hoy');await click('Confirmar lote');
 await has('1 unidad confirmada.');
 const counts=[];
 for(const total of [12,100,1000,5000]){
  await navigate('size='+total+'&kind=manga');
  await click('Abrir lista TEST');await has('Cap. 2.5');
  const mounted=()=>evaluate("document.querySelectorAll('[data-testid=granular-unit-row]').length");
  await wait(async()=>await mounted()>0,'filas montadas');
  await sleep(500);
  const list=await mounted();
  await click('Cuadrícula');
  const gridAtFirstPaint=process.env.S5_ACCEPTANCE==='1'?await mounted():null;
  await sleep(500);
  const grid=await mounted();
  assert.ok(list>0&&grid>0);
  if(total>=1000)assert.ok(list<total&&grid<total);
  counts.push({total,list,grid});
  if(process.env.S5_ACCEPTANCE==='1'){
   Object.assign(counts.at(-1),{gridAtFirstPaint,viewport:await evaluate('[innerWidth,innerHeight]')});
   await click('Seleccionar varias');
   await click('Seleccionar Cap. 2.5');
   await has('1 seleccionada');
   await click('Lista');
   await has('1 seleccionada');
   await click('Salir de selección');
   await click('Marcadas');
   await has('No hay unidades en este alcance.');
   await click('Sin marcar');
   await has('Cap. 2.5');
  }
 }
 fs.writeFileSync(path.join(out,'s3-mounts.json'),JSON.stringify(counts,null,2)+'\n');
 console.log(JSON.stringify(counts));ws.close();
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>{for(const child of children)child.kill();});

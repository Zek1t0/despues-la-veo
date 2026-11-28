const assert=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {spawn}=require('node:child_process');
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out=path.resolve('.expo/redesign-s1-evidence');
const port=Number(process.env.S1_METRO_PORT||8197);
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
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'TEST-S1-chrome-'));
 start(chrome,['--headless=new','--no-first-run','--disable-gpu','--disable-background-networking','--disable-breakpad','--disable-crash-reporter',
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
  await wait(()=>evaluate(`(()=>{
    const dialogs = document.querySelectorAll('[aria-modal="true"]');
    const scope = dialogs[dialogs.length - 1] || document;
    const target = [...scope.querySelectorAll('[role=button],[role=checkbox],button')]
      .find(e => (e.getAttribute('aria-label') || e.textContent.trim()) === ${JSON.stringify(label)});
    if (!target || target.getAttribute('aria-disabled') === 'true') return false;
    target.scrollIntoView({block:'nearest'});
    target.focus();
    target.click();
    return true;
  })()`),label);
 };
 const size=(width,height)=>cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 const capture=async name=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const focusInput=()=>evaluate(`document.querySelector('input[aria-label="Título de ejemplo"]').focus()`);
 const escape=async()=>{for(const type of ['keyDown','keyUp'])await cdp('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});};
 await cdp('Page.enable');
 await size(390,950);
 await cdp('Page.navigate',{url:'http://localhost:'+port+'/dev/media-review?gallery=s1'});
 await has('Componentes compartidos');
 await wait(()=>evaluate("getComputedStyle(document.documentElement).getPropertyValue('--app-background').trim()==='#14151b'"),'Original oscuro');
 await capture('original-oscuro-390');
 await click('Claro');
 await wait(()=>evaluate("getComputedStyle(document.documentElement).getPropertyValue('--app-background').trim()==='#f4f3f8'"),'Original claro');
 await size(320,940);
 await capture('original-claro-320');
 await click('Terminados');
 await wait(()=>evaluate("document.querySelector('[aria-label=Terminados]').getAttribute('aria-pressed')==='true'"),'chip seleccionado');
 await focusInput();
 await has('Ingresá un título.');
 await capture('campos-y-controles-320');
 await click('Más opciones');
 await has('Acciones contextuales del ejemplo.');
 await wait(()=>evaluate("document.activeElement?.getAttribute('aria-label')==='Cerrar Más opciones'"),'foco inicial');
 await capture('menu-320');
 await escape();
 await wait(()=>evaluate("document.activeElement?.getAttribute('aria-label')==='Más opciones'"),'foco restaurado');
 await click('Eliminar ejemplo');
 await has('Se eliminará solo el ejemplo TEST.');
 await capture('confirmacion-320');
 await click('Confirmar eliminación del ejemplo');
 await has('Ejemplo eliminado.');
 await click('Más opciones');
 await click('Probar confirmación demorada');
 await click('Confirmar eliminación del ejemplo');
 await has('Procesando la confirmación…');
 await escape();
 assert.match(await body(), /Procesando la confirmación…/);
 assert.equal(await evaluate("document.querySelector('[aria-label=\"Cerrar Confirmar eliminación\"]').getAttribute('aria-disabled')"), 'true');
 await capture('confirmacion-en-curso-320');
 await has('Ejemplo eliminado después de la demora.');
 await wait(()=>evaluate("document.activeElement?.getAttribute('aria-label')==='Más opciones'"),'foco después de éxito demorado');
 await click('Más opciones');
 await click('Probar rechazo recuperable');
 await click('Confirmar eliminación del ejemplo');
 await has('No se pudo completar la acción. Podés reintentar.');
 await capture('confirmacion-error-320');
 await click('Reintentar');
 await has('Procesando la confirmación…');
 await has('No se pudo completar la acción. Podés reintentar.');
 await escape();
 await wait(()=>evaluate("document.activeElement?.getAttribute('aria-label')==='Más opciones'"),'foco después de cancelar tras error');
 await click('Paleta: Original');
 await has('Pinky Clouds');
 await capture('selector-320');
 await click('Lavanda');
 await escape();
 await click('Ver opciones de la tarjeta');
 await capture('lavanda-claro-elevada-320');
 await click('Paleta: Lavanda');
 await click('Pinky Clouds');
 await escape();
 await size(390,950);
 await evaluate("document.querySelector('[aria-label=Claro]').scrollIntoView({block:'center'})");
 await capture('pinky-claro-390');
 await click('Oscuro');
 await click('Paleta: Pinky Clouds');
 await click('Obsidiana');
 await escape();
 await capture('obsidiana-oscuro-390');

 await evaluate(`(() => {
   const entries = [...document.querySelectorAll('body *')]
     .filter(node => node.matches('input') || [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim()))
     .map(node => [node, parseFloat(getComputedStyle(node).fontSize), parseFloat(getComputedStyle(node).lineHeight)]);
   entries.forEach(([node, size, line]) => {
     node.style.fontSize = size * 2 + 'px';
     if (Number.isFinite(line)) node.style.lineHeight = line * 2 + 'px';
   });
   document.querySelector('[aria-label=Oscuro]').scrollIntoView({block:'center'});
 })()`);
 await capture('obsidiana-texto-web-200');
 console.log('PASS galería S1: tema, selector, chips, campos, confirmación, Escape y foco.');
 ws.close();
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const child of children) child.kill();});

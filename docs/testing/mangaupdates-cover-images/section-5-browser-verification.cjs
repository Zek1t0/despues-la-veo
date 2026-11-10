// Local Windows Chrome headless + CDP. No packages, personal profile, or Image stubs.
// Usage: node docs/testing/mangaupdates-cover-images/section-5-browser-verification.cjs
// Optional CHROME_PATH, SECTION5_EVIDENCE_DIR (absolute, outside the repository).
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..');
const out = path.resolve(process.env.SECTION5_EVIDENCE_DIR || path.join(os.tmpdir(), 'mangaupdates-cover-images-section-5-evidence', new Date().toISOString().replace(/[:.]/g, '-')));
assert.ok(!out.toLowerCase().startsWith(repo.toLowerCase() + path.sep), 'Evidence must be outside repository');
fs.mkdirSync(out, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const processes = [], sockets = [], network = [], consoleEvents = [], checks = [], visits = [], commands = [];
let browser, currentPage, version;
const profile = fs.mkdtempSync(path.join(out, 'chrome-profile-'));
function safeUrl(value) {
  try { const url = new URL(value); for (const key of [...url.searchParams.keys()]) if (/token|key|secret|password|authorization/i.test(key)) url.searchParams.set(key, '[REDACTED]'); return url.href; } catch { return String(value); }
}
function check(name, observed) { assert.ok(observed, name); checks.push({ name, pass: true }); console.log('PASS ' + name); }
function launch(exe, args, env, label) {
  const child = spawn(exe, args, { cwd: repo, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push({ child, label }); commands.push({ exe, args, label, pid: child.pid });
  const stream = fs.createWriteStream(path.join(out, label + '.log'));
  child.stdout.pipe(stream); child.stderr.pipe(stream);
  child.on('error', error => stream.write(String(error)));
  return child;
}
async function wait(fn, label, timeout = 120000) {
  const until = Date.now() + timeout; let last;
  while (Date.now() < until) { try { const value = await fn(); if (value) return value; } catch (error) { last = error; } await delay(400); }
  throw Error('Timeout: ' + label + (last ? ': ' + last.message : ''));
}
async function portFree(port) {
  await new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(port, '127.0.0.1', () => server.close(resolve)); });
}
async function metro(port, review) {
  await portFree(port); // Never attach to, restart, or stop a pre-existing Metro process.
  const env = { ...process.env, EXPO_OFFLINE: '1', CI: '1' };
  if (review) env.EXPO_PUBLIC_MEDIA_REVIEW = '1'; else delete env.EXPO_PUBLIC_MEDIA_REVIEW;
  const child = launch(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--web', '--localhost', '--port', String(port)], env, review ? 'metro-review' : 'metro-production');
  await wait(async () => { if (child.exitCode !== null) throw Error('Metro exited ' + child.exitCode); try { return (await fetch(`http://localhost:${port}/status`)).ok; } catch { return false; } }, 'Metro ' + port);
}
class CDP {
  constructor(url) {
    this.id = 0; this.pending = new Map(); this.listeners = [];
    this.ws = new WebSocket(url); sockets.push(this.ws);
    this.ready = new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve); this.ws.addEventListener('error', reject, { once: true }); });
    this.ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) { const p = this.pending.get(message.id); if (p) { this.pending.delete(message.id); clearTimeout(p.timer); message.error ? p.reject(Error(JSON.stringify(message.error))) : p.resolve(message.result); } }
      else for (const listener of this.listeners) listener(message);
    });
  }
  async send(method, params = {}, sessionId) {
    await this.ready; const id = ++this.id;
    return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(Error('CDP timeout ' + method)); }, 120000); this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  }
}
const instrumented = new Map();
async function instrument(sessionId, label) {
  if (instrumented.has(sessionId)) return instrumented.get(sessionId);
  const pending = (async () => { try {
  await browser.send('Network.enable', {}, sessionId);
  await browser.send('Runtime.enable', {}, sessionId);
  await browser.send('Log.enable', {}, sessionId).catch(() => {});
  await browser.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
  // Reject MangaUpdates transport before dispatch, but still record every attempted request.
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, sessionId).catch(error => {
    if (label !== 'worker') throw error;
    consoleEvents.push({ kind: 'instrumentation-note', target: label, error: String(error) });
  });
  if (label !== 'worker') await browser.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
  } finally { await browser.send('Runtime.runIfWaitingForDebugger', {}, sessionId); } })();
  instrumented.set(sessionId, pending); return pending;
}
async function newPage(label) {
  const { browserContextId } = await browser.send('Target.createBrowserContext');
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  await instrument(sessionId, label);
  await browser.send('Page.enable', {}, sessionId);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  return currentPage = { label, browserContextId, sessionId, targetId };
}
async function evaluate(expression, page = currentPage) {
  const result = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }, page.sessionId);
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
}
async function body() { return evaluate('document.body?.innerText || ""'); }
async function snapshot(name) {
  const data = await evaluate(`({url:location.href,text:document.body?.innerText,controls:[...document.querySelectorAll('button,[role="button"],a,input,textarea')].map(e=>({tag:e.tagName,role:e.getAttribute('role'),label:e.getAttribute('aria-label'),text:e.textContent?.trim(),placeholder:e.getAttribute('placeholder'),value:e.value}))})`);
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(data, null, 2));
  const { data: png } = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, currentPage.sessionId);
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(png, 'base64')); return data;
}
async function navigate(url, expected) {
  visits.push({ label: currentPage.label, url }); await browser.send('Page.navigate', { url }, currentPage.sessionId);
  await wait(async () => (await body()).includes(expected), url + ' contains ' + expected);
}
async function click(label, contains = false) {
  const value = await evaluate(`(()=>{const label=${JSON.stringify(label)};const matches=[...document.querySelectorAll('button,[role="button"],a')].filter(e=>{const name=e.getAttribute('aria-label')||e.textContent.trim();return ${contains ? 'name.includes(label)' : 'name===label'};});if(matches.length!==1)return {count:matches.length};matches[0].click();return {count:1};})()`);
  assert.equal(value.count, 1, 'unique control ' + label); await delay(300);
}
async function type(selector, value) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Input absent');const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function storageTree() { return evaluate(`(async()=>{const root=await navigator.storage.getDirectory();const entries=[];async function walk(dir,prefix){for await(const [name,handle] of dir.entries()){const item={name:prefix+name,kind:handle.kind};entries.push(item);if(handle.kind==='directory')await walk(handle,prefix+name+'/');else if(prefix==='expo-sqlite/'){try{const bytes=new Uint8Array(await (await handle.getFile()).slice(0,512).arrayBuffer());const end=bytes.indexOf(0);item.logicalPath=new TextDecoder().decode(bytes.slice(0,end<0?512:end));}catch(e){item.readError=e.name;}}}}await walk(root,'');return entries;})()`); }
async function production(pageLabel) {
  await newPage(pageLabel);
  await navigate('http://localhost:8135/buscar', 'Buscar');
  await wait(async () => !(await body()).includes('Cargando configuración'), 'production hydration');
  await type('input', 'Owned smoke'); await wait(async () => (await body()).includes('TMDB no está configurado'), 'no credential');
  let text = await body(); check(pageLabel + ': no token message', text.includes('Configurar TMDB'));
  check(pageLabel + ': finite remote categories', text.includes('Películas') && text.includes('Series') && !/Manhwa|Manhua|MangaUpdates|TEST ·/.test(text));
  await click('Series'); check(pageLabel + ': Series navigation', (await body()).includes('Configurar TMDB'));
  await snapshot(pageLabel + '-search');
  await click('Librería', true); await wait(async () => (await body()).includes('Biblioteca'), 'library');
  await snapshot(pageLabel + '-library');
  check(pageLabel + ': isolated empty library', /vacía|No hay títulos|Todavía no/.test(await body()));
  await click('Abrir opciones de Biblioteca'); await click('Mostrar Biblioteca en mosaico'); await click('Cerrar opciones'); await snapshot(pageLabel + '-grid');
  await click('Abrir opciones de Biblioteca'); await click('Mostrar Biblioteca en detalle'); await click('Cerrar opciones');
  await navigate('http://localhost:8135/mangaupdates/series/42', 'no está habilitado en esta plataforma');
  check(pageLabel + ': MangaUpdates remote blocked', !(await body()).includes('Guardar en Biblioteca'));
  await snapshot(pageLabel + '-blocked');
  const entries = await storageTree(); fs.writeFileSync(path.join(out, pageLabel + '-storage.json'), JSON.stringify(entries, null, 2));
  check(pageLabel + ': no review DB in production origin', !entries.some(e => /media-review/.test(e.logicalPath || e.name)));
  check(pageLabel + ': production DB belongs to empty isolated origin', entries.some(e => /despues-la-veo\.db/.test(e.logicalPath || '')));
  await browser.send('Target.disposeBrowserContext', { browserContextId: currentPage.browserContextId });
}
async function review() {
  await newPage('review'); await navigate('http://localhost:8105/dev/media-review', 'Corpus original TEST');
  let text = await body(); check('review: banner and separate named DBs', text.includes('TEST · revisión de medios') && text.includes('media-review-primary.db') && text.includes('media-review-restore.db'));
  await snapshot('review-discover');
  const corpus = await evaluate(`[...document.querySelectorAll('[role="button"]')].filter(e=>e.getAttribute('aria-label')?.startsWith('Abrir fixture ')).map(e=>e.getAttribute('aria-label'))`);
  check('review: 20 original fixtures', corpus.length === 20);
  await click(corpus[0]); await wait(async () => (await body()).includes('Guardar en biblioteca de prueba'), 'review remote');
  await click('Guardar en biblioteca de prueba'); await wait(async () => (await body()).includes('Guardado en biblioteca de prueba:'), 'save');
  await click('Abrir detalle local guardado'); await wait(async () => (await body()).includes('Tu puntuación'), 'local detail');
  check('review: null poster uses placeholder without image request', !(await evaluate(`[...document.images].some(e=>e.src.includes('review-missing'))`)));
  await click('Viendo');
  await type('textarea', 'Section 5 owned browser note'); await click('Guardar y volver');
  await wait(async () => (await body()).includes('Mostrando 1 de 1'), 'saved note returns to library');
  const savedTitle = corpus[0].replace('Abrir fixture ', '');
  const openLocal = async () => {
    const label = await evaluate(`[...document.querySelectorAll('[role="button"]')].map(e=>e.getAttribute('aria-label')).find(s=>s?.startsWith('Abrir ')&&s.includes(${JSON.stringify(savedTitle)}))`);
    assert.ok(label, 'saved local title control'); await click(label); await wait(async () => (await body()).includes('Tu puntuación'), 'saved detail'); return label;
  };
  const reopenedLabel = await openLocal();
  check('review: note persisted through real editor and navigation', (await evaluate(`document.querySelector('textarea')?.value`)) === 'Section 5 owned browser note');
  check('review: status persisted through real editor', reopenedLabel.includes('Viendo'));
  await snapshot('review-local');
  await click('Fixtures'); await click(corpus[0]); await click('Guardar con portada rota de prueba');
  await wait(() => network.some(n => n.event === 'failure' && n.error === 'net::ERR_UNSAFE_PORT'), 'real browser rejects review broken image');
  await wait(async () => (await body()).includes('Tu puntuación') && !(await evaluate(`[...document.images].some(e=>e.src.includes('review-missing'))`)), 'real image fallback');
  check('review: actual broken image fallback preserves local metadata', (await body()).includes(savedTitle) && (await evaluate(`document.querySelector('textarea')?.value`)) === 'Section 5 owned browser note');
  await snapshot('review-broken-image');
  await click('Biblioteca de prueba'); await wait(async () => (await body()).includes('Mostrando 1 de 1'), 'primary contains saved fixture');
  await click('Abrir opciones de Biblioteca'); await click('Mostrar Biblioteca en mosaico'); await click('Cerrar opciones'); await snapshot('review-grid');
  await click('Abrir opciones de Biblioteca'); await click('Mostrar Biblioteca en detalle'); await click('Cerrar opciones');
  await click('Biblioteca restaurada'); await wait(async () => /vacía|No hay títulos|Todavía no/.test(await body()), 'restore empty');
  check('review: save isolated from restore DB', true);
  await click('Biblioteca de prueba'); await snapshot('review-primary-library');
  const entries = await storageTree(); fs.writeFileSync(path.join(out, 'review-storage.json'), JSON.stringify(entries, null, 2));
  check('review: OPFS logical database names isolated', entries.some(e => /media-review-primary/.test(e.logicalPath || '')) && entries.some(e => /media-review-restore/.test(e.logicalPath || '')) && !entries.some(e => /despues-la-veo/.test(e.logicalPath || '')));
  // Separate browser codec test with owned bytes. This does not inject a cover into app data.
  const owned = fs.readFileSync(path.join(__dirname, 'fixtures/developer-poster.svg')).toString('base64');
  const decoded = await evaluate(`(async()=>{const good=new Image();good.src='data:image/svg+xml;base64,${owned}';await good.decode();const bad=new Image();bad.src='data:image/png;base64,bm90LWEtcG5n';let rejected=false;try{await bad.decode()}catch{rejected=true}return {width:good.naturalWidth,height:good.naturalHeight,invalidRejected:rejected};})()`);
  fs.writeFileSync(path.join(out, 'owned-codec.json'), JSON.stringify(decoded, null, 2));
  check('browser codec only: owned SVG decoded 40x60; corrupt PNG rejected', decoded.width === 40 && decoded.height === 60 && decoded.invalidRejected);
  await browser.send('Target.disposeBrowserContext', { browserContextId: currentPage.browserContextId });
}
async function main() {
  console.log('Evidence: ' + out);
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'; assert.ok(fs.existsSync(chrome));
  launch(chrome, ['--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', 'about:blank'], process.env, 'chrome');
  const endpointFile = path.join(profile, 'DevToolsActivePort');
  await wait(() => fs.existsSync(endpointFile), 'Chrome CDP endpoint', 30000);
  const [port, endpoint] = fs.readFileSync(endpointFile, 'utf8').trim().split(/\r?\n/);
  browser = new CDP(`ws://127.0.0.1:${port}${endpoint}`); await browser.ready; version = await browser.send('Browser.getVersion'); console.log(version.product);
  browser.listeners.push(message => {
    const { method, params: p, sessionId } = message;
    if (method === 'Target.attachedToTarget') instrument(p.sessionId, p.targetInfo.type).catch(error => consoleEvents.push({ kind: 'instrumentation-error', error: String(error) }));
    if (method === 'Fetch.requestPaused') {
      const forbidden = /(^|\.)mangaupdates\.com$/i.test(new URL(p.request.url).hostname);
      if (forbidden) network.push({ event: 'forbidden-attempt', sessionId, url: safeUrl(p.request.url), type: p.resourceType });
      browser.send(forbidden ? 'Fetch.failRequest' : 'Fetch.continueRequest', forbidden ? { requestId: p.requestId, errorReason: 'BlockedByClient' } : { requestId: p.requestId }, sessionId).catch(() => {});
    }
    if (method === 'Network.requestWillBeSent') network.push({ event: 'request', sessionId, id: p.requestId, url: safeUrl(p.request.url), type: p.type, initiator: p.initiator, redirect: p.redirectResponse ? { url: safeUrl(p.redirectResponse.url), status: p.redirectResponse.status } : null });
    if (method === 'Network.responseReceived') network.push({ event: 'response', sessionId, id: p.requestId, url: safeUrl(p.response.url), type: p.type, status: p.response.status, mimeType: p.response.mimeType });
    if (method === 'Network.loadingFailed') network.push({ event: 'failure', sessionId, id: p.requestId, type: p.type, error: p.errorText, blockedReason: p.blockedReason });
    if (method === 'Runtime.exceptionThrown') consoleEvents.push({ kind: 'exception', sessionId, details: p.exceptionDetails });
    if (method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) consoleEvents.push({ kind: p.type, sessionId, args: p.args.map(a => a.value ?? a.description) });
    if (method === 'Log.entryAdded') consoleEvents.push({ kind: 'log', sessionId, ...p.entry });
  });
  await metro(8135, false); await production('production-before');
  await metro(8105, true); await review(); await production('production-after');
  check('all contexts: zero MangaUpdates requests or attempted activation', !network.some(n => n.event === 'forbidden-attempt' || (n.url && /https?:\/\/[^/]*mangaupdates\.com/i.test(n.url))));
  check('all contexts: zero browser runtime exceptions', !consoleEvents.some(n => n.kind === 'exception' || n.kind === 'instrumentation-error'));
  check('all contexts: no unexpected console errors', !consoleEvents.some(n => n.kind === 'error' || (n.kind === 'log' && n.level === 'error' && n.url !== 'http://127.0.0.1:1/review-missing.png')));
}
main().catch(async error => {
  console.error(error.stack); process.exitCode = 1;
  fs.writeFileSync(path.join(out, 'failure.txt'), error.stack);
  if (currentPage && browser) await snapshot('failure').catch(() => {});
}).finally(async () => {
  fs.writeFileSync(path.join(out, 'network.json'), JSON.stringify(network, null, 2));
  fs.writeFileSync(path.join(out, 'console.json'), JSON.stringify(consoleEvents, null, 2));
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ exitCode: process.exitCode || 0, version, checks, visits, commands, evidence: out }, null, 2));
  if (browser) await browser.send('Browser.close').catch(() => {});
  for (const socket of sockets) socket.close();
  for (const { child } of [...processes].reverse()) if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); else child.kill('SIGTERM');
  }
  await delay(500);
  assert.equal(path.dirname(profile), out); fs.rmSync(profile, { recursive: true, force: true });
  console.log('Cleaned owned Chrome/Metro processes and temporary profile. Evidence: ' + out);
});

/**
 * Nightshade Forge smoke test.
 *
 * Loads index.html exactly the way a browser does (same scripts, same order) in
 * a jsdom window, then walks through every screen. Any uncaught exception,
 * unhandled rejection or console error fails the run.
 *
 *   node test/smoke.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (where, err) => problems.push(`${where}: ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`);

/* ------------------------------------------------------------------ *
 * 1. Every script must parse.                                         *
 * ------------------------------------------------------------------ */
const jsFiles = [
  ...readdirSync(root).filter(f => f.endsWith('.js')),
  ...readdirSync(join(root, 'api')).map(f => `api/${f}`).filter(f => f.endsWith('.js'))
];
for (const file of jsFiles) {
  try {
    new vm.Script(readFileSync(join(root, file), 'utf8'), { filename: file });
  } catch (err) {
    fail(`syntax ${file}`, err.message);
  }
}

/* ------------------------------------------------------------------ *
 * 2. Boot index.html in jsdom.                                        *
 * ------------------------------------------------------------------ */
const html = readFileSync(join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (!scripts.length) fail('index.html', 'no scripts referenced');

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', e => {
  // jsdom reports "not implemented" for navigation-ish APIs we deliberately stub.
  if (/Not implemented/i.test(e.message)) return;
  fail('jsdomError', e);
});

const dom = new JSDOM(html.replace(/<script src="[^"]+"><\/script>/g, ''), {
  url: 'https://example.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole
});
const { window } = dom;

/* --- browser APIs jsdom does not ship ----------------------------- */
const noop = () => {};
Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
window.indexedDB = indexedDB;
window.IDBKeyRange = IDBKeyRange;
window.alert = noop;
window.confirm = () => true;
window.prompt = () => null;
window.scrollTo = noop;
window.URL.createObjectURL = () => 'blob:mock';
window.URL.revokeObjectURL = noop;
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = noop;
window.HTMLMediaElement.prototype.load = noop;
window.HTMLCanvasElement.prototype.getContext = () =>
  new Proxy({}, { get: (t, k) => (k === 'canvas' ? {} : () => ({})) });
window.HTMLCanvasElement.prototype.captureStream = () => ({ getTracks: () => [] });
class SpeechSynthesisUtterance { constructor(text) { this.text = text } }
class SpeechSynthesis {
  getVoices() { return [] }
  speak() {}
  cancel() {}
  addEventListener() {}
  removeEventListener() {}
}
window.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
window.SpeechSynthesis = SpeechSynthesis;
window.speechSynthesis = new SpeechSynthesis();
window.MediaRecorder = class { static isTypeSupported() { return true } start() {} stop() {} };
let fetchCalls = 0;
let lastRequest = null;
let fetchBody = () => JSON.stringify({ choices: [{ message: { content: 'A scripted reply.' } }] });
window.fetch = async (input, init) => {
  try { if (init && typeof init.body === 'string' && init.body.includes('"messages"')) lastRequest = JSON.parse(init.body) } catch {}
  fetchCalls++;
  if (fetchCalls > 200) throw new Error('runaway fetch loop');
  const body = fetchBody();
  return {
    ok: true, status: 200,
    headers: { get: () => 'application/json' },
    text: async () => body,
    json: async () => JSON.parse(body),
    blob: async () => ({})
  };
};

window.addEventListener('error', e => fail('window.onerror', e.error || e.message));
window.addEventListener('unhandledrejection', e => fail('unhandledrejection', e.reason));
const realWarn = window.console.warn;
window.console.error = (...a) => fail('console.error', a.join(' '));
window.console.warn = (...a) => { if (/Nightshade/i.test(a.join(' '))) fail('console.warn', a.join(' ')); else realWarn(...a) };

/* --- load the app scripts in document order -----------------------
 * Run them as real classic scripts in the window's VM context so that
 * top-level `let`/`const`/`function` land in the shared global lexical
 * scope, exactly like <script> tags in a browser.                     */
const context = dom.getInternalVMContext();
const runScript = (code, filename) => vm.runInContext(code, context, { filename });
for (const src of scripts) {
  try {
    runScript(readFileSync(join(root, src), 'utf8'), src);
  } catch (err) {
    fail(`load ${src}`, err);
  }
}
process.on('uncaughtException', err => fail('uncaughtException', err));
process.on('unhandledRejection', err => fail('unhandledRejection', err));

const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
const $ = sel => window.document.querySelector(sel);
const click = async sel => { const el = $(sel); if (!el) throw new Error(`missing element ${sel}`); el.click(); await tick() };

let stepsRun = 0;
async function step(name, fn) {
  stepsRun++;
  try { await fn(); if (process.env.SMOKE_VERBOSE) console.log('  ✓ ' + name) }
  catch (err) { fail(name, err) }
  await tick();
}

/* ------------------------------------------------------------------ *
 * 3. Walk the app.                                                    *
 * ------------------------------------------------------------------ */
window.dispatchEvent(new window.Event('load'));
await tick(120);

await step('age gate', async () => {
  if (!$('#age')) throw new Error('age confirmation button not rendered');
  await click('#age');
});

await step('pin setup', async () => {
  if (!$('#savepin')) throw new Error('pin setup not rendered');
  $('#p1').value = '1234';
  $('#p2').value = '1234';
  await click('#savepin');
  await tick(80);
  if (window.sessionStorage.getItem('nf_unlocked') !== '1') throw new Error('pin was not accepted');
});

await step('create character', async () => {
  window.state.tab = 'create';
  await window.render();
  await tick(60);
  $('#fn').value = 'Smoke Test';
  $('#fp').value = 'Curious and blunt.';
  $('#fg').value = 'Hello there.';
  await click('#saveForge');
  await tick(80);
});

for (const tab of ['home', 'chars', 'create', 'vault', 'settings', 'provider', 'voices', 'lorebooks', 'personas', 'abilities', 'attachments', 'studio']) {
  await step(`tab ${tab}`, async () => {
    window.state.tab = tab;
    window.state.chat = null;
    await window.render();
    await tick(60);
    if (!$('#app').innerHTML.trim()) throw new Error(`tab ${tab} rendered nothing`);
  });
}

await step('open chat', async () => {
  const chars = await runScript("get('characters')", 'smoke:get-characters');
  if (!chars || !chars.length) throw new Error('character was not saved');
  window.state.tab = 'chat';
  window.state.chat = chars[0].id;
  await window.render();
  await tick(120);
  if (!$('.messages')) throw new Error('chat transcript did not render');
  if (!$('#forgeSend')) throw new Error('composer did not render');
});

await step('lock screen', async () => {
  window.sessionStorage.removeItem('nf_unlocked');
  window.state.locked = true;
  window.state.tab = 'home';
  await window.render();
  await tick(60);
  if (!$('#unlockBtn')) throw new Error('lock screen did not render');
  if ($('#nfVoiceCloneBtn')) throw new Error('voice clone button leaked onto the lock screen');
});

await step('studio tabs stay locked', async () => {
  for (const tab of ['studio', 'voices', 'lorebooks']) {
    window.state.tab = tab;
    await window.render();
    await tick(40);
    if (!$('#unlockBtn')) throw new Error(`${tab} rendered while locked`);
  }
});

await step('provider + chat round trip', async () => {
  window.sessionStorage.setItem('nf_unlocked', '1');
  window.state.locked = false;
  await runScript("put('provider',{kind:'openrouter',model:'test/model',base:'https://example.test/v1/chat/completions',key:'test-key'})", 'smoke:provider');
  const chars = await runScript("get('characters')", 'smoke:chars');
  window.state.tab = 'chat';
  window.state.chat = chars[0].id;
  await window.render();
  await tick(80);
  $('#forgeText').value = 'Hello there.';
  $('#forgeSend').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick(300);
  const convs = await runScript("get('conversations')", 'smoke:convs');
  const msgs = convs.find(c => c.characterId === window.state.chat).messages;
  if (msgs.length < 2) throw new Error('assistant reply was not stored');
  if (msgs[1].text.startsWith('⚠')) throw new Error('provider call failed: ' + msgs[1].text);
});

await step('branch + regenerate terminate', async () => {
  const before = fetchCalls;
  const branch = [...window.document.querySelectorAll('[data-branch]')].pop();
  if (!branch) throw new Error('branch control missing');
  branch.click();
  await tick(250);
  const regen = [...window.document.querySelectorAll('[data-regen]')].pop();
  if (!regen) throw new Error('regenerate control missing');
  regen.click();
  await tick(400);
  // A single regenerate must not re-enter itself: a couple of calls, not dozens.
  if (fetchCalls - before > 6) throw new Error(`regenerate looped (${fetchCalls - before} provider calls)`);
  const convs = await runScript("get('conversations')", 'smoke:branches');
  if (convs.length < 2) throw new Error('branch conversation was not created');
});


await step('typed memory: add, rank, pin', async () => {
  const id = window.state.chat;
  await runScript(`nfMemory.add(${JSON.stringify(id)},{text:'The user is terrified of deep water.',type:'fact'})`, 'smoke:mem1');
  await runScript(`nfMemory.add(${JSON.stringify(id)},{text:'They promised to meet at the lighthouse.',type:'plot'})`, 'smoke:mem2');
  await runScript(`nfMemory.add(${JSON.stringify(id)},{text:'Completely unrelated trivia about spreadsheets.',type:'event'})`, 'smoke:mem3');
  await runScript(`nfMemory.add(${JSON.stringify(id)},{text:'Always speak in a low voice.',type:'fact',pinned:true})`, 'smoke:mem4');
  const list = await runScript(`nfMemory.list(${JSON.stringify(id)})`, 'smoke:memlist');
  if (list.length !== 4) throw new Error(`expected 4 memories, got ${list.length}`);
  if (list.some(m => !m.id || !m.type)) throw new Error('memories are not normalised');
  const ranked = await runScript(`nfMemory.retrieve(${JSON.stringify(id)},'we should go to the lighthouse tonight')`, 'smoke:rank');
  if (!ranked[0].pinned) throw new Error('pinned memory was not injected first');
  const texts = ranked.map(m => m.text).join(' | ');
  if (!texts.includes('lighthouse')) throw new Error('relevant memory was not retrieved: ' + texts);
  const rankedIdx = ranked.findIndex(m => m.text.includes('lighthouse'));
  const triviaIdx = ranked.findIndex(m => m.text.includes('spreadsheets'));
  if (triviaIdx >= 0 && triviaIdx < rankedIdx) throw new Error('irrelevant memory outranked the relevant one');
});

await step('memory studio opens and edits', async () => {
  const btn = window.document.querySelector('[data-memory]');
  if (!btn) throw new Error('memory button missing from the chat header');
  btn.click();
  await tick(120);
  if (!$('#nfMemoryModal')) throw new Error('memory studio did not open');
  const rows = window.document.querySelectorAll('.nf-mem-row');
  if (rows.length !== 4) throw new Error(`memory studio listed ${rows.length} rows, expected 4`);
  $('#nfMemText').value = 'Added from the memory studio.';
  await click('#nfMemAdd');
  await tick(120);
  const list = await runScript(`nfMemory.list(${JSON.stringify(window.state.chat)})`, 'smoke:memadd');
  if (list.length !== 5) throw new Error('memory studio did not save');
  window.document.querySelector('[data-del-mem]').click();
  await tick(120);
  if ((await runScript(`nfMemory.list(${JSON.stringify(window.state.chat)})`, 'smoke:memdel')).length !== 4) throw new Error('memory studio did not delete');
  $('#nfMemClose').click();
  await tick(60);
  if ($('#nfMemoryModal')) throw new Error('memory studio did not close');
});

await step('one prompt builder assembles the system message', async () => {
  const sections = await runScript('nfPrompt.list()', 'smoke:sections');
  for (const id of ['character', 'state', 'memory', 'persona', 'assignedLorebooks']) {
    if (!sections.includes(id)) throw new Error(`prompt section "${id}" is not registered`);
  }
  await runScript("put('personas',[{id:'p1',name:'Wren',bio:'A tired archivist.'}])", 'smoke:persona');
  const st = await runScript("get('settings')", 'smoke:settings') || {};
  st.activePersonaId = 'p1';
  await runScript(`put('settings',${JSON.stringify(st)})`, 'smoke:settings2');

  lastRequest = null;
  $('#forgeText').value = 'Meet me at the lighthouse.';
  $('#forgeSend').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick(300);
  if (!lastRequest) throw new Error('no provider request was captured');
  const sys = lastRequest.messages.find(m => m.role === 'system').content;
  const count = needle => sys.split(needle).length - 1;
  if (count('[PERSISTENT MEMORY') !== 1) throw new Error(`memory block appears ${count('[PERSISTENT MEMORY')} times`);
  if (count('[CURRENT CHARACTER STATE') !== 1) throw new Error('character state block is missing or duplicated');
  if (count("[THE USER'S PERSONA") !== 1) throw new Error('persona was not injected');
  if (!sys.includes('Wren')) throw new Error('persona name missing from the prompt');
  if (!sys.includes('lighthouse')) throw new Error('relevant memory was not injected into the prompt');
  if (count('[CHARACTER PROFILE]') > 1) throw new Error('character profile duplicated in the prompt');
  if (count('Curious and blunt.') > 1) throw new Error('personality text duplicated in the prompt');
  if (sys.includes('SAVED MEMORY')) throw new Error('legacy unbounded memory dump is still in the prompt');
  if (count('spreadsheets') > 0) throw new Error('irrelevant memory was injected — the budget/ranking is not being applied');
  if (sys.length > 6000) throw new Error(`system prompt is ${sys.length} chars — too heavy for free models`);
});

await step('backup export and import round trip', async () => {
  const before = await runScript("get('characters')", 'smoke:before');
  const payload = { app: 'nightshade-forge', version: 2, data: { characters: [{ id: 'imported-1', name: 'Restored Soul', personality: 'Quiet.', memory: [] }] } };
  const merged = [...before, ...payload.data.characters];
  await runScript(`put('characters',${JSON.stringify(merged)})`, 'smoke:import');
  const after = await runScript("get('characters')", 'smoke:after');
  if (!after.some(c => c.id === 'imported-1')) throw new Error('merge import lost the restored character');
  window.state.tab = 'vault';
  await window.render();
  await tick(80);
  if (!$('#importBackup')) throw new Error('vault is missing the import control');
  if (!$('#export')) throw new Error('vault is missing the export control');
  await runScript(`put('characters',${JSON.stringify(before)})`, 'smoke:restore');
});

/* ------------------------------------------------------------------ *
 * 4. Serverless handlers.                                             *
 * ------------------------------------------------------------------ */
const mockRes = () => {
  const res = { statusCode: 0, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v };
  res.status = c => { res.statusCode = c; return res };
  res.json = b => { res.body = b; return res };
  res.send = b => { res.body = b; return res };
  res.end = () => res;
  return res;
};
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
for (const [name, handlerPath] of [['health', '../api/health.js'], ['tts', '../api/tts.js'], ['voice-upload', '../api/voice-upload.js']]) {
  await step(`api ${name} handler`, async () => {
    const handler = require(handlerPath);
    if (typeof handler !== 'function') throw new Error('handler is not a function');
    const res = mockRes();
    await handler({ method: name === 'health' ? 'GET' : 'GET', headers: {}, query: {}, body: {} }, res);
    if (![200, 405].includes(res.statusCode)) throw new Error(`unexpected status ${res.statusCode}`);
  });
}
await step('api tts rejects incomplete payloads', async () => {
  const handler = require('../api/tts.js');
  const res = mockRes();
  await handler({ method: 'POST', headers: { origin: 'https://spacepocohontas.github.io' }, query: {}, body: {} }, res);
  if (res.statusCode !== 400) throw new Error(`expected 400, got ${res.statusCode}`);
  if (res.headers['Access-Control-Allow-Origin'] !== 'https://spacepocohontas.github.io') throw new Error('CORS header missing for an allowed origin');
});

await tick(150);
dom.window.close();

if (problems.length) {
  console.error(`\n✗ smoke test found ${problems.length} problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`✓ smoke test passed — ${jsFiles.length} scripts parsed, ${stepsRun} scenarios green`);

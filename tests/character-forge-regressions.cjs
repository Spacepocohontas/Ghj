// Regression tests for browser-local imports and Character Forge call sessions.
// Run: node tests/character-forge-regressions.cjs (no dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const read = p => fs.readFileSync(p, 'utf8');
const bareApp = read('app.js').replace(/\(async\(\)=>\{await openDB\(\);render\(\);setInterval\([\s\S]*?\}\)\(\);?\s*$/, '');
const appContext = { crypto: webcrypto, structuredClone, queueMicrotask };
vm.runInNewContext(bareApp + '\n globalThis.__test={checkBackupRecord,restoreBackup,scrubBackupSettings,setDb(x){db=x}};', appContext);
const a = appContext.__test;
const results = [];
function check(name, fn) { results.push(Promise.resolve().then(fn).then(() => { console.log('PASS', name); }, e => { console.error('FAIL', name, e); process.exitCode = 1; })); }
function mockDatabase(data, fail = false) {
  return { transaction(_name, mode) {
    const tx = { oncomplete: null, onabort: null, onerror: null, error: null };
    const pending = [];
    tx.objectStore = () => ({
      get(key) {
        const req = { result: clone(data[key]), onsuccess: null, onerror: null };
        queueMicrotask(() => req.onsuccess?.());
        return req;
      },
      put(value, key) {
        pending.push([key, clone(value)]);
        queueMicrotask(() => {
          if (fail) { tx.error = new Error('QuotaExceededError'); tx.onabort?.(); return; }
          if (mode === 'readwrite') for (const [k, v] of pending) data[k] = v;
          pending.length = 0;
          tx.oncomplete?.();
        });
        return {};
      }
    });
    return tx;
  }};
}
async function testBackups() {
  assert.throws(() => a.checkBackupRecord('characters', {id:'x',tags:{}}, 0), /tags/);
  assert.throws(() => a.checkBackupRecord('conversations', {id:'x',characterId:'z',messages:[{role:'user',text:8}]}, 0), /message/);
  assert.throws(() => a.checkBackupRecord('lorebooks', {id:'x',entries:[{content:8}]}, 0), /entry/);
  assert.throws(() => a.checkBackupRecord('voiceCollection', {id:'x',data:{}}, 0), /audio/);
  const clean = a.scrubBackupSettings({autoRead:true,apiKey:'hidden',provider:'hidden',theme:'dark'});
  assert.equal(clean.theme, 'dark');
  assert.equal(clean.apiKey, undefined);
  assert.equal(clean.provider, undefined);
  const data = {characters:[{id:'old',name:'Existing',tags:[]}],conversations:[],settings:{autoRead:false},nf_lorebooks:[],voiceCollection:[]};
  a.setDb(mockDatabase(data));
  const count = await a.restoreBackup({characters:[{id:'old',name:'Should not replace',tags:[]},{id:'new',name:'New',tags:['goth']}],conversations:[{id:'c1',characterId:'new',messages:[{role:'user',text:'hello'}]}],settings:{autoRead:true,apiKey:'hidden'}});
  assert.equal(count, 3);
  assert.equal(data.characters.length, 2);
  assert.equal(data.characters[0].name, 'Existing');
  assert.equal(data.conversations[0].messages[0].text, 'hello');
  assert.equal(data.settings.autoRead, true);
  assert.equal(data.settings.apiKey, undefined);
  const snapshot = JSON.stringify(data);
  a.setDb(mockDatabase(data, true));
  await assert.rejects(a.restoreBackup({characters:[{id:'bad',name:'Fail',tags:[]}]}), /QuotaExceededError/);
  assert.equal(JSON.stringify(data), snapshot);
}
async function testCalls() {
  const data = {characters:[{id:'A',name:'Ada'},{id:'B',name:'Bea'}],conversations:[]};
  const get = async k => clone(data[k]);
  const put = async (k,v) => { data[k] = clone(v); };
  const spoken = [];
  const window = { render: async()=>{},addEventListener(){}, nfSpeakCharacter:async(text,c)=>{spoken.push(c.id+':'+text);return true;} };
  const document = {addEventListener(){},querySelector(selector){return selector === '#app' ? {contains(view){return view.isConnected;}} : null;}};
  const state = {tab:'call',chat:'A'};
  const rawCall = read('voice-call.js').replace(/^\(\(\)=>\{\s*/, '').replace(/\}\)\(\);\s*$/, '');
  const ctx = {window,document,get,put,state,crypto:webcrypto,clearInterval};
  vm.runInNewContext(rawCall + '\n globalThis.__test={queueCallTurn,stopCall,setSession(s){callSession=s}};', ctx);
  const v = () => {
    const elements = {}, events = [];
    return {isConnected:true,events,querySelector(selector){
      return elements[selector] ||= {textContent:'',insertAdjacentHTML(_where,html){events.push(html);}};
    }};
  };
  const viewA = v(), sessionA = {view:viewA,version:0};
  ctx.__test.setSession(sessionA);
  window.nfCallReply = async (c,x) => c.name+' reply to '+x.messages.at(-1).text;
  await Promise.all([
    ctx.__test.queueCallTurn(data.characters[0],'one',sessionA,0),
    ctx.__test.queueCallTurn(data.characters[0],'two',sessionA,0)
  ]);
  assert.deepEqual(data.conversations[0].messages.map(m=>m.role+':'+m.text),
    ['user:one','assistant:Ada reply to one','user:two','assistant:Ada reply to two']);
  let release, ready;
  const waiting = new Promise(resolve=>release=resolve);
  const started = new Promise(resolve=>ready=resolve);
  window.nfCallReply = async () => { ready(); await waiting; return 'late answer'; };
  const pending = ctx.__test.queueCallTurn(data.characters[0],'slow',sessionA,0);
  await started;
  ctx.__test.stopCall();
  const viewB = v();
  ctx.__test.setSession({view:viewB,version:0});
  release();
  await pending;
  assert.equal(data.conversations[0].messages.at(-1).text, 'late answer');
  assert.equal(viewB.events.length, 0);
  assert.ok(!viewA.events.some(t=>t.includes('late answer')));
  assert.ok(!spoken.includes('B:late answer'));
}
function testProviderRouting() {
 const window = {render: async()=>{}};
 vm.runInNewContext(read('provider-studio.js'),{window});
 assert.equal(window.nfProviderEndpoint({kind:'openrouter',model:'openrouter/free',base:'https://nightcast-studio.vercel.app/api/chat'}),
   'https://openrouter.ai/api/v1/chat/completions');
 assert.equal(window.nfProviderEndpoint({model:'openrouter/free',base:'https://nightcast-studio.vercel.app/api/chat'}),
   'https://openrouter.ai/api/v1/chat/completions');
 assert.equal(window.nfProviderEndpoint({kind:'huggingface',base:'https://wrong.example/chat'}),
   'https://router.huggingface.co/v1/chat/completions');
 assert.equal(window.nfProviderEndpoint({kind:'openai-compatible',base:'https://my-model.example/v1/chat/completions'}),
   'https://my-model.example/v1/chat/completions');
 const err=window.nfProviderResponseError({status:404},'<!DOCTYPE html><html><title>Nightcast Studio</title></html>',{},{
   kind:'openai-compatible',base:'https://nightcast-studio.vercel.app/api/chat'
 });
 assert.match(err,/returned a webpage/);
 assert.ok(!err.includes('<!DOCTYPE'));
 const apiErr=window.nfProviderResponseError({status:429},'{"error":{"message":"Rate limit"}}',{error:{message:'Rate limit'}},{kind:'openrouter'});
 assert.match(apiErr,/Rate limit/);
}
check('provider routing prevents Nightcast 404 HTML leakage',testProviderRouting);
async function testIphoneVoiceModal(){
 let injectedCss='',spoken='';
 const speechSynthesis={
  getVoices:()=>[],cancel(){},
  speak(utterance){spoken=utterance.text;}
 };
 class SpeechSynthesisUtterance{constructor(text){this.text=text;}}
 const document={
  querySelector:()=>null,
  createElement:()=>({id:'',textContent:''}),
  head:{appendChild(node){injectedCss=node.textContent;}}
 };
 const window={render:async()=>{},speechSynthesis};
 const navigator={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'};
 vm.runInNewContext(read('forge-chat-voice-ux.js'),{window,document,navigator,speechSynthesis,SpeechSynthesisUtterance});
 assert.ok(injectedCss.includes('.nf-voice-modal{'));
 assert.ok(injectedCss.includes('.nf-voice-sheet{'));
 assert.match(injectedCss,/max-height:88dvh/);
 assert.match(read('forge-chat-voice-ux.js'),/Kokoro downloads a large local model/);
 const ok=await window.nfSpeakCharacter('hello device',{voice:{provider:'browser',browserVoice:''}});
 assert.equal(ok,true);
 assert.equal(spoken,'hello device');
 const chatterbox=read('chatterbox-voice-ui.js');
 assert.ok(chatterbox.includes('/iPhone|iPad|iPod/i.test(navigator.userAgent)'));
}
check('iPhone voice styling and default device speech',testIphoneVoiceModal);
check('backup validation, safe merge and rollback', testBackups);
check('serialized calls and correct character for delayed replies', testCalls);
Promise.all(results).then(()=>{ if(!process.exitCode) console.log('Character Forge regression checks passed.'); });
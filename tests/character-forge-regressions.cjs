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

async function testRegenerateNoDoubleRequestOrFlicker(){
 const all={characters:[{id:'A',name:'Aster',personality:'Careful'}],conversations:[{id:'conversation-A',characterId:'A',messages:[{role:'user',text:'Hello'},{role:'assistant',text:'Original'}]}],provider:{kind:'openrouter',base:'https://openrouter.ai/api/v1/chat/completions',key:'fake',model:'openrouter/free'}};
 const get=async k=>clone(all[k]);
 const put=async(k,v)=>{all[k]=clone(v)};
 const handlers={},textNode={textContent:'Original'};
 const bubble={dataset:{messageIndex:'1'},querySelector:k=>k===':scope > div:first-child'?textNode:null};
 const button={dataset:{regen:'1'},disabled:false,isConnected:true,textContent:'↻',closest:k=>k==='.bubble'?bubble:null};
 const document={body:{},addEventListener(name,handler,capture){if(name==='click'&&capture)handlers.click=handler},querySelector:k=>k.includes('data-message-index')?bubble:null};
 class MutationObserver{observe(){}}
 let requestCount=0,completeRequest;
 const waiting=new Promise(resolve=>completeRequest=resolve);
 const fetch=async()=>{requestCount++;await waiting;return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'Updated answer'}}]})}};
 const window={render:async()=>{throw Error('Regeneration should never remount whole chat')},nfProviderEndpoint:()=>all.provider.base};
 const state={tab:'chat',chat:'A',nfConversationId:'conversation-A'};
 vm.runInNewContext(read('chat-history.js'),{window,document,MutationObserver,get,put,fetch,state,alert:msg=>{throw Error(msg)},setTimeout:()=>{}});
 const e={target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}};
 handlers.click(e);handlers.click(e);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requestCount,1,'two taps must issue a single provider request');
 completeRequest();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(all.conversations[0].messages[1].text,'Updated answer');
 assert.equal(textNode.textContent,'Updated answer');
 assert.equal(all.conversations[0].messages[1].variants.length,2);
 assert.equal(button.disabled,false);
 assert.equal(read('message-menu.js').includes("document.querySelectorAll('[data-regenerate]')[i]?.click()"),false);
 assert.equal(read('chat-upgrades.js').includes('data-regenerate'),false);
}
function testManualVoiceStartsFromTap(){
 const listeners={};let spoken='';
 const document={body:{},addEventListener(name,fn,capture){if(name==='click'&&capture)listeners.click=fn},querySelectorAll:()=>[]};
 const window={state:{chat:'A'},__nfChatCharacter:{id:'A',voice:{provider:'browser'}},nfSpeakCharacter:(t)=>{spoken=t;return Promise.resolve(true)},addEventListener(){}};
 const localStorage={getItem:()=>null,setItem(){}};
 class MutationObserver{observe(){}}
 vm.runInNewContext(read('auto-voice.js'),{document,window,MutationObserver,localStorage,navigator:{userAgent:'iPhone'},get:async()=>[],setTimeout:()=>{},clearTimeout:()=>{},console});
 assert.equal(window.nfAutoVoice.enabled(),false,'iPhone should start with auto voice off unless explicitly enabled');
 const bubble={querySelector:()=>({textContent:'Tap to hear this'})};
 const button={dataset:{speak:'1'},closest:k=>k==='.bubble'?bubble:null};
 listeners.click({target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(spoken,'Tap to hear this','speech starts synchronously during tap');
}
check('Regenerate is single-request and updates in place',testRegenerateNoDoubleRequestOrFlicker);
check('iPhone manual playback is started by the user tap',testManualVoiceStartsFromTap);


async function testWorldJournalFeedAndVoice(){
 const store={characters:[{id:'a',name:'Aster',personality:'mysterious',backstory:'ancient library'}]};
 const context={
  window:{render:async()=>{},speechSynthesis:null},
  document:{},state:{tab:'home',locked:false},
  sessionStorage:{getItem:()=>null},
  get:async k=>clone(store[k]),
  put:async(k,v)=>{store[k]=clone(v)},
  crypto:webcrypto,
  navigator:{language:'en-US',userAgent:'iPhone'},
  console
 };
 vm.runInNewContext(read('character-world.js'),context);
 const w=context.window.nfCharacterWorld;
 assert.ok(w,'World APIs are registered');
 assert.equal(w.isDate(w.today()),true);
 assert.equal(w.isDate('2099-01-01'),false,'future journal dates are blocked');
 assert.equal(w.isDate('2026-02-30'),false,'impossible calendar dates are blocked');
 assert.match(w.journalPrompt(store.characters[0],'2020-01-01'),/2020-01-01/);
 assert.match(w.postPrompt(store.characters[0]),/mysterious/);
 const entry=await w.saveJournal('a','2020-01-01','My private secret.');
 assert.equal(store.nf_character_journals[0].id,entry.id);
 assert.equal(store.nf_character_journals[0].date,'2020-01-01');
 await assert.rejects(w.saveJournal('a','2099-01-01','Time traveler'),/valid date/);
 const post=await w.savePost('a','Midnight in the library.');
 await w.commentPost(post.id,'you','What happened?');
 assert.equal(store.nf_character_posts[0].comments.length,1);
 assert.equal(store.nf_character_posts[0].comments[0].text,'What happened?');
 assert.equal(read('index.html').includes('character-world.js'),true);
 assert.equal(read('index.html').includes('character-world.css'),true);
 assert.equal(read('sw.js').includes('character-world.js'),true);
 const v={window:{},navigator:{language:'en-US',userAgent:'iPhone'}};
 vm.runInNewContext(read('voice-fallback.js'),v);
 assert.equal(v.window.nfBrowserVoice.normalizeSpeech('**Hello!**',{speakMode:'all'}),'Hello!');
 assert.equal(v.window.nfBrowserVoice.normalizeSpeech('*turns* "Come closer," she said.',{speakMode:'dialogue'}),'Come closer,');
 assert.equal(v.window.nfBrowserVoice.normalizeSpeech('*turns* Hello.',{speakMode:'dialogue'}),'Hello.');
 const b=appContext.__test;
 assert.throws(()=>b.checkBackupRecord('journals',{id:'x',characterId:'a',date:'2020-01-01',text:7},0),/journal/);
 assert.throws(()=>b.checkBackupRecord('posts',{id:'y',characterId:'a',text:'hello',comments:[{authorId:'a',text:42}]},0),/comment/);
 const data={journals:[],posts:[],nf_character_journals:[],nf_character_posts:[]};
 b.setDb(mockDatabase(data));
 await b.restoreBackup({journals:[entry],posts:[store.nf_character_posts[0]]});
 assert.equal(data.nf_character_journals.length,1);
 assert.equal(data.nf_character_posts.length,1);
 assert.equal(data.nf_character_posts[0].comments.length,1);
}
check('dated fictional journals, social interactions, free voice controls and backup',testWorldJournalFeedAndVoice);


function testCharacterForgeWorldNavigationIsIsolated(){
 const index=read('index.html'),sw=read('sw.js');
 assert.ok(index.includes('<script src="character-world.js"></script>'),'World entry must be loaded');
 assert.ok(index.includes('character-world.css'),'World mobile styling must be loaded');
 for(const forbidden of ['<script src="gemini-podcast-sidecar.js">','gemini-podcast-sidecar.css','src="/studio-toolkit.js"']){
  assert.equal(index.includes(forbidden),false,'Character Forge must not load '+forbidden);
 }
 assert.equal(sw.includes('gemini-podcast-sidecar.js'),false,'Unrelated podcast sidecar must not be precached');
 assert.equal(sw.includes('studio-toolkit.js'),false,'Unrelated toolkit must not be precached');
 const ctx={crypto:webcrypto,structuredClone,queueMicrotask};
 vm.runInNewContext(bareApp+'\nglobalThis.__nav=nav();',ctx);
 const html=ctx.__nav;
 assert.ok(html.includes('data-tab="world"'),'World must be part of main navigation');
 assert.ok(html.indexOf('data-tab="world"')<html.indexOf('data-tab="chars"'),'World must be visible before the long tab list');
 assert.ok(read('forge-studio.js').includes('<button data-tab="world">'),'Studio navigation must also link to World');
 assert.ok(read('character-world.css').includes('.nav [data-tab="world"]'),'World must have mobile nav styling');
 const world=read('character-world.js');
 assert.ok(world.includes("state.tab==='world'"),'World tab must render a page');
 assert.ok(world.includes('await page()'),'World must provide content');
}
check('World tab is visible and unrelated podcast/toolkit overlays are gone',testCharacterForgeWorldNavigationIsIsolated);

check('backup validation, safe merge and rollback', testBackups);
check('serialized calls and correct character for delayed replies', testCalls);

async function testAndroidFreeVoiceFallback(){
  let priorCount=0, spoken='';
  const speechSynthesis={
    speaking:false,
    getVoices:()=>[{name:'Device English',lang:'en-US'}],
    cancel(){},
    speak(u){spoken=u.text;u.onstart?.();}
  };
  class SpeechSynthesisUtterance{constructor(text){this.text=text;}}
  const window={nfSpeakCharacter:async()=>{priorCount++;return false;}};
  const navigator={userAgent:'Mozilla/5.0 (Linux; Android 14; Mobile) Chrome/130',language:'en-US',gpu:{requestAdapter(){return {};}}};
  vm.runInNewContext(read('voice-fallback.js'),{
    window,navigator,speechSynthesis,SpeechSynthesisUtterance,
    setTimeout:()=>0,console
  });
  const ok=await window.nfSpeakCharacter('Hello Android',{voice:{provider:'chatterbox',providerVoiceId:'dark'}});
  assert.equal(ok,true);
  assert.equal(spoken,'Hello Android');
  assert.equal(priorCount,0,'must not attempt the large Chatterbox model on mobile');
  const ui=read('chatterbox-voice-ui.js');
  assert.ok(ui.includes('/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)'));
  assert.ok(ui.includes('they are not Chatterbox AI or voice cloning'));
}
check('Android Chatterbox choice speaks via free device voice without downloading AI model',testAndroidFreeVoiceFallback);
Promise.all(results).then(()=>{ if(!process.exitCode) console.log('Character Forge regression checks passed.'); });
(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const voices=()=>('speechSynthesis'in window&&speechSynthesis.getVoices)?speechSynthesis.getVoices():[];
let callTimer=null,callOn=false,rec=null,muted=false;
async function chars(){return await get('characters')||[]}
async function currentChar(){if(typeof state==='undefined'||!state.chat)return null;return (await chars()).find(c=>c.id===state.chat)||null}
async function charById(id){return (await chars()).find(c=>c.id===id)||null}
async function saveChar(c){const cs=await chars(),i=cs.findIndex(x=>x.id===c.id);if(i>=0)cs[i]=c;await put('characters',cs)}
function voiceOptions(selected){return voices().map((v,i)=>`<option value="${i}" ${v.name===selected?'selected':''}>${esc(v.name)} — ${esc(v.lang)}</option>`).join('')}
async function speak(text,c){if(window.nfSpeakCharacter&&await window.nfSpeakCharacter(text,c))return;if(!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);const v=voices().find(x=>x.name===c?.voice?.browserVoice);if(v)u.voice=v;u.rate=Number(c?.voice?.rate)||1;u.pitch=Number(c?.voice?.pitch)||1;speechSynthesis.speak(u)}
function voicePanel(c){c.voice=c.voice||{};return `<section class="card stack" id="characterVoicePanel"><h2>Character Voice</h2><p class="muted">Choose a browser voice for ${esc(c.name)}. The setting is saved with the character on this device.</p><label>Voice<select id="charVoice" class="input"><option value="">Browser default</option>${voiceOptions(c.voice.browserVoice||'')}</select></label><div class="row wrap"><label>Rate<input id="charRate" class="input" type="number" min="0.5" max="2" step="0.05" value="${c.voice.rate||1}"></label><label>Pitch<input id="charPitch" class="input" type="number" min="0" max="2" step="0.05" value="${c.voice.pitch||1}"></label></div><div class="row wrap"><button class="btn" id="saveCharVoice">Save voice</button><button class="btn" id="testCharVoice">▶ Test</button></div><p class="tiny muted">This is the device/browser speech engine. A future TTS adapter can provide true custom AI voices.</p></section>`}
function callUI(c){return `<main class="shell"><header class="topbar"><div><div class="brand">NIGHTSHADE CALL</div><h1>${esc(c.name)}</h1></div><button class="iconbtn" id="closeCall">×</button></header><section class="card callcard"><div class="avatar large">${esc(c.avatar||c.name?.[0]||'?')}</div><h2>${esc(c.name)}</h2><div id="callState" class="muted">Ready</div><div id="callTime" class="tiny">00:00</div><div class="call-controls"><button class="round primary" id="callToggle">☎</button><button class="round" id="callMute">🎙</button><button class="round" id="callStop">■</button></div><form id="callTextForm" class="row wrap" style="margin:12px 0"><input id="callText" class="input grow" placeholder="Type to talk if microphone recognition is unavailable" aria-label="Message character during call"><button type="submit" class="btn primary">Send</button></form><div id="callTranscript" class="call-transcript"></div><p class="tiny muted">Call mode uses browser speech recognition when available. Transcript messages are saved to this character's conversation.</p></section></main>`}
async function callConversation(c){const all=await get('conversations')||[];let x=all.find(v=>v.characterId===c.id);if(!x){x={id:crypto.randomUUID(),characterId:c.id,messages:[],memory:[],model:''};all.push(x);await put('conversations',all)}return {all,x}}
let callSession=null,callQueue=Promise.resolve();
function isCurrentCall(session,version){
 return Boolean(session&&callSession===session&&session.version===version&&session.view.isConnected&&document.querySelector('#app')?.contains(session.view));
}
function callEl(session,selector){return session?.view?.querySelector(selector)||null}
async function appendCallMessage(c,message){
 const all=await get('conversations')||[];
 let convo=all.find(x=>x.characterId===c.id);
 if(!convo){convo={id:crypto.randomUUID(),characterId:c.id,messages:[],memory:[],model:''};all.push(convo)}
 if(!Array.isArray(convo.messages))convo.messages=[];
 convo.messages.push(message);
 await put('conversations',all);
 return convo;
}
function queueCallTurn(c,text,session,version){
 const run=async()=>{
  if(!isCurrentCall(session,version))return;
  try{
   // Never reuse an IndexedDB snapshot across asynchronous model requests.
   const convo=await appendCallMessage(c,{role:'user',text,status:'sent',call:true});
   if(isCurrentCall(session,version)){
    callEl(session,'#callTranscript')?.insertAdjacentHTML('beforeend',`<div><b>You:</b> ${esc(text)}</div>`);
    callEl(session,'#callState').textContent='Waiting for reply…';
   }
   const answer=await window.nfCallReply(c,convo);
   if(!answer)throw Error('The model did not return a text reply.');
   // Save to the originating character even if its call has been closed.
   await appendCallMessage(c,{role:'assistant',text:answer,status:'received',call:true});
   if(!isCurrentCall(session,version))return;
   callEl(session,'#callTranscript')?.insertAdjacentHTML('beforeend',`<div><b>${esc(c.name)}:</b> ${esc(answer)}</div>`);
   callEl(session,'#callState').textContent='Reply ready';
   if(isCurrentCall(session,version))await speak(answer,c);
  }catch(err){
   if(isCurrentCall(session,version))callEl(session,'#callState').textContent='Call error: '+err.message;
  }
 };
 const pending=callQueue.then(run,run);
 callQueue=pending.catch(()=>{});
 return pending;
}
async function startCall(c){
 if(callOn)return;
 const session=callSession,version=session?.version;
 if(!isCurrentCall(session,version))return;
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){callEl(session,'#callState').textContent='Microphone recognition unavailable. Type below to talk and hear replies.';return}
 callOn=true;muted=false;
 callEl(session,'#callState').textContent='Listening…';
 callEl(session,'#callToggle').textContent='⏹';
 const activeRec=new SR();rec=activeRec;
 activeRec.continuous=true;activeRec.interimResults=false;activeRec.lang=navigator.language||'en-US';
 activeRec.onresult=e=>{
  if(muted||!isCurrentCall(session,version))return;
  const last=e.results[e.results.length-1],text=last?.[0]?.transcript?.trim();
  if(text)queueCallTurn(c,text,session,version);
 };
 activeRec.onerror=e=>{if(e.error!=='aborted'&&isCurrentCall(session,version))callEl(session,'#callState').textContent='Mic error: '+e.error};
 activeRec.onend=()=>{if(callOn&&!muted&&rec===activeRec&&isCurrentCall(session,version))try{activeRec.start()}catch{}};
 try{activeRec.start()}catch(e){callOn=false;callEl(session,'#callState').textContent=e.message;return}
 let sec=0;clearInterval(callTimer);
 callTimer=setInterval(()=>{
  if(!isCurrentCall(session,version)){clearInterval(callTimer);callTimer=null;return}
  sec++;const m=String(Math.floor(sec/60)).padStart(2,'0'),ss=String(sec%60).padStart(2,'0');
  callEl(session,'#callTime').textContent=m+':'+ss;
 },1000);
}
function pauseMic(){if(!rec)return;muted=true;try{rec.stop()}catch{}$('#callState').textContent='Mic paused'}
function stopCall(){if(callSession)callSession.version++;callOn=false;muted=false;try{rec?.stop()}catch{}rec=null;clearInterval(callTimer);callTimer=null;if('speechSynthesis'in window)speechSynthesis.cancel();if($('#callState'))$('#callState').textContent='Call ended';if($('#callToggle'))$('#callToggle').textContent='☎'}
window.nfCallReply=async(c,x)=>{const p=await get('provider');if(!p?.base||!p?.key)throw new Error('Connect a provider in Provider Studio first.');const model=x.model||p.model;if(!model)throw new Error('Choose a chat model first.');const history=x.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-30).map(m=>({role:m.role,content:m.text}));const system=typeof buildSystem==='function'?buildSystem(c,x,p,false):`Roleplay as ${c.name}. Preserve character fidelity and continuity.`;const r=await fetch(p.base,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+p.key,'HTTP-Referer':location.href,'X-Title':'Nightshade Forge'},body:JSON.stringify({model,messages:[{role:'system',content:system},...history],temperature:.9,max_tokens:1000})});const raw=await r.text();let j={};try{j=JSON.parse(raw)}catch{}if(!r.ok)throw new Error('HTTP '+r.status+(j.error?.message?': '+j.error.message:''));return j.choices?.[0]?.message?.content?.trim()||''}
async function openCall(c){
 if(callSession)stopCall();
 state.tab='call';await render();
 const main=document.querySelector('#app');if(!main)return;
 main.innerHTML=callUI(c);
 const session={view:main,version:0};callSession=session;
 callEl(session,'#closeCall').onclick=()=>{stopCall();callSession=null;state.tab='chat';render()};
 callEl(session,'#callToggle').onclick=()=>callOn?stopCall():startCall(c);
 callEl(session,'#callStop').onclick=stopCall;
 callEl(session,'#callMute').onclick=()=>{
  if(muted){muted=false;callEl(session,'#callState').textContent='Listening…';try{rec?.start()}catch{}}
  else pauseMic();
 };
 const form=callEl(session,'#callTextForm');
 if(form)form.onsubmit=async e=>{
  e.preventDefault();
  const input=callEl(session,'#callText'),value=input?.value.trim();
  if(!value)return;
  const version=session.version;
  input.value='';
  const button=form.querySelector('button');button.disabled=true;
  try{await queueCallTurn(c,value,session,version)}
  finally{if(isCurrentCall(session,version))button.disabled=false;else button.disabled=false}
 };
}
async function decorateVoicePage(){document.querySelectorAll('[data-voice-char]').forEach(x=>x.remove());const cs=await chars(),main=document.querySelector('main');if(!main||!cs.length)return;const box=document.createElement('section');box.className='card stack';box.dataset.voiceChar='1';box.innerHTML='<h2>Character Voices</h2><p class="muted">Assign a browser voice to each character.</p>'+cs.map(c=>`<div class="row"><div class="avatar">${esc(c.avatar||c.name?.[0]||'?')}</div><div class="grow"><strong>${esc(c.name)}</strong><div class="tiny muted">${esc(c.voice?.browserVoice||'Browser default')}</div></div><button class="btn" data-open-voice="${esc(c.id)}">Configure</button></div>`).join('');main.insertBefore(box,main.lastElementChild);box.querySelectorAll('[data-open-voice]').forEach(b=>b.onclick=async()=>{const c=await charById(b.dataset.openVoice);if(!c)return;document.getElementById('characterVoicePanel')?.remove();main.insertBefore(document.createRange().createContextualFragment(voicePanel(c)),box);bindVoice(c)})}
function bindVoice(c){$('#saveCharVoice').onclick=async()=>{const sel=$('#charVoice');c.voice={browserVoice:sel?.selectedOptions?.[0]?.value?sel.selectedOptions[0].textContent.split(' — ')[0]:'',rate:Number($('#charRate').value)||1,pitch:Number($('#charPitch').value)||1};await saveChar(c);alert('Character voice saved locally.');decorateVoicePage()};$('#testCharVoice').onclick=()=>speak(`Hello. I am ${c.name}.`,c)}
const priorRender=window.render;window.render=async()=>{await priorRender();if(typeof state!=='undefined'&&state.tab==='voices')await decorateVoicePage()};
// Event delegation avoids depending on bindForge being exported on window.
document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-call]');if(!b)return;const c=await currentChar()||await charById(b.dataset.character||state.chat);if(c)await openCall(c)});
window.addEventListener('load',()=>{if('speechSynthesis'in window)speechSynthesis.addEventListener('voiceschanged',()=>{if(typeof state!=='undefined'&&state.tab==='voices')render()})});
})();

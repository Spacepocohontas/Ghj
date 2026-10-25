/* Nightshade World: fictional private journals, local character social feed, free device Voice Lab. */
(()=>{
'use strict';
if(window.__nfCharacterWorld)return;window.__nfCharacterWorld=1;
const JKEY='nf_character_journals',PKEY='nf_character_posts';
const clean=v=>String(v??'');
const esc=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00').getTime())&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s&&s<=today();
const records=async key=>{const a=await get(key);return Array.isArray(a)?a:[]};
const characters=()=>records('characters');
let cachedJournals=[],cachedCharacters=[];let view='journal',characterId='',date=today(),voicePreviewMessage='The night remembers everything we leave unsaid.',allLocales=false,busy=false;
const characterName=(cs,id)=>cs.find(c=>c.id===id)?.name||'Unknown character';
const short=s=>clean(s).replace(/[\r\n]+/g,' ').slice(0,90);
const userUnlocked=async()=>{try{const sec=await get('security');return Boolean(sec&&!sec.setupNeeded&&sessionStorage.getItem('nf_unlocked')==='1'&&!state.locked)}catch{return false}};
const selected=cs=>{if(!cs.some(c=>c.id===characterId))characterId=cs[0]?.id||'';return cs.find(c=>c.id===characterId)};
function choose(cs,id='nfWorldCharacter'){
 return '<label>Character<select id="'+id+'" class="input">'+cs.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===characterId?'selected':'')+'>'+esc(c.name||'Unnamed')+'</option>').join('')+'</select></label>';
}
function tabs(){
 return '<div class="nf-world-tabs row wrap">'+[['journal','📓 Journal'],['social','✦ Social feed'],['voice','🎙 Voice Lab']].map(([k,t])=>'<button class="btn '+(k===view?'primary':'')+'" data-nf-world-view="'+k+'">'+t+'</button>').join('')+'</div>';
}
function head(title,subtitle){
 return '<main class="shell nf-world"><header class="topbar"><div><div class="brand">NIGHTSHADE WORLD · PRIVATE FICTION</div><h1>'+esc(title)+'</h1></div></header><p class="muted">'+esc(subtitle)+'</p>'+tabs()+'<div class="nf-world-content">';
}
function tail(){return '</div><div class="tiny muted" id="nfWorldStatus" role="status" aria-live="polite"></div>'+nav()+'</main>'}
function journalPrompt(c,day){
 return 'Write one fictional PRIVATE JOURNAL ENTRY in FIRST PERSON as the character. Date: '+day+'. Speak naturally in their own distinctive voice. Reveal private thoughts, contradictions, loyalties, regrets, secrets and hopes; no out-of-character AI commentary. Honor character facts without asserting events not given as historical truth. For past dates, do not mention future story events as already happened. About 130-240 words. Character: '+clean(c?.name)+'. Personality: '+clean(c?.personality)+'. Backstory: '+clean(c?.backstory)+'. Scenario: '+clean(c?.scenario)+'. Writing notes: '+clean(c?.behavior);
}
function postPrompt(c,context=''){
 return 'Write ONE fictional social-media post in the character’s own recognizable voice, 25-90 words, with appropriate emotion, personality, subtext, and optionally a hashtag or two. Do not say AI, do not quote the prompt. No markdown headings. This is an in-universe, PRIVATE, simulated social feed, not a real account. Character: '+clean(c?.name)+'. Personality: '+clean(c?.personality)+'. Backstory: '+clean(c?.backstory)+'. Scenario: '+clean(c?.scenario)+'. Context: '+context;
}
async function modelText(system,instruction){
 const p=await get('provider')||{};
 const endpoint=window.nfProviderEndpoint?.(p)||p.base;
 if(!endpoint||(!p.key&&p.kind!=='managed')||!p.model)throw Error('Connect a chat model in Provider Studio to generate AI writing. Manual entries and posts work for free.');
 const messages=[{role:'system',content:system},{role:'user',content:instruction}];
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(p.key?{'Authorization':'Bearer '+p.key}:{})},body:JSON.stringify({model:p.model,messages,temperature:.92,max_tokens:650})});
 const raw=await response.text();let data={};try{data=JSON.parse(raw)}catch{}
 if(!response.ok)throw Error(window.nfProviderResponseError?.(response,raw,data,p)||('Model HTTP '+response.status));
 const content=data.choices?.[0]?.message?.content;
 const answer=(typeof content==='string'?content:Array.isArray(content)?content.filter(x=>x?.type==='text').map(x=>x.text).join('\n'):'').trim();
 if(!answer)throw Error('The model returned no text; try another free model.');
 return answer.slice(0,7500);
}
async function saveJournal(id,day,text,origin='user'){
 if(!id||!isDate(day))throw Error('Choose a character and a valid date up to today.');
 if(!clean(text).trim())throw Error('Write an entry first.');
 const a=await records(JKEY);
 const j={id:uid(),characterId:id,date:day,text:clean(text).trim().slice(0,12000),origin,createdAt:new Date().toISOString()};
 a.push(j);await put(JKEY,a);return j;
}
async function savePost(id,text,origin='user'){
 if(!id||!clean(text).trim())throw Error('Choose a character and write a post first.');
 const a=await records(PKEY);
 const p={id:uid(),characterId:id,text:clean(text).trim().slice(0,5000),origin,createdAt:new Date().toISOString(),likes:0,liked:false,comments:[]};
 a.push(p);await put(PKEY,a);return p;
}
async function commentPost(postId,authorId,text,origin='user'){
 const a=await records(PKEY),post=a.find(p=>p.id===postId);
 if(!post)throw Error('Post not found.');
 if(!clean(text).trim())throw Error('Write a comment first.');
 if(!Array.isArray(post.comments))post.comments=[];
 post.comments.push({id:uid(),authorId:authorId||'you',text:clean(text).trim().slice(0,3000),origin,createdAt:new Date().toISOString()});
 await put(PKEY,a);return post;
}
async function journalUI(cs){
 const entries=(await records(JKEY)).filter(x=>x.characterId===characterId).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
 cachedJournals=entries;cachedCharacters=cs;const onDate=entries.filter(x=>x.date===date);
 const other=entries.filter(x=>x.date!==date).slice(0,14);
 return head('Private journals','Peek into fictional characters’ inner lives. Entries are imagined, generated only when you request them, and stored on this device.')
 +'<section class="card stack">'+choose(cs)+'<label>Explore a date<input class="input" id="nfJournalDate" type="date" min="0001-01-01" max="'+today()+'" value="'+esc(date)+'"></label>'
 +'<div class="row wrap"><button class="btn primary" id="nfJournalGenerate">✦ Write secret AI entry</button><button class="btn" id="nfJournalSave">Save my own entry</button></div>'
 +'<label>Journal draft<textarea class="input" rows="5" id="nfJournalDraft" maxlength="12000" placeholder="Write a diary entry, or generate one in the character’s voice."></textarea></label><div class="tiny muted">No automatic spying on real people or other apps; these are fictional entries inside your story.</div></section>'
 +'<section class="stack"><h2>Entries for '+esc(date)+'</h2>'+ (onDate.length?onDate.map(j=>journalCard(j,cs)).join(''):'<div class="card muted">No entry for this day. You can create one above.</div>')+'</section>'
 +(other.length?'<section class="stack"><h2>Other dates</h2>'+other.map(j=>journalCard(j,cs)).join('')+'</section>':'')
 +tail();
}
function journalCard(j,cs){
 return '<article class="card stack nf-journal-card"><div class="row"><strong class="grow">'+esc(j.date)+' · '+esc(characterName(cs,j.characterId))+'</strong><span class="tiny muted">'+(j.origin==='ai'?'AI imagined':'Written')+'</span></div><p class="nf-world-prose">'+esc(j.text)+'</p><div class="row wrap"><button class="btn" data-nf-read-journal="'+esc(j.id)+'">🔊 Read aloud</button><button class="btn danger" data-nf-delete-journal="'+esc(j.id)+'">Delete</button></div></article>';
}
function postCard(p,cs){
 const c=cs.find(c=>c.id===p.characterId)||{};
 const replies=Array.isArray(p.comments)?p.comments:[];
 return '<article class="card nf-social-post"><div class="row"><div class="avatar">'+esc(c.avatar||c.name?.[0]||'✦')+'</div><div class="grow"><strong>'+esc(c.name||'Character')+'</strong><div class="tiny muted">@'+esc(short(c.name||'character').replace(/\s+/g,'').toLowerCase())+' · '+esc((p.createdAt||'').slice(0,16).replace('T',' '))+'</div></div></div>'
 +'<p class="nf-world-prose">'+esc(p.text)+'</p><div class="row wrap"><button class="btn" data-nf-like="'+esc(p.id)+'">'+(p.liked?'♥':'♡')+' '+Number(p.likes||0)+'</button><button class="btn" data-nf-reply="'+esc(p.id)+'">✦ AI character reacts</button><button class="btn danger" data-nf-delete-post="'+esc(p.id)+'">Delete</button></div>'
 +(replies.length?'<div class="nf-social-comments">'+replies.map(r=>'<p class="nf-world-prose"><strong>'+esc(r.authorId==='you'?'You':characterName(cs,r.authorId))+'</strong> '+esc(r.text)+'</p>').join('')+'</div>':'')
 +'<form class="row wrap nf-comment-form" data-nf-comment-form="'+esc(p.id)+'"><input class="input grow" maxlength="3000" placeholder="Write a comment as yourself" aria-label="Comment"><button class="btn" type="submit">Comment</button></form></article>';
}
async function socialUI(cs){
 const posts=(await records(PKEY)).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,150);
 return head('Character social feed','Your own in-universe social network. Posts and replies are private simulations, not published to real social media.')
 +'<section class="card stack">'+choose(cs)+'<div class="row wrap"><button class="btn primary" id="nfGeneratePost">✦ Character makes a post</button><button class="btn" id="nfSavePost">Post my draft</button></div>'
 +'<textarea class="input" id="nfSocialDraft" rows="3" maxlength="5000" placeholder="Draft a post for this character…"></textarea><div class="tiny muted">AI posts and AI comments require a configured text model. No background posting or paid social platform.</div></section>'
 +(posts.length?'<section class="stack">'+posts.map(p=>postCard(p,cs)).join('')+'</section>':'<section class="card muted">No posts yet. Generate a character post or add your own.</section>')
 +tail();
}
const styles={natural:'Natural',dark:'Low & moody',warm:'Warm & gentle',cinematic:'Cinematic',playful:'Playful'};
const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.min(max,Math.max(min,Number(n))):fallback;
function voiceOptions(p){
 const all=window.speechSynthesis?.getVoices?.()||[];
 const list=allLocales?all:all.filter(v=>v.lang?.toLowerCase().startsWith('en'));
 return list.sort((a,b)=>String(a.lang).localeCompare(String(b.lang))||a.name.localeCompare(b.name))
 .map(v=>'<option value="'+esc(v.name)+'" '+(p.browserVoice===v.name?'selected':'')+'>'+esc(v.name)+' · '+esc(v.lang)+'</option>').join('');
}
async function voiceUI(cs){
 const c=selected(cs),v=c?.voice||{};
 return head('Free Voice Lab','Tune device voices without paying. Quality depends on voices installed on your phone; this is not premium voice cloning.')
 +'<section class="card stack">'+choose(cs)+'<label>Installed device voice<select id="nfVoiceSelect" class="input"><option value="">Device default</option>'+voiceOptions(v)+'</select></label>'
 +'<label class="switchrow"><input id="nfAllVoices" type="checkbox" '+(allLocales?'checked':'')+'> Show all languages</label>'
 +'<label>Delivery style<select id="nfVoiceStyle" class="input">'+Object.entries(styles).map(([k,label])=>'<option value="'+k+'" '+(v.deliveryStyle===k?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'
 +'<label>Speaking speed <output id="nfRateValue">'+clamp(v.rate,.5,1.6,1).toFixed(2)+'×</output><input id="nfVoiceRate" type="range" min="0.5" max="1.6" step="0.05" value="'+clamp(v.rate,.5,1.6,1)+'"></label>'
 +'<label>Pitch <output id="nfPitchValue">'+clamp(v.pitch,.5,1.6,1).toFixed(2)+'</output><input id="nfVoicePitch" type="range" min="0.5" max="1.6" step="0.05" value="'+clamp(v.pitch,.5,1.6,1)+'"></label>'
 +'<label>Read-aloud mode<select class="input" id="nfSpeechMode"><option value="all" '+(v.speakMode!=='dialogue'?'selected':'')+'>Full reply (dialogue and narration)</option><option value="dialogue" '+(v.speakMode==='dialogue'?'selected':'')+'>Dialogue in quotation marks only</option></select></label>'
 +'<label>Sample sentence<textarea class="input" id="nfVoiceSample" rows="2" maxlength="600">'+esc(voicePreviewMessage)+'</textarea></label>'
 +'<div class="row wrap"><button class="btn" id="nfVoicePreview">▶ Preview now</button><button class="btn" id="nfVoiceStop">■ Stop</button><button class="btn primary" id="nfVoiceSave">Save for '+esc(c?.name||'character')+'</button></div>'
 +'<div class="tiny muted">For improved voices, install or enable enhanced system voices on your device if available. Safari exposes only what iOS provides. Kokoro may work on supported computers; it may struggle on phones.</div></section>'+tail();
}
async function page(){
 const cs=await characters();selected(cs);
 if(!cs.length)return head('World','Create a character first to unlock journals, a fictional social feed, and voice controls.')+'<section class="card">No characters saved yet.</section>'+tail();
 if(view==='journal')return journalUI(cs);if(view==='social')return socialUI(cs);return voiceUI(cs);
}
function status(message){const el=document.querySelector('#nfWorldStatus');if(el)el.textContent=message}
function lockButtons(buttons,yes){buttons.forEach(b=>{if(b)b.disabled=yes})}
function getVoiceSettings(){
 const voices=document.querySelector('#nfVoiceSelect'),style=document.querySelector('#nfVoiceStyle'),rate=document.querySelector('#nfVoiceRate'),pitch=document.querySelector('#nfVoicePitch'),mode=document.querySelector('#nfSpeechMode');
 return {provider:'browser',providerVoiceId:null,providerVoiceName:'Device voice',browserVoice:voices?.value||'',browserVoiceName:voices?.value||'',deliveryStyle:style?.value||'natural',rate:clamp(rate?.value,.5,1.6,1),pitch:clamp(pitch?.value,.5,1.6,1),speakMode:mode?.value==='dialogue'?'dialogue':'all',autoRead:true};
}
function preview(text,c){
 const promise=window.nfBrowserVoice?.speak(text,c);
 if(!promise){status('Built-in device speech is unavailable in this browser.');return}
 Promise.resolve(promise).then(ok=>status(ok?'Voice started.':'Could not play the voice. Check device volume and try another installed voice.')).catch(e=>status('Playback error: '+e.message));
}
function directVoice(text,character){
 if(!character)return;
 preview(text,{...character,voice:{...character.voice,provider:'browser'}});
}
function attach(){
 const world=document.querySelector('.nf-world');if(!world)return;
 world.querySelectorAll('[data-nf-world-view]').forEach(b=>b.onclick=()=>{view=b.dataset.nfWorldView;render()});
 const pick=world.querySelector('#nfWorldCharacter');if(pick)pick.onchange=()=>{characterId=pick.value;render()};
 const day=world.querySelector('#nfJournalDate');if(day)day.onchange=()=>{if(isDate(day.value)){date=day.value;render()}else{date=today();status('Choose a real date no later than today.')}};
 const write=world.querySelector('#nfJournalSave');if(write)write.onclick=async()=>{try{await saveJournal(characterId,date,world.querySelector('#nfJournalDraft').value);await render()}catch(e){status(e.message)}};
 const aiJournal=world.querySelector('#nfJournalGenerate');if(aiJournal)aiJournal.onclick=async()=>{
  if(busy)return;busy=true;aiJournal.disabled=true;status('Writing a fictional private entry…');
  const cs=await characters(),c=cs.find(x=>x.id===characterId),day=date;
  try{const text=await modelText('You are writing fictional private journals for a creative roleplay app.',journalPrompt(c,day));await saveJournal(c.id,day,text,'ai');if(state.tab==='world'&&view==='journal'){await render();status('Imagined journal entry saved.')}}catch(e){status('Could not generate: '+e.message)}finally{busy=false;if(aiJournal.isConnected)aiJournal.disabled=false}
 };
 world.querySelectorAll('[data-nf-read-journal]').forEach(b=>b.onclick=()=>{const j=cachedJournals.find(x=>x.id===b.dataset.nfReadJournal);if(!j)return;directVoice(j.text,cachedCharacters.find(c=>c.id===j.characterId))});
 world.querySelectorAll('[data-nf-delete-journal]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this fictional journal entry?'))return;const list=(await records(JKEY)).filter(x=>x.id!==b.dataset.nfDeleteJournal);await put(JKEY,list);await render()});
 const save=world.querySelector('#nfSavePost');if(save)save.onclick=async()=>{try{await savePost(characterId,world.querySelector('#nfSocialDraft').value);await render()}catch(e){status(e.message)}};
 const generate=world.querySelector('#nfGeneratePost');if(generate)generate.onclick=async()=>{
  if(busy)return;busy=true;generate.disabled=true;status('Generating an in-universe post…');
  const cs=await characters(),c=cs.find(x=>x.id===characterId);
  try{const t=await modelText('Write character-consistent fictional social posts, without real-world publishing.',postPrompt(c));await savePost(c.id,t,'ai');if(state.tab==='world'&&view==='social'){await render();status('New fictional post added.')}}catch(e){status('Could not generate post: '+e.message)}finally{busy=false;if(generate.isConnected)generate.disabled=false}
 };
 world.querySelectorAll('[data-nf-like]').forEach(b=>b.onclick=async()=>{const all=await records(PKEY),p=all.find(x=>x.id===b.dataset.nfLike);if(!p)return;p.liked=!p.liked;p.likes=Math.max(0,Number(p.likes||0)+(p.liked?1:-1));await put(PKEY,all);await render()});
 world.querySelectorAll('[data-nf-delete-post]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this fictional post and its replies?'))return;await put(PKEY,(await records(PKEY)).filter(x=>x.id!==b.dataset.nfDeletePost));await render()});
 world.querySelectorAll('[data-nf-comment-form]').forEach(form=>form.onsubmit=async e=>{e.preventDefault();try{await commentPost(form.dataset.nfCommentForm,'you',form.querySelector('input').value);await render()}catch(err){status(err.message)}});
 world.querySelectorAll('[data-nf-reply]').forEach(b=>b.onclick=async()=>{
  if(busy)return;
  const cs=await characters(),p=(await records(PKEY)).find(p=>p.id===b.dataset.nfReply),c=selected(cs);
  if(!p||!c)return;
  if(c.id===p.characterId&&cs.length>1){status('Choose a different character above to react to this post.');return}
  busy=true;b.disabled=true;status(c.name+' is writing an in-universe reply…');
  try{const t=await modelText('Write only the fictional character’s comment, no exposition or labels.',postPrompt(c,'Reply in 1-3 sentences to this post by '+characterName(cs,p.characterId)+': '+p.text));await commentPost(p.id,c.id,t,'ai');if(state.tab==='world'&&view==='social'){await render();status('Character reply added.')}}catch(e){status('Could not generate reply: '+e.message)}finally{busy=false;if(b.isConnected)b.disabled=false}
 });
 const all=world.querySelector('#nfAllVoices');if(all)all.onchange=()=>{allLocales=all.checked;render()};
 const rate=world.querySelector('#nfVoiceRate');if(rate)rate.oninput=()=>world.querySelector('#nfRateValue').textContent=Number(rate.value).toFixed(2)+'×';
 const pitch=world.querySelector('#nfVoicePitch');if(pitch)pitch.oninput=()=>world.querySelector('#nfPitchValue').textContent=Number(pitch.value).toFixed(2);
 const style=world.querySelector('#nfVoiceStyle');if(style)style.onchange=()=>{const preset=window.nfBrowserVoice?.presets?.[style.value];if(!preset)return;const rate=world.querySelector('#nfVoiceRate'),pitch=world.querySelector('#nfVoicePitch');if(rate){rate.value=preset[0];world.querySelector('#nfRateValue').textContent=Number(rate.value).toFixed(2)+'×'}if(pitch){pitch.value=preset[1];world.querySelector('#nfPitchValue').textContent=Number(pitch.value).toFixed(2)}};
 const listen=world.querySelector('#nfVoicePreview');if(listen)listen.onclick=()=>{
  const sample=world.querySelector('#nfVoiceSample');voicePreviewMessage=sample?.value?.slice(0,600)||voicePreviewMessage;
  // Synchronous playback inside click callback is essential on Safari.
  preview(voicePreviewMessage,{voice:getVoiceSettings()});
 };
 const stop=world.querySelector('#nfVoiceStop');if(stop)stop.onclick=()=>{window.speechSynthesis?.cancel();status('Voice stopped.')};
 const saveVoice=world.querySelector('#nfVoiceSave');if(saveVoice)saveVoice.onclick=async()=>{
  const cs=await characters(),c=cs.find(x=>x.id===characterId);if(!c)return;
  c.voice={...(c.voice||{}),...getVoiceSettings(),assignedAt:new Date().toISOString()};
  await put('characters',cs);status('Saved free device voice settings for '+c.name+'.');
 };
}
const base=window.render;
window.render=async(...args)=>{
 if(await userUnlocked()&&state.tab==='world'){
  document.querySelector('#app').innerHTML=await page();
  attach();bindNav();return;
 }
 await base(...args);bindNav();
};
function bindNav(){
 if(state.locked||sessionStorage.getItem('nf_unlocked')!=='1')return;
 document.querySelectorAll('.nav').forEach(n=>{
  if(n.querySelector('[data-tab="world"]'))return;
  const b=document.createElement('button');b.dataset.tab='world';b.innerHTML='✦<br><small>World</small>';
  b.className=state.tab==='world'?'active':'';
  b.onclick=()=>{state.tab='world';view='journal';render()};
  n.append(b);
 });
}
if(window.speechSynthesis?.addEventListener)window.speechSynthesis.addEventListener('voiceschanged',()=>{if(state.tab==='world'&&view==='voice'&&!document.activeElement?.matches('textarea,input'))render()});
window.nfCharacterWorld={today,isDate,journalPrompt,postPrompt,saveJournal,savePost,commentPost,open(tab='journal'){view=['journal','social','voice'].includes(tab)?tab:'journal';state.tab='world';return render()}};
})();

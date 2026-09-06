(()=>{
const KEY='nf_character_state';
const defaults=()=>({mood:'Neutral',relationship:'Unspecified',activity:'Idle',trust:50,affection:50,tension:0,goals:[],secrets:[],plotThreads:[],history:[],processed:[],updatedAt:new Date().toISOString()});
const clamp=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,Math.round(Number(n)||0)));
const band=n=>n>=85?'devoted':n>=70?'warm':n>=55?'positive':n>=45?'neutral':n>=30?'cool':n>=15?'strained':'hostile';
function bondLine(s){return `Trust ${clamp(s.trust)}/100 (${band(clamp(s.trust))}), affection ${clamp(s.affection)}/100 (${band(clamp(s.affection))}), tension ${clamp(s.tension)}/100. These move gradually: a single apology softens things, it does not reset them.`}
async function all(){return await get(KEY)||{}}
async function stateFor(id){const a=await all();return {...defaults(),...(a[id]||{})}}
async function save(id,v){const a=await all();a[id]={...await stateFor(id),...v,updatedAt:new Date().toISOString()};await put(KEY,a);return a[id]}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function list(v){return (Array.isArray(v)?v:[]).filter(Boolean).map(x=>String(x).trim()).filter(Boolean)}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function has(t,words){return words.some(w=>t.includes(w))}
function firstMatch(t,items){for(const x of items)if(x[0].some(w=>t.includes(w)))return x[1];return ''}
async function character(){const cs=await get('characters')||[];return cs.find(c=>c.id===state.chat)}
async function activeConv(){const a=await get('conversations')||[];return a.find(x=>x.id===state.nfConversationId)||a.find(x=>x.characterId===state.chat)}
function moodTone(m){m=String(m||'').toLowerCase();return m.includes('angry')||m.includes('hostile')||m.includes('danger')||m.includes('furious')?'⚠':m.includes('happy')||m.includes('excited')||m.includes('calm')||m.includes('loving')?'✦':'◌'}
function infer(text,role,s){
 const t=clean(text).toLowerCase(); if(!t)return null;
 const mood=firstMatch(t,[
  [['furious','enraged','rage','pissed','angry','mad','hostile','hate','hates'],'Angry'],
  [['jealous','jealousy','possessive','threat','threatened','danger','dangerous'],'Guarded'],
  [['terrified','terror','scared','afraid','fear','panic','panicked'],'Afraid'],
  [['sad','heartbroken','cry','crying','lonely','miserable','grief','hurt'],'Hurt'],
  [['love','loving','adore','kiss','tender','sweet'],'Affectionate'],
  [['excited','thrilled','ecstatic','amazing','awesome','laugh','laughing'],'Excited'],
  [['happy','glad','smile','smiling','relieved','relief'],'Happy'],
  [['calm','okay','fine','safe','peaceful'],'Calm']
 ])||s.mood;
 const relationship=firstMatch(t,[
  [['i love you','love you','trust you','i trust','miss you','need you','want you'],'Close / trusting'],
  [['thank you','thanks','appreciate','you helped','helped me'],'Warming / grateful'],
  [['sorry','forgive','forgiven','make it up'],'Repairing / vulnerable'],
  [['leave me','go away','break up','dont trust','do not trust','hate you'],'Strained / defensive'],
  [['angry with you','mad at you','upset with you'],'Tense / conflicted']
 ])||s.relationship;
 const activity=firstMatch(t,[
  [['sleep','sleeping','bed','wake up','woke up'],'Resting'],
  [['work','working','job','office','shift'],'Working'],
  [['drive','driving','car','road','travel'],'Traveling'],
  [['walk','walking','run','running','outside'],'Out / moving'],
  [['fight','fighting','attack','attacked','battle'],'In conflict'],
  [['eat','eating','food','dinner','lunch','breakfast','cook'],'Eating / cooking'],
  [['watch','watching','movie','tv','show'],'Watching something'],
  [['plan','planning','investigate','investigating','figure out','research'],'Planning / investigating'],
  [['talk','talking','conversation','listen','listening'],'In conversation']
 ])||s.activity;
 const bond={trust:0,affection:0,tension:0};
 const nudges=[[['i love you','love you','trust you','i trust','miss you','need you'],{trust:4,affection:6,tension:-3}],
  [['thank you','thanks','appreciate','you helped','helped me'],{trust:2,affection:2,tension:-2}],
  [['sorry','forgive','apologise','apologize','make it up'],{trust:2,affection:1,tension:-4}],
  [['hate you','leave me','go away','never speak','dont trust','do not trust'],{trust:-7,affection:-7,tension:8}],
  [['liar','lied','betrayed','you cheated'],{trust:-10,affection:-4,tension:9}],
  [['angry with you','mad at you','upset with you','shut up'],{trust:-2,affection:-2,tension:5}]];
 for(const [words,d] of nudges)if(has(t,words)){bond.trust+=d.trust;bond.affection+=d.affection;bond.tension+=d.tension}
 const goals=[]; const goalRx=/(?:let's|lets|we need to|we should|i want to|i need to|our goal is to|the goal is to)\s+([^.!?]{3,120})/gi; let m; while((m=goalRx.exec(String(text)))&&goals.length<3){const v=clean(m[1]);if(v&&v.length<140)goals.push(v.charAt(0).toUpperCase()+v.slice(1))}
 const threads=[]; const threadRx=/(?:we have to|we need to|find|figure out|before|later|secret|promise|plan|investigate|protect|escape|stop|save)\s+([^.!?]{3,100})/gi; while((m=threadRx.exec(String(text)))&&threads.length<3){const v=clean(m[1]);if(v&&v.length<120)threads.push(v.charAt(0).toUpperCase()+v.slice(1))}
 return {mood,relationship,activity,goals,threads,role,bond}
}
async function evolve(id,msg){
 const text=msg?.text??msg?.content??''; const role=msg?.role||'user'; const raw=clean(text); if(!id||!raw)return false;
 const s=await stateFor(id); const fingerprint=role+'|'+raw.slice(0,500); if((s.processed||[]).includes(fingerprint))return false;
 const next=infer(raw,role,s); if(!next)return false;
 const changes=[];
 if(next.bond&&(next.bond.trust||next.bond.affection||next.bond.tension)){
  const t0=clamp(s.trust),a0=clamp(s.affection),x0=clamp(s.tension);
  s.trust=clamp(t0+next.bond.trust);s.affection=clamp(a0+next.bond.affection);s.tension=clamp(x0+next.bond.tension);
  if(s.trust!==t0||s.affection!==a0||s.tension!==x0)changes.push({field:'bond',from:`${t0}/${a0}/${x0}`,to:`${s.trust}/${s.affection}/${s.tension}`,reason:role+' message signal'});
 } else { s.tension=clamp(clamp(s.tension)-1) }
 if(next.mood!==s.mood){changes.push({field:'mood',from:s.mood,to:next.mood,reason:role+' message signal'});s.mood=next.mood}
 if(next.relationship!==s.relationship){changes.push({field:'relationship',from:s.relationship,to:next.relationship,reason:role+' message signal'});s.relationship=next.relationship}
 if(next.activity!==s.activity){changes.push({field:'activity',from:s.activity,to:next.activity,reason:role+' message signal'});s.activity=next.activity}
 if(next.goals.length){const merged=[...s.goals,...next.goals];s.goals=[...new Map(merged.map(x=>[x.toLowerCase(),x])).values()].slice(-8);if(s.goals.length!==list(s.goals).length)changes.push({field:'goals',from:'',to:next.goals.join('; '),reason:'goal language detected'})}
 if(next.threads.length){const merged=[...s.plotThreads,...next.threads];s.plotThreads=[...new Map(merged.map(x=>[x.toLowerCase(),x])).values()].slice(-10);changes.push({field:'plotThreads',from:'',to:next.threads.join('; '),reason:'plot language detected'})}
 s.processed=[...(s.processed||[]),fingerprint].slice(-40);
 if(changes.length){s.history=[...(s.history||[]),...changes.map(c=>({...c,at:new Date().toISOString()}))].slice(-30)}
 await save(id,{mood:s.mood,relationship:s.relationship,activity:s.activity,trust:clamp(s.trust),affection:clamp(s.affection),tension:clamp(s.tension),goals:s.goals,plotThreads:s.plotThreads,history:s.history,processed:s.processed,lastMessageAt:new Date().toISOString(),lastEvolvedKey:fingerprint});
 if(changes.length)await decorate();
 return !!changes.length;
}
/* Opt-in: ask the model for a small JSON state patch after a reply.
 * One short extra request (~150 tokens out). Off by default; keyword
 * inference above stays the free, zero-request path. */
let modelBusy=false;let modelStamp='';
async function modelUpdate(id,messages){
 if(modelBusy)return false;
 const cfg=await window.nfAutonomy?.cfg?.();
 if(!cfg?.modelState)return false;
 const p=await get('provider');if(!p?.base||!p?.key)return false;
 const model=p.model;if(!model)return false;
 const s=await stateFor(id);const c=await character();if(!c)return false;
 const recent=messages.slice(-6).map(m=>`${m.role==='assistant'?(c.name||'character'):'user'}: ${String(m.text||'').slice(0,600)}`).join('\n');
 if(!recent.trim())return false;
 modelBusy=true;
 try{
  const sys='You are a story state tracker. Read the exchange and reply with ONLY a JSON object, no prose, no code fences. Schema: {"mood":string,"relationship":string,"activity":string,"trust_delta":number,"affection_delta":number,"tension_delta":number,"goals":string[],"plot_threads":string[]}. Deltas are small integers between -10 and 10 describing how the character\'s feelings shifted in THIS exchange. Use 0 when nothing changed. Keep arrays short and only include genuinely new items.';
  const user=`Character: ${c.name||'unknown'}\nCurrent mood: ${s.mood}\nCurrent relationship: ${s.relationship}\nTrust ${clamp(s.trust)}, affection ${clamp(s.affection)}, tension ${clamp(s.tension)}\nKnown goals: ${(s.goals||[]).join('; ')||'none'}\nOpen threads: ${(s.plotThreads||[]).join('; ')||'none'}\n\nExchange:\n${recent}`;
  const r=await fetch(p.base,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+p.key,'X-NF-Internal':'state'},body:JSON.stringify({model,messages:[{role:'system',content:sys},{role:'user',content:user}],temperature:.1,max_tokens:220})});
  if(!r.ok)return false;
  const j=await r.json().catch(()=>null);
  const raw=j?.choices?.[0]?.message?.content||'';
  const m=raw.match(/\{[\s\S]*\}/);if(!m)return false;
  let d;try{d=JSON.parse(m[0])}catch{return false}
  await applyDelta(id,d);
  return true;
 }catch(e){return false}finally{modelBusy=false}
}
async function applyDelta(id,d){
 if(!d||typeof d!=='object')return null;
 const s=await stateFor(id);const changes=[];
 const setIf=(field,value)=>{const v=String(value||'').trim().slice(0,60);if(v&&v.toLowerCase()!=='unknown'&&v!==s[field]){changes.push({field,from:s[field],to:v,reason:'model state pass'});s[field]=v}};
 setIf('mood',d.mood);setIf('relationship',d.relationship);setIf('activity',d.activity);
 const step=(n)=>Math.max(-10,Math.min(10,Math.round(Number(n)||0)));
 const t0=clamp(s.trust),a0=clamp(s.affection),x0=clamp(s.tension);
 s.trust=clamp(t0+step(d.trust_delta));s.affection=clamp(a0+step(d.affection_delta));s.tension=clamp(x0+step(d.tension_delta));
 if(s.trust!==t0||s.affection!==a0||s.tension!==x0)changes.push({field:'bond',from:`${t0}/${a0}/${x0}`,to:`${s.trust}/${s.affection}/${s.tension}`,reason:'model state pass'});
 const merge=(cur,add,cap)=>[...new Map([...(cur||[]),...list(add)].map(v=>[String(v).toLowerCase(),String(v)])).values()].slice(-cap);
 s.goals=merge(s.goals,d.goals,6);s.plotThreads=merge(s.plotThreads,d.plot_threads,8);
 if(changes.length)s.history=[...(s.history||[]),...changes.map(c=>({...c,at:new Date().toISOString()}))].slice(-40);
 await save(id,s);
 return s;
}

async function evolveConversation(){
 if(state.tab!=='chat'||!state.chat)return; const x=await activeConv();if(!x||!Array.isArray(x.messages))return;
 for(const m of x.messages.slice(-6))await evolve(state.chat,m);
 const last=x.messages[x.messages.length-1];
 if(last?.role==='assistant'&&!String(last.text||'').startsWith('⚠')){
  const stamp=(x.id||'')+':'+(x.messages.length)+':'+String(last.text||'').slice(0,40);
  if(modelStamp!==stamp){modelStamp=stamp;modelUpdate(state.chat,x.messages).catch(()=>{})}
 }
}
async function decorate(){if(state.tab!=='chat'||!state.chat)return;const c=await character();if(!c)return;const s=await stateFor(c.id);const head=document.querySelector('.chathead');if(!head)return;document.querySelector('#nfStateStrip')?.remove();const strip=document.createElement('div');strip.id='nfStateStrip';strip.className='nf-state-strip';const live=document.createElement('span');live.className='nf-state-live';live.textContent='↻ LIVE';live.title='Character state evolves from conversation';strip.append(live);const chips=[`${moodTone(s.mood)} ${s.mood}`,`♡ ${s.relationship}`,`⌁ ${s.activity}`];if(s.goals.length)chips.push(`◎ ${s.goals.length} goal${s.goals.length===1?'':'s'}`);if(s.plotThreads.length)chips.push(`◈ ${s.plotThreads.length} thread${s.plotThreads.length===1?'':'s'}`);chips.forEach(t=>{const b=document.createElement('button');b.className='nf-state-chip';b.textContent=t;b.title='Character state — tap to edit';b.onclick=()=>openDetails(c.id);strip.append(b)});head.insertAdjacentElement('afterend',strip)}
async function openDetails(id){const s=await stateFor(id);const lines=[`MOOD: ${s.mood}`,`RELATIONSHIP: ${s.relationship}`,`ACTIVITY: ${s.activity}`,`GOALS: ${s.goals.length?s.goals.map((x,i)=>`${i+1}. ${x}`).join('\\n'):'None'}`,`PLOT THREADS: ${s.plotThreads.length?s.plotThreads.map((x,i)=>`${i+1}. ${x}`).join('\\n'):'None'}`,`SECRETS: ${s.secrets.length?s.secrets.map((x,i)=>`${i+1}. ${x}`).join('\\n'):'None'}`].join('\\n\\n');const modal=document.createElement('div');modal.className='nf-state-modal';modal.innerHTML='<div class="nf-state-dialog"><button class="nf-state-close">×</button><h3>Character State</h3><pre>'+esc(lines)+'</pre><button class="btn nf-edit-state">Edit state</button></div>';document.body.append(modal);modal.querySelector('.nf-state-close').onclick=()=>modal.remove();modal.querySelector('.nf-edit-state').onclick=()=>{modal.remove();openEditor(id)};modal.onclick=e=>{if(e.target===modal)modal.remove()}}
async function openEditor(id){const s=await stateFor(id);const mood=prompt('Current mood',s.mood);if(mood===null)return;const relationship=prompt('Relationship state',s.relationship);if(relationship===null)return;const activity=prompt('Current activity',s.activity);if(activity===null)return;const goals=prompt('Goals — separate with commas',s.goals.join(', '));if(goals===null)return;const secrets=prompt('Secrets — separate with commas',s.secrets.join(', '));if(secrets===null)return;const threads=prompt('Plot threads — separate with commas',s.plotThreads.join(', '));if(threads===null)return;await save(id,{mood:mood.trim()||'Neutral',relationship:relationship.trim()||'Unspecified',activity:activity.trim()||'Idle',goals:list(goals.split(',')),secrets:list(secrets.split(',')),plotThreads:list(threads.split(','))});await render()}
async function injectPrompt(){window.nfPrompt?.register({id:'state',priority:40,build:async ctx=>{if(!ctx.characterId||!ctx.character)return '';const s=await stateFor(ctx.characterId);return '[CURRENT CHARACTER STATE — MAINTAIN CONTINUITY]\nMood: '+s.mood+'\nRelationship: '+s.relationship+'\nBond: '+bondLine(s)+'\nCurrent activity: '+s.activity+'\nGoals: '+(s.goals.join('; ')||'none')+'\nPlot threads: '+(s.plotThreads.join('; ')||'none')+'\nPrivate character secrets (do not reveal unless naturally appropriate): '+(s.secrets.join('; ')||'none')}})}
injectPrompt();
window.nfCharacterState={stateFor,save,openEditor,evolve,evolveConversation,applyDelta,modelUpdate,bondLine};
const oldRender=window.render;window.render=async()=>{await oldRender();await decorate();setTimeout(evolveConversation,50)};
window.addEventListener('load',()=>{setTimeout(decorate,0);setTimeout(evolveConversation,500)});
setInterval(()=>{if(document.visibilityState==='visible')evolveConversation().catch(()=>{});},1500);
const style=document.createElement('style');style.textContent='.nf-state-modal{position:fixed;inset:0;z-index:10000;background:#000b;display:grid;place-items:center;padding:18px}.nf-state-dialog{position:relative;width:min(520px,100%);max-height:80vh;overflow:auto;padding:20px;border:1px solid #4a3150;border-radius:18px;background:#120d15;box-shadow:0 20px 60px #000b}.nf-state-dialog h3{margin:0 0 12px}.nf-state-dialog pre{white-space:pre-wrap;font:12px/1.6 system-ui;color:#ddd}.nf-state-close{position:absolute;right:10px;top:8px;border:0;background:transparent;color:#aaa;font-size:24px}.nf-edit-state{margin-top:10px}.nf-state-strip{display:flex;align-items:center;gap:6px;padding:5px 8px 7px;overflow:auto;border-bottom:1px solid #24182a;background:#0e0a12}.nf-state-live{white-space:nowrap;border:1px solid #55334e;background:#1b1020;color:#ff83ca;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.06em}.nf-state-chip{white-space:nowrap;border:1px solid #38253d;background:#17101b;color:#d9cddd;border-radius:999px;padding:5px 9px;font-size:10px}.nf-state-chip:hover{border-color:#a94d8c;color:#ff83ca;background:#211426}@media(max-width:560px){.nf-state-strip{scrollbar-width:none}.nf-state-chip{font-size:9px;padding:5px 8px}}';document.head.append(style);
})();

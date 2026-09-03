(()=>{
const KEY='nf_character_state';
const defaults=()=>({mood:'Neutral',relationship:'Unspecified',activity:'Idle',goals:[],secrets:[],plotThreads:[],history:[],processed:[],updatedAt:new Date().toISOString()});
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
 const goals=[]; const goalRx=/(?:let's|lets|we need to|we should|i want to|i need to|our goal is to|the goal is to)\s+([^.!?]{3,120})/gi; let m; while((m=goalRx.exec(String(text)))&&goals.length<3){const v=clean(m[1]);if(v&&v.length<140)goals.push(v.charAt(0).toUpperCase()+v.slice(1))}
 const threads=[]; const threadRx=/(?:we have to|we need to|find|figure out|before|later|secret|promise|plan|investigate|protect|escape|stop|save)\s+([^.!?]{3,100})/gi; while((m=threadRx.exec(String(text)))&&threads.length<3){const v=clean(m[1]);if(v&&v.length<120)threads.push(v.charAt(0).toUpperCase()+v.slice(1))}
 return {mood,relationship,activity,goals,threads,role}
}
async function evolve(id,msg){
 const text=msg?.text??msg?.content??''; const role=msg?.role||'user'; const raw=clean(text); if(!id||!raw)return false;
 const s=await stateFor(id); const fingerprint=role+'|'+raw.slice(0,500); if((s.processed||[]).includes(fingerprint))return false;
 const next=infer(raw,role,s); if(!next)return false;
 const changes=[];
 if(next.mood!==s.mood){changes.push({field:'mood',from:s.mood,to:next.mood,reason:role+' message signal'});s.mood=next.mood}
 if(next.relationship!==s.relationship){changes.push({field:'relationship',from:s.relationship,to:next.relationship,reason:role+' message signal'});s.relationship=next.relationship}
 if(next.activity!==s.activity){changes.push({field:'activity',from:s.activity,to:next.activity,reason:role+' message signal'});s.activity=next.activity}
 if(next.goals.length){const merged=[...s.goals,...next.goals];s.goals=[...new Map(merged.map(x=>[x.toLowerCase(),x])).values()].slice(-8);if(s.goals.length!==list(s.goals).length)changes.push({field:'goals',from:'',to:next.goals.join('; '),reason:'goal language detected'})}
 if(next.threads.length){const merged=[...s.plotThreads,...next.threads];s.plotThreads=[...new Map(merged.map(x=>[x.toLowerCase(),x])).values()].slice(-10);changes.push({field:'plotThreads',from:'',to:next.threads.join('; '),reason:'plot language detected'})}
 s.processed=[...(s.processed||[]),fingerprint].slice(-40);
 if(changes.length){s.history=[...(s.history||[]),...changes.map(c=>({...c,at:new Date().toISOString()}))].slice(-30)}
 await save(id,{mood:s.mood,relationship:s.relationship,activity:s.activity,goals:s.goals,plotThreads:s.plotThreads,history:s.history,processed:s.processed,lastMessageAt:new Date().toISOString(),lastEvolvedKey:fingerprint});
 if(changes.length)await decorate();
 return !!changes.length;
}
async function evolveConversation(){
 if(state.tab!=='chat'||!state.chat)return; const x=await activeConv();if(!x||!Array.isArray(x.messages))return;
 for(const m of x.messages.slice(-6))await evolve(state.chat,m);
}
async function decorate(){if(state.tab!=='chat'||!state.chat)return;const c=await character();if(!c)return;const s=await stateFor(c.id);const head=document.querySelector('.chathead');if(!head)return;document.querySelector('#nfStateStrip')?.remove();const strip=document.createElement('div');strip.id='nfStateStrip';strip.className='nf-state-strip';const live=document.createElement('span');live.className='nf-state-live';live.textContent='↻ LIVE';live.title='Character state evolves from conversation';strip.append(live);const chips=[`${moodTone(s.mood)} ${s.mood}`,`♡ ${s.relationship}`,`⌁ ${s.activity}`];if(s.goals.length)chips.push(`◎ ${s.goals.length} goal${s.goals.length===1?'':'s'}`);if(s.plotThreads.length)chips.push(`◈ ${s.plotThreads.length} thread${s.plotThreads.length===1?'':'s'}`);chips.forEach(t=>{const b=document.createElement('button');b.className='nf-state-chip';b.textContent=t;b.title='Character state — tap to edit';b.onclick=()=>openEditor(c.id);strip.append(b)});head.insertAdjacentElement('afterend',strip)}
async function openEditor(id){const s=await stateFor(id);const mood=prompt('Current mood',s.mood);if(mood===null)return;const relationship=prompt('Relationship state',s.relationship);if(relationship===null)return;const activity=prompt('Current activity',s.activity);if(activity===null)return;const goals=prompt('Goals — separate with commas',s.goals.join(', '));if(goals===null)return;const secrets=prompt('Secrets — separate with commas',s.secrets.join(', '));if(secrets===null)return;const threads=prompt('Plot threads — separate with commas',s.plotThreads.join(', '));if(threads===null)return;await save(id,{mood:mood.trim()||'Neutral',relationship:relationship.trim()||'Unspecified',activity:activity.trim()||'Idle',goals:list(goals.split(',')),secrets:list(secrets.split(',')),plotThreads:list(threads.split(','))});await render()}
async function injectPrompt(){const old=window.fetch;if(window.__nfStateFetch)return;window.__nfStateFetch=true;window.fetch=async function(input,init){try{if(init?.body&&typeof init.body==='string'){const j=JSON.parse(init.body);if(Array.isArray(j.messages)){const sys=j.messages.find(m=>m.role==='system');if(sys&&state.chat){const c=await character(),s=await stateFor(state.chat);if(c){sys.content+='\n\n[CURRENT CHARACTER STATE — MAINTAIN CONTINUITY]\nMood: '+s.mood+'\nRelationship: '+s.relationship+'\nCurrent activity: '+s.activity+'\nGoals: '+(s.goals.join('; ')||'none')+'\nPlot threads: '+(s.plotThreads.join('; ')||'none')+'\nPrivate character secrets (do not reveal unless naturally appropriate): '+(s.secrets.join('; ')||'none')}}init.body=JSON.stringify(j)}}}catch(e){}return old.apply(this,arguments)}}
injectPrompt();
window.nfCharacterState={stateFor,save,openEditor,evolve,evolveConversation};
const oldRender=window.render;window.render=async()=>{await oldRender();await decorate();setTimeout(evolveConversation,50)};
window.addEventListener('load',()=>{setTimeout(decorate,0);setTimeout(evolveConversation,500)});
setInterval(()=>{if(document.visibilityState==='visible')evolveConversation().catch(()=>{});},1500);
const style=document.createElement('style');style.textContent='.nf-state-strip{display:flex;align-items:center;gap:6px;padding:5px 8px 7px;overflow:auto;border-bottom:1px solid #24182a;background:#0e0a12}.nf-state-live{white-space:nowrap;border:1px solid #55334e;background:#1b1020;color:#ff83ca;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:700;letter-spacing:.06em}.nf-state-chip{white-space:nowrap;border:1px solid #38253d;background:#17101b;color:#d9cddd;border-radius:999px;padding:5px 9px;font-size:10px}.nf-state-chip:hover{border-color:#a94d8c;color:#ff83ca;background:#211426}@media(max-width:560px){.nf-state-strip{scrollbar-width:none}.nf-state-chip{font-size:9px;padding:5px 8px}}';document.head.append(style);
})();

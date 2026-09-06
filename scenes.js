/* Scenes — first-class story objects.
   A scene owns a place, a time, a cast, its premise, its open plot threads and
   its own log. Conversations point at a scene; the active scene is injected
   into every prompt so the model always knows where the story is standing. */
(()=>{
if(window.nfScenes)return;
const KEY='nf_scenes';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const uid=()=>(crypto.randomUUID?crypto.randomUUID():'sc-'+Math.random().toString(36).slice(2)+Date.now());
const nowIso=()=>new Date().toISOString();
const trim=(s,n)=>String(s??'').trim().slice(0,n);

async function allScenes(){const a=await get(KEY);return Array.isArray(a)?a:[]}
async function saveScenes(a){await put(KEY,a)}

function blank(characterId,seed){
 return {id:uid(),characterIds:characterId?[characterId]:[],title:trim(seed?.title,120)||'New scene',
  location:trim(seed?.location,200),timeOfDay:trim(seed?.timeOfDay,80),mood:trim(seed?.mood,80),
  premise:trim(seed?.premise,2000),threads:[],log:[],createdAt:nowIso(),updatedAt:nowIso()}
}

function scenesFor(list,characterId){return list.filter(s=>!characterId||!s.characterIds?.length||s.characterIds.includes(characterId))}

async function conversationFor(characterId){
 const all=await get('conversations')||[];
 if(window.state?.nfConversationId){const byId=all.find(v=>v.id===window.state.nfConversationId);if(byId)return {all,conv:byId}}
 return {all,conv:all.find(v=>v.characterId===characterId)||null};
}

/* Every chat gets a scene. The first one is seeded from the character's own
   scenario so the feature starts full rather than empty. */
async function ensureScene(characterId){
 if(!characterId)return null;
 const {all,conv}=await conversationFor(characterId);
 const list=await allScenes();
 if(conv?.sceneId){const found=list.find(s=>s.id===conv.sceneId);if(found)return found}
 const existing=scenesFor(list,characterId)[0];
 if(existing){if(conv){conv.sceneId=existing.id;await put('conversations',all)}return existing}
 const c=(await get('characters')||[]).find(v=>v.id===characterId);
 const scene=blank(characterId,{title:c?.name?`${c.name} — opening scene`:'Opening scene',premise:c?.scenario||''});
 list.push(scene);
 await saveScenes(list);
 if(conv){conv.sceneId=scene.id;await put('conversations',all)}
 return scene;
}

async function activeScene(characterId){
 const id=characterId||window.state?.chat;
 if(!id)return null;
 const {conv}=await conversationFor(id);
 const list=await allScenes();
 if(conv?.sceneId){const s=list.find(v=>v.id===conv.sceneId);if(s)return s}
 return scenesFor(list,id)[0]||null;
}

async function setScene(characterId,sceneId){
 const {all,conv}=await conversationFor(characterId);
 if(!conv)return false;
 conv.sceneId=sceneId;
 await put('conversations',all);
 return true;
}

async function updateScene(id,patch){
 const list=await allScenes();
 const s=list.find(v=>v.id===id);
 if(!s)return null;
 Object.assign(s,patch,{updatedAt:nowIso()});
 await saveScenes(list);
 return s;
}

async function createScene(characterId,seed){
 const list=await allScenes();
 const s=blank(characterId,seed);
 list.push(s);
 await saveScenes(list);
 await setScene(characterId,s.id);
 return s;
}

async function deleteScene(id){
 const list=await allScenes();
 const next=list.filter(s=>s.id!==id);
 if(next.length===list.length)return false;
 await saveScenes(next);
 const all=await get('conversations')||[];
 let touched=false;
 all.forEach(c=>{if(c.sceneId===id){delete c.sceneId;touched=true}});
 if(touched)await put('conversations',all);
 return true;
}

async function addThread(id,text){
 const s=(await allScenes()).find(v=>v.id===id);
 if(!s)return null;
 const t=trim(text,300);
 if(!t)return null;
 return updateScene(id,{threads:[...(s.threads||[]),{id:uid(),text:t,status:'open',at:nowIso()}]});
}
async function setThreadStatus(id,threadId,status){
 const s=(await allScenes()).find(v=>v.id===id);
 if(!s)return null;
 return updateScene(id,{threads:(s.threads||[]).map(t=>t.id===threadId?{...t,status}:t)});
}
async function removeThread(id,threadId){
 const s=(await allScenes()).find(v=>v.id===id);
 if(!s)return null;
 return updateScene(id,{threads:(s.threads||[]).filter(t=>t.id!==threadId)});
}
async function logScene(id,text){
 const s=(await allScenes()).find(v=>v.id===id);
 if(!s)return null;
 const t=trim(text,600);
 if(!t)return null;
 return updateScene(id,{log:[...(s.log||[]),{text:t,at:nowIso()}].slice(-40)});
}

/* Optional, free: ask the current model for a two-line recap of what just
   happened and store it on the scene. Uses the internal header so the prompt
   builder leaves the request alone. */
let summaryBusy=false;
async function summarize(characterId){
 if(summaryBusy)return null;
 const scene=await activeScene(characterId);
 if(!scene)return null;
 const p=await get('provider');
 if(!p?.base||!p?.key||!p?.model)throw new Error('Connect a provider first.');
 const {conv}=await conversationFor(characterId);
 const msgs=(conv?.messages||[]).filter(m=>m.role==='user'||m.role==='assistant').slice(-14);
 if(!msgs.length)throw new Error('Nothing has happened in this scene yet.');
 summaryBusy=true;
 try{
  const body={model:p.model,temperature:.2,max_tokens:180,messages:[
   {role:'system',content:'Summarise the roleplay excerpt as scene notes. Reply with two or three short sentences of plain past-tense narration covering what changed: events, decisions, revelations, and where the characters now stand. No preamble, no bullet points, no commentary.'},
   {role:'user',content:msgs.map(m=>`${m.role==='assistant'?'character':'user'}: ${String(m.text||'').slice(0,600)}`).join('\n')}]};
  const r=await fetch(p.base,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+p.key,'X-NF-Internal':'scene'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json().catch(()=>null);
  const text=j?.choices?.[0]?.message?.content?.trim();
  if(!text)throw new Error('The model returned nothing.');
  await logScene(scene.id,text);
  return text;
 }finally{summaryBusy=false}
}

/* ---------- prompt injection ---------- */
function sceneBlock(scene,castNames){
 const open=(scene.threads||[]).filter(t=>t.status!=='resolved').map(t=>t.text);
 const done=(scene.threads||[]).filter(t=>t.status==='resolved').map(t=>t.text);
 const log=(scene.log||[]).slice(-4).map(l=>l.text);
 const lines=['[CURRENT SCENE — THE STORY IS HAPPENING HERE]','Scene: '+(scene.title||'Untitled')];
 if(scene.location)lines.push('Location: '+scene.location);
 if(scene.timeOfDay)lines.push('Time: '+scene.timeOfDay);
 if(scene.mood)lines.push('Atmosphere: '+scene.mood);
 if(castNames&&castNames.length)lines.push('Present: '+castNames.join(', '));
 if(scene.premise)lines.push('Situation: '+scene.premise);
 if(open.length)lines.push('Open plot threads (advance these, do not resolve them all at once):\n'+open.map(t=>'- '+t).join('\n'));
 if(done.length)lines.push('Already resolved (do not re-open): '+done.join('; '));
 if(log.length)lines.push('Earlier in this scene:\n'+log.map(t=>'- '+t).join('\n'));
 lines.push('Stay physically and logically consistent with this setting. If the story moves somewhere else, narrate the transition instead of teleporting.');
 return lines.join('\n');
}

window.nfPrompt?.register({id:'scene',priority:35,build:async ctx=>{
 const id=ctx.characterId;
 if(!id)return '';
 const scene=await activeScene(id);
 if(!scene)return '';
 const chars=await get('characters')||[];
 const cast=(scene.characterIds||[]).map(cid=>chars.find(c=>c.id===cid)?.name).filter(Boolean);
 return sceneBlock(scene,cast);
}});

/* ---------- chat bar ---------- */
let drawing=false;
async function decorate(){
 if(window.state?.tab!=='chat'||!window.state?.chat)return;
 const head=document.querySelector('.chathead');
 if(!head||drawing)return;
 drawing=true;
 try{
  const scene=await ensureScene(window.state.chat);
  if(!scene)return;
  document.querySelector('#nfSceneBar')?.remove();
  const bar=document.createElement('button');
  bar.id='nfSceneBar';
  bar.className='nf-scene-bar';
  bar.title='Open the scene';
  const open=(scene.threads||[]).filter(t=>t.status!=='resolved').length;
  const bits=[scene.location,scene.timeOfDay].filter(Boolean).join(' · ');
  bar.innerHTML='<span class="nf-scene-icon">🎬</span><span class="nf-scene-title">'+esc(scene.title||'Untitled scene')+'</span>'+
   (bits?'<span class="nf-scene-where">'+esc(bits)+'</span>':'')+
   (open?'<span class="nf-scene-threads">◈ '+open+'</span>':'')+
   '<span class="nf-scene-edit">EDIT</span>';
  bar.onclick=()=>openSheet();
  const anchor=document.querySelector('#nfStateStrip')||head;
  anchor.insertAdjacentElement('afterend',bar);
 }finally{drawing=false}
}

async function openSheet(){
 const characterId=window.state?.chat;
 const scene=await ensureScene(characterId);
 if(!scene)return;
 const list=scenesFor(await allScenes(),characterId);
 const modal=document.createElement('div');
 modal.className='nf-scene-modal';
 const threads=(scene.threads||[]);
 modal.innerHTML=`<div class="nf-scene-dialog"><button class="nf-scene-close" title="Close">×</button>
  <h3>Scene</h3>
  <label class="tiny muted">SCENE<select id="scPick" class="input">${list.map(s=>`<option value="${esc(s.id)}" ${s.id===scene.id?'selected':''}>${esc(s.title||'Untitled')}</option>`).join('')}</select></label>
  <div class="nf-scene-row"><button class="btn" id="scNew">＋ New scene</button><button class="btn danger" id="scDel">Delete scene</button></div>
  <label>Title<input id="scTitle" class="input" value="${esc(scene.title||'')}"></label>
  <label>Location<input id="scLoc" class="input" placeholder="The rain-slick rooftop of the Verity building" value="${esc(scene.location||'')}"></label>
  <div class="nf-scene-row"><label class="grow">Time<input id="scTime" class="input" placeholder="Just after midnight" value="${esc(scene.timeOfDay||'')}"></label><label class="grow">Atmosphere<input id="scMood" class="input" placeholder="Tense, electric" value="${esc(scene.mood||'')}"></label></div>
  <label>What is going on<textarea id="scPremise" class="input" rows="3" placeholder="Why are they here, what just happened, what is at stake…">${esc(scene.premise||'')}</textarea></label>
  <h4>Plot threads</h4>
  <div id="scThreads" class="nf-scene-threadlist">${threads.length?threads.map(t=>`<div class="nf-scene-thread ${t.status==='resolved'?'done':''}"><button class="nf-thread-tick" data-toggle="${esc(t.id)}" title="${t.status==='resolved'?'Reopen':'Mark resolved'}">${t.status==='resolved'?'☑':'☐'}</button><span>${esc(t.text)}</span><button class="nf-thread-x" data-drop="${esc(t.id)}" title="Remove">×</button></div>`).join(''):'<div class="muted tiny">No open threads. Add what the story is reaching for.</div>'}</div>
  <div class="nf-scene-row"><input id="scThread" class="input grow" placeholder="She still has not told him about the letter"><button class="btn" id="scAddThread">Add</button></div>
  <h4>Scene log</h4>
  <div class="nf-scene-log">${(scene.log||[]).slice(-6).map(l=>`<div class="nf-scene-logline">${esc(l.text)}</div>`).join('')||'<div class="muted tiny">Nothing recorded yet.</div>'}</div>
  <div class="nf-scene-row"><button class="btn" id="scSum">✧ Summarise what just happened</button></div>
  <div id="scMsg" class="muted tiny"></div>
  <button class="btn primary" id="scSave">Save scene</button></div>`;
 document.body.append(modal);
 const q=s=>modal.querySelector(s);
 const close=()=>modal.remove();
 q('.nf-scene-close').onclick=close;
 modal.onclick=e=>{if(e.target===modal)close()};
 q('#scPick').onchange=async e=>{await setScene(characterId,e.target.value);close();await window.render?.();openSheet()};
 q('#scNew').onclick=async()=>{const title=prompt('Name the new scene','New scene');if(title===null)return;await createScene(characterId,{title:title||'New scene'});close();await window.render?.();openSheet()};
 q('#scDel').onclick=async()=>{if(!confirm('Delete this scene? The conversation itself is kept.'))return;await deleteScene(scene.id);close();await window.render?.()};
 q('#scAddThread').onclick=async()=>{const v=q('#scThread').value;if(!v.trim())return;await addThread(scene.id,v);close();openSheet()};
 modal.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{const t=threads.find(x=>x.id===b.dataset.toggle);await setThreadStatus(scene.id,b.dataset.toggle,t?.status==='resolved'?'open':'resolved');close();await window.render?.();openSheet()});
 modal.querySelectorAll('[data-drop]').forEach(b=>b.onclick=async()=>{await removeThread(scene.id,b.dataset.drop);close();openSheet()});
 q('#scSum').onclick=async()=>{const m=q('#scMsg');m.textContent='Reading the scene…';try{const t=await summarize(characterId);m.textContent=t?'Saved to the scene log.':'Nothing to summarise.';if(t){close();openSheet()}}catch(e){m.textContent=e.message}};
 q('#scSave').onclick=async()=>{
  await updateScene(scene.id,{title:trim(q('#scTitle').value,120)||'Untitled scene',location:trim(q('#scLoc').value,200),timeOfDay:trim(q('#scTime').value,80),mood:trim(q('#scMood').value,80),premise:trim(q('#scPremise').value,2000)});
  close();await window.render?.()};
}

window.nfScenes={allScenes,activeScene,ensureScene,createScene,updateScene,deleteScene,setScene,addThread,setThreadStatus,removeThread,logScene,summarize,sceneBlock,openSheet};

const baseRender=window.render;
window.render=async function(){const r=await baseRender.apply(this,arguments);decorate().catch(()=>{});return r};
window.addEventListener('load',()=>setTimeout(()=>decorate().catch(()=>{}),60));

const style=document.createElement('style');
style.textContent='.nf-scene-bar{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:0;border-bottom:1px solid #24182a;background:#0c0810;color:#d9cddd;font:inherit;font-size:11px;text-align:left;cursor:pointer}'+
'.nf-scene-bar:hover{background:#150e1a}.nf-scene-icon{font-size:12px}.nf-scene-title{font-weight:700;color:#ff83ca;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}'+
'.nf-scene-where{color:#9b8ea3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nf-scene-threads{margin-left:auto;color:#c9a7ff;white-space:nowrap}'+
'.nf-scene-edit{border:1px solid #38253d;border-radius:999px;padding:2px 7px;font-size:9px;letter-spacing:.08em;color:#9b8ea3}'+
'.nf-scene-threads+.nf-scene-edit{margin-left:6px}.nf-scene-bar>.nf-scene-edit:first-of-type:not(:last-child){margin-left:auto}'+
'.nf-scene-modal{position:fixed;inset:0;z-index:10001;background:#000b;display:grid;place-items:center;padding:18px}'+
'.nf-scene-dialog{position:relative;width:min(560px,100%);max-height:86vh;overflow:auto;padding:20px;border:1px solid #4a3150;border-radius:18px;background:#120d15;display:flex;flex-direction:column;gap:10px}'+
'.nf-scene-dialog h3{margin:0}.nf-scene-dialog h4{margin:6px 0 0;font-size:12px;letter-spacing:.08em;color:#9b8ea3;text-transform:uppercase}'+
'.nf-scene-close{position:absolute;right:10px;top:8px;border:0;background:transparent;color:#aaa;font-size:24px;cursor:pointer}'+
'.nf-scene-row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}.nf-scene-row .grow{flex:1;min-width:120px}'+
'.nf-scene-threadlist{display:flex;flex-direction:column;gap:6px}'+
'.nf-scene-thread{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #2a1c31;border-radius:10px;background:#170f1c;font-size:12px}'+
'.nf-scene-thread.done{opacity:.55;text-decoration:line-through}'+
'.nf-thread-tick,.nf-thread-x{border:0;background:transparent;color:#c9a7ff;font-size:14px;cursor:pointer}.nf-thread-x{margin-left:auto;color:#a06}'+
'.nf-scene-log{display:flex;flex-direction:column;gap:5px}.nf-scene-logline{font-size:12px;color:#cfc3d4;border-left:2px solid #4a3150;padding-left:8px}';
document.head.append(style);
})();

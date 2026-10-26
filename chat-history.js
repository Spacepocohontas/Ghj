(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let decorating=false;const regenerating=new Set();
async function current(){const cs=await get('characters')||[], c=cs.find(x=>x.id===state.chat);const all=await get('conversations')||[], x=all.find(v=>v.id===state.nfConversationId)||all.find(v=>v.characterId===state.chat);return {c,x,all}}
function ensureVariants(m){if(m.role!=='assistant')return; if(!Array.isArray(m.variants)||!m.variants.length)m.variants=[m.text||'']; if(typeof m.activeVariant!=='number'||m.activeVariant<0||m.activeVariant>=m.variants.length)m.activeVariant=Math.max(0,m.variants.indexOf(m.text||'')); if(!m.text&&m.variants[0])m.text=m.variants[m.activeVariant]}
async function saveVariant(index,text){const q=await current();if(!q.x)return null;const m=q.x.messages[index];if(!m||m.role!=='assistant')return null;ensureVariants(m);const existing=m.variants.findIndex(v=>v===text);if(existing>=0)m.activeVariant=existing;else{m.variants.push(text);m.activeVariant=m.variants.length-1}m.text=text;m.status='received';await put('conversations',q.all);return m}
function avatarFor(c){return c?.avatar&&String(c.avatar).startsWith('data:')?`<img src="${esc(c.avatar)}" alt="">`:(c?.avatar||'✦')}
function addTyping(){const box=document.querySelector('.messages');if(!box||box.querySelector('.nf-typing'))return;const el=document.createElement('div');el.className='nf-msgrow nf-typing-row';el.innerHTML=`<div class="nf-bubble-avatar">${avatarFor(window.__nfChatCharacter)}</div><div class="nf-typing"><span></span><span></span><span></span></div>`;box.append(el);box.scrollTop=box.scrollHeight;setTimeout(()=>el.remove(),30000)}
function removeTyping(){document.querySelectorAll('.nf-typing').forEach(x=>x.closest('.nf-typing-row')?.remove())}
async function regenerateVariant(index,button){
 const chatId=state.chat,conversationId=state.nfConversationId||'';
 const key=chatId+'|'+conversationId+'|'+index;
 if(regenerating.has(key))return;
 regenerating.add(key);
 if(button){button.disabled=true;button.textContent='…'}
 try{
  const q=await current();
  const original=q.x?.messages?.[index];
  if(!q.c||!q.x||!original||original.role!=='assistant')return;
  const p=await get('provider')||{},endpoint=window.nfProviderEndpoint?.(p)||p.base;
  const model=q.x.model||p.model;
  if(!endpoint||!p.key||!model)throw Error('Connect an AI provider and select a model first.');
  const prior=q.x.messages.slice(0,index).slice(-30).filter(m=>['user','assistant'].includes(m.role)).map(v=>({role:v.role,content:v.text||''}));
  const memory=(q.c.memory||[]).map(v=>typeof v==='string'?v:v.text).filter(Boolean).join('\\n');
  const system=`You are ${q.c.name||'the character'}. Stay completely in character. Never narrate the user's actions or thoughts. Preserve the supplied personality, memories and story. Personality: ${q.c.personality||''}\\nAppearance: ${q.c.appearance||''}\\nBackstory: ${q.c.backstory||''}\\nScenario: ${q.c.scenario||''}\\nRP instructions: ${q.c.behavior||''}\\nSaved memories: ${memory||'(none)'}`;
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+p.key},body:JSON.stringify({model,messages:[{role:'system',content:system},...prior],temperature:.95,max_tokens:900})});
  const raw=await response.text();let j={};try{j=JSON.parse(raw)}catch{}
  if(!response.ok)throw Error(window.nfProviderResponseError?.(response,raw,j,p)||('Provider HTTP '+response.status));
  const content=j.choices?.[0]?.message?.content;
  const text=typeof content==='string'?content.trim():Array.isArray(content)?content.filter(x=>x?.type==='text').map(x=>x.text||'').join('\\n').trim():'';
  if(!text)throw Error('The selected model returned no text. Try another available model.');
  // Save against the active conversation, not a stale snapshot from before the request.
  const refreshed=await current();
  if(refreshed.x?.id!==q.x.id||refreshed.x?.messages?.[index]?.role!=='assistant')return;
  const saved=await saveVariant(index,text);
  if(state.chat!==chatId||(state.nfConversationId||'')!==conversationId)return;
  const bubble=document.querySelector(`.messages .bubble[data-message-index="${index}"]`);
  if(bubble){
   const body=bubble.querySelector(':scope > div:first-child');
   if(body)body.textContent=text;
   const meta=bubble.querySelector('.bubblemeta');
   let controls=meta?.querySelector('.nf-variants');
   if(meta&&saved?.variants?.length>1&&!controls){
    controls=document.createElement('span');controls.className='nf-variants';
    controls.innerHTML='<button class="mini nf-prev" title="Previous response">‹</button><span class="nf-count"></span><button class="mini nf-next" title="Next response">›</button>';
    meta.prepend(controls);
    controls.querySelectorAll('button').forEach(btn=>btn.onclick=async e=>{e.stopPropagation();const cur=await current(),m=cur.x?.messages?.[index];if(!m)return;ensureVariants(m);m.activeVariant=(m.activeVariant+(btn.classList.contains('nf-prev')?-1:1)+m.variants.length)%m.variants.length;m.text=m.variants[m.activeVariant];await put('conversations',cur.all);const display=bubble.querySelector(':scope > div:first-child');if(display)display.textContent=m.text;controls.querySelector('.nf-count').textContent=(m.activeVariant+1)+'/'+m.variants.length});
   }
   const count=controls?.querySelector('.nf-count');
   if(count&&saved)count.textContent=(saved.activeVariant+1)+'/'+saved.variants.length;
   // No full render, no forced reflow or animation flicker.
  }
  // Intentional regeneration does not automatically play over existing audio.
 }catch(e){alert('Regenerate failed: '+e.message)}
 finally{regenerating.delete(key);if(button?.isConnected){button.disabled=false;button.textContent='↻'}}
}
window.nfRegenerateMessage=regenerateVariant;
async function decorate(){if(state.tab!=='chat'||!state.chat||decorating)return;decorating=true;try{const q=await current();if(!q.c||!q.x)return;window.__nfChatCharacter=q.c;(q.x.messages||[]).forEach(ensureVariants);const bubbles=[...document.querySelectorAll('.messages .bubble')];bubbles.forEach((b,i)=>{if(b.dataset.nfDecorated)return;const m=q.x.messages[i];if(!m)return;b.dataset.nfDecorated='1';b.dataset.messageIndex=i;if(m.role==='assistant'){const row=document.createElement('div');row.className='nf-msgrow theirs';b.parentNode.insertBefore(row,b);row.append(b);const av=document.createElement('div');av.className='nf-bubble-avatar';av.innerHTML=avatarFor(q.c);row.insertBefore(av,b);ensureVariants(m);const meta=b.querySelector('.bubblemeta');if(meta&&m.variants.length>1){const controls=document.createElement('span');controls.className='nf-variants';controls.innerHTML=`<button class="mini nf-prev" title="Previous response">‹</button><span class="nf-count">${m.activeVariant+1}/${m.variants.length}</span><button class="mini nf-next" title="Next response">›</button>`;meta.prepend(controls)}}else{const row=document.createElement('div');row.className='nf-msgrow mine';b.parentNode.insertBefore(row,b);row.append(b)}});document.querySelectorAll('.nf-prev,.nf-next').forEach(btn=>{btn.onclick=async e=>{e.stopPropagation();const bubble=btn.closest('.bubble');const i=Number(bubble?.dataset.messageIndex);const q2=await current(),m=q2.x?.messages?.[i];if(!m)return;ensureVariants(m);const dir=btn.classList.contains('nf-prev')?-1:1;m.activeVariant=(m.activeVariant+dir+m.variants.length)%m.variants.length;m.text=m.variants[m.activeVariant];await put('conversations',q2.all);await window.render()}});document.querySelectorAll('[data-regenerate]').forEach(btn=>btn.title='Generate another response');}finally{decorating=false}}
const oldRender=window.render;window.render=async()=>{await oldRender();await decorate()};
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-regenerate],[data-regen]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const bubble=b.closest('.bubble');const i=b.dataset.regen!=null?Number(b.dataset.regen):Number(bubble?.dataset.messageIndex);if(Number.isInteger(i)&&i>=0)regenerateVariant(i,b)},true);
document.addEventListener('submit',e=>{if(e.target?.id==='forgeSend')addTyping()},true);
const mo=new MutationObserver(()=>{if(document.querySelector('.messages .bubble.theirs'))removeTyping()});mo.observe(document.body,{childList:true,subtree:true});
})();

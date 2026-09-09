/* Nightcast Studio — Gemini Notebook sidecar + free default fallback
 * Local-first. No API key required. Nothing is uploaded automatically.
 */
(function(){
  'use strict';
  const KEY='nightcast_gemini_sidecar_v1';
  const state=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const save=(v)=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const download=(name,text,type='text/plain')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  const getChars=()=>{
    const out=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(!k) continue;
      try{
        const v=JSON.parse(localStorage.getItem(k));
        const arr=Array.isArray(v)?v:(v&&Array.isArray(v.characters)?v.characters:null);
        if(!arr) continue;
        arr.forEach(x=>{if(x&&typeof x==='object'&&(x.name||x.characterName||x.personality))out.push(x)});
      }catch{}
    }
    const seen=new Set(); return out.filter(c=>{const n=c.id||c.name||c.characterName;if(seen.has(n))return false;seen.add(n);return true});
  };
  const buildPacket=()=>{
    const s=state(), chars=getChars();
    const title=s.title||document.title.replace(/\s*[—-].*$/,'')||'Nightcast Episode';
    const topic=s.topic||'';
    const format=s.format||'Deep Dive';
    const lines=['# Nightcast Studio — Gemini Audio Pack','',`## Episode`,`Title: ${title}`,`Topic: ${topic||'[enter topic]'}`,`Format: ${format}`,`Created: ${new Date().toLocaleString()}`,'','## Cast'];
    if(chars.length) chars.forEach((c,i)=>{lines.push(`### ${c.name||c.characterName||`Character ${i+1}`}`); if(c.role)lines.push(`Role: ${c.role}`); if(c.bio)lines.push(`Bio: ${c.bio}`); if(c.personality)lines.push(`Personality: ${c.personality}`); if(c.speakingStyle)lines.push(`Speaking style: ${c.speakingStyle}`); if(c.traits)lines.push(`Traits: ${Array.isArray(c.traits)?c.traits.join(', '):c.traits}`); if(c.catchphrases)lines.push(`Catchphrases: ${c.catchphrases}`); if(c.lore||c.background)lines.push(`Lore/background: ${c.lore||c.background}`); lines.push(`Retain memory: ${c.rememberPodcast!==false?'ON':'OFF'}`,'');});
    else lines.push('No character records were detected from local storage. Add/select characters in Nightcast first.','');
    lines.push('## Character behavior','Preserve each character’s personality, relationship dynamics, goals, knowledge boundaries, and speaking mannerisms. Do not flatten the cast into generic hosts. Let characters disagree naturally and react to one another.','', '## Episode direction', 'Open with a short hook. Develop the topic through character-driven conversation. Give every selected character meaningful turns. Use callbacks to enabled character memory when present. End with a clear closing exchange.','', '## Custom Gemini/NotebookLM instruction', s.prompt||'Create a lively podcast-style conversation grounded in the supplied Nightcast source material. Keep the cast distinct, conversational, and character-driven. Prioritize the source facts and character profiles; do not invent contradictory lore.');
    return {md:lines.join('\n'),json:{title,topic,format,characters:chars,createdAt:new Date().toISOString(),prompt:s.prompt||''}};
  };
  const defaultPrompt='Create a podcast-style discussion using the supplied Nightcast character profiles and episode brief. Keep every character distinct. Use natural turn-taking, interruptions and reactions where appropriate, preserve personalities and relationships, and stay grounded in the provided material. Do not collapse the cast into generic narrators.';
  function mount(){
    if(document.getElementById('nightcast-gemini-sidecar'))return;
    const root=document.createElement('div'); root.id='nightcast-gemini-sidecar';
    root.innerHTML=`<button id="nc-gemini-open" class="nc-gemini-fab">✨ Podcast Audio</button><div id="nc-gemini-panel" class="nc-gemini-panel" hidden><div class="nc-gemini-head"><strong>Podcast Audio Engine</strong><button id="nc-gemini-close" aria-label="Close">×</button></div><p class="nc-gemini-sub">Free-first routing: Gemini/NotebookLM when you want polished AI-host audio, or the built-in browser voice fallback when you need it now.</p><label>Episode title<input id="nc-g-title" placeholder="Nightcast Episode"></label><label>Topic<input id="nc-g-topic" placeholder="What should they discuss?"></label><label>Format<select id="nc-g-format"><option>Deep Dive</option><option>The Brief</option><option>The Critique</option><option>The Debate</option><option>Interview</option><option>Co-Host</option><option>Panel</option></select></label><label>Gemini instruction<textarea id="nc-g-prompt" rows="4">${esc(defaultPrompt)}</textarea></label><div class="nc-g-actions"><button id="nc-pack">Download Gemini Pack</button><button id="nc-copy">Copy Prompt</button><button id="nc-open-notebook">Open Gemini Notebook</button><button id="nc-default" class="primary">▶ Use Default Voice</button></div><div class="nc-g-import"><strong>Import finished Gemini audio</strong><input id="nc-audio" type="file" accept="audio/*"><small>Downloaded NotebookLM/Gemini audio stays local until you choose to upload/share it elsewhere.</small></div><div id="nc-g-status" role="status"></div></div>`;
    document.body.appendChild(root);
    const panel=root.querySelector('#nc-gemini-panel');
    const fill=()=>{const s=state();root.querySelector('#nc-g-title').value=s.title||'';root.querySelector('#nc-g-topic').value=s.topic||'';root.querySelector('#nc-g-format').value=s.format||'Deep Dive';root.querySelector('#nc-g-prompt').value=s.prompt||defaultPrompt};
    root.querySelector('#nc-gemini-open').onclick=()=>{fill();panel.hidden=false}; root.querySelector('#nc-gemini-close').onclick=()=>panel.hidden=true;
    const persist=()=>save({title:root.querySelector('#nc-g-title').value,topic:root.querySelector('#nc-g-topic').value,format:root.querySelector('#nc-g-format').value,prompt:root.querySelector('#nc-g-prompt').value});
    root.querySelector('#nc-pack').onclick=()=>{persist();const p=buildPacket();download((p.json.title||'nightcast').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-gemini-pack.md',p.md,'text/markdown');download((p.json.title||'nightcast').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-gemini-pack.json',JSON.stringify(p.json,null,2),'application/json');root.querySelector('#nc-g-status').textContent='Gemini pack downloaded. Upload the .md to Gemini Notebook/NotebookLM, then generate Audio Overview.'};
    root.querySelector('#nc-copy').onclick=async()=>{persist();try{await navigator.clipboard.writeText(root.querySelector('#nc-g-prompt').value);root.querySelector('#nc-g-status').textContent='Prompt copied.'}catch{root.querySelector('#nc-g-status').textContent='Copy failed; select the prompt manually.'}};
    root.querySelector('#nc-open-notebook').onclick=()=>window.open('https://notebooklm.google.com/','_blank','noopener');
    root.querySelector('#nc-default').onclick=()=>{persist();const p=buildPacket();window.NightcastDefaultPodcast?.play?.(p.md)||speakFallback(p.md);root.querySelector('#nc-g-status').textContent='Default browser voice fallback started.'};
    root.querySelector('#nc-audio').onchange=e=>{const f=e.target.files?.[0];if(!f)return; const id='nc-import-'+Date.now(); try{const db=indexedDB.open('NightcastStudio',1);db.onupgradeneeded=()=>{const d=db.result;if(!d.objectStoreNames.contains('importedAudio'))d.createObjectStore('importedAudio',{keyPath:'id'})};db.onsuccess=()=>{const tx=db.result.transaction('importedAudio','readwrite');tx.objectStore('importedAudio').put({id,name:f.name,type:f.type,size:f.size,blob:f,createdAt:new Date().toISOString()});tx.oncomplete=()=>root.querySelector('#nc-g-status').textContent=`Imported ${f.name} into local episode storage.`}}catch{root.querySelector('#nc-g-status').textContent='Audio selected, but local database storage was unavailable.'}};
  }
  function speakFallback(text){if(!('speechSynthesis'in window)){alert('Browser speech is unavailable. Try Gemini Audio or ElevenLabs instead.');return} speechSynthesis.cancel();const clean=text.replace(/^#+.*$/gm,'').replace(/https?:\/\/\S+/g,'');const u=new SpeechSynthesisUtterance(clean.slice(0,12000));u.rate=1;u.pitch=1;u.volume=1;u.onend=()=>{};speechSynthesis.speak(u)}
  window.NightcastDefaultPodcast={play:speakFallback};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();

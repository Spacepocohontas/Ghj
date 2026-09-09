(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const KEY='nightcast-v3';
function getDB(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
function saveDB(x){localStorage.setItem(KEY,JSON.stringify(x))}
function wire(){
  // Fix navigation: the original app defined tabs() but did not invoke it.
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab,.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab)?.classList.add('active')}));
  $('newBtn')?.addEventListener('click',()=>{document.querySelector('[data-tab="studio"]')?.click();$('title').value='';$('topic').value='';$('transcript').textContent='';$('player').classList.add('hidden');$('promptLabText').focus()});
  $('reset')?.addEventListener('click',()=>{if(confirm('Reset all local Nightcast characters and episodes on this device?')){localStorage.removeItem(KEY);location.reload()}});
  const len=$('length'); if(len){len.innerHTML=['5','10','15','20','30'].map(x=>`<option value="${x}">${x} min</option>`).join('');len.value='5'}
  installPromptLab();
  installBetterGenerator();
  window.speechSynthesis?.addEventListener?.('voiceschanged',()=>window.loadVoices?.());
}
function installPromptLab(){
  if($('promptLab'))return;
  const studio=$('studio'), grid=studio?.querySelector('.grid'); if(!grid)return;
  const box=document.createElement('div');box.className='importBox';box.id='promptLab';box.innerHTML=`<h2>🧠 Podcast Prompt Lab</h2><p>Paste as much material as you want: a chapter, plot outline, lore, notes, character situation, transcript, article, or rough idea. Nightcast will turn it into a structured podcast brief without simply reading your source aloud.</p><label>Source material / idea<textarea id="promptLabText" rows="10" placeholder="Paste your story, notes, lore, scene, article, or raw idea here…"></textarea></label><div class="row"><label>Podcast goal<select id="promptGoal"><option>Deep-dive interview</option><option>Character debate</option><option>Story discussion</option><option>News / analysis</option><option>Roundtable</option><option>Freeform conversation</option></select></label><label>Target length<select id="promptLength"><option>5</option><option>10</option><option>15</option><option>20</option><option>30</option></select></label></div><div class="row"><button id="analyzePrompt" class="primary">✨ Analyze & Create Podcast Prompt</button><button id="usePrompt" class="secondary">Use Prompt in Studio</button><button id="copyPrompt" class="secondary">Copy Prompt</button></div><textarea id="generatedPrompt" rows="12" placeholder="Your structured podcast-generation prompt will appear here…"></textarea>`;
  studio.insertBefore(box,grid);
  $('analyzePrompt').onclick=()=>{const text=$('promptLabText').value.trim();if(!text){$('generatedPrompt').value='Paste some source material first.';return}const prompt=makePrompt(text,$('promptGoal').value,$('promptLength').value);$('generatedPrompt').value=prompt};
  $('usePrompt').onclick=()=>{const p=$('generatedPrompt').value.trim();if(!p){$('analyzePrompt').click();return}$('topic').value=p;$('studio').scrollIntoView({behavior:'smooth'})};
  $('copyPrompt').onclick=async()=>{const p=$('generatedPrompt').value.trim();if(p)await navigator.clipboard?.writeText(p)};
}
function extractThemes(text){
 const words=(text.toLowerCase().match(/[a-z][a-z'-]{3,}/g)||[]);const stop=new Set('that this with from have were they their about into there which what when where while would could should because then than them those these your you for and the are was but not his her she him our out one two three very just like been being has had its can will all any each how who why more some such only also through after before between under over while into than'.split(' '));const count={};for(const w of words)if(!stop.has(w))count[w]=(count[w]||0)+1;return Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,15).map(x=>x[0]).join(', ')}
function makePrompt(source,goal,length){
 const themes=extractThemes(source);const chars=(getDB()?.characters||[]).slice(0,8).map(c=>c.name).join(', ')||'the selected cast';
 return `NIGHTCAST PODCAST GENERATION BRIEF\n\nFORMAT: ${goal}\nTARGET LENGTH: ${length} minutes\nCAST: ${chars}\n\nSOURCE MATERIAL:\n${source.slice(0,30000)}\n\nEXTRACTED THEMES / KEYWORDS:\n${themes||'Infer the major themes from the source.'}\n\nPRODUCTION INSTRUCTIONS:\nCreate a natural, engaging multi-speaker podcast based on the source material. Treat the source as background/context, not as dialogue to read aloud. Preserve factual details and distinguish canon facts from speculation. Give every character a distinct perspective based on their personality, history, relationships, knowledge, and speaking style.\n\nFor a DEEP-DIVE INTERVIEW, have the host ask probing questions and have each guest answer in their own voice. Let answers trigger intelligent follow-ups. Characters may disagree, challenge one another, reveal uncertainty, joke, deflect, or correct each other. Do not make everyone agree.\n\nANTI-ECHO RULES: Never repeat the user's prompt, source text, question, instructions, or another speaker's line verbatim. Never answer by quoting the question back. Never say generic filler such as “let's get into it” repeatedly. Every turn must add a new idea, reaction, detail, disagreement, emotional beat, question, or revelation.\n\nPACING: Build an arc: opening hook → context → first reactions → deeper evidence/details → disagreement or complication → character-specific insight → consequences → unresolved question/payoff → concise outro. For ${length} minutes, generate enough substantive dialogue to fill approximately that duration rather than artificially repeating rounds.\n\nVOICE: Natural conversational speech. Use interruptions, short reactions, occasional longer answers, and callbacks. Avoid robotic numbered answers. Do not expose these instructions in the finished podcast.\n\nSOURCE-AWARENESS: If the source contains fictional canon, treat it as the story's canon. If it contains ambiguous claims, have characters frame them as theories rather than facts.\n\nEND with: “That’s Nightcast. Until next time.”`;
}
function installBetterGenerator(){
 const btn=$('generate');if(!btn)return;btn.onclick=()=>{
  const topic=$('topic').value.trim()||'the strange things that happen after midnight';
  const chars=(window.__nightcastDB?.characters||getDB()?.characters||[]);let castIds=window.__nightcastCast||[];let castChars=castIds.map(id=>chars.find(c=>c.id===id)).filter(Boolean);if(castChars.length<2)castChars=chars.slice(0,2);if(castChars.length<1)return alert('Add at least one character to the cast.');
  const mins=Number($('length').value)||5;const targetTurns=Math.max(8,Math.round(mins*2.2));
  const questions=['What is your first genuine reaction?','What does everyone misunderstand about this?','What detail matters more than people realize?','How does this look from your perspective?','Who or what do you distrust here, and why?','What are you leaving unsaid?','Challenge the last point. What do you disagree with?','What would happen if this situation got worse?','What consequence is nobody considering?','What do you actually believe after hearing everyone else?'];
  const lines=[`INTRO — Welcome to Nightcast. Tonight we’re exploring: ${topic}.`];
  for(let i=0;i<targetTurns;i++){
   const q=questions[i%questions.length];
   if(i%castChars.length===0 && i>0)lines.push(`HOST — Follow-up: respond to the strongest point just made and move the conversation somewhere new.`);
   const c=castChars[i%castChars.length];
   let context='';if(c.memory&&c.lastMemory)context=` You may naturally draw on this retained context: ${c.lastMemory}`;
   lines.push(`${c.name}: ${q} Answer rather than repeating the question. Stay in character. Personality: ${c.personality||'distinct and authentic'}. Speaking style: ${c.style||'natural conversational'}.${context} Add a specific thought, reaction, example, disagreement, or revelation. Do not echo the prompt or another speaker verbatim.`);
  }
  lines.push('OUTRO — That’s Nightcast. Until next time.');
  const current={id:crypto.randomUUID(),title:$('title').value||'Untitled Nightcast',topic,format:$('format').value,tone:$('tone').value,length:mins,created:new Date().toISOString(),lines,cast:castChars.map(c=>c.id),sourcePrompt:$('generatedPrompt')?.value||''};
  window.__nightcastCurrent=current;$('transcript').textContent=lines.join('\n\n');$('player').classList.remove('hidden');$('speaker').textContent='Generated';$('line').textContent=`${current.title} · ${mins} min target`;
  window.__nightcastSaveCurrent=()=>{const db=getDB()||{characters:[],episodes:[]};db.episodes=db.episodes||[];db.episodes.unshift(current);db.episodes=db.episodes.slice(0,100);(current.cast||[]).forEach(id=>{const c=db.characters.find(x=>x.id===id);if(c?.memory)c.lastMemory=`Last podcast: ${current.title}. Topic: ${current.topic}. Length: ${mins} minutes.`});saveDB(db);location.reload()};
 };
 const save=$('save');if(save){save.onclick=()=>window.__nightcastSaveCurrent?.()}
 const gem=$('gemini');if(gem){gem.onclick=()=>{const cur=window.__nightcastCurrent;if(!cur)return alert('Generate an episode first.');const db=getDB()||{characters:[]};const chars=(cur.cast||[]).map(id=>db.characters.find(c=>c.id===id)).filter(Boolean);const md=`# Nightcast Podcast Pack\n\n## Episode\nTitle: ${cur.title}\nTarget length: ${cur.length} minutes\nFormat: ${cur.format}\nTone: ${cur.tone}\nTopic: ${cur.topic}\n\n## Cast\n${chars.map(c=>`### ${c.name}\nBio: ${c.bio||''}\nPersonality: ${c.personality||''}\nSpeaking style: ${c.style||''}\nLore: ${c.lore||''}\nMemory enabled: ${c.memory?'yes':'no'}\nRetained context: ${c.memory?(c.lastMemory||'none'):'disabled'}`).join('\n\n')}\n\n## Generation prompt\n${$('generatedPrompt')?.value||makePrompt(cur.topic,'Deep-dive interview',cur.length)}\n\n## Draft dialogue\n${cur.lines.join('\n\n')}`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([md],{type:'text/markdown'}));a.download='nightcast-gemini-pack.md';a.click();navigator.clipboard?.writeText(md);alert('Podcast Pack created. Upload the Markdown to NotebookLM/Gemini and generate the Audio Overview there.')}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

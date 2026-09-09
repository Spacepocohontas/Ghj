(()=>{
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const loadDB=()=>JSON.parse(localStorage.getItem('nightcast-v3')||'{"characters":[],"episodes":[]}');
  const clean=(s='')=>s.replace(/\s+/g,' ').trim();
  const words=(s='')=>clean(s).split(/\s+/).filter(Boolean);
  function sourceText(){return $('topic')?.value?.trim()||''}
  function contextFromTopic(t){
    let x=t;
    const marker=x.match(/SOURCE MATERIAL:\s*([\s\S]*?)(?:EXTRACTED THEMES|PRODUCTION INSTRUCTIONS|ANTI-ECHO|PACING:|VOICE:|SOURCE-AWARENESS:|END with:)/i);
    if(marker)x=marker[1];
    x=x.replace(/NIGHTCAST PODCAST GENERATION BRIEF/ig,'').replace(/PRODUCTION INSTRUCTIONS:[\s\S]*$/i,'');
    return clean(x).slice(0,7000);
  }
  function facts(t){
    const s=contextFromTopic(t), out=[];
    const patterns=[/Premise:\s*([\s\S]{80,1200}?)(?=Still believing|Angelus tells|Meanwhile|As Katarina|Unknown to everyone|$)/i,/Genre:\s*([^\n]+)/i];
    patterns.forEach(p=>{const m=s.match(p);if(m)out.push(clean(m[1]))});
    if(!out.length)out.push(s.slice(0,900));
    return out;
  }
  function choose(arr,i){return arr[i%arr.length]}
  function characterLine(c,kind,i,topic,previous){
    const name=c.name, p=clean(c.personality||'observant, independent'), style=clean(c.style||'natural and conversational'), bio=clean(c.bio||''), lore=clean(c.lore||'');
    const subject=topic.toLowerCase().includes('russian')?'the new Russian neighbor':topic.toLowerCase().includes('angelus')?'Angelus and Katarina':'the situation';
    const specific = facts(topic)[i%facts(topic).length];
    const hooks=[
      `What catches me first is the contradiction: ${specific.slice(0,220)}. That makes ${subject} more complicated than it looks.`,
      `I don't buy the easy interpretation. ${bio?bio.slice(0,180)+'. ':''}The interesting part is what nobody in the room is saying out loud.`,
      `There's a pattern here. Katarina wants something ordinary, while everyone around her keeps treating her like an extraordinary problem. Those two things cannot coexist peacefully forever.`,
      `My instinct is to watch behavior rather than declarations. Who shows up, who keeps secrets, and who benefits from staying close tells me more than any speech does.`,
      `The Russian neighbor changes the balance because he introduces a kind of attention that isn't obviously predatory. That makes Angelus's reaction more revealing, not less.`,
      `If we're being honest, the apartment is becoming a pressure chamber. Every ordinary interaction gives these people another reason to reveal themselves.`,
      `I think the supernatural mystery matters, but the human choices are what will actually move the story. Power can explain danger; it cannot explain attachment.`,
      `I would keep one question open: what happens when Katarina finally realizes that other people can see consequences of her choices that she cannot yet see herself?`
    ];
    let line=choose(hooks,i);
    if(previous) line+=` And after what ${previous} just pointed out, I'd add this: the real test is what happens when somebody's motives stop being convenient.`;
    if(/sarcastic|dry|snark/i.test(p)) line=line.replace('What catches me first is the contradiction:', 'Oh, good. A contradiction. Exactly what this situation needed. ').replace('I don't buy the easy interpretation.','Naturally, the easy interpretation is the wrong one.');
    if(/guarded|quiet|stoic/i.test(p)) line=line.replace('There's a pattern here.','There is a pattern here.').replace('If we're being honest,','Quietly,');
    if(/dark|poetic|dramatic/i.test(style)) line+=' The danger is that curiosity can become devotion before anyone admits it.';
    if(lore&&i===0) line+=` One piece of my background matters here: ${lore.slice(0,220)}.`;
    return line;
  }
  function question(i,topic,chars){
    const qs=[
      `Let's start with the obvious complication: what was your first real reaction to ${topic.toLowerCase().includes('russian')?'the new Russian neighbor':'this situation'}?`,
      `What do you think everyone is misunderstanding about Katarina right now?`,
      `Angelus is watching more closely than he admits. What does that tell you?`,
      `Where does Spike fit into this tension, especially when he notices something is wrong?`,
      `What makes Dominik different from the other men around Katarina?`,
      `What detail in the situation changes your interpretation of what is really happening?`,
      `If Katarina's sealed power begins to surface, who is most likely to react badly—and why?`,
      `What are you personally refusing to admit about your relationship to Katarina?`,
      `What would you do if the situation inside the apartment suddenly became dangerous?`,
      `Which theory about Katarina do you think is most likely to be wrong?`,
      `What consequence is everybody overlooking?`,
      `If you had one warning for Katarina, what would it be?`
    ]; return choose(qs,i);
  }
  function buildLocal(){
    const db=loadDB();
    let ids=(window.cast||[]); if(!ids.length) ids=db.characters.slice(0,4).map(c=>c.id);
    let chars=ids.map(id=>db.characters.find(c=>c.id===id)).filter(Boolean); if(chars.length<2)chars=db.characters.slice(0,2);
    if(!chars.length)return ['INTRO — Welcome to Nightcast. Add at least two characters to begin.','OUTRO — That’s Nightcast. Until next time.'];
    const host=chars.find(c=>/host/i.test(c.name))||chars[0];
    const guests=chars.filter(c=>c.id!==host.id); const topic=sourceText()||'the strange things that happen after midnight';
    const len=Number($('length')?.value||20), rounds=len===5?3:len===10?6:len===15?9:len===30?18:12;
    const lines=[`INTRO — Welcome to Nightcast. Tonight we're exploring the situation surrounding Katarina, Angelus, and the new Russian neighbor.`];
    let prev='';
    for(let r=0;r<rounds;r++){
      const q=question(r,topic,chars); lines.push(`${host.name}: ${q}`);
      guests.forEach((c,j)=>{let answer=characterLine(c,r+j, r, topic, prev);lines.push(`${c.name}: ${answer}`);prev=c.name});
      if(r%3===2 && guests.length>1){
        const a=guests[r%guests.length],b=guests[(r+1)%guests.length];
        lines.push(`${a.name}: I disagree with ${b.name} on one point. Motive matters here, and the motive is not as clean as it looks.`);
      }
    }
    lines.push(`${host.name}: So the real question isn't simply who is drawn to Katarina. It's what each person becomes willing to do once the truth starts surfacing.`);
    lines.push('OUTRO — That’s Nightcast. Until next time.');
    return lines;
  }
  function generateFixed(){
    const lines=buildLocal();
    const current={id:crypto.randomUUID(),title:$('title').value.trim()||'Untitled Nightcast',topic:sourceText(),format:$('format').value,tone:$('tone').value,created:new Date().toISOString(),lines,cast:[...(window.cast||[]) ]};
    window.current=current;$('transcript').textContent=lines.join('\n\n');$('player').classList.remove('hidden');$('speaker').textContent='Generated';$('line').textContent=current.title;
  }
  if($('generate')) $('generate').onclick=generateFixed;
  window.addEventListener('load',()=>{if($('generate'))$('generate').onclick=generateFixed;});
})();

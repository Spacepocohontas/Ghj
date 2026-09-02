(()=>{
if(window.__nfPromptContext)return;window.__nfPromptContext=1;
const nativeFetch=window.fetch.bind(window);
function lore(c,msgs){const all=(msgs||[]).map(m=>m.content||'').join('\n').toLowerCase();return (c.lorebook||[]).filter(e=>e&&e.enabled!==false&&Array.isArray(e.keys)&&e.keys.some(k=>k&&all.includes(String(k).toLowerCase()))).sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)).slice(0,20)}
window.fetch=async function(input,init){
 try{
  const body=init&&init.body;
  if(body&&typeof body==='string'&&typeof state!=='undefined'&&state.chat&&typeof get==='function'){
   const req=JSON.parse(body);if(Array.isArray(req.messages)&&req.messages.some(m=>m.role==='system')){
    const cs=await get('characters')||[],c=cs.find(x=>x.id===state.chat);
    if(c){
     c.card=c.card||{};const entries=lore(c,req.messages);const context=[];
     if(c.card.systemPrompt)context.push('[CHARACTER CARD SYSTEM PROMPT]\n'+c.card.systemPrompt);
     if(c.card.postHistoryInstructions)context.push('[CHARACTER CARD POST-HISTORY INSTRUCTIONS]\n'+c.card.postHistoryInstructions);
     if(c.card.exampleDialogue)context.push('[CHARACTER CARD EXAMPLE DIALOGUE]\n'+c.card.exampleDialogue);
     if(entries.length)context.push('[ACTIVE LOREBOOK]\n'+entries.map(e=>`## ${e.name||'Entry'}\n${e.content||''}`).join('\n\n'));
     if(context.length){const sys=req.messages.find(m=>m.role==='system');sys.content=String(sys.content||'')+'\n\n'+context.join('\n\n');init={...init,body:JSON.stringify(req)}}
    }
   }
  }
 }catch(e){console.warn('Nightshade prompt context skipped:',e)}
 return nativeFetch(input,init)
};
})();

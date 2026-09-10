(()=>{
if(window.__nfAiGenerationBridge)return;window.__nfAiGenerationBridge=1;
const nativeFetch=window.fetch.bind(window);
const getCfg=async()=>{try{return await get('aiGeneration')||{}}catch{return {}}};
const buildContext=async()=>{try{const id=window.state?.chat;if(!id)return null;const cs=await get('characters')||[],c=cs.find(x=>x.id===id);const all=await get('conversations')||[],x=all.find(v=>v.characterId===id);return {c,x}}catch{return null}};
window.fetch=async function(input,init){
 try{
  const url=typeof input==='string'?input:(input?.url||'');
  const opts=init||{};
  if(!/\/chat\/completions(?:\?|$)/i.test(url))return nativeFetch(input,init);
  let body=typeof opts.body==='string'?JSON.parse(opts.body):null;if(!body)return nativeFetch(input,init);
  const cfg=await getCfg();
  if(cfg&&Object.keys(cfg).length){
   if(Number.isFinite(+cfg.temperature))body.temperature=+cfg.temperature;
   if(Number.isFinite(+cfg.maxTokens))body.max_tokens=+cfg.maxTokens;
   if(Number.isFinite(+cfg.topP))body.top_p=+cfg.topP;
   if(cfg.stream===true||cfg.stream===false)body.stream=!!cfg.stream;
   if(Array.isArray(body.messages)){
    const ctx=await buildContext();
    const notes=[];
    if(cfg.authorNote)notes.push('AUTHOR / SCENE DIRECTION:\n'+cfg.authorNote);
    if(ctx?.c?.goals)notes.push('CHARACTER GOALS:\n'+(Array.isArray(ctx.c.goals)?ctx.c.goals.join('\n'):ctx.c.goals));
    if(ctx?.c?.mood)notes.push('CURRENT MOOD:\n'+ctx.c.mood);
    if(ctx?.c?.activity)notes.push('CURRENT ACTIVITY:\n'+ctx.c.activity);
    if(notes.length){const sys=body.messages.find(m=>m.role==='system');if(sys)sys.content=String(sys.content||'')+'\n\n'+notes.join('\n\n');else body.messages.unshift({role:'system',content:notes.join('\n\n')})}
    const n=Math.max(4,Math.min(80,Number(cfg.context)||24));const system=body.messages.filter(m=>m.role==='system');const other=body.messages.filter(m=>m.role!=='system');body.messages=[...system,...other.slice(-n)];
    if(cfg.systemPrompt){const sys=body.messages.find(m=>m.role==='system');if(sys)sys.content=String(cfg.systemPrompt)+'\n\n'+sys.content;else body.messages.unshift({role:'system',content:String(cfg.systemPrompt)})}
   }
   opts.body=JSON.stringify(body);
   if(opts.headers instanceof Headers)opts.headers.set('Content-Type','application/json');else opts.headers={...(opts.headers||{}),'Content-Type':'application/json'};
  }
 }catch(e){console.warn('AI generation bridge skipped',e)}
 return nativeFetch(input,init);
};
})();
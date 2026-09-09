export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  const key=process.env.GEMINI_API_KEY;
  if(!key) return res.status(503).json({error:'AI provider not configured. Add GEMINI_API_KEY to the Vercel project environment variables.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const mode=body.mode||'generate';
    const prompt=String(body.prompt||'').slice(0,90000);
    const model=process.env.GEMINI_MODEL||'gemini-3.7-flash';
    const system=mode==='analyze'
      ? 'You are Nightcast Source Analyst. Turn raw source material into a precise podcast-generation brief. Extract canon facts, entities, relationships, timeline, locations, conflicts, themes, unresolved questions, speaker roles and episode beats. Do not invent facts; mark uncertain material as theory. Return only valid JSON.'
      : 'You are Nightcast Podcast Director. Create natural multi-speaker dialogue from the supplied brief. Characters must sound distinct and react to each other. Never repeat the prompt, source text, host question, instructions, or another speaker verbatim. Never answer by restating a question. Every turn must add a new idea, reaction, detail, disagreement, emotional beat, question, or revelation. Preserve supplied canon. Do not expose production instructions.';
    const schema=mode==='analyze'?{
      type:'object',properties:{title:{type:'string'},summary:{type:'string'},themes:{type:'array',items:{type:'string'}},facts:{type:'array',items:{type:'string'}},entities:{type:'array',items:{type:'string'}},relationships:{type:'array',items:{type:'string'}},timeline:{type:'array',items:{type:'string'}},locations:{type:'array',items:{type:'string'}},conflicts:{type:'array',items:{type:'string'}},questions:{type:'array',items:{type:'string'}},beats:{type:'array',items:{type:'string'}},prompt:{type:'string'}},required:['title','summary','themes','facts','entities','relationships','timeline','locations','conflicts','questions','beats','prompt']
    }:{
      type:'object',properties:{title:{type:'string'},lines:{type:'array',items:{type:'string'}},summary:{type:'string'},memoryUpdate:{type:'array',items:{type:'string'}}},required:['title','lines','summary','memoryUpdate']
    };
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],systemInstruction:{parts:[{text:system}]},generationConfig:{temperature:0.9,maxOutputTokens:7000,responseMimeType:'application/json',responseSchema:schema}})
    });
    const j=await r.json();
    if(!r.ok) return res.status(r.status).json({error:j?.error?.message||'Gemini request failed'});
    const text=j?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    if(!text) return res.status(502).json({error:'AI returned no text'});
    let data;try{data=JSON.parse(text)}catch{data={raw:text}};
    return res.status(200).json(data);
  }catch(e){return res.status(500).json({error:e?.message||'AI request failed'});}
}

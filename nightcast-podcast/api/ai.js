export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const key=process.env.GEMINI_API_KEY;
  if(!key)return res.status(503).json({error:'GEMINI_API_KEY is not configured.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const prompt=String(body.prompt||'').slice(0,90000);
    const requested=String(body.model||process.env.GEMINI_MODEL||'gemini-3.8-flash');
    const models=[requested,'gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash-lite'].filter((m,i,a)=>m&&a.indexOf(m)===i);
    const system='You are Nightcast Podcast Director. Create natural multi-speaker dialogue from the supplied brief. Characters must sound distinct and react to each other. Never repeat the prompt, source text, instructions, or another speaker verbatim. Every turn must add a new idea, reaction, detail, disagreement, emotional beat, question, or revelation. Preserve supplied character details. Return only JSON.';
    let lastError='Gemini request failed';
    for(const model of models){
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],systemInstruction:{parts:[{text:system}]},generationConfig:{temperature:.9,maxOutputTokens:7000,responseMimeType:'application/json',responseSchema:{type:'object',properties:{title:{type:'string'},lines:{type:'array',items:{type:'string'}}},required:['title','lines']}}})});
      const j=await r.json();
      if(r.ok){
        const text=j?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
        if(!text){lastError='AI returned no text';continue;}
        return res.status(200).json({...JSON.parse(text),modelUsed:model});
      }
      lastError=j?.error?.message||lastError;
      if(![429,500,502,503,504].includes(r.status))break;
    }
    return res.status(503).json({error:`Gemini is temporarily unavailable. Tried ${models.join(', ')}. ${lastError}`});
  }catch(e){return res.status(500).json({error:e?.message||'AI request failed'})}
}
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const body=req.body||{};
    const key=body.apiKey||process.env.AI_GATEWAY_API_KEY;
    if(!key) return res.status(400).json({error:'No Vercel AI Gateway key configured.'});
    const useWeb=!!body.webHelp;
    const model=useWeb?'perplexity/sonar':(body.model||process.env.AI_GATEWAY_MODEL||'openai/gpt-5.5');
    const r=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({model,messages:[
        {role:'system',content:'You are the Nightcast Podcast Director. Generate an actual natural multi-speaker conversation. Never output meta-prompts or instructions. Return only valid JSON with keys title and lines, where lines is an array of strings formatted as Speaker: spoken dialogue.'},
        {role:'user',content:String(body.prompt||'')}
      ],temperature:Number(body.temperature??0.9),max_tokens:Number(body.maxTokens||12000),response_format:{type:'json_object'}})
    });
    const text=await r.text();
    let j;try{j=JSON.parse(text)}catch{j={error:{message:text}}}
    if(!r.ok) return res.status(r.status).json({error:j?.error?.message||'AI Gateway request failed',details:j});
    const content=j?.choices?.[0]?.message?.content||'';
    let out;try{out=JSON.parse(content)}catch{out={title:'Nightcast Episode',lines:[content]}}
    return res.status(200).json(out);
  }catch(e){return res.status(500).json({error:e.message||'Gateway error'})}
}
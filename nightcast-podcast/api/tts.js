export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const {text,voiceId,apiKey,modelId}=req.body||{};
    const key=process.env.ELEVENLABS_API_KEY||apiKey;
    if(!key) return res.status(400).json({error:'No ElevenLabs API key configured.'});
    if(!text||!voiceId) return res.status(400).json({error:'text and voiceId are required.'});
    const r=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voiceId),{
      method:'POST',headers:{'Content-Type':'application/json','xi-api-key':key,'Accept':'audio/mpeg'},
      body:JSON.stringify({text:String(text),model_id:modelId||'eleven_v3',output_format:'mp3_44100_128'})
    });
    const buf=Buffer.from(await r.arrayBuffer());
    if(!r.ok){let msg=buf.toString('utf8');try{msg=JSON.parse(msg)?.detail?.message||msg}catch{}return res.status(r.status).json({error:msg||'ElevenLabs TTS failed'})}
    res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','no-store');return res.status(200).send(buf);
  }catch(e){return res.status(500).json({error:e.message||'TTS error'})}
}
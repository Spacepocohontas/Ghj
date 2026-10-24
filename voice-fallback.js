/* Local speech fallback: works on iOS Safari without WebGPU or paid voice APIs. */
(()=>{
'use strict';
if(window.nfBrowserVoice)return;
const presets={natural:[1,1],dark:[.88,.74],warm:[.94,.96],cinematic:[.84,.84],playful:[1.12,1.18]};
const available=()=>typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined';
const hasWebGPU=()=>Boolean(navigator.gpu?.requestAdapter);
let active;
function speak(text,c={}){
  const msg=String(text??'').trim();
  if(!msg||!available())return Promise.resolve(false);
  const p=c.voice||{},style=p.deliveryStyle||(p.provider==='chatterbox'?p.providerVoiceId:'natural');
  const [r,pitch]=presets[style]||presets.natural;
  const u=new SpeechSynthesisUtterance(msg),vr=Number(p.rate),vp=Number(p.pitch);
  u.rate=vr>0?Math.min(2,Math.max(.5,vr)):r;
  u.pitch=vp>0?Math.min(2,Math.max(.5,vp)):pitch;
  u.volume=1;
  const choices=speechSynthesis.getVoices?.()||[];
  const wanted=p.browserVoice||p.browserVoiceName||'';
  const v=choices.find(x=>x.name===wanted)||choices.find(x=>x.lang?.toLowerCase()===(p.lang||navigator.language||'en-US').toLowerCase())||choices.find(x=>x.lang?.startsWith('en'));
  if(v)u.voice=v;
  if(active)active.onstart=active.onend=active.onerror=null;
  active=u;
  try{speechSynthesis.cancel()}catch{}
  return new Promise(resolve=>{
    let done=false;const finish=v=>{if(!done){done=true;resolve(v)}};
    u.onstart=()=>finish(true);
    u.onend=()=>{finish(true);if(active===u)active=null};
    u.onerror=e=>{console.warn('Device speech unavailable',e?.error);finish(false);if(active===u)active=null};
    try{speechSynthesis.speak(u)}catch(e){console.warn('Device speech error',e);finish(false)}
    setTimeout(()=>finish(Boolean(speechSynthesis.speaking)),4000);
  });
}
async function saveStyle(id,style){
  const cs=await get('characters')||[],c=cs.find(x=>x.id===id);
  if(!c)return null;
  const [rate,pitch]=presets[style]||presets.natural;
  c.voice={...(c.voice||{}),provider:'browser',providerVoiceId:null,
    providerVoiceName:'Device · '+style,
    savedVoiceId:null,browserVoice:'',browserVoiceName:'',
    deliveryStyle:style,rate,pitch,autoRead:true};
  await put('characters',cs);return c;
}
const prior=window.nfSpeakCharacter;
window.nfSpeakCharacter=async(text,c)=>{
  const p=c?.voice?.provider;
  // Don't download Chatterbox's huge WebGPU model on an incompatible phone.
  if(p==='chatterbox'&&!hasWebGPU())return speak(text,c);
  if(p==='kokoro'&&/iPhone|iPad|iPod/.test(navigator.userAgent))return speak(text,c);
  // Browser speech must start in the original tap handler on iOS; do not await other adapters.
  if(p==='browser'||c?.voice?.browserVoice||c?.voice?.browserVoiceName)return speak(text,c);
  try{if(prior&&await prior(text,c))return true}
  catch(e){console.warn('Selected character voice failed; trying device speech',e)}
  return speak(text,c);
};
window.nfBrowserVoice={speak,saveStyle,available,hasWebGPU,presets};
})();

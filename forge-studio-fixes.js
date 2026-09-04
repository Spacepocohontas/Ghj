(()=>{
if(window.__nfForgeStudioFixes)return;window.__nfForgeStudioFixes=1;
// Route all existing browser-TTS calls through the character's assigned Voice Studio profile.
if('speechSynthesis'in window){const original=SpeechSynthesis.prototype.speak;SpeechSynthesis.prototype.speak=function(utterance){try{if(!window.__nfVoiceRouting&&typeof state!=='undefined'&&state.chat&&utterance&&!utterance.__nfRouted){const cs=window.__nfGetCharacters?window.__nfGetCharacters():null;const route=window.__nfVoiceRoute; if(route){route(utterance).catch(()=>{})}}}catch{}return original.call(this,utterance)}}
window.__nfVoiceRoute=async u=>{try{const cs=await get('characters')||[],c=cs.find(x=>x.id===state.chat);const vs=await get('voiceCollection')||[],v=vs.find(x=>x.id===c?.voice?.savedVoiceId);if(!v||!v.browserVoice)return;const bv=speechSynthesis.getVoices().find(x=>x.name===v.browserVoice);if(bv)u.voice=bv;u.rate=v.rate||1;u.pitch=v.pitch||1;u.__nfRouted=true}catch{}};
// Correct voice-profile deletion and clean assignments by profile ID.
document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-del-voice]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const a=await get('voiceCollection')||[],i=Number(b.dataset.delVoice),v=a[i];if(!v)return;if(!confirm(`Delete ${v.name||'this voice'}?`))return;a.splice(i,1);await put('voiceCollection',a);const cs=await get('characters')||[];cs.forEach(c=>{if(c.voice?.savedVoiceId===v.id)c.voice.savedVoiceId=null});await put('characters',cs);render()},true);
})();

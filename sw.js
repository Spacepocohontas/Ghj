const CACHE='nightshade-forge-shell-v9-mobile-voice-fallback';
const SHELL=["./","./index.html","./app.js","./forge-pass2.js","./voice-call.js","./style.css","./document-support/document-loader.js","./media-studio.js","./provider-studio.js","./capability-studio.js","./chat-upgrades.js","./conversation-branches.js","./character-studio.js","./character-cards.js","./prompt-context.js","./voice-library.js","./voice-adapter.js","./auto-voice.js","./call-controls.js","./autonomy-memory.js","./autonomy-bridge.js","./chat-history.js","./chat-rewind.js","./chat-list.js","./message-menu.js","./chat-status.js","./character-state.js","./forge-enhancements.js","./forge-studio.js","./forge-studio-fixes.js","./forge-control-center.js","./ai-generation-bridge.js","./voice-clone.js","./workflow.js","./gemini-podcast-sidecar.js","./kokoro-voice.js","./chatterbox-voice.js","./forge-chat-voice-ux.js","./chatterbox-voice-ui.js","./chatterbox-reference.js","./chatterbox-reference-ui.js","./elevenlabs-voice-picker.js","./voice-fallback.js","/studio-toolkit.js","./media-studio.css","./forge-ui.css","./gemini-podcast-sidecar.css"];
const REQUIRED=["./","./index.html","./app.js","./forge-pass2.js","./voice-call.js","./style.css"];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(REQUIRED);
    await Promise.allSettled(SHELL.filter(path=>!REQUIRED.includes(path)).map(path=>cache.add(path)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  // Keep previous populated caches as a fallback until every referenced asset
  // is available in the new cache; do not immediately remove v6/v7 resources.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||/\/api\//.test(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{}));
    }
    return response;
  }).catch(async()=>{
    const current=await caches.open(CACHE);
    const saved=await current.match(event.request)||await caches.match(event.request);
    if(saved)return saved;
    if(event.request.mode==='navigate')return await current.match('./index.html')||await caches.match('./index.html')||Response.error();
    return Response.error();
  }));
});

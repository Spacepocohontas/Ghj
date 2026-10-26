(()=>{if(window.__nfVoiceClone)return;window.__nfVoiceClone=1;const API_ROOT=location.hostname.endsWith('.github.io')?'https://ghj-git-main-ohnoitstamara-4066.vercel.app':'',BRIDGE=API_ROOT+'/api/tts',UPLOAD=API_ROOT+'/api/voice-upload';const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));const uid=()=>crypto.randomUUID();const getA=async k=>await get(k)||[];const putA=(k,v)=>put(k,v);const allowed=f=>{const n=(f.name||'').toLowerCase(),t=(f.type||'').toLowerCase();return /\.(mp3|mp4|m4a|wav|webm|mov|ogg|oga|flac|aac)$/.test(n)||/^(audio|video)\//.test(t)};const uploadDirect=async(f,onProgress)=>{const r=await fetch(UPLOAD,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({name:f.name,type:f.type||'application/octet-stream'})});const info=await r.json().catch(()=>({}));if(!r.ok||!info.putUrl)throw Error(info.error||'Could not start secure upload.');await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('PUT',info.putUrl);x.setRequestHeader('Content-Type',f.type||info.contentType||'application/octet-stream');x.upload.onprogress=e=>{if(e.lengthComputable)onProgress?.(e.loaded/e.total)};x.onload=()=>x.status>=200&&x.status<300?resolve():reject(Error('Upload failed (HTTP '+x.status+').'));x.onerror=()=>reject(Error('Upload connection failed.'));x.onabort=()=>reject(Error('Upload cancelled.'));x.send(f)});return {url:info.getUrl,name:f.name,type:f.type||info.contentType||'application/octet-stream',size:f.size}};async function cloneVoice(v){const samples=(v.samples||[]).filter(s=>s.url||s.data).map(s=>({url:s.url,data:s.data,name:s.name,type:s.type}));const res=await fetch(BRIDGE+'?action=clone',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({name:v.name,description:v.description,samples,removeBackgroundNoise:false})});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data?.detail?.detail?.message||data?.detail?.message||data?.error||('Cloud provider HTTP '+res.status));return data.voice_id}const readSample=file=>new Promise((resolve,reject)=>{
 const fr=new FileReader();fr.onload=()=>resolve(fr.result);
 fr.onerror=()=>reject(Error('Could not read the sample on this device.'));
 fr.readAsDataURL(file);
});
const LOCAL_MAX=8*1024*1024,LOCAL_TOTAL=12*1024*1024,CLOUD_DIRECT_LIMIT=2*1024*1024;
async function editor(){
 if(document.querySelector('#nfVoiceSampleEditor'))return;
 const m=document.createElement('div');m.className='nf-modal';m.id='nfVoiceSampleEditor';
 m.innerHTML='<section class="card stack" role="dialog" aria-modal="true" aria-label="Voice samples and cloning">'+
 '<div class="row"><div class="grow"><h2>Voice Samples &amp; Cloning</h2><div class="muted">Save your own voice samples for free on this device. A saved sample is NOT a synthesized voice clone.</div></div><button class="iconbtn" id="nfcClose">×</button></div>'+
 '<label>Voice name<input id="nfcName" class="input" placeholder="e.g. GalaXia Voice"></label>'+
 '<label>Description<textarea id="nfcDesc" class="input" rows="2" placeholder="Optional description"></textarea></label>'+
 '<div class="row wrap"><label class="btn">＋ Add audio/video samples<input id="nfcFiles" type="file" accept=".mp3,.mp4,.m4a,.wav,.webm,.mov,.ogg,.oga,.flac,.aac,audio/*,video/*" multiple hidden></label><button class="btn" id="nfcRecord">◉ Record</button></div>'+
 '<div class="tiny muted">Free local storage: up to 8 MB per sample, 12 MB total. You can preview recordings in Voice Studio without uploading them to a server.</div>'+
 '<div id="nfcStatus" class="tiny muted" role="status" aria-live="polite"></div><div id="nfcSamples" class="stack"></div>'+
 '<button class="btn primary" id="nfcSave">💾 Save samples locally — FREE</button>'+
 '<details><summary>Optional: Real AI voice cloning (cloud provider)</summary>'+
 '<p class="tiny muted">Actual cloning requires a configured voice provider and may require a paid plan or credits. It is NOT part of the free local feature. Small samples can be sent directly without Blob storage, but may be subject to provider limits.</p>'+
 '<button class="btn" id="nfcClone">☁ Request AI Clone (may use paid provider)</button></details></section>';
 document.body.append(m);
 const name=m.querySelector('#nfcName'),desc=m.querySelector('#nfcDesc'),
 list=m.querySelector('#nfcSamples'),status=m.querySelector('#nfcStatus'),files=m.querySelector('#nfcFiles');
 let samples=[],stream,rec,chunks=[];
 const urls=[];
 const close=()=>{try{rec?.state==='recording'&&rec.stop()}catch{}
  try{stream?.getTracks().forEach(t=>t.stop())}catch{}
  urls.forEach(u=>URL.revokeObjectURL(u));m.remove()};
 function paint(){
  list.innerHTML=samples.length?samples.map((s,i)=>'<div class="nf-sample">'+
   '<div class="row"><div class="grow"><strong>'+esc(s.name)+'</strong>'+
   '<div class="tiny muted">'+Math.round(s.size/1024)+' KB · '+esc(s.type||'audio')+'</div></div>'+
   '<button class="btn" data-x="'+i+'">×</button></div>'+
   (s.preview?'<audio controls preload="none" src="'+esc(s.preview)+'" style="width:100%;margin-top:6px"></audio>':'')+
   '</div>').join(''):'<div class="tiny muted">No samples yet. For best results, record about 1–2 minutes of clear, single-speaker audio.</div>';
  list.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.x);const removed=samples.splice(i,1)[0];if(removed?.preview){URL.revokeObjectURL(removed.preview);const n=urls.indexOf(removed.preview);if(n>=0)urls.splice(n,1)}paint()});
 }
 function addFile(f){
  if(!allowed(f))throw Error('Unsupported file: '+f.name);
  if(!f.size)throw Error('Empty file: '+f.name);
  if(f.size>LOCAL_MAX)throw Error(f.name+' exceeds the local 8 MB per-sample limit.');
  if(samples.reduce((a,b)=>a+b.size,0)+f.size>LOCAL_TOTAL)throw Error('The voice samples exceed the local 12 MB total limit.');
  const preview=URL.createObjectURL(f);urls.push(preview);
  samples.push({id:uid(),name:f.name||'Voice sample',type:f.type||'audio/mpeg',size:f.size,file:f,preview});
 }
 paint();
 files.onchange=e=>{const selected=[...(e.target.files||[])];let count=0;
  for(const f of selected){try{addFile(f);count++}catch(err){status.textContent='⚠ '+err.message;break}}
  if(count===selected.length)status.textContent='Added '+count+' sample(s). Nothing has been uploaded.';paint();files.value='';
 };
 m.querySelector('#nfcRecord').onclick=async()=>{
  if(rec?.state==='recording'){rec.stop();return}
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
   const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported?.(x))||'';
   rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);chunks=[];
   rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
   rec.onstop=()=>{stream?.getTracks().forEach(t=>t.stop());
    if(!m.isConnected)return;
    const b=new Blob(chunks,{type:rec.mimeType||'audio/webm'});
    try{const f=new File([b],'recorded-sample.'+(b.type.includes('mp4')?'m4a':'webm'),{type:b.type});addFile(f);status.textContent='Sample captured locally.'}catch(e){status.textContent='⚠ '+e.message}
    m.querySelector('#nfcRecord').textContent='◉ Record';paint()};
   rec.start();m.querySelector('#nfcRecord').textContent='■ Stop';status.textContent='Recording on this device…';
  }catch(e){status.textContent='⚠ '+e.message}
 };
 m.querySelector('#nfcSave').onclick=async()=>{
  const n=name.value.trim()||'Local Voice Reference';
  if(!samples.length){status.textContent='⚠ Add at least one sample.';return}
  const btn=m.querySelector('#nfcSave');btn.disabled=true;
  try{
   status.textContent='Saving locally on this device…';
   const saved=[];for(const s of samples){saved.push({id:s.id,name:s.name,type:s.type,size:s.size,data:await readSample(s.file)})}
   const a=await getA('voiceCollection');
   a.push({id:uid(),name:n,description:desc.value.trim(),samples:saved,browserVoice:'',rate:1,pitch:1,engine:'local-reference',providerVoiceId:null,createdAt:new Date().toISOString()});
   await putA('voiceCollection',a);
   status.textContent='Saved locally. This is a reference recording, not an AI clone. Preview it in Voice Studio.';
   setTimeout(()=>{close();render()},1100);
  }catch(e){status.textContent='⚠ Local save failed: '+e.message;btn.disabled=false}
 };
 m.querySelector('#nfcClone').onclick=async()=>{
  if(!samples.length){status.textContent='⚠ Add a sample first.';return}
  const size=samples.reduce((n,s)=>n+s.size,0);
  if(size>CLOUD_DIRECT_LIMIT){status.textContent='Cloud cloning without Blob storage accepts up to 2 MB total. Trim or compress the recording. Free local saving supports larger samples.';return}
  if(!confirm('Real AI voice cloning is NOT free local playback. Your recording will be uploaded to the configured cloud voice provider. Provider charges or plan restrictions may apply. Continue?'))return;
  const btn=m.querySelector('#nfcClone');btn.disabled=true;
  try{
   status.textContent='Sending small samples to the configured voice provider…';
   const encoded=[];for(const s of samples)encoded.push({id:s.id,name:s.name,type:s.type,size:s.size,data:await readSample(s.file)});
   const voiceId=await cloneVoice({name:name.value.trim()||'Nightshade Voice',description:desc.value.trim(),samples:encoded});
   const voices=await getA('voiceCollection');
   voices.push({id:uid(),name:name.value.trim()||'Nightshade Voice',description:desc.value.trim(),
    samples:encoded,browserVoice:'',rate:1,pitch:1,engine:'elevenlabs',providerVoiceId:voiceId,createdAt:new Date().toISOString()});
   await putA('voiceCollection',voices);
   status.textContent='Cloud voice clone created and saved.';
   setTimeout(()=>{close();render()},1100);
  }catch(e){status.textContent='⚠ Cloud cloning failed: '+e.message;btn.disabled=false}
 };
 m.querySelector('#nfcClose').onclick=close;
}
function inject(){if(!['voices','chars'].includes(typeof state!=='undefined'?state.tab:window.state?.tab)){document.getElementById('nfVoiceCloneBtn')?.remove();return}if(document.getElementById('nfVoiceCloneBtn'))return;const b=document.createElement('button');b.id='nfVoiceCloneBtn';b.className='btn primary';b.textContent='🎙 Voice Samples';b.onclick=editor;(document.querySelector('main')||document.body).appendChild(b)}new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});window.nfOpenVoiceClone=editor;window.addEventListener('load',()=>setTimeout(inject,300))})();
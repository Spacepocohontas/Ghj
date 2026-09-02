(()=>{
async function allConvs(){return await get('conversations')||[]}
async function active(){const all=await allConvs();return {all,x:all.find(v=>v.characterId===state.chat)}}
function branchName(kind){const t=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});return `${kind==='edit'?'Edit':'Branch'} · ${t}`}
async function makeBranch(index,kind='branch',editText=null){
 const {all,x}=await active();if(!x)return null;
 const clone=JSON.parse(JSON.stringify(x));clone.id=crypto.randomUUID();clone.parentConversationId=x.id;clone.branchPoint=index;clone.branchName=branchName(kind);clone.createdAt=new Date().toISOString();clone.messages=(x.messages||[]).slice(0,index+1);
 if(editText!==null&&clone.messages[index]){clone.messages[index].text=editText.trim();clone.messages[index].edited=true;clone.messages[index].editedAt=new Date().toISOString()}
 all.unshift(clone);await put('conversations',all);return clone
}
async function switchBranch(id){const all=await allConvs(),i=all.findIndex(v=>v.id===id);if(i<0)return;const [x]=all.splice(i,1);all.unshift(x);await put('conversations',all);await render()}
async function branchFrom(i){if(await makeBranch(i))await render()}
async function editBranch(i){const {x}=await active(),m=x?.messages?.[i];if(!m)return;const t=prompt('Edit this message in a new branch',m.text);if(t===null||!t.trim())return;await makeBranch(i,'edit',t);await render();if(m.role==='user'){const b=document.querySelector('#forgeContinue');if(b)b.click()}else{const b=document.querySelector(`[data-regen="${i}"]`);if(b)b.click()}}
async function regenBranch(i){const {x}=await active(),m=x?.messages?.[i];if(!m||m.role!=='assistant')return;await makeBranch(i,'branch');await render();const b=document.querySelector(`[data-regen="${i}"]`);if(b)b.click()}
async function addBranchUI(){
 if(state.tab!=='chat'||!state.chat)return;const all=await allConvs(),x=all.find(v=>v.characterId===state.chat);if(!x)return;
 const head=document.querySelector('.chathead');
 if(head&&!document.querySelector('#branchPicker')){
  const branches=all.filter(v=>v.characterId===state.chat),wrap=document.createElement('div');wrap.id='branchPicker';wrap.style.cssText='padding:0 8px 6px;display:flex;gap:6px;align-items:center;overflow:auto;';
  const label=document.createElement('span');label.className='tiny muted';label.textContent='BRANCHES';wrap.append(label);
  branches.forEach((b,n)=>{const q=document.createElement('button');q.className='mini';q.textContent=b.branchName||`Main${n?' #'+(n+1):''}`;q.title=b.parentConversationId?'Conversation branch':'Main conversation';if(b.id===x.id)q.disabled=true;q.onclick=()=>switchBranch(b.id);wrap.append(q)});
  head.insertAdjacentElement('afterend',wrap)
 }
 document.querySelectorAll('.bubble').forEach((bubble,i)=>{const row=bubble.querySelector('.bubblemeta');if(!row||row.querySelector('[data-branch]'))return;const br=document.createElement('button');br.className='mini';br.dataset.branch=i;br.textContent='⑂ Branch';br.title='Create a new conversation branch from here';br.onclick=()=>branchFrom(i);row.append(' ',br);const ed=row.querySelector('[data-edit]');if(ed)ed.onclick=e=>{e.stopPropagation();editBranch(i)};const rg=row.querySelector('[data-regen]');if(rg)rg.onclick=e=>{e.stopPropagation();regenBranch(i)}})
}
const oldRender=window.render;window.render=async()=>{await oldRender();await addBranchUI()};window.addEventListener('load',()=>setTimeout(addBranchUI,0));
})();
/* Memory Studio — see, edit, pin and organise everything a character knows.
 * Replaces the old one-line prompt() with a real manager. Entirely local. */
(() => {
if (window.__nfMemoryStudio) return;
window.__nfMemoryStudio = 1;

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const TYPES = () => (window.nfMemory?.TYPES) || [['fact', 'Fact', '']];
let openFor = null;

async function characterName(id) {
  const c = (await get('characters') || []).find(x => x.id === id);
  return c?.name || 'this character';
}

function close() { document.querySelector('#nfMemoryModal')?.remove(); openFor = null }

async function open(characterId) {
  if (!characterId || !window.nfMemory) return;
  close();
  openFor = characterId;
  const name = await characterName(characterId);
  const wrap = document.createElement('div');
  wrap.id = 'nfMemoryModal';
  wrap.className = 'nf-mem-modal';
  wrap.innerHTML = `<section class="card stack nf-mem-dialog">
    <div class="row"><div class="grow"><h2>Memory · ${esc(name)}</h2>
    <div class="tiny muted">Pinned memories are always sent. The rest are ranked by relevance to what you are talking about, so long histories stay affordable on free models.</div></div>
    <button class="iconbtn" id="nfMemClose">×</button></div>
    <div class="nf-mem-add">
      <textarea id="nfMemText" class="input" rows="2" placeholder="Something this character should always know…"></textarea>
      <div class="row wrap">
        <select id="nfMemType" class="input">${TYPES().map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
        <label class="switchrow tiny"><input type="checkbox" id="nfMemPin"> Pin</label>
        <button class="btn primary" id="nfMemAdd">＋ Add memory</button>
      </div>
    </div>
    <input id="nfMemSearch" class="input" placeholder="Search memories…">
    <div id="nfMemList" class="stack"></div>
    <div class="row wrap"><button class="btn" id="nfMemExport">⇩ Export</button><span class="tiny muted" id="nfMemCount"></span></div>
  </section>`;
  document.body.append(wrap);
  wrap.onclick = e => { if (e.target === wrap) close() };
  wrap.querySelector('#nfMemClose').onclick = close;
  wrap.querySelector('#nfMemSearch').oninput = paint;
  wrap.querySelector('#nfMemAdd').onclick = async () => {
    const text = wrap.querySelector('#nfMemText').value.trim();
    if (!text) return;
    await window.nfMemory.add(characterId, { text, type: wrap.querySelector('#nfMemType').value, pinned: wrap.querySelector('#nfMemPin').checked, source: 'manual' });
    wrap.querySelector('#nfMemText').value = '';
    wrap.querySelector('#nfMemPin').checked = false;
    paint();
  };
  wrap.querySelector('#nfMemExport').onclick = async () => {
    const list = await window.nfMemory.list(characterId);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ character: name, memories: list }, null, 2)], { type: 'application/json' }));
    a.download = (name || 'character').replace(/[^\w.-]+/g, '_') + '_memories.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  paint();
}

async function paint() {
  const box = document.querySelector('#nfMemList');
  if (!box || !openFor) return;
  const q = (document.querySelector('#nfMemSearch')?.value || '').toLowerCase();
  const all = await window.nfMemory.list(openFor);
  const list = q ? all.filter(m => m.text.toLowerCase().includes(q) || m.type.includes(q)) : all;
  const labels = Object.fromEntries(TYPES().map(([v, l]) => [v, l]));
  document.querySelector('#nfMemCount').textContent = `${all.length} memor${all.length === 1 ? 'y' : 'ies'} · ${all.filter(m => m.pinned).length} pinned`;
  box.innerHTML = list.length ? list.map(m => `<div class="nf-mem-row${m.pinned ? ' pinned' : ''}" data-id="${esc(m.id)}">
    <div class="grow"><div class="nf-mem-text">${esc(m.text)}</div>
    <div class="tiny muted"><span class="nf-mem-chip">${esc(labels[m.type] || m.type)}</span>${m.source === 'auto' ? ' · auto-captured' : ''} · ${new Date(m.at).toLocaleDateString()}</div></div>
    <button class="mini" data-pin="${esc(m.id)}" title="Always include this memory">${m.pinned ? '★' : '☆'}</button>
    <button class="mini" data-edit-mem="${esc(m.id)}">✎</button>
    <button class="mini" data-del-mem="${esc(m.id)}">🗑</button>
  </div>`).join('') : '<div class="muted tiny">No memories yet. Add what this character should never forget.</div>';

  box.querySelectorAll('[data-pin]').forEach(b => b.onclick = async () => {
    const list = await window.nfMemory.list(openFor);
    const m = list.find(x => x.id === b.dataset.pin);
    if (m) await window.nfMemory.update(openFor, m.id, { pinned: !m.pinned });
    paint();
  });
  box.querySelectorAll('[data-edit-mem]').forEach(b => b.onclick = async () => {
    const list = await window.nfMemory.list(openFor);
    const m = list.find(x => x.id === b.dataset.editMem);
    if (!m) return;
    const t = prompt('Edit memory', m.text);
    if (t === null || !t.trim()) return;
    await window.nfMemory.update(openFor, m.id, { text: t.trim() });
    paint();
  });
  box.querySelectorAll('[data-del-mem]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this memory?')) return;
    await window.nfMemory.remove(openFor, b.dataset.delMem);
    paint();
  });
}

/* Take over the old prompt()-based memory buttons wherever they appear. */
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-memory]');
  if (!b) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  open(b.dataset.memory);
}, true);

document.addEventListener('keydown', e => { if (e.key === 'Escape') close() });

const style = document.createElement('style');
style.id = 'nfMemoryStyle';
style.textContent = `.nf-mem-modal{position:fixed;inset:0;z-index:10001;background:#000c;display:flex;align-items:flex-end;justify-content:center;padding:12px}
.nf-mem-dialog{width:min(640px,100%);max-height:88vh;overflow:auto}
.nf-mem-add{display:grid;gap:7px}
.nf-mem-row{display:flex;gap:7px;align-items:flex-start;padding:9px;border:1px solid #2b1b30;border-radius:11px;background:#0e0a12}
.nf-mem-row.pinned{border-color:#633153;background:#170f1b}
.nf-mem-text{font-size:13px;line-height:1.45;word-break:break-word}
.nf-mem-chip{display:inline-block;padding:1px 7px;border:1px solid #38253d;border-radius:999px;margin-right:4px}
.nf-mem-row .mini{flex:0 0 auto}
@media(max-width:560px){.nf-mem-dialog{max-height:92vh}}`;
document.head.append(style);

window.nfMemoryStudio = { open, close };
})();

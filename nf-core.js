/* Nightshade Forge — core services.
 *
 * One place that owns:
 *   nfStore   — canonical vault keys + one-time migration of duplicated stores
 *   nfMemory  — typed, pinned, retrievable long-term memory
 *   nfPrompt  — the single system-prompt builder (replaces four fetch patches)
 *
 * Loaded straight after app.js so every later module can register into it.
 */
(() => {
if (window.nfCore) return;

/* ------------------------------------------------------------------ *
 * Store                                                               *
 * ------------------------------------------------------------------ */
const KEYS = {
  characters: 'characters',
  conversations: 'conversations',
  settings: 'settings',
  provider: 'provider',
  voices: 'voiceCollection',
  lorebooks: 'nf_lorebooks',
  autonomy: 'nf_autonomy',
  characterState: 'nf_character_state',
  personas: 'personas',
  attachments: 'attachments',
  abilities: 'abilities'
};

const arr = async k => (await get(k)) || [];
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/* Voices used to be written to three different keys by three different
 * screens, and lorebooks to two. Fold the strays into the canonical key once,
 * so nothing a user saved is stranded in an unreachable UI. */
async function migrate() {
  const done = (await get('nf_migrations')) || {};

  if (!done.voices) {
    const canonical = await arr(KEYS.voices);
    const strays = [...(await arr('voices')), ...(await arr('voiceLibrary'))];
    let added = 0;
    for (const v of strays) {
      if (!v || !v.name) continue;
      if (canonical.some(x => x.id === v.id || (x.name === v.name && x.createdAt === v.createdAt))) continue;
      canonical.push({ id: v.id || uid(), name: v.name, description: v.description || '', samples: v.samples || [], data: v.data || '', type: v.type || '', size: v.size || 0, browserVoice: v.browserVoice || '', rate: v.rate || 1, pitch: v.pitch || 1, createdAt: v.createdAt || now(), migratedFrom: 'legacy voice store' });
      added++;
    }
    if (added) await put(KEYS.voices, canonical);
    done.voices = now();
  }

  if (!done.lorebooks) {
    const canonical = await arr(KEYS.lorebooks);
    let added = 0;
    for (const b of await arr('lorebooks')) {
      if (!b || canonical.some(x => x.id === b.id)) continue;
      canonical.push({ id: b.id || uid(), name: b.name || 'Imported lorebook', entries: Array.isArray(b.entries) ? b.entries : [], createdAt: b.createdAt || now(), source: b.source || 'legacy store' });
      added++;
    }
    if (added) await put(KEYS.lorebooks, canonical);
    done.lorebooks = now();
  }

  if (!done.memoryTypes) {
    const cs = await arr(KEYS.characters);
    let touched = false;
    for (const c of cs) {
      if (!Array.isArray(c.memory) || !c.memory.length) continue;
      const next = c.memory.map(m => normalizeMemory(m)).filter(Boolean);
      if (JSON.stringify(next) !== JSON.stringify(c.memory)) { c.memory = next; touched = true }
    }
    if (touched) await put(KEYS.characters, cs);
    done.memoryTypes = now();
  }

  await put('nf_migrations', done);
}

/* ------------------------------------------------------------------ *
 * Memory                                                              *
 * ------------------------------------------------------------------ */
const TYPES = [
  ['fact', 'Fact', 'Permanent truth about the user, character or world'],
  ['event', 'Event', 'Something that happened during your story'],
  ['relationship', 'Relationship', 'How the character feels about you'],
  ['plot', 'Plot thread', 'Unresolved story business'],
  ['world', 'World', 'Lore about the setting'],
  ['preference', 'Preference', 'Likes, dislikes, boundaries']
];
const TYPE_WEIGHT = { pinned: 3, fact: 1.6, relationship: 1.5, plot: 1.4, preference: 1.2, world: 1.1, event: 1 };

function normalizeMemory(m) {
  if (!m) return null;
  if (typeof m === 'string') {
    const text = m.trim();
    return text ? { id: uid(), text, type: 'fact', pinned: false, source: 'legacy', at: now() } : null;
  }
  const text = String(m.text || '').trim();
  if (!text) return null;
  return {
    id: m.id || uid(),
    text,
    type: TYPES.some(t => t[0] === m.type) ? m.type : (m.type === 'auto' ? 'fact' : 'fact'),
    pinned: !!m.pinned,
    source: m.source || (m.type === 'auto' ? 'auto' : 'manual'),
    at: m.at || now(),
    usedAt: m.usedAt || null
  };
}

const STOP = new Set('a an and are as at be but by for from had has have he her him his i if in is it its me my no not of on or our she so that the their them then there they this to too us was we were what when which who will with you your'.split(' '));
const terms = s => String(s || '').toLowerCase().split(/[^a-z0-9']+/).filter(w => w.length > 2 && !STOP.has(w));

/** Free, offline relevance ranking: idf-weighted term overlap + type + recency.
 *  No embeddings, no API calls, no cost — but far better than substring counting. */
function rank(memories, queryText, limit) {
  const q = [...new Set(terms(queryText))];
  const docs = memories.map(m => ({ m, t: new Set(terms(m.text)) }));
  const df = new Map();
  for (const w of q) df.set(w, docs.reduce((n, d) => n + (d.t.has(w) ? 1 : 0), 0));
  const newest = Math.max(...memories.map(m => +new Date(m.at) || 0), 1);
  const scored = docs.map(({ m, t }) => {
    let score = 0;
    for (const w of q) {
      if (!t.has(w)) continue;
      const n = df.get(w) || 1;
      score += Math.log(1 + memories.length / n);
    }
    score *= TYPE_WEIGHT[m.pinned ? 'pinned' : m.type] || 1;
    // Recency only *breaks ties* between memories that actually matched — it must
    // never lift an irrelevant memory above the relevance threshold.
    if (score > 0) {
      const age = (newest - (+new Date(m.at) || 0)) / 86400000;
      score += Math.max(0, 0.4 - age * 0.01);
    }
    return { m, score };
  });
  const pinned = scored.filter(x => x.m.pinned).map(x => x.m);
  const rest = scored.filter(x => !x.m.pinned && x.score > 0).sort((a, b) => b.score - a.score).map(x => x.m);
  return [...pinned, ...rest].slice(0, limit);
}

const nfMemory = {
  TYPES,
  normalize: normalizeMemory,
  async list(characterId) {
    const c = (await arr(KEYS.characters)).find(x => x.id === characterId);
    return (c?.memory || []).map(normalizeMemory).filter(Boolean);
  },
  async save(characterId, memories) {
    const cs = await arr(KEYS.characters);
    const c = cs.find(x => x.id === characterId);
    if (!c) return false;
    c.memory = memories.map(normalizeMemory).filter(Boolean);
    await put(KEYS.characters, cs);
    return true;
  },
  async add(characterId, entry) {
    const list = await nfMemory.list(characterId);
    const m = normalizeMemory(entry);
    if (!m) return null;
    if (list.some(x => x.text.toLowerCase() === m.text.toLowerCase())) return null;
    list.push(m);
    await nfMemory.save(characterId, list);
    return m;
  },
  async remove(characterId, id) {
    await nfMemory.save(characterId, (await nfMemory.list(characterId)).filter(m => m.id !== id));
  },
  async update(characterId, id, patch) {
    const list = await nfMemory.list(characterId);
    const m = list.find(x => x.id === id);
    if (!m) return null;
    Object.assign(m, patch);
    await nfMemory.save(characterId, list);
    return m;
  },
  /** Memories to inject, budgeted so free models with small context windows cope. */
  async retrieve(characterId, queryText, { limit = 18, maxChars = 1800 } = {}) {
    const all = await nfMemory.list(characterId);
    if (!all.length) return [];
    const picked = rank(all, queryText, limit);
    const out = [];
    let used = 0;
    for (const m of picked) {
      if (used + m.text.length > maxChars) break;
      out.push(m);
      used += m.text.length;
    }
    return out;
  }
};

/* ------------------------------------------------------------------ *
 * Prompt builder                                                      *
 * ------------------------------------------------------------------ */
const sections = [];
const nfPrompt = {
  /** register({id, priority, skipIf, build}) — build(ctx) returns a string or falsy. */
  register(section) {
    if (!section || !section.id || typeof section.build !== 'function') return;
    const i = sections.findIndex(s => s.id === section.id);
    if (i >= 0) sections[i] = section; else sections.push(section);
    sections.sort((a, b) => (a.priority || 50) - (b.priority || 50));
  },
  list: () => sections.map(s => s.id),
  async build(ctx) {
    const blocks = [];
    for (const s of sections) {
      try {
        if (typeof s.skipIf === 'function' && s.skipIf(ctx)) continue;
        const text = await s.build(ctx);
        if (text && String(text).trim()) blocks.push(String(text).trim());
      } catch (err) {
        console.warn('Nightshade prompt section failed:', s.id, err);
      }
    }
    return blocks.join('\n\n');
  }
};

function looksLikeChat(body) {
  return typeof body === 'string' && body.length < 2000000 && body.includes('"messages"');
}

const nativeFetch = window.fetch.bind(window);
window.fetch = async function (input, init) {
  try {
    if (init && looksLikeChat(init.body)) {
      const req = JSON.parse(init.body);
      if (Array.isArray(req.messages) && req.messages.length) {
        const characterId = window.state?.chat || null;
        const characters = await arr(KEYS.characters);
        const conversations = await arr(KEYS.conversations);
        const character = characters.find(c => c.id === characterId) || null;
        const conversation = conversations.find(x => x.id === window.state?.nfConversationId)
          || conversations.find(x => x.characterId === characterId) || null;
        let system = req.messages.find(m => m.role === 'system');
        const recent = req.messages.filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-8).map(m => m.content || m.text || '').join('\n');
        const ctx = { req, characterId, character, conversation, recent, system: system ? String(system.content || '') : '' };
        const extra = await nfPrompt.build(ctx);
        if (extra) {
          if (!system) { system = { role: 'system', content: '' }; req.messages.unshift(system) }
          system.content = (String(system.content || '').trim() + '\n\n' + extra).trim();
          init = { ...init, body: JSON.stringify(req) };
        }
      }
    }
  } catch (err) {
    console.warn('Nightshade prompt build skipped:', err);
  }
  return nativeFetch(input, init);
};

/* ------------------------------------------------------------------ *
 * Built-in sections                                                   *
 * ------------------------------------------------------------------ */
nfPrompt.register({
  id: 'memory',
  priority: 60,
  build: async ctx => {
    if (!ctx.characterId) return '';
    const picked = await nfMemory.retrieve(ctx.characterId, ctx.recent);
    if (!picked.length) return '';
    const label = m => (m.pinned ? '★ ' : '') + (m.type === 'fact' ? '' : `(${m.type}) `);
    return '[PERSISTENT MEMORY — treat as established truth]\n' + picked.map(m => '- ' + label(m) + m.text).join('\n');
  }
});

nfPrompt.register({
  id: 'persona',
  priority: 20,
  build: async ctx => {
    const settings = (await get(KEYS.settings)) || {};
    if (!settings.activePersonaId) return '';
    const p = (await arr(KEYS.personas)).find(x => x.id === settings.activePersonaId);
    if (!p) return '';
    return `[THE USER'S PERSONA — this is who the user is playing]\nName: ${p.name || 'the user'}\n${p.bio || ''}\nAddress them as this person. Never write their dialogue, thoughts or choices for them.`;
  }
});

window.nfCore = { KEYS, migrate, uid, now };
window.nfMemory = nfMemory;
window.nfPrompt = nfPrompt;
if (window.nfDbReady) window.nfDbReady.then(migrate).catch(() => {});
})();

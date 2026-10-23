(() => {
  if (window.__nfProviderStudioV2) return;
  window.__nfProviderStudioV2 = 1;

  const MANAGED = {
    kind: 'managed',
    model: 'openrouter/free',
    base: '/api/ai',
    key: 'server-managed',
    creative: true,
  };
  const FREE = [
    ['openrouter/free', 'Forge Free Auto — rotates available free models'],
    ['deepseek/deepseek-r1:free', 'DeepSeek R1 — Free'],
    ['openai/gpt-oss-20b:free', 'GPT-OSS 20B — Free'],
    ['nvidia/nemotron-3-nano-30b-a3b:free', 'Nemotron Nano — Free'],
  ];
  const esc = value => String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  async function provider() {
    const saved = await get('provider');
    if (!saved || !saved.base || (!saved.key && saved.kind !== 'managed')) {
      await put('provider', { ...MANAGED });
      return { ...MANAGED };
    }
    if (saved.kind === 'managed') return { ...MANAGED, ...saved, key: 'server-managed', base: '/api/ai' };
    return saved;
  }

  const previousRender = window.render;
  window.render = async function renderProviderStudio() {
    const security = await get('security');
    if (security && !security.setupNeeded && sessionStorage.getItem('nf_unlocked') === '1' && !state.locked) {
      await provider();
      if (state.tab === 'provider') {
        document.querySelector('#app').innerHTML = await providerUI();
        bindProvider();
        return;
      }
    }

    await previousRender();
    if (sessionStorage.getItem('nf_unlocked') === '1' && !state.locked) {
      document.querySelectorAll('.nav').forEach(navbar => {
        if (navbar.querySelector('[data-tab="provider"]')) return;
        const button = document.createElement('button');
        button.dataset.tab = 'provider';
        button.innerHTML = '◈<br><small>Provider</small>';
        button.onclick = () => {
          state.tab = 'provider';
          state.chat = null;
          render();
        };
        navbar.appendChild(button);
      });
    }
  };

  async function providerUI() {
    const current = await provider();
    const options = FREE.map(([value, label]) =>
      `<option value="${value}" ${current.model === value ? 'selected' : ''}>${label}</option>`
    ).join('');
    const managed = current.kind === 'managed';

    return `<main class="shell">
      <header class="topbar"><div><div class="brand">PROVIDER STUDIO</div><h1>AI connection</h1></div></header>
      <section class="card stack">
        <div class="notice">Forge Free is stored on the server. You do not need to paste an API key into this phone.</div>
        <label>Connection
          <select id="psKind" class="input">
            <option value="managed" ${managed ? 'selected' : ''}>Forge Free — no key entry</option>
            <option value="openrouter" ${current.kind === 'openrouter' ? 'selected' : ''}>My OpenRouter key — saved on this device</option>
            <option value="huggingface" ${current.kind === 'huggingface' ? 'selected' : ''}>My Hugging Face token</option>
            <option value="openai-compatible" ${current.kind === 'openai-compatible' ? 'selected' : ''}>Custom OpenAI-compatible endpoint</option>
          </select>
        </label>
        <label>Free model
          <select id="psPreset" class="input"><option value="">Choose a free preset…</option>${options}</select>
        </label>
        <label>Model<input id="psModel" class="input" value="${esc(current.model || MANAGED.model)}" placeholder="Model name"></label>
        <div id="psAdvanced" class="stack" ${managed ? 'hidden' : ''}>
          <label>Chat endpoint<input id="psBase" class="input" value="${esc(managed ? '' : current.base)}"></label>
          <label>API key<input id="psKey" class="input" type="password" value="${esc(managed ? '' : current.key)}" placeholder="Saved only in this browser"></label>
        </div>
        <label class="switchrow"><input id="psCreative" type="checkbox" ${current.creative !== false ? 'checked' : ''}> Creative RP mode</label>
        <div class="tiny muted">Forge Free uses only <code>openrouter/free</code> or models ending in <code>:free</code>. Free providers can still rate-limit a busy request.</div>
        <div class="row wrap"><button class="btn primary" id="psSave">Save connection</button><button class="btn" id="psTest">Test connection</button></div>
        <div id="psMsg" class="muted"></div>
      </section>
      ${nav()}
    </main>`;
  }

  function bindProvider() {
    document.querySelectorAll('[data-tab]').forEach(button => {
      button.onclick = () => {
        state.tab = button.dataset.tab;
        state.chat = null;
        render();
      };
    });

    const kind = $('#psKind');
    const preset = $('#psPreset');
    const model = $('#psModel');
    const base = $('#psBase');
    const key = $('#psKey');
    const advanced = $('#psAdvanced');

    function updateMode() {
      const managed = kind.value === 'managed';
      advanced.hidden = managed;
      if (managed) model.value = model.value.endsWith(':free') || model.value === 'openrouter/free' ? model.value : 'openrouter/free';
      if (kind.value === 'openrouter') base.value = 'https://openrouter.ai/api/v1/chat/completions';
      if (kind.value === 'huggingface' && !base.value.includes('huggingface')) base.value = 'https://router.huggingface.co/v1/chat/completions';
    }

    preset.onchange = () => {
      if (preset.value) model.value = preset.value;
    };
    kind.onchange = updateMode;

    const read = () => kind.value === 'managed'
      ? { ...MANAGED, model: model.value.trim() || MANAGED.model, creative: $('#psCreative').checked }
      : {
          kind: kind.value,
          model: model.value.trim(),
          base: base.value.trim(),
          key: key.value.trim(),
          creative: $('#psCreative').checked,
        };

    $('#psSave').onclick = async () => {
      const next = read();
      if (!next.base || !next.model || !next.key) {
        $('#psMsg').textContent = 'Add an endpoint, model, and API key first.';
        return;
      }
      await put('provider', next);
      $('#psMsg').textContent = next.kind === 'managed'
        ? `Saved. ${next.model} will use the server connection.`
        : `Saved on this device. Current model: ${next.model}`;
    };

    $('#psTest').onclick = async () => {
      const next = read();
      const message = $('#psMsg');
      if (!next.base || !next.model || !next.key) {
        message.textContent = 'Add an endpoint, model, and API key first.';
        return;
      }
      message.textContent = `Testing ${next.model}…`;
      try {
        const response = await fetch(next.base, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${next.key}`,
            'HTTP-Referer': location.href,
            'X-Title': 'Nightshade Forge',
          },
          body: JSON.stringify({
            model: next.model,
            messages: [{ role: 'user', content: 'Reply with exactly: connected' }],
            temperature: 0.2,
            max_tokens: 12,
          }),
        });
        const raw = await response.text();
        let payload = {};
        try { payload = JSON.parse(raw); } catch {}
        if (!response.ok) throw new Error(`HTTP ${response.status}${payload.error?.message ? `: ${payload.error.message}` : ''}`);
        const reply = payload.choices?.[0]?.message?.content || 'response received';
        message.textContent = `Connected: ${reply}`;
        await put('provider', next);
      } catch (error) {
        message.textContent = `Connection failed: ${error.message}`;
      }
    };

    updateMode();
  }
})();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function apiKey() {
  return process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '';
}

function bridge() {
  const url = String(process.env.FORGE_AI_UPSTREAM || '').trim();
  const token = String(process.env.FORGE_BRIDGE_TOKEN || '').trim();
  return url.startsWith('https://') && token ? { url, token } : null;
}

function safeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-80).map(message => ({
    role: ['system', 'user', 'assistant'].includes(message?.role) ? message.role : 'user',
    content: String(message?.content || '').slice(0, 50000),
  })).filter(message => message.content);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      provider: apiKey() ? 'openrouter' : 'openrouter-bridge',
      configured: Boolean(apiKey() || bridge()),
      model: 'openrouter/free',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'GET health or POST chat completions only.' });
  }

  const key = apiKey();
  const upstreamBridge = bridge();
  if (!key && !upstreamBridge) {
    return res.status(503).json({
      error: { message: 'The free chat provider is not configured on the server yet.' },
    });
  }

  const messages = safeMessages(req.body?.messages);
  if (!messages.length) {
    return res.status(400).json({ error: { message: 'At least one chat message is required.' } });
  }

  const model = String(req.body?.model || 'openrouter/free').trim();
  if (!(model === 'openrouter/free' || model.endsWith(':free'))) {
    return res.status(400).json({
      error: { message: 'Character Forge server mode only allows OpenRouter free models.' },
    });
  }

  try {
    const upstream = await fetch(upstreamBridge?.url || OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: upstreamBridge ? `Bearer ${upstreamBridge.token}` : `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': `https://${req.headers.host || 'ghj-sooty.vercel.app'}`,
        'X-Title': 'Nightshade Character Forge',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: Math.max(0, Math.min(2, Number(req.body?.temperature) || 0.95)),
        max_tokens: Math.max(64, Math.min(2400, Number(req.body?.max_tokens) || 1200)),
        stream: false,
      }),
    });

    const contentType = upstream.headers.get('content-type') || '';
    const payload = contentType.includes('json')
      ? await upstream.json().catch(() => ({}))
      : { error: { message: await upstream.text() } };

    if (!upstream.ok) {
      const message = payload?.error?.message || `Free provider returned HTTP ${upstream.status}.`;
      return res.status(upstream.status).json({ error: { message } });
    }

    const message = payload?.choices?.[0]?.message;
    if (message && !message.content && typeof message.reasoning === 'string') {
      message.content = message.reasoning;
    }
    if (message && Array.isArray(message.content)) {
      message.content = message.content.map(part => part?.text || '').join('\n').trim();
    }
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: { message: `Could not reach the free model provider: ${error?.message || error}` },
    });
  }
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Keep fallbacks aligned with the free presets shown in Provider Studio.
const FREE_FALLBACKS = [
  'openai/gpt-oss-20b:free',
  'deepseek/deepseek-r1:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
];

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

// Providers may return either a string or an array of text/content parts.
function extractText(message) {
  if (!message || typeof message !== 'object') return '';
  const content = message.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map(part => {
      if (typeof part === 'string') return part;
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.content === 'string') return part.content;
      return '';
    }).filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  // Some reasoning models put their only usable completion in these fields.
  for (const value of [message.output_text, message.reasoning, message.refusal]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  if (Array.isArray(message.reasoning_details)) {
    const text = message.reasoning_details.map(part => part?.text || '').filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  return '';
}

async function requestModel({ model, messages, temperature, maxTokens, headers, url }) {
  const upstream = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  const contentType = upstream.headers.get('content-type') || '';
  const payload = contentType.includes('json')
    ? await upstream.json().catch(() => ({}))
    : { error: { message: await upstream.text() } };

  if (!upstream.ok) {
    const error = new Error(payload?.error?.message || `Free provider returned HTTP ${upstream.status}.`);
    error.status = upstream.status;
    error.payload = payload;
    throw error;
  }

  const message = payload?.choices?.[0]?.message;
  const text = extractText(message);
  if (message && text) message.content = text;
  return { payload, text };
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
    return res.status(405).json({ error: { message: 'GET health or POST chat completions only.' } });
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

  const selectedModel = String(req.body?.model || 'openrouter/free').trim();
  if (!(selectedModel === 'openrouter/free' || selectedModel.endsWith(':free'))) {
    return res.status(400).json({
      error: { message: 'Character Forge server mode only allows OpenRouter free models.' },
    });
  }

  const candidates = [...new Set([selectedModel, ...FREE_FALLBACKS].filter(Boolean))];
  const headers = {
    Authorization: upstreamBridge ? `Bearer ${upstreamBridge.token}` : `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': `https://${req.headers.host || 'ghj-sooty.vercel.app'}`,
    'X-Title': 'Nightshade Character Forge',
  };
  const options = {
    messages,
    temperature: Math.max(0, Math.min(2, Number(req.body?.temperature) || 0.95)),
    maxTokens: Math.max(64, Math.min(2400, Number(req.body?.max_tokens) || 1200)),
    headers,
    url: upstreamBridge?.url || OPENROUTER_URL,
  };

  const failures = [];
  for (const model of candidates) {
    try {
      const result = await requestModel({ ...options, model });
      if (result.text) {
        // Preserve the OpenAI-compatible response shape expected by the app.
        result.payload.choices[0].message.content = result.text;
        res.setHeader('X-Forge-Model', model);
        res.setHeader('X-Forge-Fallback', model === selectedModel ? 'none' : 'used');
        return res.status(200).json(result.payload);
      }
      failures.push(`${model}: provider returned an empty completion`);
    } catch (error) {
      failures.push(`${model}: ${String(error.message || error).slice(0, 180)}`);
      // Retry another free model after provider errors as well as empty replies.
    }
  }

  return res.status(502).json({
    error: {
      message: 'No free model returned usable text after automatic retries. ' + failures.join(' | '),
      code: 'EMPTY_MODEL_COMPLETION',
    },
  });
};

const ALLOWED_ORIGINS = [
  'https://spacepocohontas.github.io',
  'https://cadence-studio-snowy.vercel.app',
  'https://ghj-git-main-ohnoitstamara-4066.vercel.app',
  'https://ghj-1ul6y6d5b-ohnoitstamara-4066.vercel.app'
];

function cors(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function eleven(req, res) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: 'Voice provider is not configured on the server.' });
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(req.body.voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: req.body.text, model_id: req.body.modelId || 'eleven_multilingual_v2', ...(req.body.voiceSettings ? { voice_settings: req.body.voiceSettings } : {}) })
  });
  const type = upstream.headers.get('content-type') || '';
  if (!upstream.ok) {
    const detail = type.includes('json') ? await upstream.json().catch(() => ({})) : await upstream.text();
    return res.status(upstream.status).json({ error: 'ElevenLabs request failed.', detail });
  }
  res.setHeader('Content-Type', type || 'audio/mpeg'); res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
}

async function clone(req, res) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: 'Voice provider is not configured on the server.' });
  const { name, description, removeBackgroundNoise = false, samples = [] } = req.body || {};
  if (!name || !Array.isArray(samples) || !samples.length) return res.status(400).json({ error: 'name and at least one audio sample are required.' });
  if (samples.length > 10) return res.status(400).json({ error: 'Maximum 10 samples per clone request.' });
  const form = new FormData();
  form.append('name', String(name).slice(0, 100));
  if (description) form.append('description', String(description).slice(0, 1000));
  form.append('remove_background_noise', String(Boolean(removeBackgroundNoise)));
  let added = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] || {};
    if (s.url) {
      const upstreamSample = await fetch(String(s.url));
      if (!upstreamSample.ok) return res.status(400).json({ error: `Could not read uploaded sample ${i + 1}.` });
      const bytes = Buffer.from(await upstreamSample.arrayBuffer());
      if (bytes.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'Each audio sample must be 25 MB or smaller.' });
      const mime = s.type || upstreamSample.headers.get('content-type') || 'application/octet-stream';
      form.append('files[]', new Blob([bytes], { type: mime }), s.name || `sample-${i + 1}`);
      added++;
      continue;
    }
    if (s.data) {
      const raw = String(s.data);
      const m = raw.match(/^data:([^;,]+)?;base64,(.+)$/);
      if (!m) continue;
      const mime = m[1] || s.type || 'audio/webm';
      const bytes = Buffer.from(m[2], 'base64');
      if (bytes.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'Each audio sample must be 25 MB or smaller.' });
      form.append('files[]', new Blob([bytes], { type: mime }), s.name || `sample-${i + 1}`);
      added++;
    }
  }
  if (!added) return res.status(400).json({ error: 'No readable voice samples were supplied.' });
  const upstream = await fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  const type = upstream.headers.get('content-type') || '';
  const data = type.includes('json') ? await upstream.json().catch(() => ({})) : { raw: await upstream.text() };
  if (!upstream.ok) return res.status(upstream.status).json({ error: 'Voice cloning failed.', detail: data });
  return res.status(200).json(data);
}

module.exports = async (req, res) => {
  cors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    if (req.query?.action === 'clone') return await clone(req, res);
    const { voiceId, text } = req.body || {};
    if (!voiceId || !text) return res.status(400).json({ error: 'voiceId and text are required.' });
    if (typeof text !== 'string' || text.length > 5000) return res.status(400).json({ error: 'Text must be 1–5000 characters.' });
    return await eleven(req, res);
  } catch (err) {
    return res.status(502).json({ error: 'Voice provider connection failed.', detail: String(err?.message || err) });
  }
};

const ALLOWED_ORIGINS = [
  'https://spacepocohontas.github.io',
  'https://cadence-studio-snowy.vercel.app'
];

function cors(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  cors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: 'Voice provider is not configured on the server.' });

  const { voiceId, text, modelId = 'eleven_multilingual_v2', voiceSettings } = req.body || {};
  if (!voiceId || !text) return res.status(400).json({ error: 'voiceId and text are required.' });
  if (typeof text !== 'string' || text.length > 5000) return res.status(400).json({ error: 'Text must be 1–5000 characters.' });

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: modelId, ...(voiceSettings ? { voice_settings: voiceSettings } : {}) })
    });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok) {
      const detail = type.includes('json') ? await upstream.json().catch(() => ({})) : await upstream.text();
      return res.status(upstream.status).json({ error: 'ElevenLabs request failed.', detail });
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', type || 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audio);
  } catch (err) {
    return res.status(502).json({ error: 'Voice provider connection failed.', detail: String(err?.message || err) });
  }
};

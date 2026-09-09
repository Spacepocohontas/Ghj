export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: 'ElevenLabs is not configured on this deployment.' });
  const { voice_id, text, model_id = 'eleven_multilingual_v2', voice_settings } = req.body || {};
  if (!voice_id || !text) return res.status(400).json({ error: 'voice_id and text are required.' });
  if (String(text).length > 5000) return res.status(413).json({ error: 'Text is too long for one request.' });
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice_id)}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id, voice_settings: voice_settings || { stability: 0.5, similarity_boost: 0.75 } })
    });
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(r.status).setHeader('Content-Type', r.headers.get('content-type') || 'audio/mpeg').send(buf);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach ElevenLabs.' });
  }
}

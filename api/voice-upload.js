const { issueSignedToken, presignUrl } = require('@vercel/blob');

const ALLOWED_ORIGINS = [
  'https://spacepocohontas.github.io',
  'https://ghj-git-main-ohnoitstamara-4066.vercel.app',
  'https://ghj-1ul6y6d5b-ohnoitstamara-4066.vercel.app'
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
  try {
    const body = req.body || {};
    const name = String(body.name || 'voice-sample').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'voice-sample';
    const type = String(body.type || 'application/octet-stream').slice(0, 120);
    const token = await issueSignedToken({ operations: ['put', 'get'] });
    const pathname = `nightshade-voice-samples/${crypto.randomUUID()}-${name}`;
    const put = await presignUrl(token, { pathname, operation: 'put', validUntil: Date.now() + 15 * 60 * 1000 });
    const get = await presignUrl(token, { pathname, operation: 'get', validUntil: Date.now() + 30 * 60 * 1000 });
    return res.status(200).json({ pathname, putUrl: put.presignedUrl, getUrl: get.presignedUrl, contentType: type });
  } catch (err) {
    return res.status(500).json({ error: 'Could not create a secure upload URL.', detail: String(err?.message || err) });
  }
};

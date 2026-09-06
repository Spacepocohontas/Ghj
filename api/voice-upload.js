const { randomUUID } = require('node:crypto');
const { issueSignedToken, presignUrl } = require('@vercel/blob');

const ALLOWED_ORIGINS = [
  'https://spacepocohontas.github.io',
  'https://cadence-studio-snowy.vercel.app',
  'https://ghj-git-main-ohnoitstamara-4066.vercel.app',
  'https://ghj-1ul6y6d5b-ohnoitstamara-4066.vercel.app'
];

const MAX_SAMPLE_BYTES = 25 * 1024 * 1024;
const PUT_TTL_MS = 15 * 60 * 1000;
const GET_TTL_MS = 30 * 60 * 1000;

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
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
    return res.status(503).json({ error: 'Blob storage is not configured on the server.' });
  }
  try {
    const body = req.body || {};
    const name = String(body.name || 'voice-sample').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'voice-sample';
    const type = String(body.type || 'application/octet-stream').slice(0, 120);
    const pathname = `nightshade-voice-samples/${randomUUID()}-${name}`;
    const validUntil = Date.now() + GET_TTL_MS;
    // The token must be scoped to the exact pathname it will presign, and both
    // presign calls require an explicit `access` level.
    const token = await issueSignedToken({ pathname, operations: ['put', 'get'], validUntil });
    const put = await presignUrl(token, {
      operation: 'put',
      access: 'private',
      pathname,
      validUntil: Date.now() + PUT_TTL_MS,
      maximumSizeInBytes: MAX_SAMPLE_BYTES,
      allowOverwrite: true
    });
    const get = await presignUrl(token, {
      operation: 'get',
      access: 'private',
      pathname,
      validUntil
    });
    return res.status(200).json({ pathname, putUrl: put.presignedUrl, getUrl: get.presignedUrl, contentType: type });
  } catch (err) {
    return res.status(500).json({ error: 'Could not create a secure upload URL.', detail: String(err?.message || err) });
  }
};

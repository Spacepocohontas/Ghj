export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { url, type = 'character' } = body;
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'A public http(s) URL is required.' });
    }
    const sourceUrl = new URL(url);
    const response = await fetch(sourceUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Nightcast-Importer/1.0',
        Accept: 'application/json,text/plain,text/html,image/png,*/*'
      }
    });
    if (!response.ok) throw Error(`Source returned HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') || sourceUrl.pathname.endsWith('.json')) {
      const data = await response.json();
      return res.status(200).json({ source: url, type, data });
    }
    const html = await response.text();
    if (type === 'lorebook') return res.status(200).json({ source: url, type, text: html });
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const description = (html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([\s\S]*?)["']/i) || [])[1] || '';
    const clean = value => String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return res.status(200).json({
      source: url,
      type,
      html: true,
      data: {
        name: clean(title),
        description: clean(description),
        rawText: clean(html).slice(0, 50000)
      }
    });
  } catch (error) {
    return res.status(502).json({
      error: error?.message || 'Unable to import that URL. The source may require login, block automated access, or disallow public fetching.'
    });
  }
}

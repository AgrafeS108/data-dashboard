const { json, checkOrigin } = require('./_helpers');

module.exports = async (req, res) => {
  if (!checkOrigin(req)) return json(res, 403, { error: 'Origine non autorisée.' });

  try {
    const endpoint = req.query.endpoint;
    const allowed = ['channels', 'playlistItems', 'videos', 'search', 'commentThreads', 'playlists'];
    if (!endpoint || !allowed.includes(endpoint)) {
      return json(res, 400, { error: 'Endpoint YouTube non autorisé.' });
    }
    if (!process.env.YOUTUBE_API_KEY) {
      return json(res, 500, { error: 'YOUTUBE_API_KEY manquant côté serveur.' });
    }

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'endpoint' || k === 'key' || k === '_' || k === 'force') continue;
      if (Array.isArray(v)) params.set(k, v[v.length - 1]);
      else if (v != null) params.set(k, v);
    }
    params.set('key', process.env.YOUTUBE_API_KEY);

    const upstream = `https://www.googleapis.com/youtube/v3/${endpoint}?${params.toString()}`;
    const r = await fetch(upstream);
    const data = await r.json().catch(() => ({}));

    // Cache CDN Vercel : après le premier chargement, les mêmes requêtes deviennent quasi instantanées.
    // s-maxage = 6h, stale-while-revalidate = 24h.
    if (r.ok) {
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      res.setHeader('CDN-Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    json(res, r.ok ? 200 : r.status, data);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    json(res, 500, { error: e.message });
  }
};

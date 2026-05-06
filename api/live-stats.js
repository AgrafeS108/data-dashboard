const { json, checkOrigin } = require('./_helpers');

async function ytVideos(ids) {
  if (!process.env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY manquant côté serveur.');
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'statistics');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error?.message || 'Erreur live-stats YouTube');
  return data;
}

module.exports = async (req, res) => {
  if (!checkOrigin(req)) return json(res, 403, { error: 'Origine non autorisée.' });
  try {
    const ids = String(req.query.ids || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 50);
    if (!ids.length) return json(res, 400, { error: 'IDs manquants.' });
    const data = await ytVideos(ids);
    const stats = {};
    for (const v of data.items || []) {
      stats[v.id] = {
        views: parseInt(v.statistics?.viewCount || '0', 10),
        likes: parseInt(v.statistics?.likeCount || '0', 10),
        comments: parseInt(v.statistics?.commentCount || '0', 10)
      };
    }
    res.setHeader('Cache-Control', 'no-store');
    return json(res, 200, { ok:true, generatedAt: new Date().toISOString(), stats });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return json(res, 500, { ok:false, error: e.message });
  }
};

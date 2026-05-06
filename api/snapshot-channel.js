const { json, checkOrigin } = require('./_helpers');

const CHANNEL_CONFIGS = {
  sport: { key:'sport', label:'SPORT', handle:'ftvsport', channelId:'UCRm-DLbhzojKd10edotYxMg' },
  francetv: { key:'francetv', label:'FRANCE TV', handle:'francetv', channelId:null },
  franceinfo: { key:'franceinfo', label:'FRANCEINFO', handle:'franceinfo', channelId:null },
  francetvculture: { key:'francetvculture', label:'CULTURE', handle:'francetvculture', channelId:null },
  slash: { key:'slash', label:'SLASH', handle:'slash_ftv', channelId:null }
};

function classifyType(title, durationIso, hasLive) {
  if (hasLive) return 'live';
  const t = String(title || '').toLowerCase();
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(durationIso || '');
  const secs = m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0;
  if (t.includes('#shorts') || t.includes('shorts') || secs <= 61) return 'short';
  return 'video';
}

async function yt(endpoint, params) {
  if (!process.env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY manquant côté serveur.');
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') url.searchParams.set(k, v); });
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY);
  const r = await fetch(url.toString());
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error?.message || `Erreur YouTube ${endpoint}`);
  return data;
}

async function resolveUploadsPlaylist(cfg) {
  const filters = [];
  if (cfg.channelId) filters.push({ id: cfg.channelId });
  if (cfg.handle) filters.push({ forHandle: '@' + String(cfg.handle).replace(/^@/, '') });
  let lastError = null;
  for (const filter of filters) {
    try {
      const data = await yt('channels', { part:'contentDetails,snippet', ...filter });
      const item = data.items?.[0];
      const uploadsId = item?.contentDetails?.relatedPlaylists?.uploads;
      if (uploadsId) return { uploadsId, channelTitle: item.snippet?.title || cfg.label };
    } catch (e) { lastError = e; }
  }
  if (lastError) throw lastError;
  throw new Error(`Chaîne introuvable: ${cfg.label}`);
}

async function buildSnapshot(channelKey) {
  const cfg = CHANNEL_CONFIGS[channelKey] || CHANNEL_CONFIGS.sport;
  const { uploadsId, channelTitle } = await resolveUploadsPlaylist(cfg);
  const videos = [];
  let pageToken = '';
  let page = 0;
  do {
    page++;
    const playlist = await yt('playlistItems', {
      part:'snippet,contentDetails', playlistId: uploadsId, maxResults: '50', pageToken
    });
    const ids = (playlist.items || [])
      .map(item => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
      .filter(Boolean);
    if (ids.length) {
      const details = await yt('videos', {
        part:'statistics,contentDetails,snippet,liveStreamingDetails', id: ids.join(','), maxResults:'50'
      });
      for (const v of details.items || []) {
        const hasLive = !!v.liveStreamingDetails?.actualStartTime;
        videos.push({
          id: v.id,
          channelKey: cfg.key,
          channelTitle,
          title: v.snippet?.title || '',
          description: v.snippet?.description || '',
          tags: (v.snippet?.tags || []).map(x => String(x).toLowerCase()),
          views: parseInt(v.statistics?.viewCount || '0', 10),
          likes: parseInt(v.statistics?.likeCount || '0', 10),
          comments: parseInt(v.statistics?.commentCount || '0', 10),
          duration: v.contentDetails?.duration || '',
          publishedAt: v.snippet?.publishedAt || '',
          type: classifyType(v.snippet?.title, v.contentDetails?.duration, hasLive)
        });
      }
    }
    pageToken = playlist.nextPageToken || '';
    // Protection anti-boucle en cas de chaîne énorme / quota inattendu.
    if (page > 120) break;
  } while (pageToken);

  return { ok:true, channel: cfg.key, label: cfg.label, generatedAt: new Date().toISOString(), count: videos.length, videos };
}

module.exports = async (req, res) => {
  if (!checkOrigin(req)) return json(res, 403, { error: 'Origine non autorisée.' });
  const channel = String(req.query.channel || 'sport');
  try {
    const data = await buildSnapshot(channel);
    // Snapshot pré-généré : instantané une fois le cache Vercel chaud.
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('CDN-Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return json(res, 200, data);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return json(res, 500, { ok:false, channel, error: e.message });
  }
};

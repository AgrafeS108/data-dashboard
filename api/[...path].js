function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function sendText(res, status, text, contentType='text/plain; charset=utf-8') {
  res.statusCode = status; res.setHeader('content-type', contentType); res.end(text);
}
function getUrl(req) { return new URL(req.url, `https://${req.headers.host || 'localhost'}`); }
function getPath(req) { return getUrl(req).pathname.replace(/^\/api\/?/, '').replace(/\/$/, ''); }
function getQuery(req) { const u = getUrl(req); return Object.fromEntries(u.searchParams.entries()); }
function checkOrigin(req) {
  const allowed = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
  if (!allowed.length) return true;
  const origin = req.headers.origin || '';
  if (!origin) return true;
  return allowed.some(a => origin === a || origin.startsWith(a));
}
function requireAdmin(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return true;
  const got = req.headers['x-admin-key'];
  if (got === expected) return true;
  sendJson(res, 401, { error: 'Admin non autorisé. Vérifie ADMIN_PASSWORD.' });
  return false;
}
async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let data='';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}
async function refreshGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN || '',
    grant_type: 'refresh_token'
  });
  const resp = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) throw new Error(data.error_description || data.error || `Google token ${resp.status}`);
  return data.access_token;
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
  const secs = m ? (Number(m[1] || 0)*3600 + Number(m[2] || 0)*60 + Number(m[3] || 0)) : 0;
  if (t.includes('#shorts') || t.includes('shorts') || secs <= 61) return 'short';
  return 'video';
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
    } catch(e) { lastError = e; }
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
    const playlist = await yt('playlistItems', { part:'snippet,contentDetails', playlistId: uploadsId, maxResults:'50', pageToken });
    const ids = (playlist.items || []).map(item => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId).filter(Boolean);
    if (ids.length) {
      const details = await yt('videos', { part:'statistics,contentDetails,snippet,liveStreamingDetails', id: ids.join(','), maxResults:'50' });
      for (const v of details.items || []) {
        const hasLive = !!v.liveStreamingDetails?.actualStartTime;
        videos.push({
          id: v.id, channelKey: cfg.key, channelTitle,
          title: v.snippet?.title || '', description: v.snippet?.description || '',
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
    if (page > Number(process.env.MAX_YOUTUBE_PAGES || 120)) break;
  } while (pageToken);
  return { ok:true, channel: cfg.key, label: cfg.label, generatedAt: new Date().toISOString(), count: videos.length, videos };
}
const cacheHeaders = {
  'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
  'CDN-Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
  'Vercel-CDN-Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
  'X-FTV-Cache': 'snapshot-cdn-6h'
};
async function handler(req, res) {
  const path = getPath(req);
  const q = getQuery(req);
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok:true });
  try {
    if (path === 'health' || path === '') return sendJson(res, 200, { ok:true, route:'health', time:new Date().toISOString(), function:'single-catchall' });
    if (path === 'admin-status') {
      if (!requireAdmin(req,res)) return;
      return sendJson(res, 200, { ok:true, env:{ ADMIN_PASSWORD:!!process.env.ADMIN_PASSWORD, YOUTUBE_API_KEY:!!process.env.YOUTUBE_API_KEY, GOOGLE_CLIENT_ID:!!process.env.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET:!!process.env.GOOGLE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN:!!process.env.YOUTUBE_REFRESH_TOKEN, ANTHROPIC_API_KEY:!!process.env.ANTHROPIC_API_KEY, ALLOWED_ORIGINS:!!process.env.ALLOWED_ORIGINS }});
    }
    if (path === 'admin-test') {
      if (!requireAdmin(req,res)) return;
      const result = { youtubeData:null, youtubeAnalyticsToken:null, claude:null };
      try { const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${process.env.YOUTUBE_API_KEY}`); result.youtubeData = { ok:r.ok, status:r.status }; } catch(e) { result.youtubeData = { ok:false, error:e.message }; }
      try { const token = await refreshGoogleAccessToken(); result.youtubeAnalyticsToken = { ok:!!token, tokenPreview:token ? token.slice(0,8)+'...' : null }; } catch(e) { result.youtubeAnalyticsToken = { ok:false, error:e.message }; }
      result.claude = { ok:!!process.env.ANTHROPIC_API_KEY };
      return sendJson(res, 200, result);
    }
    if (path === 'oauth/google/start') {
      const origin = `https://${req.headers.host}`;
      const redirect_uri = `${origin}/api/oauth/google/callback`;
      const scope = 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly';
      const params = new URLSearchParams({ client_id:process.env.GOOGLE_CLIENT_ID||'', redirect_uri, response_type:'code', access_type:'offline', prompt:'consent', scope });
      res.statusCode = 302; res.setHeader('location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`); return res.end();
    }
    if (path === 'oauth/google/callback') {
      const code = q.code;
      const origin = `https://${req.headers.host}`;
      const redirect_uri = `${origin}/api/oauth/google/callback`;
      if (!code) return sendText(res, 400, 'Code OAuth manquant.');
      const body = new URLSearchParams({ code, client_id:process.env.GOOGLE_CLIENT_ID||'', client_secret:process.env.GOOGLE_CLIENT_SECRET||'', redirect_uri, grant_type:'authorization_code' });
      const r = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
      const data = await r.json().catch(()=>({}));
      if (!r.ok) return sendText(res, 200, `<h1>Erreur OAuth</h1><pre>${JSON.stringify(data,null,2)}</pre><p>Vérifie l'Authorized redirect URI : ${redirect_uri}</p>`, 'text/html; charset=utf-8');
      return sendText(res, 200, `<!DOCTYPE html><meta charset="utf-8"><title>OAuth OK</title><body style="font-family:Arial;padding:30px;background:#f6f7fb"><h1>Connexion YouTube Analytics réussie</h1><p>Copie le refresh token ci-dessous dans Vercel → Environment Variables → <b>YOUTUBE_REFRESH_TOKEN</b>, puis redéploie.</p><textarea style="width:100%;height:120px">${data.refresh_token||''}</textarea><pre>${JSON.stringify({scope:data.scope,expires_in:data.expires_in,token_type:data.token_type},null,2)}</pre><p><a href="/admin.html">Retour admin</a></p></body>`, 'text/html; charset=utf-8');
    }
    if (!checkOrigin(req)) return sendJson(res, 403, { error:'Origine non autorisée.' });
    if (path === 'youtube-v3') {
      const endpoint = q.endpoint;
      const allowed = ['channels','playlistItems','videos','search','commentThreads','playlists'];
      if (!endpoint || !allowed.includes(endpoint)) return sendJson(res, 400, { error:'Endpoint YouTube non autorisé.' });
      if (!process.env.YOUTUBE_API_KEY) return sendJson(res, 500, { error:'YOUTUBE_API_KEY manquant côté serveur.' });
      const params = new URLSearchParams();
      for (const [k,v] of Object.entries(q)) { if (k === 'endpoint' || k === 'key' || k === '_' || k === 'force') continue; if (v != null) params.set(k, v); }
      params.set('key', process.env.YOUTUBE_API_KEY);
      const r = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${params.toString()}`);
      const data = await r.json().catch(()=>({}));
      return sendJson(res, r.ok ? 200 : r.status, data, r.ok ? cacheHeaders : {'Cache-Control':'no-store'});
    }
    if (path === 'youtube-analytics') {
      if (req.method !== 'POST') return sendJson(res, 405, { error:'POST requis.' });
      const paramsIn = await readBody(req);
      const accessToken = await refreshGoogleAccessToken();
      const params = new URLSearchParams();
      for (const [k,v] of Object.entries(paramsIn || {})) if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, String(v));
      if (!params.has('ids')) params.set('ids', 'channel==MINE');
      const r = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`, { headers:{ Authorization:`Bearer ${accessToken}` } });
      const data = await r.json().catch(()=>({}));
      return sendJson(res, r.ok ? 200 : r.status, data);
    }
    if (path === 'claude') {
      if (req.method !== 'POST') return sendJson(res, 405, { error:'POST requis.' });
      if (!process.env.ANTHROPIC_API_KEY) return sendJson(res, 500, { error:'ANTHROPIC_API_KEY manquant côté serveur.' });
      const { prompt, withWeb=true } = await readBody(req);
      if (!prompt) return sendJson(res, 400, { error:'Prompt manquant.' });
      const bodyBase = { model:'claude-haiku-4-5', max_tokens:2800, system:'Tu es un consultant senior data & média spécialisé YouTube, sport, télévision et plateformes numériques. Tu ne dois pas inventer de chiffres. Quand tu fais une hypothèse, tu dois clairement la qualifier.', messages:[{ role:'user', content:prompt }] };
      const body = withWeb ? { ...bodyBase, tools:[{ type:'web_search_20250305', name:'web_search', max_uses:5, user_location:{ type:'approximate', city:'Paris', region:'Île-de-France', country:'FR', timezone:'Europe/Paris' } }] } : bodyBase;
      const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{ 'x-api-key':process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01', 'content-type':'application/json' }, body:JSON.stringify(body) });
      const data = await r.json().catch(()=>({}));
      return sendJson(res, r.ok ? 200 : r.status, data);
    }
    if (path === 'cache-status') return sendJson(res, 200, { ok:true, strategy:'single serverless function + Vercel CDN cache 6h + browser Cache Storage 6h' }, {'Cache-Control':'no-store'});
    if (path === 'snapshot-channel' || path === 'snapshot') {
      const channel = String(q.channel || 'sport');
      const data = await buildSnapshot(channel);
      return sendJson(res, 200, data, cacheHeaders);
    }
    if (path === 'live-stats') {
      const ids = String(q.ids || '').split(',').map(x => x.trim()).filter(Boolean).slice(0,50);
      if (!ids.length) return sendJson(res, 400, { error:'IDs manquants.' });
      const data = await yt('videos', { part:'statistics', id:ids.join(',') });
      const stats = {};
      for (const v of data.items || []) stats[v.id] = { views:parseInt(v.statistics?.viewCount || '0', 10), likes:parseInt(v.statistics?.likeCount || '0', 10), comments:parseInt(v.statistics?.commentCount || '0', 10) };
      return sendJson(res, 200, { ok:true, generatedAt:new Date().toISOString(), stats }, {'Cache-Control':'no-store'});
    }
    if (path === 'cron/preload-all') {
      const expected = process.env.CRON_SECRET;
      if (expected && req.headers.authorization !== `Bearer ${expected}`) return sendJson(res, 401, { error:'Cron non autorisé.' });
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const base = `${proto}://${host}`;
      const channels = ['sport','francetv','franceinfo','francetvculture','slash'];
      const results = [];
      for (const channel of channels) {
        const started = Date.now();
        try { const r = await fetch(`${base}/api/snapshot-channel?channel=${encodeURIComponent(channel)}`, { headers:{ 'x-ftv-cron-preload':'1' } }); const data = await r.json().catch(()=>({})); results.push({ channel, ok:r.ok, status:r.status, count:data.count || 0, ms:Date.now()-started, error:data.error || null }); }
        catch(e) { results.push({ channel, ok:false, ms:Date.now()-started, error:e.message }); }
      }
      return sendJson(res, 200, { ok:true, generatedAt:new Date().toISOString(), results });
    }
    return sendJson(res, 404, { error:'Route API introuvable', path });
  } catch(e) {
    return sendJson(res, 500, { ok:false, error:e.message, path:getPath(req) }, {'Cache-Control':'no-store'});
  }
}
module.exports = handler;

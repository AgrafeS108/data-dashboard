function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function sendText(res, status, text, contentType='text/plain; charset=utf-8') {
  res.statusCode = status; res.setHeader('content-type', contentType); res.end(text);
}
const crypto = require('crypto');
const ADMIN_COOKIE = 'ftv_admin_session';
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  return raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1) || '';
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function signAdminSession(ts) {
  const secret = process.env.ADMIN_PASSWORD || '';
  return crypto.createHmac('sha256', secret).update(`ftv-admin-v1:${ts}`).digest('hex');
}
function createAdminSession() {
  const ts = Date.now();
  return `${ts}.${signAdminSession(ts)}`;
}
function verifyAdminSession(token) {
  if (!process.env.ADMIN_PASSWORD || !token) return false;
  const [tsRaw, sig] = String(token).split('.');
  const ts = Number(tsRaw);
  if (!ts || !sig) return false;
  const maxAgeMs = 1000 * 60 * 60 * 12;
  if (Date.now() - ts > maxAgeMs) return false;
  return safeEqual(sig, signAdminSession(ts));
}
function setAdminCookie(res, token) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=43200`);
}
function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0`);
}

const USER_COOKIE = 'ftv_user_session';
function b64urlEncode(str) { return Buffer.from(str, 'utf8').toString('base64url'); }
function b64urlDecode(str) { return Buffer.from(str, 'base64url').toString('utf8'); }
function createUserCookiePayload(session) {
  return b64urlEncode(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || (session.expires_in ? Math.floor(Date.now()/1000) + Number(session.expires_in) : null)
  }));
}
function parseUserCookie(req) {
  const raw = getCookie(req, USER_COOKIE);
  if (!raw) return null;
  try { return JSON.parse(b64urlDecode(decodeURIComponent(raw))); } catch(e) { return null; }
}
function setUserCookie(res, session) {
  const value = createUserCookiePayload(session);
  const maxAge = 1000 * 60 * 60 * 24 * 14;
  res.setHeader('Set-Cookie', `${USER_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=${Math.floor(maxAge/1000)}`);
}
function clearUserCookie(res) {
  res.setHeader('Set-Cookie', `${USER_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0`);
}
function supabaseEnv() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  return { url, anon, service, configured: !!(url && anon), adminConfigured: !!(url && service) };
}
async function supabaseFetch(path, opts = {}) {
  const env = supabaseEnv();
  if (!env.url) throw new Error('SUPABASE_URL manquant.');
  const key = opts.service ? env.service : env.anon;
  if (!key) throw new Error(opts.service ? 'SUPABASE_SERVICE_ROLE_KEY manquant.' : 'SUPABASE_ANON_KEY manquant.');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${opts.token || key}`,
    'content-type': 'application/json',
    ...(opts.headers || {})
  };
  const resp = await fetch(`${env.url}${path}`, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch(e) { data = text; }
  if (!resp.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || `Erreur Supabase ${resp.status}`;
    const err = new Error(msg); err.status = resp.status; err.data = data; throw err;
  }
  return data;
}
async function getProfile(userId) {
  const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, { service:true, headers:{ Prefer:'return=representation' } });
  return Array.isArray(rows) ? rows[0] || null : null;
}
async function upsertProfile(profile) {
  const rows = await supabaseFetch('/rest/v1/profiles?on_conflict=id', {
    method:'POST', service:true, body: profile,
    headers:{ Prefer:'resolution=merge-duplicates,return=representation' }
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function getProfileChannelAccess(userId) {
  try {
    const rows = await supabaseFetch(`/rest/v1/profile_channel_access?user_id=eq.${encodeURIComponent(userId)}&select=channel`, { service:true });
    return Array.isArray(rows) ? rows.map(r => r.channel).filter(Boolean) : [];
  } catch(e) {
    return [];
  }
}
async function enrichProfile(profile) {
  if (!profile?.id) return profile;
  const channels = await getProfileChannelAccess(profile.id);
  return { ...profile, allowed_channels: channels };
}
async function logUsageEvent({ req, userId, eventType, channel, meta }) {
  try {
    if (!userId || !eventType) return;
    await supabaseFetch('/rest/v1/usage_events', {
      method:'POST', service:true,
      body:{ user_id:userId, event_type:eventType, channel:channel || null, meta:meta || {}, user_agent:req.headers['user-agent'] || null },
      headers:{ Prefer:'return=minimal' }
    });
  } catch(e) {}
}
async function refreshSupabaseSession(refresh_token) {
  const env = supabaseEnv();
  const data = await supabaseFetch('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token }, headers:{ apikey: env.anon, Authorization:`Bearer ${env.anon}` } });
  return data;
}
async function getCurrentUser(req, res, { allowRefresh = true } = {}) {
  const env = supabaseEnv();
  if (!env.configured) return { ok:false, code:'not_configured', error:'Supabase non configuré.' };
  let session = parseUserCookie(req);
  if (!session?.access_token) return { ok:false, code:'no_session', error:'Session absente.' };
  try {
    const user = await supabaseFetch('/auth/v1/user', { token: session.access_token });
    let profile = await getProfile(user.id);
    if (!profile || profile.status !== 'active') return { ok:false, code:'inactive', error:'Compte inactif ou non autorisé.' };
    profile = await enrichProfile(profile);
    await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method:'PATCH', service:true, body:{ last_seen_at:new Date().toISOString() }, headers:{ Prefer:'return=minimal' } }).catch(()=>{});
    return { ok:true, user, profile };
  } catch(e) {
    if (allowRefresh && session.refresh_token) {
      try {
        const fresh = await refreshSupabaseSession(session.refresh_token);
        setUserCookie(res, fresh);
        const user = await supabaseFetch('/auth/v1/user', { token: fresh.access_token });
        let profile = await getProfile(user.id);
        if (!profile || profile.status !== 'active') return { ok:false, code:'inactive', error:'Compte inactif ou non autorisé.' };
        profile = await enrichProfile(profile);
        return { ok:true, user, profile, refreshed:true };
      } catch(refreshErr) {}
    }
    return { ok:false, code:'invalid_session', error:'Session expirée ou invalide.' };
  }
}
async function requireUser(req, res) {
  const current = await getCurrentUser(req, res);
  if (!current.ok) {
    clearUserCookie(res);
    sendJson(res, 401, { ok:false, error: current.error, code: current.code }, {'Cache-Control':'no-store'});
    return null;
  }
  return current;
}
async function requireAdminUser(req, res) {
  const current = await requireUser(req, res);
  if (!current) return null;
  if (current.profile.role !== 'admin') {
    sendJson(res, 403, { ok:false, error:'Rôle admin requis.' }, {'Cache-Control':'no-store'});
    return null;
  }
  return current;
}

async function requireRole(req, res, allowedRoles) {
  const current = await requireUser(req, res);
  if (!current) return null;
  const role = current.profile?.role || 'viewer';
  if (!allowedRoles.includes(role)) {
    sendJson(res, 403, { ok:false, error:`Rôle ${allowedRoles.join(' ou ')} requis.` }, {'Cache-Control':'no-store'});
    return null;
  }
  return current;
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
  if (got && got === expected) return true;
  const session = decodeURIComponent(getCookie(req, ADMIN_COOKIE) || '');
  if (verifyAdminSession(session)) return true;
  sendJson(res, 401, { error: 'Admin non autorisé. Vérifie ADMIN_PASSWORD.' }, {'Cache-Control':'no-store'});
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

function getYouTubeContentOwnerId() {
  return String(process.env.YOUTUBE_CONTENT_OWNER_ID || process.env.YT_CONTENT_OWNER_ID || '').trim();
}
function applyContentOwnerParams(params) {
  const ownerId = getYouTubeContentOwnerId();
  if (!ownerId) return { ownerId:'', mode:'channel' };
  const currentIds = params.get('ids') || '';
  if (!currentIds || currentIds === 'channel==MINE' || currentIds.startsWith('channel==')) {
    params.set('ids', `contentOwner==${ownerId}`);
  }
  if (!params.has('onBehalfOfContentOwner')) params.set('onBehalfOfContentOwner', ownerId);
  return { ownerId, mode:'contentOwner' };
}
async function youtubeOAuthJson(path, params = {}) {
  const accessToken = await refreshGoogleAccessToken();
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries(params || {}).forEach(([k,v]) => { if (v !== undefined && v !== null && String(v) !== '') url.searchParams.set(k, String(v)); });
  const r = await fetch(url.toString(), { headers:{ Authorization:`Bearer ${accessToken}` } });
  const data = await r.json().catch(()=>({}));
  if (!r.ok || data.error) {
    const err = new Error(data.error?.message || data.error_description || `YouTube OAuth ${r.status}`);
    err.status = r.status; err.data = data; throw err;
  }
  return data;
}
async function listManagedChannels(ownerId) {
  const channels = [];
  let pageToken = '';
  do {
    const data = await youtubeOAuthJson('channels', {
      part:'id,snippet',
      managedByMe:'true',
      onBehalfOfContentOwner: ownerId,
      maxResults:'50',
      pageToken
    });
    for (const item of data.items || []) {
      channels.push({ id:item.id, title:item.snippet?.title || item.id, customUrl:item.snippet?.customUrl || null });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken && channels.length < 500);
  return channels;
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
function slimDescription(text) {
  const max = Number(process.env.SNAPSHOT_DESCRIPTION_MAX || 700);
  return String(text || '').slice(0, max);
}
function slimTags(tags) {
  const max = Number(process.env.SNAPSHOT_TAGS_MAX || 25);
  return (Array.isArray(tags) ? tags : []).slice(0, max).map(x => String(x).toLowerCase());
}
const SNAPSHOT_MEMORY_TTL_MS = Number(process.env.SNAPSHOT_MEMORY_TTL_MS || 1000 * 60 * 60 * 6);
globalThis.__FTV_SNAPSHOT_MEMORY_CACHE = globalThis.__FTV_SNAPSHOT_MEMORY_CACHE || new Map();
function getSnapshotMemory(channelKey) {
  const hit = globalThis.__FTV_SNAPSHOT_MEMORY_CACHE.get(channelKey);
  if (!hit || Date.now() - hit.ts > SNAPSHOT_MEMORY_TTL_MS) return null;
  return hit.data;
}
function setSnapshotMemory(channelKey, data) {
  try { globalThis.__FTV_SNAPSHOT_MEMORY_CACHE.set(channelKey, { ts: Date.now(), data }); } catch(e) {}
}
async function buildSnapshot(channelKey, { force = false } = {}) {
  const cfg = CHANNEL_CONFIGS[channelKey] || CHANNEL_CONFIGS.sport;
  if (!force) {
    const warm = getSnapshotMemory(cfg.key);
    if (warm) return { ...warm, memoryCache:true };
  }
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
          title: v.snippet?.title || '', description: slimDescription(v.snippet?.description || ''),
          tags: slimTags(v.snippet?.tags || []),
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
  const snapshot = { ok:true, channel: cfg.key, label: cfg.label, handle: cfg.handle, generatedAt: new Date().toISOString(), count: videos.length, videos };
  setSnapshotMemory(cfg.key, snapshot);
  return snapshot;
}
const cacheHeaders = {
  'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
  'CDN-Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
  'Vercel-CDN-Cache-Control': 's-maxage=1800, stale-while-revalidate=21600',
  'X-FTV-Cache': 'snapshot-cdn-6h'
};
async function handler(req, res) {
  const path = getPath(req);
  const q = getQuery(req);
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok:true });
  try {
    if (path === 'health' || path === '') return sendJson(res, 200, { ok:true, route:'health', time:new Date().toISOString(), function:'single-catchall' });

    if (path === 'auth-login') {
      if (req.method !== 'POST') return sendJson(res, 405, { error:'POST requis.' }, {'Cache-Control':'no-store'});
      const env = supabaseEnv();
      if (!env.configured) return sendJson(res, 500, { ok:false, error:'Supabase non configuré. Ajoute SUPABASE_URL et SUPABASE_ANON_KEY dans Vercel.' }, {'Cache-Control':'no-store'});
      const { email, password } = await readBody(req);
      if (!email || !password) return sendJson(res, 400, { ok:false, error:'Email et mot de passe requis.' }, {'Cache-Control':'no-store'});
      const session = await supabaseFetch('/auth/v1/token?grant_type=password', {
        method:'POST', body:{ email, password }, headers:{ apikey: env.anon, Authorization:`Bearer ${env.anon}` }
      });
      const user = session.user;
      const profile = await getProfile(user.id);
      if (!profile || profile.status !== 'active') { clearUserCookie(res); return sendJson(res, 403, { ok:false, error:'Compte inactif ou non autorisé.' }, {'Cache-Control':'no-store'}); }
      setUserCookie(res, session);
      return sendJson(res, 200, { ok:true, user:{ id:user.id, email:user.email }, profile:{ role:profile.role, status:profile.status, full_name:profile.full_name } }, {'Cache-Control':'no-store'});
    }

    if (path === 'auth-reset-password') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok:false, error:'POST requis.' }, {'Cache-Control':'no-store'});
      const env = supabaseEnv();
      if (!env.configured) return sendJson(res, 500, { ok:false, error:'Supabase non configuré.' }, {'Cache-Control':'no-store'});
      const { email } = await readBody(req);
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) return sendJson(res, 400, { ok:false, error:'Email valide requis.' }, {'Cache-Control':'no-store'});
      const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const redirectTo = `${proto}://${host}/?reset=password`;
      try {
        await supabaseFetch(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
          method:'POST',
          body:{ email: cleanEmail },
          headers:{ apikey: env.anon, Authorization:`Bearer ${env.anon}` }
        });
      } catch(e) {
        // Réponse volontairement neutre pour ne pas révéler si un email existe ou non.
      }
      return sendJson(res, 200, { ok:true, message:'Si ce compte existe, un email de réinitialisation vient d’être envoyé.' }, {'Cache-Control':'no-store'});
    }
    if (path === 'auth-adopt-session') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok:false, error:'POST requis.' }, {'Cache-Control':'no-store'});
      const { access_token, refresh_token, expires_at, expires_in } = await readBody(req);
      if (!access_token) return sendJson(res, 400, { ok:false, error:'Token de récupération manquant.' }, {'Cache-Control':'no-store'});
      const user = await supabaseFetch('/auth/v1/user', { token: access_token });
      const profile = await getProfile(user.id);
      if (!profile || profile.status !== 'active') return sendJson(res, 403, { ok:false, error:'Compte inactif ou non autorisé.' }, {'Cache-Control':'no-store'});
      setUserCookie(res, { access_token, refresh_token, expires_at, expires_in });
      return sendJson(res, 200, { ok:true, user:{ id:user.id, email:user.email }, profile:{ role:profile.role, status:profile.status, full_name:profile.full_name } }, {'Cache-Control':'no-store'});
    }
    if (path === 'auth-change-password') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok:false, error:'POST requis.' }, {'Cache-Control':'no-store'});
      const current = await requireUser(req, res); if (!current) return;
      const { password } = await readBody(req);
      const nextPassword = String(password || '').trim();
      if (nextPassword.length < 8) return sendJson(res, 400, { ok:false, error:'Le mot de passe doit contenir au moins 8 caractères.' }, {'Cache-Control':'no-store'});
      const session = parseUserCookie(req);
      await supabaseFetch('/auth/v1/user', {
        method:'PUT',
        token: session.access_token,
        body:{ password: nextPassword }
      });
      return sendJson(res, 200, { ok:true, message:'Mot de passe mis à jour.' }, {'Cache-Control':'no-store'});
    }

    if (path === 'auth-logout') {
      clearUserCookie(res);
      return sendJson(res, 200, { ok:true }, {'Cache-Control':'no-store'});
    }
    if (path === 'auth-me') {
      const env = supabaseEnv();
      if (!env.configured) return sendJson(res, 200, { ok:false, configured:false, error:'Supabase non configuré.' }, {'Cache-Control':'no-store'});
      const current = await getCurrentUser(req, res);
      if (!current.ok) return sendJson(res, 401, { ok:false, configured:true, error:current.error, code:current.code }, {'Cache-Control':'no-store'});
      return sendJson(res, 200, { ok:true, configured:true, user:{ id:current.user.id, email:current.user.email }, profile:{ role:current.profile.role, status:current.profile.status, full_name:current.profile.full_name } }, {'Cache-Control':'no-store'});
    }
    if (path === 'activity-log') {
      const current = await requireUser(req, res); if (!current) return;
      if (req.method !== 'POST') return sendJson(res, 405, { ok:false, error:'POST requis.' }, {'Cache-Control':'no-store'});
      const body = await readBody(req).catch(()=>({}));
      await logUsageEvent({ req, userId:current.user.id, eventType:String(body.event_type || 'view'), channel:String(body.channel || ''), meta:body.meta || {} });
      return sendJson(res, 200, { ok:true }, {'Cache-Control':'no-store'});
    }

    if (path === 'admin-activity') {
      if (!requireAdmin(req,res)) return;
      const limit = Math.min(200, Math.max(1, Number(q.limit || 80)));
      const rows = await supabaseFetch(`/rest/v1/usage_events?select=*,profiles(email,full_name,role)&order=created_at.desc&limit=${limit}`, { service:true }).catch(()=>[]);
      return sendJson(res, 200, { ok:true, events: rows || [] }, {'Cache-Control':'no-store'});
    }

    if (path === 'admin-channel-access') {
      if (!requireAdmin(req,res)) return;
      if (req.method === 'GET') {
        const rows = await supabaseFetch('/rest/v1/profile_channel_access?select=*', { service:true }).catch(()=>[]);
        return sendJson(res, 200, { ok:true, access: rows || [] }, {'Cache-Control':'no-store'});
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const user_id = String(body.user_id || '').trim();
        const channels = Array.isArray(body.channels) ? body.channels.map(x=>String(x).trim()).filter(Boolean) : [];
        if (!user_id) return sendJson(res, 400, { ok:false, error:'user_id requis.' }, {'Cache-Control':'no-store'});
        await supabaseFetch(`/rest/v1/profile_channel_access?user_id=eq.${encodeURIComponent(user_id)}`, { method:'DELETE', service:true, headers:{ Prefer:'return=minimal' } });
        if (channels.length) {
          await supabaseFetch('/rest/v1/profile_channel_access', { method:'POST', service:true, body:channels.map(channel=>({user_id,channel})), headers:{ Prefer:'return=minimal' } });
        }
        return sendJson(res, 200, { ok:true, channels }, {'Cache-Control':'no-store'});
      }
      return sendJson(res, 405, { ok:false, error:'Méthode non autorisée.' }, {'Cache-Control':'no-store'});
    }

    if (path === 'alert-state') {
      const current = await requireUser(req, res); if (!current) return;
      if (req.method === 'GET') {
        const channel = String(q.channel || '').trim();
        const qs = `/rest/v1/alert_states?user_id=eq.${encodeURIComponent(current.user.id)}${channel?`&channel=eq.${encodeURIComponent(channel)}`:''}&select=*&order=updated_at.desc`;
        const rows = await supabaseFetch(qs, { service:true }).catch(()=>[]);
        return sendJson(res, 200, { ok:true, alerts: rows || [] }, {'Cache-Control':'no-store'});
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const alert_key = String(body.alert_key || '').trim();
        const channel = String(body.channel || '').trim();
        const status = ['open','in_progress','resolved','ignored'].includes(body.status) ? body.status : 'open';
        const priority = ['low','medium','high'].includes(body.priority) ? body.priority : 'medium';
        if (!alert_key || !channel) return sendJson(res, 400, { ok:false, error:'alert_key et channel requis.' }, {'Cache-Control':'no-store'});
        const payload = { user_id:current.user.id, channel, alert_key, status, priority, note:String(body.note || ''), updated_at:new Date().toISOString() };
        const rows = await supabaseFetch('/rest/v1/alert_states?on_conflict=user_id,channel,alert_key', { method:'POST', service:true, body:payload, headers:{ Prefer:'resolution=merge-duplicates,return=representation' } });
        return sendJson(res, 200, { ok:true, alert:Array.isArray(rows)?rows[0]:rows }, {'Cache-Control':'no-store'});
      }
      return sendJson(res, 405, { ok:false, error:'Méthode non autorisée.' }, {'Cache-Control':'no-store'});
    }

    if (path === 'admin-users') {
      if (!requireAdmin(req,res)) return;
      const env = supabaseEnv();
      if (!env.adminConfigured) return sendJson(res, 500, { ok:false, error:'Supabase admin non configuré. Ajoute SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.' }, {'Cache-Control':'no-store'});
      if (req.method === 'GET') {
        const profiles = await supabaseFetch('/rest/v1/profiles?select=*&order=created_at.desc', { service:true });
        return sendJson(res, 200, { ok:true, users:profiles }, {'Cache-Control':'no-store'});
      }
      if (req.method !== 'POST') return sendJson(res, 405, { error:'Méthode non autorisée.' }, {'Cache-Control':'no-store'});
      const body = await readBody(req);
      const action = body.action;
      if (action === 'create') {
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '').trim();
        const full_name = String(body.full_name || '').trim();
        const role = ['admin','editor','viewer'].includes(body.role) ? body.role : 'viewer';
        if (!email || !password) return sendJson(res, 400, { ok:false, error:'Email et mot de passe temporaire requis.' }, {'Cache-Control':'no-store'});
        const created = await supabaseFetch('/auth/v1/admin/users', { method:'POST', service:true, body:{ email, password, email_confirm:true, user_metadata:{ full_name, role } } });
        const user = created.user || created;
        const profile = await upsertProfile({ id:user.id, email, full_name, role, status:'active' });
        return sendJson(res, 200, { ok:true, user:profile }, {'Cache-Control':'no-store'});
      }
      if (action === 'update') {
        const id = String(body.id || '');
        if (!id) return sendJson(res, 400, { ok:false, error:'ID requis.' }, {'Cache-Control':'no-store'});
        const patch = {};
        if (body.full_name !== undefined) patch.full_name = String(body.full_name || '').trim();
        if (['admin','editor','viewer'].includes(body.role)) patch.role = body.role;
        if (['active','disabled'].includes(body.status)) patch.status = body.status;
        const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method:'PATCH', service:true, body:patch, headers:{ Prefer:'return=representation' } });
        return sendJson(res, 200, { ok:true, user:Array.isArray(rows) ? rows[0] : rows }, {'Cache-Control':'no-store'});
      }
      if (action === 'reset-password') {
        const id = String(body.id || '');
        const password = String(body.password || '').trim();
        if (!id || !password) return sendJson(res, 400, { ok:false, error:'ID et nouveau mot de passe requis.' }, {'Cache-Control':'no-store'});
        await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method:'PUT', service:true, body:{ password } });
        return sendJson(res, 200, { ok:true }, {'Cache-Control':'no-store'});
      }
      if (action === 'delete') {
        const id = String(body.id || '');
        if (!id) return sendJson(res, 400, { ok:false, error:'ID requis.' }, {'Cache-Control':'no-store'});
        await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method:'DELETE', service:true });
        return sendJson(res, 200, { ok:true }, {'Cache-Control':'no-store'});
      }
      return sendJson(res, 400, { ok:false, error:'Action admin-users inconnue.' }, {'Cache-Control':'no-store'});
    }

    if (path === 'user-watchlist') {
      const current = await requireUser(req, res); if (!current) return;
      if (req.method === 'GET') {
        const channel = String(q.channel || 'sport').trim();
        const rows = await supabaseFetch(`/rest/v1/user_watchlist?user_id=eq.${encodeURIComponent(current.user.id)}&channel=eq.${encodeURIComponent(channel)}&select=*&order=created_at.desc`, { service:true });
        return sendJson(res, 200, { ok:true, items: rows || [] }, {'Cache-Control':'no-store'});
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const event_key = String(body.event_key || '').trim();
        const bodyChannel = String(body.channel || q.channel || 'sport').trim();
        if (!event_key) return sendJson(res, 400, { ok:false, error:'event_key requis.' }, {'Cache-Control':'no-store'});
        const existing = await supabaseFetch(`/rest/v1/user_watchlist?user_id=eq.${encodeURIComponent(current.user.id)}&channel=eq.${encodeURIComponent(bodyChannel)}&event_key=eq.${encodeURIComponent(event_key)}&select=id`, { service:true });
        if (Array.isArray(existing) && existing[0]?.id) {
          await supabaseFetch(`/rest/v1/user_watchlist?id=eq.${encodeURIComponent(existing[0].id)}`, { method:'DELETE', service:true, headers:{ Prefer:'return=minimal' } });
        } else {
          await supabaseFetch('/rest/v1/user_watchlist', { method:'POST', service:true, body:{ user_id:current.user.id, channel:bodyChannel, event_key }, headers:{ Prefer:'return=minimal' } });
        }
        const rows = await supabaseFetch(`/rest/v1/user_watchlist?user_id=eq.${encodeURIComponent(current.user.id)}&channel=eq.${encodeURIComponent(bodyChannel)}&select=*&order=created_at.desc`, { service:true });
        return sendJson(res, 200, { ok:true, items: rows || [] }, {'Cache-Control':'no-store'});
      }
      return sendJson(res, 405, { ok:false, error:'Méthode non autorisée.' }, {'Cache-Control':'no-store'});
    }

    if (path === 'admin-login') {
      if (req.method !== 'POST') return sendJson(res, 405, { error:'POST requis.' }, {'Cache-Control':'no-store'});
      const { password } = await readBody(req);
      const expected = process.env.ADMIN_PASSWORD || '';
      if (!expected || !password || password !== expected) return sendJson(res, 401, { ok:false, error:'Mot de passe admin incorrect.' }, {'Cache-Control':'no-store'});
      setAdminCookie(res, createAdminSession());
      return sendJson(res, 200, { ok:true, message:'Admin connecté.' }, {'Cache-Control':'no-store'});
    }
    if (path === 'admin-logout') {
      clearAdminCookie(res);
      return sendJson(res, 200, { ok:true, message:'Admin déconnecté.' }, {'Cache-Control':'no-store'});
    }
    if (path === 'admin-status') {
      if (!requireAdmin(req,res)) return;
      return sendJson(res, 200, { ok:true, env:{ ADMIN_PASSWORD:!!process.env.ADMIN_PASSWORD, YOUTUBE_API_KEY:!!process.env.YOUTUBE_API_KEY, GOOGLE_CLIENT_ID:!!process.env.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET:!!process.env.GOOGLE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN:!!process.env.YOUTUBE_REFRESH_TOKEN, YOUTUBE_CONTENT_OWNER_ID:!!getYouTubeContentOwnerId(), ANTHROPIC_API_KEY:!!process.env.ANTHROPIC_API_KEY, ALLOWED_ORIGINS:!!process.env.ALLOWED_ORIGINS, SUPABASE_URL:!!process.env.SUPABASE_URL, SUPABASE_ANON_KEY:!!(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY), SUPABASE_SERVICE_ROLE_KEY:!!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) }});
    }
    if (path === 'admin-test') {
      if (!requireAdmin(req,res)) return;
      const result = { youtubeData:null, youtubeAnalyticsToken:null, youtubeContentOwner:null, claude:null };
      try { const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&id=UCRm-DLbhzojKd10edotYxMg&key=${process.env.YOUTUBE_API_KEY}`); result.youtubeData = { ok:r.ok, status:r.status }; } catch(e) { result.youtubeData = { ok:false, error:e.message }; }
      try { const token = await refreshGoogleAccessToken(); result.youtubeAnalyticsToken = { ok:!!token, tokenPreview:token ? token.slice(0,8)+'...' : null }; } catch(e) { result.youtubeAnalyticsToken = { ok:false, error:e.message }; }
      try {
        const ownerId = getYouTubeContentOwnerId();
        if (!ownerId) result.youtubeContentOwner = { ok:false, error:'YOUTUBE_CONTENT_OWNER_ID manquant. Colle la valeur o=... trouvée dans YouTube Studio / Content Manager.' };
        else {
          const channels = await listManagedChannels(ownerId);
          result.youtubeContentOwner = { ok:true, ownerIdPreview: ownerId.slice(0,4)+'…'+ownerId.slice(-4), managedChannelsCount: channels.length, managedChannelsSample: channels.slice(0,12) };
        }
      } catch(e) { result.youtubeContentOwner = { ok:false, error:e.message, data:e.data || null }; }
      result.claude = { ok:!!process.env.ANTHROPIC_API_KEY };
      return sendJson(res, 200, result);
    }
    if (path === 'oauth/google/start' || path === 'oauth-start') {
      if (!requireAdmin(req,res)) return;
      const origin = `https://${req.headers.host}`;
      const callbackPath = path === 'oauth-start' ? '/api/oauth-callback' : '/api/oauth/google/callback';
      const redirect_uri = `${origin}${callbackPath}`;
      const scope = 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly';
      const params = new URLSearchParams({ client_id:process.env.GOOGLE_CLIENT_ID||'', redirect_uri, response_type:'code', access_type:'offline', prompt:'consent', scope });
      res.statusCode = 302; res.setHeader('location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`); return res.end();
    }
    if (path === 'oauth/google/callback' || path === 'oauth-callback') {
      if (!requireAdmin(req,res)) return;
      const code = q.code;
      const origin = `https://${req.headers.host}`;
      const callbackPath = path === 'oauth-callback' ? '/api/oauth-callback' : '/api/oauth/google/callback';
      const redirect_uri = `${origin}${callbackPath}`;
      if (!code) return sendText(res, 400, 'Code OAuth manquant.');
      const body = new URLSearchParams({ code, client_id:process.env.GOOGLE_CLIENT_ID||'', client_secret:process.env.GOOGLE_CLIENT_SECRET||'', redirect_uri, grant_type:'authorization_code' });
      const r = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
      const data = await r.json().catch(()=>({}));
      if (!r.ok) return sendText(res, 200, `<h1>Erreur OAuth</h1><pre>${JSON.stringify(data,null,2)}</pre><p>Vérifie l'Authorized redirect URI : ${redirect_uri}</p>`, 'text/html; charset=utf-8');
      return sendText(res, 200, `<!DOCTYPE html><meta charset="utf-8"><title>OAuth OK</title><body style="font-family:Arial;padding:30px;background:#f6f7fb"><h1>Connexion YouTube Analytics réussie</h1><p>Copie le refresh token ci-dessous dans Vercel → Environment Variables → <b>YOUTUBE_REFRESH_TOKEN</b>, puis redéploie.</p><textarea style="width:100%;height:120px">${data.refresh_token||''}</textarea><pre>${JSON.stringify({scope:data.scope,expires_in:data.expires_in,token_type:data.token_type},null,2)}</pre><p><a href="/admin.html">Retour admin</a></p></body>`, 'text/html; charset=utf-8');
    }
    if (!checkOrigin(req)) return sendJson(res, 403, { error:'Origine non autorisée.' });
    if (path === 'youtube-v3') {
      if (!(await requireUser(req,res))) return;
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
    if (path === 'youtube-content-owner-test') {
      if (!requireAdmin(req,res)) return;
      const ownerId = getYouTubeContentOwnerId();
      if (!ownerId) return sendJson(res, 400, { ok:false, error:'YOUTUBE_CONTENT_OWNER_ID manquant. Ajoute la valeur o=... dans Vercel.' }, {'Cache-Control':'no-store'});
      try {
        const channels = await listManagedChannels(ownerId);
        const today = new Date();
        const endDate = today.toISOString().slice(0,10);
        const startDate = new Date(today.getTime() - 28*86400000).toISOString().slice(0,10);
        const accessToken = await refreshGoogleAccessToken();
        const params = new URLSearchParams({
          ids:`contentOwner==${ownerId}`,
          onBehalfOfContentOwner:ownerId,
          startDate, endDate,
          metrics:'views,estimatedMinutesWatched',
          dimensions:'channel',
          sort:'-views',
          maxResults:'20'
        });
        const r = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`, { headers:{ Authorization:`Bearer ${accessToken}` } });
        const report = await r.json().catch(()=>({}));
        return sendJson(res, r.ok ? 200 : r.status, { ok:r.ok, ownerIdPreview: ownerId.slice(0,4)+'…'+ownerId.slice(-4), managedChannelsCount:channels.length, managedChannels:channels.slice(0,100), analyticsSample:report, startDate, endDate }, {'Cache-Control':'no-store'});
      } catch(e) {
        return sendJson(res, e.status || 500, { ok:false, error:e.message, data:e.data || null }, {'Cache-Control':'no-store'});
      }
    }
    if (path === 'youtube-analytics') {
      if (!(await requireRole(req,res,['admin','editor']))) return;
      if (req.method !== 'POST') return sendJson(res, 405, { error:'POST requis.' });
      const paramsIn = await readBody(req);
      const accessToken = await refreshGoogleAccessToken();
      const params = new URLSearchParams();
      for (const [k,v] of Object.entries(paramsIn || {})) if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, String(v));
      if (!params.has('ids')) params.set('ids', 'channel==MINE');
      const analyticsMode = applyContentOwnerParams(params);
      const r = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`, { headers:{ Authorization:`Bearer ${accessToken}` } });
      const data = await r.json().catch(()=>({}));
      if (data && typeof data === 'object' && !Array.isArray(data)) data.ftvMeta = { analyticsMode: analyticsMode.mode, contentOwnerEnabled: !!analyticsMode.ownerId };
      return sendJson(res, r.ok ? 200 : r.status, data);
    }
    if (path === 'claude') {
      const current = await requireUser(req,res); if (!current) return; if (!['admin','editor'].includes(current.profile.role)) return sendJson(res, 403, { error:'Rôle editor ou admin requis pour Claude.' }, {'Cache-Control':'no-store'});
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
    if (path === 'cache-status') { if (!(await requireUser(req,res))) return; return sendJson(res, 200, { ok:true, strategy:'single serverless function + Vercel CDN cache 6h + browser Cache Storage 6h' }, {'Cache-Control':'no-store'}); }
    if (path === 'snapshot-channel' || path === 'snapshot') {
      if (!(await requireUser(req,res))) return;
      const channel = String(q.channel || 'sport');
      const data = await buildSnapshot(channel, { force: q.force === '1' || q.force === 'true' });
      return sendJson(res, 200, data, cacheHeaders);
    }
    if (path === 'live-stats') {
      if (!(await requireUser(req,res))) return;
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
        try {
          const data = await buildSnapshot(channel, { force: q.force === '1' || q.force === 'true' });
          results.push({ channel, ok:true, status:200, count:data.count || 0, ms:Date.now()-started, error:null });
        } catch(e) { results.push({ channel, ok:false, ms:Date.now()-started, error:e.message }); }
      }
      return sendJson(res, 200, { ok:true, generatedAt:new Date().toISOString(), results });
    }
    return sendJson(res, 404, { error:'Route API introuvable', path });
  } catch(e) {
    return sendJson(res, 500, { ok:false, error:e.message, path:getPath(req) }, {'Cache-Control':'no-store'});
  }
}
module.exports = handler;

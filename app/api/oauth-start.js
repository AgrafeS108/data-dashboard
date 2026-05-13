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

function verifyAdminSession(token) {
  if (!process.env.ADMIN_PASSWORD || !token) return false;
  const [tsRaw, sig] = String(token).split('.');
  const ts = Number(tsRaw);
  if (!ts || !sig) return false;
  const maxAgeMs = 1000 * 60 * 60 * 12;
  if (Date.now() - ts > maxAgeMs) return false;
  return safeEqual(sig, signAdminSession(ts));
}

function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const got = req.headers['x-admin-key'];
  if (expected && got && got === expected) return true;
  const session = decodeURIComponent(getCookie(req, ADMIN_COOKIE) || '');
  return verifyAdminSession(session);
}

module.exports = async function handler(req, res) {
  if (!isAdmin(req)) {
    res.statusCode = 401;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<h1>Admin non autorisé</h1><p>Retourne sur <a href="/admin.html">la console admin</a>, connecte-toi avec ADMIN_PASSWORD, puis relance la connexion YouTube Analytics.</p>');
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('GOOGLE_CLIENT_ID manquant dans Vercel.');
    return;
  }

  const origin = `https://${req.headers.host}`;
  const redirectUri = `${origin}/api/oauth-callback`;
  const scope = 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope
  });

  res.statusCode = 302;
  res.setHeader('location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.end();
};

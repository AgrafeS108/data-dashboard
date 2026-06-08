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

  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get('code');
  if (!code) {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Code OAuth manquant.');
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquant dans Vercel.');
    return;
  }

  const origin = `https://${req.headers.host}`;
  const redirectUri = `${origin}/api/oauth-callback`;
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await tokenResp.json().catch(() => ({}));

  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (!tokenResp.ok) {
    res.statusCode = 200;
    res.end(`<!doctype html><meta charset="utf-8"><title>Erreur OAuth</title><body style="font-family:Arial;padding:32px;background:#f6f7fb;color:#111827"><h1>Erreur OAuth</h1><p>Vérifie dans Google Cloud que cette URL est bien dans les URI de redirection autorisés :</p><pre style="padding:16px;background:white;border-radius:12px">${redirectUri}</pre><pre style="padding:16px;background:white;border-radius:12px;white-space:pre-wrap">${JSON.stringify(data,null,2)}</pre><p><a href="/admin.html">Retour admin</a></p></body>`);
    return;
  }

  const warning = data.refresh_token ? '' : '<p style="padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;color:#7c2d12"><b>Refresh token absent.</b> Dans Google Account → Security → Third-party access, révoque l’accès de l’app puis relance OAuth depuis /admin.html. Google ne renvoie parfois le refresh token qu’au premier consentement.</p>';
  res.statusCode = 200;
  res.end(`<!doctype html><meta charset="utf-8"><title>OAuth OK v111</title><body style="font-family:Arial;padding:32px;background:#f6f7fb;color:#111827"><h1>Connexion YouTube Analytics réussie</h1>${warning}<p>Copie le refresh token ci-dessous dans Vercel → Environment Variables → <b>YOUTUBE_REFRESH_TOKEN</b>, puis redéploie.</p><textarea style="width:100%;height:140px;padding:14px;border-radius:12px;border:1px solid #d1d5db">${data.refresh_token || ''}</textarea><pre style="padding:16px;background:white;border-radius:12px;white-space:pre-wrap">${JSON.stringify({scope:data.scope,expires_in:data.expires_in,token_type:data.token_type},null,2)}</pre><p><a href="/admin.html">Retour admin</a></p></body>`);
};

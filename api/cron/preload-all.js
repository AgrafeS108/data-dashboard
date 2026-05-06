const { json } = require('../_helpers');

module.exports = async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.authorization !== `Bearer ${expected}`) {
    return json(res, 401, { error: 'Cron non autorisé.' });
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${host}`;
  const channels = ['sport','francetv','franceinfo','francetvculture','slash'];
  const results = [];
  for (const channel of channels) {
    const started = Date.now();
    try {
      const r = await fetch(`${base}/api/snapshot-channel?channel=${encodeURIComponent(channel)}`, {
        headers: { 'x-ftv-cron-preload': '1' }
      });
      const data = await r.json().catch(() => ({}));
      results.push({ channel, ok: r.ok, status: r.status, count: data.count || 0, ms: Date.now() - started, error: data.error || null });
    } catch (e) {
      results.push({ channel, ok:false, ms: Date.now() - started, error: e.message });
    }
  }
  return json(res, 200, { ok:true, generatedAt: new Date().toISOString(), results });
};

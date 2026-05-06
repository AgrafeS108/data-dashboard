const { json, checkOrigin } = require('./_helpers');
module.exports = async (req, res) => {
  if (!checkOrigin(req)) return json(res, 403, { error: 'Origine non autorisée.' });
  res.setHeader('Cache-Control', 'no-store');
  json(res, 200, {
    ok: true,
    strategy: 'Vercel CDN cache 6h + browser Cache Storage 6h',
    note: 'Le premier chargement peut être long; les reloads suivants et les autres utilisateurs profitent du cache CDN/navigateur.'
  });
};

# FTV Dashboard — v59 fixed Vercel routing

Version corrigée pour éviter les erreurs 404 sur Vercel.

## Structure obligatoire

```
api/
public/
README.md
package.json
vercel.json
```

Ne mets pas `admin.html` ou `index.html` à la racine : ils doivent rester dans `public/`.

## Tests après déploiement

1. Front : `https://data-dashboard-mocha-iota.vercel.app/`
2. Admin : `https://data-dashboard-mocha-iota.vercel.app/admin.html`
3. Health API : `https://data-dashboard-mocha-iota.vercel.app/api/health`
4. Snapshot : `https://data-dashboard-mocha-iota.vercel.app/api/snapshot-channel?channel=sport`
5. Cron : `https://data-dashboard-mocha-iota.vercel.app/api/cron/preload-all`

## Variables Vercel

```
ADMIN_PASSWORD=...
YOUTUBE_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=test
ANTHROPIC_API_KEY=...
ALLOWED_ORIGINS=https://data-dashboard-mocha-iota.vercel.app,http://localhost:3000
```

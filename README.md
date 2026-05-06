# FTV Dashboard v61 — Performance + mobile premium + single API Vercel Hobby

## Contenu

- `public/index.html` : dashboard client avec UI mobile/tablette améliorée.
- `public/admin.html` : console admin.
- `api/[...path].js` : une seule fonction backend pour rester compatible Vercel Hobby.
- `vercel.json` : rewrite admin + cron quotidien de préchargement.

## Tests après upload

1. `https://TON-DOMAINE.vercel.app/api/health`
2. `https://TON-DOMAINE.vercel.app/api/snapshot-channel?channel=sport`
3. `https://TON-DOMAINE.vercel.app/admin.html`
4. `https://TON-DOMAINE.vercel.app/`

## Performance

Le dashboard lit d'abord un snapshot serveur mis en cache par Vercel/CDN, puis lance un refresh léger des vues/likes/commentaires publics en arrière-plan.

Le cron Vercel appelle automatiquement `/api/cron/preload-all` chaque jour à 05:00 UTC pour réchauffer les snapshots.

## Variables Vercel requises

- `ADMIN_PASSWORD`
- `YOUTUBE_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `ANTHROPIC_API_KEY`
- `ALLOWED_ORIGINS`

Optionnel :
- `MAX_YOUTUBE_PAGES=120` pour contrôler le volume maximal de pages YouTube scannées par chaîne.
- `CRON_SECRET` si tu veux protéger le cron.

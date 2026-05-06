# FTV Dashboard — Client + Admin + Backend Vercel

Base créée depuis `FTV_Analytics_v54_analytics_export_fixed.html`.

## Contenu
- `public/index.html` : dashboard client, même UI, appels sensibles redirigés vers `/api`.
- `public/admin.html` : console admin au même style visuel.
- `api/youtube-v3.js` : proxy YouTube Data API.
- `api/youtube-analytics.js` : proxy YouTube Analytics API avec refresh token serveur.
- `api/claude.js` : proxy Claude/Anthropic.
- `api/oauth/google/*` : protocole OAuth pour récupérer le refresh token.

## Variables Vercel
```txt
ADMIN_PASSWORD=change-moi
YOUTUBE_API_KEY=clé_data_api
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=secret_google
YOUTUBE_REFRESH_TOKEN=refresh_token_oauth
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_ORIGINS=https://ton-site.vercel.app,http://localhost:3000
```

## OAuth
Dans Google Cloud, ajoute l’Authorized redirect URI :
```txt
https://TON-SITE.vercel.app/api/oauth/google/callback
```
Puis va sur `/admin` → Connecter YouTube Analytics → copie le refresh token dans `YOUTUBE_REFRESH_TOKEN` sur Vercel → redéploie.


## Cache & performance v56

Cette version ajoute deux niveaux de cache :

- **Cache CDN Vercel côté `/api/youtube-v3`** : les réponses YouTube Data API sont conservées 6h (`s-maxage=21600`) avec `stale-while-revalidate` 24h.
- **Cache navigateur Cache Storage** : le dashboard garde les réponses API 6h dans le navigateur. Après un premier chargement complet, un reload doit être beaucoup plus rapide.

Conséquence :
- premier chargement d'une grosse chaîne = peut encore prendre du temps ;
- rechargements suivants = beaucoup plus rapides ;
- autres utilisateurs peuvent bénéficier du cache CDN si les mêmes requêtes ont déjà été faites.

Pour forcer une mise à jour complète : vider le cache du navigateur ou attendre 6h.


## v57 Responsive tactile
- Ajout d'une couche responsive pour smartphone et tablette.
- Sidebar transformée en navigation horizontale tactile sur petits écrans.
- Cartes, filtres, onglets, tableaux et admin optimisés pour le touch.
- Desktop inchangé autant que possible.

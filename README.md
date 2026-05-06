# FTV Dashboard v64 — UX polish + dark mode + clickable videos

Cette version part de la v63 fonctionnelle et ajoute :

- correction responsive de l’onglet Copilot IA sur desktop ;
- amélioration mobile/tablette plus robuste ;
- menu burger toujours visible sur écrans tactiles ;
- dark mode persistant via localStorage ;
- accès Console admin déplacé dans le menu burger ;
- suppression de l’encadré Console admin dans l’onglet Analytics ;
- vidéos cliquables vers YouTube sans lien bleu visible ;
- routes OAuth plates conservées : `/api/oauth-start` et `/api/oauth-callback`.

## Structure attendue

```txt
api/
public/
README.md
package.json
vercel.json
```

## Tests après déploiement

```txt
/api/health
/
/admin.html
/api/oauth-start
```

# FTV Dashboard v62 — AI Predictive Media Copilot

Base v61 conservée : dashboard client, admin, backend Vercel Hobby en une seule fonction, snapshot + live refresh.

## Nouveautés v62

- Nouvel onglet **🧠 Copilot IA** dans le dashboard.
- Module `public/modules/predictionEngine.js` : score de potentiel, probabilité de viralité, projections 24h/J+7/J+30, confiance, comparaison aux vidéos similaires.
- Module `public/modules/syntheticMediaData.js` : scénarios synthétiques plausibles.
- Module `public/modules/aiMediaCopilot.js` : lecture stratégique média exploitable.
- UI premium compatible desktop/mobile/tablette.
- Architecture future-ready pour CTR, watch time, rétention, impressions, sources de trafic.

## Structure obligatoire

```txt
api/
  [...path].js
public/
  index.html
  admin.html
  modules/
    predictionEngine.js
    syntheticMediaData.js
    aiMediaCopilot.js
package.json
vercel.json
README.md
```

## Variables Vercel

Conserver les variables déjà créées :

```txt
ADMIN_PASSWORD=...
YOUTUBE_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
ANTHROPIC_API_KEY=...
ALLOWED_ORIGINS=https://data-dashboard-mocha-iota.vercel.app,http://localhost:3000
```

## Tests après déploiement

```txt
/api/health
/api/snapshot-channel?channel=sport
/admin.html
```

## Note produit

Les prédictions sont des estimations probabilistes : elles enrichissent l'aide à la décision mais ne sont pas des vérités absolues. Les données YouTube Analytics détaillées pourront renforcer les scores quand CTR/watch time/rétention seront disponibles.


## Correctif v63 OAuth

Pour éviter les 404 sur les routes imbriquées OAuth, le bouton admin utilise maintenant des routes plates :

- Start OAuth : `/api/oauth-start`
- Callback OAuth : `/api/oauth-callback`

Dans Google Cloud → OAuth Client → URI de redirection autorisés, ajoute exactement :

`https://data-dashboard-mocha-iota.vercel.app/api/oauth-callback`

Tu peux garder l'ancienne URL `/api/oauth/google/callback`, mais la nouvelle route plate est celle à utiliser.

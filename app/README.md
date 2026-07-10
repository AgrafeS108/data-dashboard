# YouTube Channel Data Viewer

Le dossier **`app/` est la racine du projet à déployer**, comme pour le Data Dashboard.

## Structure

```text
app/
├── api/
│   ├── resolve-channel.js
│   ├── channel-videos.js
│   ├── videos.js
│   └── health.js
├── lib/
│   ├── youtube.js
│   └── http.js
├── public/
│   ├── index.html
│   └── assets/
│       ├── css/app.css
│       ├── js/app.js
│       └── vendor/
│           ├── exceljs.min.js
│           └── EXCELJS-LICENSE.txt
├── tests/
├── .env.example
├── package.json
└── vercel.json
```

## Fonctionnement

1. Colle l’URL d’une chaîne YouTube.
2. L’application identifie la chaîne et sa playlist officielle d’uploads.
3. Toutes les vidéos publiques sont chargées par lots de 50.
4. Tu sélectionnes les vidéos voulues.
5. L’application génère un fichier Excel `.xlsx` avec leurs métadonnées et une feuille dédiée à la chaîne.

## Variable Vercel obligatoire

Dans **Project Settings > Environment Variables**, ajoute :

```env
YOUTUBE_API_KEY=ta_cle_youtube_data_api_v3
```

Active-la pour **Production**, **Preview** et **Development**, puis relance un déploiement.

## Déploiement

- Si ton dépôt contient le dossier père `app`, définis **Root Directory** sur `app` dans Vercel.
- Si tu envoies directement le contenu de `app`, laisse la racine du projet telle quelle.
- Ajoute `YOUTUBE_API_KEY`.
- Lance un nouveau déploiement sans réutiliser l’ancien cache si nécessaire.

## Routes API

- `GET /api/health`
- `POST /api/resolve-channel`
- `POST /api/channel-videos`
- `POST /api/videos`

Les anciennes URL imbriquées sont redirigées par `vercel.json` pour compatibilité.

Pour contrôler le déploiement, ouvre `/api/health`. La réponse attendue contient :

```json
{
  "ok": true,
  "apiKeyConfigured": true
}
```

## Lancement local

Depuis le dossier `app` :

```bash
vercel dev
```

## Tests

```bash
npm run check
```

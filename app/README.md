# YouTube Channel Data Viewer

Projet livré avec la même organisation que le Data Dashboard : le dossier **`app/` est la racine à déployer sur Vercel**.

## Structure

```text
app/
├── api/
│   ├── [...path].js
│   └── youtube.js
├── public/
│   ├── index.html
│   └── assets/
│       ├── css/app.css
│       ├── js/app.js
│       └── vendor/
│           ├── exceljs.min.js
│           └── EXCELJS-LICENSE.txt
├── tests/
│   └── channel-reference-tests.js
├── .env.example
├── .gitignore
├── package.json
└── vercel.json
```

## Fonctionnement

1. Colle l'URL d'une chaîne YouTube.
2. L'application résout la chaîne et lit sa playlist officielle d'uploads.
3. Les vidéos publiques sont chargées par pages de 50.
4. Tu sélectionnes les vidéos voulues.
5. L'application génère un fichier Excel `.xlsx` avec leurs métadonnées et une feuille dédiée à la chaîne.

## Variables Vercel

Ajoute dans **Project Settings > Environment Variables** :

```env
YOUTUBE_API_KEY=ta_cle_youtube_data_api_v3
```

Ne mets jamais la vraie clé dans les fichiers du projet.

## Déploiement comme le Data Dashboard

- importe le dépôt dans Vercel ;
- définis **Root Directory** sur `app` si ton dépôt contient le dossier père ;
- ou déploie directement le contenu de `app/` comme racine du projet ;
- ajoute `YOUTUBE_API_KEY` ;
- lance le déploiement.

## Lancement local

Depuis le dossier `app` :

```bash
vercel dev
```

Puis ouvre l'adresse indiquée par Vercel, généralement `http://localhost:3000`.

## Tests

```bash
npm run check
```

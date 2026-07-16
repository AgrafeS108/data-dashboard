# YouTube Channel Data Viewer

Le dossier **`app/` est la racine du projet à déployer**, comme pour le Data Dashboard.

## Nouveautés de cette version

- cadrage du chargement avant le lancement avec date de début, date de fin et maximum de vidéos ;
- arrêt automatique dès que le plafond ou le début de période est atteint ;
- recherche locale par titre, description, tags, métadonnées et annonceur saisi ;
- choix précis des colonnes à inclure dans Excel, avec préréglage essentiel ou sélection complète ;
- correction de la validation des cases à cocher : la sélection active est désormais mémorisée puis appliquée réellement à l’export ;
- « Date de Paris » et « Heure exacte de Paris » sont maintenant deux colonnes indépendantes ;
- observations pré-roll multiples par vidéo, avec marque et entreprise annonceuse ;
- comptage automatique du nombre de présences par marque et par entreprise ;
- deux feuilles Excel dédiées : une ligne par observation et une synthèse de tous les annonceurs.

> Le nom de l’annonceur pré-roll n’est pas fourni par l’API publique YouTube. Les publicités varient selon le spectateur, son contexte et le ciblage. Le champ prévu dans l’application est donc une saisie manuelle fiable, et non une donnée inventée.

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
│       ├── js/search.js
│       └── vendor/
├── tests/
├── .env.example
├── package.json
└── vercel.json
```

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
- Lance un nouveau déploiement.

## Routes API

- `GET /api/health`
- `POST /api/resolve-channel`
- `POST /api/channel-videos`
- `POST /api/videos`

`POST /api/channel-videos` accepte désormais aussi :

```json
{
  "publishedAfter": "2026-01-01T00:00:00.000Z",
  "publishedBefore": "2026-07-16T23:59:59.999Z",
  "limit": 500
}
```

## Lancement local

```bash
vercel dev
```

## Tests

```bash
npm run check
```


## Observations pré-roll

Chaque vidéo peut conserver plusieurs tests publicitaires manuels. La marque est le champ principal. Les autres données disponibles sont l’entreprise annonceuse, la présence ou non d’une publicité, la date, l’heure, le pays ou la localisation, le format, une preuve et des notes.

L’export Excel contient désormais :

- `Vidéos sélectionnées` : uniquement les colonnes choisies ;
- `Observations pré-roll` : une ligne pour chaque test enregistré, afin qu’aucune marque ni entreprise ne disparaisse ;
- `Synthèse annonceurs` : une ligne par couple marque / entreprise avec le nombre de présences, le nombre de vidéos concernées, les localisations, les formats et les preuves ;
- `Chaîne` : informations générales et totaux de l’export.

Les colonnes pré-roll de la feuille principale proposent aussi la marque principale, toutes les marques avec leurs nombres de présences, l’entreprise principale, toutes les entreprises avec leurs nombres de présences, ainsi que les compteurs de tests.

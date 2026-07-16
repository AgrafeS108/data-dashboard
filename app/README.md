# YouTube Channel Data Viewer + Pré-roll Collector

Le dossier **`app/` est la racine du projet à déployer**, comme pour le Data Dashboard.

## Ce que contient cette version

- chargement des vidéos d’une chaîne YouTube avec période et plafond définis avant la récupération ;
- recherche locale par mots-clés ;
- sélection des vidéos et des colonnes Excel ;
- export Excel des métadonnées YouTube ;
- observations pré-roll manuelles ;
- **extension Chrome incluse pour tester automatiquement les vidéos sélectionnées** ;
- estimation de la marque à partir du texte visible de l’annonce et du domaine de destination ;
- capture facultative de l’écran lorsqu’une publicité est détectée ;
- validation/correction de la marque dans l’extension ;
- import des observations dans le dashboard ;
- synthèse Excel de toutes les marques et entreprises avec leur nombre de présences.

## Structure

```text
app/
├── api/
│   ├── resolve-channel.js
│   ├── channel-videos.js
│   ├── videos.js
│   └── health.js
├── lib/
├── public/
│   ├── index.html
│   ├── assets/
│   └── downloads/
│       └── yt-preroll-collector-extension.zip
├── extension/
│   ├── manifest.json
│   ├── service-worker.js
│   ├── content.js
│   ├── shared.js
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── icons/
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

## Installer l’extension Chrome

Deux possibilités :

1. depuis le site déployé, ouvre **Collecte pré-roll** puis télécharge l’extension ;
2. depuis le projet local, utilise directement le dossier `app/extension`.

Installation manuelle :

1. ouvre `chrome://extensions` ;
2. active **Mode développeur** ;
3. clique sur **Charger l’extension non empaquetée** ;
4. sélectionne le dossier `yt-preroll-collector-extension` décompressé, ou directement `app/extension`.

## Workflow de collecte pré-roll

1. Charge une chaîne et sélectionne les vidéos à tester.
2. Clique sur **Collecte pré-roll**.
3. Télécharge la file JSON des vidéos sélectionnées.
4. Ouvre l’extension Chrome et importe cette file.
5. Choisis la durée maximale de test, la localisation et les captures.
6. Démarre la collecte.
7. L’extension ouvre chaque vidéo une seule fois et observe le pré-roll réellement servi.
8. Vérifie ou corrige la marque dans les résultats de l’extension.
9. Exporte les observations JSON.
10. Réimporte ce fichier dans le dashboard.
11. Exporte l’Excel avec les colonnes souhaitées.

## Données automatiques ajoutées

Pour chaque observation collectée par l’extension :

- marque estimée ;
- entreprise annonceuse estimée ;
- publicité détectée ou non ;
- date et heure ;
- localisation choisie ;
- format estimé ;
- score de confiance ;
- méthode de détection ;
- domaine et URL de destination lorsqu’ils sont visibles ;
- texte publicitaire détecté ;
- référence de la capture ;
- identifiant du run de collecte.

Ces variables sont disponibles dans les options de la feuille principale et dans la feuille détaillée **Observations pré-roll**. La feuille **Synthèse annonceurs** agrège les présences par couple marque / entreprise.

## Limites importantes

- YouTube ne fournit pas le nom de l’annonceur par API.
- L’extension observe la publicité réellement affichée pour le navigateur, le compte, le pays et le moment du test.
- Une même vidéo peut servir plusieurs annonceurs différents ou aucune publicité.
- La marque est estimée automatiquement à partir du texte visible et du domaine de destination ; les cas à faible confiance doivent être validés avec la capture.
- L’extension effectue un seul test par vidéo et ne boucle pas les lectures.
- Les sélecteurs visuels de YouTube peuvent évoluer ; les tests inclus vérifient la structure et les heuristiques, mais pas la diffusion réelle d’une publicité.

## Routes API

- `GET /api/health`
- `POST /api/resolve-channel`
- `POST /api/channel-videos`
- `POST /api/videos`

## Lancement local

```bash
vercel dev
```

## Tests

```bash
npm run check
```

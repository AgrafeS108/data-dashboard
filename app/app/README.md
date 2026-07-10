# YouTube Channel Data Viewer

Application web permettant de coller **une seule URL de chaîne YouTube**, de récupérer toutes ses vidéos publiques, de sélectionner les vidéos voulues et de télécharger leurs métadonnées dans un véritable fichier Excel `.xlsx`.

## Fonctionnalités

- URL de chaîne `youtube.com/@handle`
- Identifiant direct `youtube.com/channel/UC…`
- Anciens liens `/user/…`
- Prise en charge de la plupart des anciens liens personnalisés `/c/…`
- Chargement progressif de toutes les vidéos publiques de la chaîne
- Vidéos classiques, Shorts et lives publics
- Recherche par titre, description, identifiant ou tag
- Tri par date, vues ou likes
- Pagination jusqu’à 100 vidéos par page
- Sélection d’une vidéo, d’une page ou de tous les résultats filtrés
- Sélection conservée lors des changements de page et de filtre
- Export Excel uniquement des vidéos sélectionnées
- Affichage détaillé des métadonnées de chaque vidéo
- Mode clair et sombre
- Clé API conservée uniquement côté serveur

## Contenu du fichier Excel

Le classeur contient deux feuilles.

### `Vidéos sélectionnées`

Pour chaque vidéo :

- titre et URL YouTube ;
- identifiants vidéo et chaîne ;
- date et heure exacte de publication au format ISO 8601 UTC ;
- date UTC, heure UTC et date/heure de Paris ;
- vues, likes et commentaires ;
- taux d’engagement calculé ;
- durée lisible, durée ISO et durée en secondes ;
- statut live, définition et sous-titres ;
- catégorie, langues, tags et description ;
- miniature, licence, intégration et statut enfants ;
- éventuelles restrictions géographiques.

### `Chaîne`

Nom, URL, identifiant, abonnés, vues, nombre de vidéos, date de création, pays, langue, description et nombre de vidéos exportées.

## Fonctionnement technique

L’application :

1. résout l’URL avec `channels.list` ;
2. récupère l’identifiant de la playlist d’uploads dans `contentDetails.relatedPlaylists.uploads` ;
3. parcourt cette playlist avec `playlistItems.list`, 50 éléments par requête ;
4. enrichit chaque lot avec `videos.list` ;
5. crée le fichier Excel directement dans le navigateur avec ExcelJS.

Cette méthode évite `search.list` pour les URL modernes contenant un `@handle`. Les anciens liens personnalisés peuvent nécessiter une recherche de secours plus coûteuse en quota.

Documentation officielle :

- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/playlistItems/list
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.google.com/youtube/v3/determine_quota_cost

## Installation locale

Pré-requis : Node.js 20 ou plus récent.

```bash
npm install
```

Duplique `.env.example` en `.env`, puis ajoute ta clé YouTube Data API v3 :

```env
YOUTUBE_API_KEY=TA_CLE_YOUTUBE
PORT=3000
```

Lance ensuite l’application :

```bash
npm run dev
```

Ouvre :

```text
http://localhost:3000
```

## Créer une clé API YouTube

1. Crée ou ouvre un projet dans Google Cloud Console.
2. Active **YouTube Data API v3**.
3. Crée une clé API dans **APIs et services > Identifiants**.
4. Restreins idéalement cette clé à YouTube Data API v3.
5. Place-la dans `.env` ou dans les variables d’environnement de ton hébergeur.

## Déploiement Vercel

1. Envoie le dossier sur GitHub.
2. Importe le dépôt dans Vercel.
3. Ajoute la variable d’environnement `YOUTUBE_API_KEY`.
4. Déploie.

Les fonctions Vercel sont volontairement courtes : le navigateur demande les vidéos lot par lot, ce qui évite qu’une chaîne volumineuse doive être traitée dans une seule fonction serveur.

## Limites

- Seules les données publiques accessibles avec une clé API sont récupérées.
- Les vidéos privées, supprimées ou indisponibles peuvent apparaître comme éléments illisibles de la playlist.
- Les compteurs correspondent à l’état des données au moment du chargement.
- La quantité de chaînes et de vidéos analysables dépend du quota quotidien du projet Google Cloud.
- L’heure ISO UTC exportée est la valeur exacte renvoyée par `snippet.publishedAt`.

## Vérification du code

```bash
npm run check
```

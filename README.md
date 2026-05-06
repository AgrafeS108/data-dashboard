# FTV Dashboard — v58 hybride live + snapshot + mobile

## Ce que fait cette version

- Le dashboard client n'appelle plus les grosses APIs au reload.
- Il lit d'abord un **snapshot serveur** via `/api/snapshot-channel`.
- Si le snapshot est déjà chaud dans le cache Vercel, l'affichage est quasi instantané.
- Ensuite, en arrière-plan, le client lance un refresh léger via `/api/live-stats` pour mettre à jour uniquement les métriques publiques très fraîches : vues, likes, commentaires.
- Les données Analytics privées restent en snapshot / backend, car YouTube Analytics n'est pas du vrai temps réel.
- Le cron `/api/cron/preload-all` préchauffe les snapshots automatiquement chaque jour.

## Structure obligatoire

```txt
api/
public/
  index.html
  admin.html
README.md
package.json
vercel.json
```

## Variables Vercel nécessaires

```txt
ADMIN_PASSWORD=...
YOUTUBE_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
ANTHROPIC_API_KEY=...
ALLOWED_ORIGINS=https://ton-site.vercel.app,http://localhost:3000
```

Optionnel, mais recommandé pour sécuriser le cron manuel :

```txt
CRON_SECRET=une_phrase_secrete
```

## URLs utiles

Admin :
```txt
/admin.html
```

Test snapshot :
```txt
/api/snapshot-channel?channel=sport
```

Test live stats :
```txt
/api/live-stats?ids=VIDEO_ID
```

Preload manuel :
```txt
/api/cron/preload-all
```

## Important

Le premier chargement d'une chaîne peut encore être long si le snapshot n'a jamais été généré.
Ensuite, le cache Vercel + cache navigateur accélèrent fortement.
Le cron Vercel préchauffe automatiquement une fois par jour sur plan Hobby.

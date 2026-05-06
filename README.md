# FTV Dashboard v60 — single API function

Version corrigée pour le plan Hobby Vercel : toutes les routes backend sont fusionnées dans `api/[...path].js`.

Structure attendue :

```txt
api/
  [...path].js
public/
  index.html
  admin.html
README.md
package.json
vercel.json
```

Tests après déploiement :

```txt
/api/health
/api/admin-status
/api/snapshot-channel?channel=sport
/api/cron/preload-all
```

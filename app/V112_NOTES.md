# v112 — Rebuild moteur données admin-first

Objectif : supprimer le cache comme source de vérité et déplacer le travail lourd côté console admin.

## Changements clés
- Cache Vercel/CDN supprimé (`no-store` partout sur les routes données).
- Cache navigateur `CacheStorage` supprimé/ignoré.
- Cache vidéo `localStorage` désactivé côté dashboard client.
- Le dashboard client lit `/api/dashboard-data`, qui renvoie uniquement la dernière donnée stockée par l'admin.
- Nouvelle route admin `/api/admin-refresh-data` : va chercher YouTube Data + YouTube Analytics puis stocke dans Supabase.
- Nouvelles tables Supabase : `dashboard_channel_snapshots` et `dashboard_analytics_snapshots`.
- La console admin déclenche l'actualisation live chaîne par chaîne ou globale.
- Les routes historiques `/api/snapshot-channel` et `/api/snapshot` lisent désormais le stockage admin, pas YouTube directement.

## À faire au déploiement
1. Exécuter le bloc SQL v112 ajouté dans `supabase/schema.sql`.
2. Déployer sur Vercel.
3. Ouvrir `/admin.html`.
4. Cliquer `Actualiser toutes les données`.
5. Vérifier dans les logs : `ok:true`, `videos`, `lastVideoPublishedAt`, `analytics.ytd.ok`.
6. Ouvrir le dashboard client : il doit afficher `storedUpdatedAt` récent et les vidéos stockées par l'admin.

## Limite de test local
La syntaxe JS/Node a été testée localement. Le test réel YouTube/Supabase nécessite les variables Vercel et l'accès réseau de production.

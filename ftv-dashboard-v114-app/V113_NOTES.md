# V113 — admin source of truth stabilisé

## Correction principale
Les snapshots par chaîne ne sont plus écrits en un seul énorme JSONB.
Ils sont stockés en chunks dans `dashboard_snapshot_chunks`, puis reconstruits côté API client.

Pourquoi : Supabase/PostgREST timeoutait sur les chaînes lourdes, notamment franceinfo et slash.

## Ce que ça ne corrige pas automatiquement
`invalid_grant` sur YouTube Analytics signifie que `YOUTUBE_REFRESH_TOKEN` est invalide/révoqué/ancien.
Il faut relancer OAuth depuis `/admin.html`, copier le nouveau refresh token dans Vercel, puis redéployer.

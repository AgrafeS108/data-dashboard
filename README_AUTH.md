# v85 — Auth Supabase + gestion utilisateurs

Cette version ajoute une vraie authentification dashboard avec Supabase Auth et une table `profiles` pilotée depuis la console admin.

## Variables Vercel nécessaires

Ajoute ces variables dans Vercel → Project → Settings → Environment Variables → Production :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Garde aussi :

- `ADMIN_PASSWORD`
- `YOUTUBE_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `ANTHROPIC_API_KEY`
- `ALLOWED_ORIGINS`

## SQL Supabase

Exécute le fichier :

```txt
supabase/schema.sql
```

dans Supabase → SQL Editor.

## Premier utilisateur

1. Déploie la v85.
2. Ouvre `/admin.html`.
3. Connecte-toi avec `ADMIN_PASSWORD`.
4. Va dans l'onglet `Utilisateurs`.
5. Crée ton propre compte avec rôle `admin`.
6. Va sur `/` et connecte-toi avec ce compte.

## Sécurité

- Les mots de passe sont gérés par Supabase Auth.
- La `SUPABASE_SERVICE_ROLE_KEY` reste uniquement côté serveur dans Vercel.
- Le client ne voit jamais les secrets.
- Les routes data du dashboard vérifient une session active.


## v87 — rôles effectifs côté dashboard

Les rôles sont maintenant visibles et appliqués côté interface :

- admin : accès complet, lien Console admin, exports et analyses Claude.
- editor : accès dashboard, exports et analyses Claude, pas de lien Console admin.
- viewer : lecture seule, pas d’export, pas de bouton Claude, pas de lien Console admin.

Le backend protège déjà les routes sensibles : /api/claude nécessite admin ou editor. La console admin reste protégée par ADMIN_PASSWORD comme accès maître.

La page de connexion reprend le design premium historique du dashboard, mais utilise Supabase Auth pour vérifier email/mot de passe.

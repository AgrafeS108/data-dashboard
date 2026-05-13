# FTV Dashboard v94 — améliorations décisionnelles

Cette version ajoute :

- un nouvel onglet desktop `Alertes` orienté décision ;
- un comparateur événement A vs B ;
- une watchlist synchronisable via Supabase (`user_watchlist`) ;
- un durcissement backend : YouTube Analytics et Claude sont réservés aux rôles `admin` / `editor` ;
- conservation des optimisations de chargement v93.

## SQL à lancer dans Supabase

Si la table `user_watchlist` n'existe pas, lance le contenu de `supabase/schema.sql` ou au minimum la section V94.

## Fichiers principaux modifiés

- `public/index.html`
- `api/[...path].js`
- `supabase/schema.sql`

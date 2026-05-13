# FTV Dashboard v75

Version mobile v74 conservée visuellement + calendrier centré, recherche effaçable et filtre de type contenu clarifié.


## v81 — Full Professional Redesign

Cette version conserve le backend/API/OAuth/admin de la v80 et ne reconstruit pas la logique métier.
Le redesign desktop est centralisé dans `public/styles/desktop.css` pour éviter d'empiler des patchs inline dans `index.html`.
La version mobile validée reste inchangée.

Objectifs UX :
- interface desktop plus sobre et professionnelle ;
- cartes plus lisibles ;
- sidebar plus claire ;
- onglets plus propres ;
- tableaux Analytics plus exploitables ;
- dark mode conservé ;
- aucune modification des routes API Vercel.

## v85 Auth Supabase

Voir `README_AUTH.md` et `supabase/schema.sql`.

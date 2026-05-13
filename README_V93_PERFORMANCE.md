# v93 — Performance loading optimization

Cette version réduit le chargement sans modifier l'UI validée :

- snapshot serveur allégé : descriptions et tags tronqués côté API pour réduire le poids JSON ;
- cache mémoire serveur warm sur les snapshots quand la fonction Vercel reste chaude ;
- écriture localStorage différée après le premier rendu pour éviter les freezes ;
- refresh live limité aux vidéos prioritaires récentes/top vues au lieu de toute la chaîne ;
- refresh live silencieux en arrière-plan pour ne pas bloquer l'ouverture du dashboard.

Fichiers modifiés :
- `api/[...path].js`
- `public/index.html`

Test : ouvrir `/?v=93` après déploiement.

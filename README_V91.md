# v91 — Intelligence opérationnelle

Cette version ajoute une couche Copilot plus décisionnelle, sans modifier le backend Supabase/Auth.

Ajouts principaux :
- Alertes intelligentes par chaîne active
- Comparateur d’évènements multi-années
- Watchlist événementielle persistante en localStorage
- Top actions IA éditoriales
- Qualité éditoriale des vidéos
- Brief prêt à copier
- Indice de dépendance événementielle
- Saisonnalité mensuelle
- Routes OAuth explicites conservées : /api/oauth-start et /api/oauth-callback

Installation recommandée : remplacer au minimum public/index.html et ajouter api/oauth-start.js + api/oauth-callback.js si absents.

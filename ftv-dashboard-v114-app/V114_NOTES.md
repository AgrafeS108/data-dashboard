# v114 — Rebuild classification title-first

Objectif : rendre la classification beaucoup plus robuste.

Changements :
- nouveau moteur `v114-classification-title-first` injecté avant le rendu React ;
- priorité forte au titre, puis description/tags uniquement en confirmation ;
- règles explicites pour football, rugby, tennis, tennis de table, cyclisme, athlétisme, natation, basket, handball, volley, combat, hiver, moteurs, golf, surf, gymnastique, e-sport ;
- garde-fou anti Tennis fourre-tout, notamment tennis de table / Lebrun / WTT ;
- fallback conservé vers v113 seulement si le résultat est cohérent ;
- cache classification invalidable et version exposée dans `window.FTV_CLASSIFICATION_VERSION`.

À faire après déploiement :
1. vider localStorage/cache navigateur si l’ancienne classification reste visible ;
2. réactualiser les chaînes depuis l’admin ;
3. vérifier les catégories sur SPORT, franceinfo et slash.

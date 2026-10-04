# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

PWA hors ligne de gestion des Wi-Fi Zones CISPOLstore (vente de vouchers, rapport journalier, tableau de bord), dérivée du business plan CISPOLstore-Bandundu 2026. JavaScript vanilla sans framework ni étape de build : `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`.

## Commandes

- `npm start` : sert le dossier sur http://localhost:8080 (le service worker exige http(s), pas `file://`).
- `npm test` / `node tests/e2e.mjs [dossierCaptures]` : test de bout en bout Playwright/Chromium avec son propre serveur HTTP. C'est un seul scénario séquentiel : pour tester une partie isolée, commentez les étapes suivantes ou ajoutez des assertions à la suite.
- `npm run icons` : régénère `icons/icon-192.png` et `icon-512.png` à partir de `icons/icon.svg`.

## Architecture (`app.js`)

Une IIFE découpée en sections `// ---------- X ----------` :

- **Storage** : IndexedDB `cispolstore` (stores `meta`, `agents`, `zones`, `sales`, `incidents`, clé `id`), chargé entièrement en mémoire dans `db` au démarrage. Chaque écriture fait `put()` en base puis met à jour `db`. Les réglages sont un seul document `meta/settings` (tarifs, charges, taux, panier moyen, `launchMonth`, `targets`).
- **Domain** : `salesWhere()` filtre (exclut les ventes annulées sauf `includeVoid`) et `summarize()` calcule clients, cash, mm, gratuits et `byTariff`. Une vente copie `tariffLabel`, `price` et `minutes` au moment de la vente, donc modifier la grille ne change pas l'historique. `byTariff` est indexé par libellé. Seuil de rentabilité = `ceil(charges mensuelles / (panier moyen × 30))`, multiplié par le nombre de zones quand on regarde « Toutes les zones ».
- **Session & PIN** : PIN haché (SHA-256 + sel, repli FNV hors contexte sécurisé), `pinLen` stocké pour la saisie automatique, blocage de 30 s après 5 échecs, verrouillage après 5 min d'inactivité (`sessionStorage`).
- **Router** : `location.hash` (`#/vendre`, `#/rapport`, `#/tableau`, `#/reglages`). Chaque écran est une fonction `renderX()` qui réécrit `#view` en template strings puis rebranche ses écouteurs. L'état d'interface entre deux rendus est dans `ui`. `#/tableau` et `#/reglages` sont réservés au rôle `gerant` (contrôle dans `route()`).
- **Export** : CSV avec séparateur `;` et BOM pour Excel en français, et sauvegarde JSON (`app: 'cispolstore-gestion'`) que `restoreBackup()` vérifie.

## Points d'attention

- Toute donnée saisie par l'utilisateur injectée dans le HTML doit passer par `esc()`.
- Après toute modification d'un fichier listé dans `ASSETS`, incrémenter `VERSION` dans `sw.js`, sinon les téléphones gardent l'ancienne version en cache.
- Les dates des ventes sont stockées en `day` local (`YYYY-MM-DD`) et `at` ISO. Les rapports filtrent sur `day`.
- Les annulations ne suppriment rien : `void`, `voidReason`, `voidAt`, `voidBy`.

## Conventions

Interface, README et messages de commit en français ; commentaires du code en anglais.

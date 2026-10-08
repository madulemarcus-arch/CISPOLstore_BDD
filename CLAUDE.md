# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

PWA hors ligne de gestion des Wi-Fi Zones CISPOLstore (vente de vouchers, rapport journalier, tableau de bord), dérivée du business plan CISPOLstore-Bandundu 2026. JavaScript vanilla sans framework ni étape de build : `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`.

## Commandes

- `npm start` : sert le dossier sur http://localhost:8080 (le service worker exige http(s), pas `file://`).
- `npm test` / `node tests/e2e.mjs [dossierCaptures]` : test de bout en bout Playwright/Chromium avec son propre serveur HTTP. C'est un seul scénario séquentiel : pour tester une partie isolée, commentez les étapes suivantes ou ajoutez des assertions à la suite.
- `npm run icons` : régénère `icons/icon-192.png`, `icon-512.png` et `logo-mark.png` à partir du logo `icons/logo-source.png` (zone du symbole définie par `MARK` dans `tests/icons.mjs`).

## Architecture (`app.js`)

Une IIFE découpée en sections `// ---------- X ----------` :

- **Storage** : IndexedDB `cispolstore` version 2 (stores `meta`, `agents`, `zones`, `sales`, `incidents`, `tickets`, clé `id`), chargé entièrement en mémoire dans `db` au démarrage. Chaque écriture fait `put()` en base puis met à jour `db`. Les réglages sont un seul document `meta/settings` (tarifs, charges, taux, panier moyen, `launchMonth`, `targets`).
- **Domain** : `salesWhere()` filtre (exclut les ventes annulées sauf `includeVoid`) et `summarize()` calcule clients, cash, mm, gratuits et `byTariff`. Une vente copie `tariffLabel`, `price` et `minutes` au moment de la vente, donc modifier la grille ne change pas l'historique. `byTariff` est indexé par libellé. Seuil de rentabilité = `ceil(charges mensuelles / (panier moyen × 30))`, multiplié par le nombre de zones quand on regarde « Toutes les zones ».
- **Session & PIN** : PIN haché (SHA-256 + sel, repli FNV hors contexte sécurisé), `pinLen` stocké pour la saisie automatique, blocage de 30 s après 5 échecs, verrouillage après 5 min d'inactivité (`sessionStorage`).
- **Tickets MikroTik** : un ticket (`tickets`) a un `status` `stock` → `sold` (à la vente, `saleId`) ou `void` (vente annulée : jamais remis en stock). Les lots sont regroupés par `batchId`/`batchLabel` (`L<AAAAMMJJ>-NN`). Si `settings.mikrotik.enabled`, `renderSell()` prend le plus ancien ticket en stock de la zone et du forfait. Un code saisi à la main qui correspond à un ticket impose son forfait. `rscFor()` génère le script RouterOS : profil `cispol-<idForfait>` (`shared-users=1`, `rate-limit` facultatif), puis un `:do { /ip hotspot user add … limit-uptime=… } on-error={}` par ticket pour qu'une réimportation soit sans effet. Tout ce qui part au routeur passe par `ascii()`/`rosStr()` (RouterOS gère mal l'UTF-8). `loginHtml()` produit la page `hotspot/login.html` (variables `$(…)` de MikroTik, connexion CHAP via `/md5.js` du routeur, mot de passe = code).
- **Router** : `location.hash` (`#/vendre`, `#/rapport`, `#/tickets`, `#/tableau`, `#/reglages`). Chaque écran est une fonction `renderX()` qui réécrit `#view` en template strings puis rebranche ses écouteurs. L'état d'interface entre deux rendus est dans `ui`. `#/tickets`, `#/tableau` et `#/reglages` sont réservés au rôle `gerant` (contrôle dans `route()`).
- **Export** : CSV avec séparateur `;` et BOM pour Excel en français, et sauvegarde JSON (`app: 'cispolstore-gestion'`) que `restoreBackup()` vérifie.

## Points d'attention

- Toute donnée saisie par l'utilisateur injectée dans le HTML doit passer par `esc()`.
- Après toute modification d'un fichier listé dans `ASSETS`, incrémenter `VERSION` dans `sw.js`, sinon les téléphones gardent l'ancienne version en cache.
- Les dates des ventes sont stockées en `day` local (`YYYY-MM-DD`) et `at` ISO. Les rapports filtrent sur `day`.
- Les annulations ne suppriment rien : `void`, `voidReason`, `voidAt`, `voidBy`.
- Un changement de schéma IndexedDB demande d'incrémenter la version dans `openDb()` et de migrer les réglages au démarrage (voir le bloc « data created by v1 » dans Boot).
- Les scripts `.rsc` et `login.html` ne peuvent pas être testés ici sans routeur : le test e2e vérifie leur contenu, pas leur exécution par RouterOS.

## Charte graphique

Couleurs du logo CispolStore, en variables CSS dans `styles.css` : bleu marine `#1e435e` (`--accent`, boutons, titres), orange `#d85833` (`--brand-orange`, « Store », onglet actif, bordure des vouchers), jaune `#e5af42` (`--brand-yellow`). `brandHtml()` affiche le nom avec « Store » en orange. `login.html` (Hotspot) reprend ces couleurs en dur et embarque le logo en data URI, car le client n'a pas Internet avant de se connecter.

## Compétences (skills)

`.claude/skills/find-skills/` : compétence « find-skills » de `vercel-labs/skills`, copiée telle quelle pour être chargée à chaque session. Elle aide à chercher et installer d'autres compétences (`npx skills find …`). Pour la mettre à jour, réexécuter `npx skills add https://github.com/vercel-labs/skills --skill find-skills` et recopier son `SKILL.md` ici. Relire une compétence avant de l'ajouter : elle s'exécute avec tous les droits de l'agent.

Compétences propres à CispolStore (écrites pour ce projet, en français, destinées au gérant) :
- `bilan-mensuel/` : bilan du mois à partir de l'export CSV des ventes. Les calculs passent par `scripts/bilan.py` (Python 3, sans dépendance) ; les repères du business plan sont dans `references/plan.md`. Si le format de l'export change dans `exportSalesCsv()` (`app.js`), mettre à jour le script.
- `mikrotik-nouveau-routeur/` : configuration pas à pas d'un MikroTik en Hotspot CispolStore, générateur de configuration complète par modèle (`scripts/generer_config.py`, table `MODELES`) et dépannage (`references/depannage.md`). Doit rester cohérent avec `rscFor()` et `loginHtml()` (profils `cispol-*`, connexion CHAP, dossier `hotspot`). Les scripts RouterOS générés n'ont pas été testés sur un vrai routeur depuis ce dépôt.
- `ouverture-zone/` : décision, choix d'emplacement, budget, checklist et mise en place d'une nouvelle zone (`references/reperes.md`).

## Conventions

Interface, README et messages de commit en français ; commentaires du code en anglais.

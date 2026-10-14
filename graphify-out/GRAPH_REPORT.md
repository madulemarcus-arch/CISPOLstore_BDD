# Graph Report - CISPOLstore_BDD  (2026-10-14)

## Corpus Check
- 16 files · ~27,409 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .webmanifest 1, .css 1)

## Summary
- 192 nodes · 302 edges · 19 communities (18 shown, 1 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `893affd5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- bilan.py
- e2e.mjs
- Nouveau routeur MikroTik pour une Wi-Fi Zone CispolStore
- Find Skills
- package.json
- renderSell
- Dépannage Hotspot CispolStore
- generer_config.py
- Ouverture d'une nouvelle Wi-Fi Zone CispolStore
- CLAUDE.md
- Repères du business plan CISPOLstore-Bandundu (sept. 2026)
- Repères chiffrés (business plan CISPOLstore-Bandundu, sept. 2026)
- renderLogin
- route
- CISPOLstore Gestion
- Bilan mensuel CispolStore
- showVoucher
- sw.js

## God Nodes (most connected - your core abstractions)
1. `renderTickets()` - 14 edges
2. `Nouveau routeur MikroTik pour une Wi-Fi Zone CispolStore` - 14 edges
3. `renderSell()` - 12 edges
4. `route()` - 11 edges
5. `renderReport()` - 11 edges
6. `toast()` - 9 edges
7. `renderSettings()` - 9 edges
8. `editAgent()` - 9 edges
9. `Dépannage Hotspot CispolStore` - 9 edges
10. `renderDashboard()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Architecture (`app.js`)` --references--> `route()`  [INFERRED]
  CISPOLstore_BDD/CLAUDE.md → CISPOLstore_BDD/app.js
- `Architecture (`app.js`)` --references--> `rscFor()`  [INFERRED]
  CISPOLstore_BDD/CLAUDE.md → CISPOLstore_BDD/app.js
- `Architecture (`app.js`)` --references--> `loginHtml()`  [INFERRED]
  CISPOLstore_BDD/CLAUDE.md → CISPOLstore_BDD/app.js
- `Architecture (`app.js`)` --references--> `restoreBackup()`  [INFERRED]
  CISPOLstore_BDD/CLAUDE.md → CISPOLstore_BDD/app.js
- `Points d'attention` --references--> `openDb()`  [INFERRED]
  CISPOLstore_BDD/CLAUDE.md → CISPOLstore_BDD/app.js

## Import Cycles
- None detected.

## Communities (19 total, 1 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.21
Nodes (17): batchCsv(), batches(), createBatch(), download(), downloadRsc(), exportDailyCsv(), exportSalesCsv(), loadAll() (+9 more)

### Community 1 - "bilan.py"
Cohesion: 0.20
Nodes (8): analyse(), fc(), load(), main(), markdown(), months_between(), to_int(), usd()

### Community 2 - "e2e.mjs"
Cohesion: 0.12
Nodes (7): playwright, errors, json, server, TYPES, dir, MARK

### Community 3 - "Nouveau routeur MikroTik pour une Wi-Fi Zone CispolStore"
Cohesion: 0.13
Nodes (14): 0. Avant de commencer : ce qu'il faut savoir, 1. Remise à zéro et sécurité de base, 2. Internet (Starlink), 3. Wi-Fi, 4. Hotspot, 5. Page de connexion aux couleurs CispolStore, 6. Premiers tickets, 7. Test final (obligatoire avant d'ouvrir) (+6 more)

### Community 4 - "Find Skills"
Cohesion: 0.14
Nodes (13): Common Skill Categories, Find Skills, How to Help Users Find Skills, Step 1: Understand What They Need, Step 2: Check the Leaderboard First, Step 3: Search for Skills, Step 4: Verify Quality Before Recommending, Step 5: Present Options to the User (+5 more)

### Community 5 - "package.json"
Cohesion: 0.17
Nodes (11): description, devDependencies, playwright, name, private, scripts, icons, start (+3 more)

### Community 6 - "renderSell"
Cohesion: 0.33
Nodes (10): dailyReport(), drawChart(), renderDashboard(), renderReport(), renderSell(), reportText(), salesWhere(), summarize() (+2 more)

### Community 7 - "Dépannage Hotspot CispolStore"
Cohesion: 0.20
Nodes (9): Dépannage Hotspot CispolStore, Internet lent, « invalid username or password » avec un bon code, L'import du script .rsc échoue, La page de connexion ne s'ouvre pas, La page s'ouvre mais reste blanche ou sans style / le bouton ne fait rien, Le routeur ne répond plus après une modification, Les tickets fonctionnent avant d'être vendus (+1 more)

### Community 8 - "generer_config.py"
Cohesion: 0.56
Nodes (5): ascii_only(), cle_modele(), generer(), main(), ros_str()

### Community 9 - "Ouverture d'une nouvelle Wi-Fi Zone CispolStore"
Cohesion: 0.22
Nodes (8): Ce que tu produis, Ouverture d'une nouvelle Wi-Fi Zone CispolStore, Étape 1 : faut-il ouvrir maintenant ?, Étape 2 : choisir l'emplacement, Étape 3 : checklist avant achat (Annexe A), Étape 4 : budget, Étape 5 : calendrier, Étape 6 : mise en place dans l'appli et sur le routeur

### Community 10 - "CLAUDE.md"
Cohesion: 0.25
Nodes (6): openDb(), Charte graphique, Commandes, Conventions, Points d'attention, Projet

### Community 11 - "Repères du business plan CISPOLstore-Bandundu (sept. 2026)"
Cohesion: 0.25
Nodes (7): Grille tarifaire de lancement (FC), Hypothèses, Repères du business plan CISPOLstore-Bandundu (sept. 2026), Risques et réponses (§8), Règles de décision, Résultat indicatif du plan (panier 750 FC, charges 1 100 000 FC), Trajectoire (objectif clients payants/jour, mois 1 à 12)

### Community 12 - "Repères chiffrés (business plan CISPOLstore-Bandundu, sept. 2026)"
Cohesion: 0.25
Nodes (7): Budget d'investissement par zone (USD), Calendrier type (plan §9), Charges mensuelles par zone (FC), Effet d'un partenariat 70/30 (exemple de calcul), Plan d'expansion, Repères chiffrés (business plan CISPOLstore-Bandundu, sept. 2026), Seuil et trajectoire

### Community 13 - "renderLogin"
Cohesion: 0.33
Nodes (7): checkPin(), defaultSettings(), hashPin(), renderLogin(), renderSetup(), setPin(), touchSession()

### Community 14 - "route"
Cohesion: 0.62
Nodes (7): closeModal(), editAgent(), lock(), renderSettings(), restoreBackup(), route(), toast()

### Community 15 - "CISPOLstore Gestion"
Cohesion: 0.29
Nodes (6): CISPOLstore Gestion, Fonctionnalités, Limites à connaître, Mettre en place le MikroTik, Tests, Utiliser

### Community 16 - "Bilan mensuel CispolStore"
Cohesion: 0.33
Nodes (5): 1. Récupérer les données, 2. Calculer avec le script (ne pas recalculer à la main), 3. Rédiger le bilan, 4. Livrer, Bilan mensuel CispolStore

### Community 17 - "showVoucher"
Cohesion: 0.40
Nodes (5): copyText(), openModal(), shareText(), showVoucher(), voucherText()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Architecture (`app.js`)` connect `renderSell` to `app.js`, `CLAUDE.md`, `route`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `renderSell()` (e.g. with `route()` and `Architecture (`app.js`)`) actually correct?**
  _`renderSell()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `e2e.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `playwright` connect `e2e.mjs` to `package.json`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `route()` (e.g. with `app.js` and `renderSettings()`) actually correct?**
  _`route()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `Nouveau routeur MikroTik pour une Wi-Fi Zone CispolStore` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `renderSell()` connect `renderSell` to `app.js`, `showVoucher`, `route`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
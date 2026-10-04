# CISPOLstore Gestion

Application de gestion des Wi-Fi Zones CISPOLstore (Bandundu) : vente de vouchers, rapport journalier et tableau de bord. Elle remplace le classeur Excel de suivi (Annexe B du business plan 2026).

C'est une **application web installable (PWA)** : elle s'installe sur l'écran d'accueil d'un téléphone, **fonctionne sans Internet** et garde les données **sur l'appareil**.

## Fonctionnalités

- **Comptes avec code PIN** (4 à 6 chiffres) : un gérant et des agents. Après 5 PIN erronés, le compte est bloqué pendant 30 s, et l'appli se verrouille après 5 min d'inactivité.
- **Vendre** : choix du forfait, paiement en cash, Mobile Money ou gratuit. Un code unique (ex. `K7QM-3XPA`) est généré, ou on saisit le code d'un ticket imprimé par le routeur. Le code peut être copié ou envoyé au client.
- **Rapport journalier** (structure de l'Annexe B) : clients, vouchers par forfait, recettes cash et Mobile Money, total, vouchers gratuits, incidents. Il s'envoie par WhatsApp en un clic. Le gérant peut annuler une vente en indiquant un motif.
- **Tableau de bord** (gérant) :
  - clients du jour comparés au seuil de rentabilité (49/jour), CA et résultat du mois (CA − charges), panier moyen ;
  - objectif mensuel de la trajectoire sur 12 mois (§6.5) ;
  - graphique jour par jour, et répartition par forfait et par agent.
- **Réglages** (gérant) : agents, zones, grille tarifaire, taux de change, charges mensuelles, objectifs.
- **Données** : export CSV des ventes et des rapports (s'ouvre dans Excel), sauvegarde et restauration complète en `.json` pour changer de téléphone.

Les valeurs par défaut (tarifs, charges de 1 100 000 FC, taux de 2 300 FC/$, panier moyen de 750 FC, objectifs) viennent du business plan. Elles sont toutes modifiables.

## Utiliser

**Hébergé en HTTPS** (GitHub Pages, Netlify…) : ouvrez l'adresse sur le téléphone puis faites « Ajouter à l'écran d'accueil ». L'appli marche ensuite hors ligne.

**En local, pour tester** :

```bash
npm start            # http://localhost:8080
```

Ouvrir `index.html` directement (double-clic) fonctionne aussi, mais sans le mode hors ligne ni l'installation.

## Limites à connaître

- Les données sont **propres à chaque téléphone** : il n'y a pas de synchronisation entre appareils. Faites une sauvegarde `.json` régulière (Réglages → Données).
- L'appli **ne valide pas les codes sur le réseau Wi-Fi** : c'est le rôle du portail captif du routeur. Pour que les codes vendus fonctionnent, soit vous vendez les tickets générés par le routeur en saisissant leur code, soit vous ajoutez les codes générés par l'appli dans le routeur.
- Le PIN sert à séparer les agents, pas à protéger contre une personne qui aurait le téléphone et des compétences techniques.

## Tests

```bash
npm install          # installe Playwright (navigateur Chromium requis)
npm test             # parcours complet : installation, ventes, PIN, rapport, tableau de bord, exports
node tests/e2e.mjs captures/   # idem, avec des captures d'écran dans captures/
```

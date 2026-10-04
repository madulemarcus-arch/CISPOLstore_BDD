# CISPOLstore Gestion

Application de gestion des Wi-Fi Zones CISPOLstore (Bandundu) : vente de vouchers, rapport journalier et tableau de bord. Elle remplace le classeur Excel de suivi (Annexe B du business plan 2026).

C'est une **application web installable (PWA)** : elle s'installe sur l'écran d'accueil d'un téléphone, **fonctionne sans Internet** et garde les données **sur l'appareil**.

## Fonctionnalités

- **Comptes avec code PIN** (4 à 6 chiffres) : un gérant et des agents. Après 5 PIN erronés, le compte est bloqué pendant 30 s, et l'appli se verrouille après 5 min d'inactivité.
- **Vendre** : choix du forfait, paiement en cash, Mobile Money ou gratuit. L'appli prend le prochain ticket MikroTik en stock (ex. `k7qm3xpa`), ou on saisit le code d'un ticket imprimé : le forfait est alors repris du ticket. Le code peut être copié ou envoyé au client.
- **Tickets MikroTik** (gérant) : génération de lots par forfait et par zone, avec le script `.rsc` qui crée les utilisateurs Hotspot dans le routeur. On peut aussi imprimer les tickets (A4, 4 par ligne), suivre le stock (en stock, vendus, annulés) et télécharger la page de connexion `login.html` aux couleurs de CISPOLstore avec les tarifs.
- **Rapport journalier** (structure de l'Annexe B) : clients, vouchers par forfait, recettes cash et Mobile Money, total, vouchers gratuits, incidents. Il s'envoie par WhatsApp en un clic. Le gérant peut annuler une vente en indiquant un motif.
- **Tableau de bord** (gérant) :
  - clients du jour comparés au seuil de rentabilité (49/jour), CA et résultat du mois (CA − charges), panier moyen ;
  - objectif mensuel de la trajectoire sur 12 mois (§6.5) ;
  - graphique jour par jour, et répartition par forfait et par agent.
- **Réglages** (gérant) : agents, zones, grille tarifaire, taux de change, charges mensuelles, objectifs.
- **Données** : export CSV des ventes et des rapports (s'ouvre dans Excel), sauvegarde et restauration complète en `.json` pour changer de téléphone.

Les valeurs par défaut (tarifs, charges de 1 100 000 FC, taux de 2 300 FC/$, panier moyen de 750 FC, objectifs) viennent du business plan. Elles sont toutes modifiables.

## Mettre en place le MikroTik

1. Dans le routeur, configurez le **Hotspot** sur l'interface Wi-Fi (IP → Hotspot → Hotspot Setup) avec le nom de réseau choisi, par exemple « CISPOLstore WiFi ».
2. Dans l'appli, onglet **Tickets** : vérifiez le nom du réseau, puis téléchargez **login.html**. Dans Winbox, menu Files, remplacez le fichier `hotspot/login.html` par celui-ci.
3. Générez un lot de tickets (par exemple 50 tickets « 1 heure »). Le fichier `cispol-L…rsc` se télécharge.
4. Dans Winbox, glissez ce fichier dans **Files**, puis dans **New Terminal** tapez `/import file-name=cispol-L….rsc`.
5. Vérifiez dans **IP → Hotspot → Users** que les tickets apparaissent, et testez un ticket avec un téléphone avant de vendre.

Chaque ticket est limité à 1 appareil à la fois. Son temps n'est décompté que pendant la connexion (`limit-uptime`). Le débit maximal par forfait se règle dans Réglages → Grille tarifaire (ex. `1M/2M`) et s'applique aux lots suivants.

Ces scripts n'ont pas encore été testés sur un vrai routeur : faites un premier essai avec un petit lot.

## Utiliser

**Hébergé en HTTPS** (GitHub Pages, Netlify…) : ouvrez l'adresse sur le téléphone puis faites « Ajouter à l'écran d'accueil ». L'appli marche ensuite hors ligne.

**En local, pour tester** :

```bash
npm start            # http://localhost:8080
```

Ouvrir `index.html` directement (double-clic) fonctionne aussi, mais sans le mode hors ligne ni l'installation.

## Limites à connaître

- Les données sont **propres à chaque téléphone** : il n'y a pas de synchronisation entre appareils. Faites une sauvegarde `.json` régulière (Réglages → Données).
- La liaison avec le MikroTik se fait **par fichier** (étape 1) : les tickets sont créés dans le routeur en important le script d'un lot. L'appli ne lit pas encore l'utilisation réelle des tickets ; ce sera l'étape 2, avec une appli Android connectée à l'API du routeur.
- Les tickets d'un lot fonctionnent dès leur import dans le routeur, même s'ils ne sont pas encore vendus dans l'appli : gardez les tickets imprimés en lieu sûr.
- Le PIN sert à séparer les agents, pas à protéger contre une personne qui aurait le téléphone et des compétences techniques.

## Tests

```bash
npm install          # installe Playwright (navigateur Chromium requis)
npm test             # parcours complet : installation, ventes, PIN, rapport, tableau de bord, exports
node tests/e2e.mjs captures/   # idem, avec des captures d'écran dans captures/
```

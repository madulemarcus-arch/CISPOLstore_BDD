---
name: ouverture-zone
description: "Accompagne l'ouverture d'une nouvelle Wi-Fi Zone CispolStore, de la décision au lancement : vérifier que l'ouverture est justifiée (règle de discipline du business plan), comparer les emplacements candidats, budget, partenariat d'emplacement 70/30, checklist avant achat, calendrier, puis mise en place dans l'appli et sur le routeur. À utiliser dès que l'utilisateur parle d'ouvrir, lancer, dupliquer ou étendre une zone, d'un nouvel emplacement ou quartier (Basoko, Disasi, Mayoyo, près d'une université, d'un hôtel…), d'un partenaire qui propose un local, ou de l'expansion du réseau, même sans dire « ouverture »."
---

# Ouverture d'une nouvelle Wi-Fi Zone CispolStore

Le business plan CISPOLstore-Bandundu (sept. 2026) fixe une méthode prudente : **pilote → mesurer → rentabilité → réinvestir → nouvelle zone**. Ce guide aide le gérant à la suivre sans sauter d'étape. Les repères chiffrés sont dans `references/reperes.md` ; lis-le avant de donner un montant.

Adapte le niveau de détail : une question rapide (« combien coûte une zone ? ») mérite une réponse courte ; un vrai projet d'ouverture mérite le parcours complet ci-dessous, étape par étape.

## Étape 1 : faut-il ouvrir maintenant ?

La règle de discipline du plan : **une nouvelle zone seulement si la zone existante est (1) rentable, (2) stable techniquement et (3) dispose d'une réserve de sécurité.**

Vérifie avec l'utilisateur, chiffres à l'appui :
1. **Rentable** : idéalement le dernier bilan mensuel (compétence `bilan-mensuel`, à partir de l'export CSV de l'appli). Au-dessus du seuil (≈ 49 clients payants/jour par zone) sur au moins les 2 derniers mois ?
2. **Stable** : coupures Internet ou électricité fréquentes ? Incidents dans les rapports journaliers ?
3. **Réserve** : trésorerie disponible ≥ budget d'ouverture + 2 à 3 mois de charges ?

Si un critère manque, dis-le franchement et propose ce qui le débloquerait, plutôt que d'aider à ouvrir quand même. Si l'utilisateur décide d'ouvrir malgré tout, c'est son choix : continue, en notant le risque.

Première zone (pilote) : la règle ne s'applique pas, mais la **vérification réglementaire** (étape 3) est encore plus importante.

## Étape 2 : choisir l'emplacement

Le plan demande d'évaluer **au moins 5 emplacements** avant de décider. Pour chacun, note de 1 à 5 :

| Critère | Ce qu'on regarde |
|---|---|
| Fréquentation | Passage aux heures de pointe (compter sur place 30 min, matin et soir) |
| Clientèle | Étudiants, commerçants, voyageurs… (segments du plan §3.2) |
| Sécurité | Risque de vol du matériel, surveillance |
| Électricité | Fiabilité, fréquence des coupures |
| Visibilité | Signalétique possible, passage devant |
| Concurrence | Cybercafés et Wi-Fi proches, leurs prix |
| Accessibilité | Facile d'accès, horaires |
| Coût | Loyer ou partage de revenus |

Propose un tableau comparatif rempli avec ce que l'utilisateur te donne, avec un total et une recommandation argumentée. Les priorités du plan : zones commerciales et grands axes, abords des universités et instituts, hôtels et commerces partenaires, puis quartiers résidentiels denses.

**Partenariat d'emplacement** (plan §7.2) : le partenaire fournit l'espace, la sécurité et parfois une partie de l'énergie ; CispolStore fournit la connectivité, l'équipement, l'installation et l'exploitation. Partage indicatif **70 % CispolStore / 30 % partenaire**. Si l'utilisateur négocie : calcule l'impact sur le seuil de rentabilité (les 30 % s'appliquent au chiffre d'affaires, mais le loyer disparaît des charges).

## Étape 3 : checklist avant achat (Annexe A)

À dérouler dans cet ordre (ne commander le matériel qu'après les premiers points) :
1. Autorisation **ARPTC** et conditions **Starlink** pour un usage commercial (priorité absolue ; offre Business/Priority si exigée).
2. Emplacement choisi et accord signé.
3. Devis Internet adapté à l'usage commercial.
4. Devis équipements **transport et douane inclus**, et coût réel du transport Kinshasa–Bandundu.
5. Installation et tests, puis promotion de lancement.
6. Suivi quotidien des ventes, bilans à 30, 60 et 90 jours.

## Étape 4 : budget

Base : budget du plan (≈ 5 000 $ par zone, dont 1 000 $ de fonds de roulement). Une 2e zone peut coûter moins cher si le partenaire fournit le local ou l'énergie, ou si une partie du matériel (outillage, signalétique) existe déjà. Fais un tableau poste par poste à partir de `references/reperes.md`, en distinguant ce qui est **devis confirmé** et ce qui est **hypothèse**. Rappelle de ne pas engager tout le capital dans le matériel.

## Étape 5 : calendrier

Propose un planning daté à partir d'aujourd'hui, inspiré du plan §9 (≈ 50 jours jusqu'au lancement, bilan à 90 jours). Les étapes réglementaire et emplacement passent avant toute commande.

## Étape 6 : mise en place dans l'appli et sur le routeur

1. Appli CISPOLstore Gestion → **Réglages → Zones** : « + Zone » avec le nom de la nouvelle zone.
2. **Réglages → Agents** : créer l'agent de la zone (rôle Agent, zone = la nouvelle, PIN personnel).
3. **Un téléphone par zone** : installer l'appli sur le téléphone de la zone. Les données restent sur chaque téléphone ; pour les bilans, exporter le CSV de chaque téléphone.
4. Routeur : suivre la compétence `mikrotik-nouveau-routeur` (Hotspot, login.html, premier lot d'essai). Les tickets d'un lot ne valent que pour le routeur où il est importé.
5. **Tickets** : générer les lots de la nouvelle zone, imprimer, ranger en lieu sûr.
6. Faire un test complet (vente dans l'appli → connexion d'un client) avant l'ouverture au public.

## Ce que tu produis

Selon la demande : un tableau comparatif d'emplacements, un budget, un planning, une note de décision « ouvrir / attendre », ou la checklist complète. Quand le document est destiné à être gardé ou partagé (associé, partenaire, banque), propose de le faire sous forme de document plutôt que dans le chat.

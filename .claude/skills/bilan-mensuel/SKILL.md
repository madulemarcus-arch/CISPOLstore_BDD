---
name: bilan-mensuel
description: Produit le bilan mensuel d'une ou plusieurs Wi-Fi Zones CispolStore à partir de l'export CSV des ventes de l'appli CISPOLstore Gestion, et le compare au business plan (seuil de rentabilité, objectifs clients/jour, charges, panier moyen). À utiliser dès que l'utilisateur parle de bilan, de résultats du mois, de chiffre d'affaires, de « combien on a fait », de rentabilité, de point à 30/60/90 jours, de décision d'expansion, ou partage un fichier cispolstore-ventes-*.csv ou cispolstore-rapports-*.csv, même sans dire « bilan ».
---

# Bilan mensuel CispolStore

Objectif : transformer l'export des ventes de l'appli en un bilan clair pour le gérant, avec des chiffres exacts et une lecture « business plan » (sommes-nous rentables ? sur la trajectoire ? que faire ?).

Le lecteur est le gérant, pas un informaticien : français simple, montants en FC (avec l'équivalent en $ entre parenthèses quand c'est utile), pas de jargon.

## 1. Récupérer les données

Il faut l'export **Ventes (CSV / Excel)** de l'appli : Réglages → Données → « Ventes (CSV / Excel) ». Le fichier s'appelle `cispolstore-ventes-AAAA-MM-JJ.csv`. Séparateur `;`, encodage UTF-8 avec BOM, colonnes :

`Date;Heure;Zone;Agent;Code;Forfait;Durée (min);Paiement;Montant (FC);Expiration;Statut;Motif annulation`

- `Paiement` vaut `Cash`, `Mobile Money` ou `Gratuit`.
- `Statut` vaut `Valide` ou `Annulée` : les ventes annulées ne comptent pas dans les recettes, mais leur nombre est une information utile (erreurs, fraude possible).

Si l'utilisateur n'a pas le fichier, explique-lui en une phrase comment l'exporter et demande-le. Si plusieurs téléphones vendent (une zone par téléphone), il faut un export par téléphone : le script accepte plusieurs fichiers.

Demande aussi, si tu ne les connais pas : le mois à analyser (par défaut le dernier mois complet présent dans le fichier) et le **mois de lancement** de la zone (pour savoir si on est au mois 1, 2… de la trajectoire). Les autres hypothèses ont des valeurs par défaut tirées du business plan (voir `references/plan.md`) ; utilise celles que l'utilisateur a modifiées dans l'appli s'il te les donne.

## 2. Calculer avec le script (ne pas recalculer à la main)

```bash
python3 .claude/skills/bilan-mensuel/scripts/bilan.py cispolstore-ventes-*.csv --mois 2026-11 --lancement 2026-11
```

Options utiles : `--zone "Zone Basoko"` (une seule zone), `--charges 1100000` (charges mensuelles **par zone**), `--panier 750`, `--taux 2300`, `--objectifs 50,65,80,...`, `--json` (sortie brute). Le script affiche un bilan en Markdown avec tous les chiffres. Fais-lui confiance pour les calculs : un total faux détruit la confiance du gérant dans tout le reste.

## 3. Rédiger le bilan

Pars de la sortie du script et ajoute la lecture humaine. Structure :

1. **En une phrase** : le verdict du mois (ex. « Mois rentable : +312 000 FC, au-dessus du seuil 18 jours sur 30 »).
2. **Chiffres clés** : clients payants, CA (cash / Mobile Money), résultat après charges, moyenne clients/jour face au seuil et à l'objectif du mois, panier moyen face aux 750 FC prévus.
3. **Ce qui marche / ce qui coince** : forfaits qui se vendent, jours forts et faibles, agents, zones, part du Mobile Money, ventes annulées et vouchers gratuits (au-delà de ~5 % des ventes, le signaler : c'est de l'argent qui ne rentre pas).
4. **Recommandations** (2 à 4, concrètes), en t'appuyant sur le plan :
   - sous le seuil plusieurs mois de suite → leviers du §8 du plan : ajuster l'offre ou les prix, promotion, partenariats (écoles, commerces), voire déplacer la zone ;
   - panier moyen très différent de 750 FC → le seuil réel change, le dire et recalculer (`charges ÷ (panier réel × 30)`) ;
   - au-dessus de l'objectif et stable → au bilan 90 jours, la règle de discipline du plan s'applique : on n'ouvre une 2e zone que si la 1re est rentable, stable techniquement et dispose d'une réserve de sécurité ;
   - beaucoup d'annulations ou de gratuits → revoir avec les agents concernés.
5. **Points de vigilance** : données manquantes (jours sans vente = appli non utilisée ou zone fermée ?), mois incomplet, hypothèses utilisées.

Garde un ton factuel : ne promets pas une tendance sur deux semaines de données, et dis-le quand l'échantillon est trop petit.

## 4. Livrer

- Demande courte dans le chat → réponds dans le chat.
- Bilan à garder, partager ou imprimer → propose un document (doc, PDF ou Word selon ce que l'utilisateur préfère), avec un tableau par zone si plusieurs zones.
- Pour WhatsApp, propose aussi une version courte (5-6 lignes) à copier-coller.

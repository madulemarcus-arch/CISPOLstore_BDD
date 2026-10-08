# Repères du business plan CISPOLstore-Bandundu (sept. 2026)

Valeurs par défaut de l'appli et du script `bilan.py`. Elles sont modifiables dans l'appli (Réglages) : si l'utilisateur les a changées, utiliser ses valeurs.

## Hypothèses
- Taux de change : 1 USD ≈ 2 300 FC (à vérifier, volatil).
- Panier moyen : 750 FC par client payant.
- Charges mensuelles **par zone** : 1 100 000 FC (≈ 478 $)
  - Internet Starlink 250 000 · Agent 250 000 · Électricité 150 000 · Emplacement 150 000 · Maintenance 100 000 · Marketing 100 000 · Divers 100 000.
- Seuil de rentabilité : charges ÷ (panier × 30) = 1 100 000 ÷ 22 500 ≈ **49 clients payants/jour** par zone. C'est un seuil de sécurité, pas un objectif.

## Trajectoire (objectif clients payants/jour, mois 1 à 12)
50 · 65 · 80 · 90 · 100 · 110 · 120 · 130 · 140 · 150 · 165 · 180

## Résultat indicatif du plan (panier 750 FC, charges 1 100 000 FC)
| Clients/jour | CA mensuel | Résultat |
|---|---|---|
| 50 | 1 125 000 | +25 000 |
| 75 | 1 687 500 | +587 500 |
| 100 | 2 250 000 | +1 150 000 |
| 150 | 3 375 000 | +2 275 000 |
| 200 | 4 500 000 | +3 400 000 |

## Grille tarifaire de lancement (FC)
30 min 250 · 1 h 500 · 3 h 1 000 · Journée 2 000 · 3 jours 3 500 · 7 jours 5 000 · 30 jours 15 000 · Student semaine 5 000 · Student mois 15 000.

## Risques et réponses (§8)
- Faible fréquentation → modifier l'offre ou déplacer la zone.
- Prix mal calibrés → tester plusieurs forfaits.
- Saturation → limitation de débit, points d'accès, QoS.
- Hausse du tarif Starlink → revoir la grille.
- Coupures d'électricité → onduleur, batterie, solaire.

## Règles de décision
- Pilote de 90 jours ; bilans à 30, 60 et 90 jours.
- Une 2e zone seulement si la 1re est rentable, stable techniquement et dispose d'une réserve de sécurité.
- Partenariat d'emplacement indicatif : 70 % CispolStore / 30 % partenaire.

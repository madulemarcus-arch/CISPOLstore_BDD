#!/usr/bin/env python3
"""Monthly report for CispolStore Wi-Fi zones, from the app's sales export.

Usage:
  python3 bilan.py cispolstore-ventes-*.csv [--mois 2026-11] [--lancement 2026-11]
                   [--zone "Zone Basoko"] [--charges 1100000] [--panier 750]
                   [--taux 2300] [--objectifs 50,65,...] [--json]

Input: one or more CSV files exported from CISPOLstore Gestion (Réglages > Données >
Ventes), ';'-separated, UTF-8 with BOM. Several files (one per phone) are merged;
duplicate sales (same date, time, code) are counted once.
Output: a Markdown report on stdout (or JSON with --json). Amounts in FC.
"""
import argparse
import calendar
import csv
import json
import math
import sys
from collections import Counter, defaultdict

DEFAULT_TARGETS = [50, 65, 80, 90, 100, 110, 120, 130, 140, 150, 165, 180]


def fc(n):
    return f"{round(n):,}".replace(",", " ") + " FC"


def usd(n, rate):
    return f"≈ {round(n / rate):,} $".replace(",", " ")


def to_int(v):
    v = (v or "").replace(" ", "").replace(" ", "").replace(" ", "").strip()
    try:
        return int(float(v.replace(",", ".")))
    except ValueError:
        return 0


def load(paths):
    rows, seen = [], set()
    for p in paths:
        with open(p, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            missing = {"Date", "Zone", "Agent", "Code", "Forfait", "Paiement", "Montant (FC)", "Statut"} - set(reader.fieldnames or [])
            if missing:
                sys.exit(f"{p} : ce n'est pas un export « Ventes » de l'appli (colonnes manquantes : {', '.join(sorted(missing))})")
            for r in reader:
                key = (r["Date"], r.get("Heure", ""), r["Code"])
                if key in seen:
                    continue
                seen.add(key)
                rows.append({
                    "date": r["Date"].strip(), "zone": r["Zone"].strip(), "agent": r["Agent"].strip(),
                    "forfait": r["Forfait"].strip(), "paiement": r["Paiement"].strip(),
                    "montant": to_int(r["Montant (FC)"]), "annulee": r["Statut"].strip().lower().startswith("annul"),
                })
    return rows


def months_between(a, b):
    ya, ma = map(int, a.split("-"))
    yb, mb = map(int, b.split("-"))
    return (yb - ya) * 12 + (mb - ma)


def analyse(rows, mois, zone, charges_zone, panier, targets, lancement):
    month_rows = [r for r in rows if r["date"].startswith(mois) and (not zone or r["zone"] == zone)]
    valid = [r for r in month_rows if not r["annulee"]]
    paid = [r for r in valid if r["paiement"] != "Gratuit"]
    zones = sorted({r["zone"] for r in valid}) or ([zone] if zone else [])
    nz = max(1, len(zones))

    y, m = map(int, mois.split("-"))
    n_days = calendar.monthrange(y, m)[1]
    last_day = max((int(r["date"][8:10]) for r in month_rows), default=0)
    # Averages use the days covered by the data, so a month in progress is not under-rated
    covered = n_days if last_day == n_days else max(last_day, 1)

    seuil_zone = math.ceil(charges_zone / (panier * 30))
    seuil = seuil_zone * nz
    charges = charges_zone * nz
    idx = months_between(lancement, mois) if lancement else None
    target = targets[min(idx, len(targets) - 1)] if idx is not None and idx >= 0 else None

    per_day = Counter(r["date"] for r in paid)
    days = [(f"{mois}-{d:02d}", per_day.get(f"{mois}-{d:02d}", 0)) for d in range(1, covered + 1)]
    cash = sum(r["montant"] for r in paid if r["paiement"] == "Cash")
    mm = sum(r["montant"] for r in paid if r["paiement"] == "Mobile Money")
    total = cash + mm

    def group(key):
        g = defaultdict(lambda: {"clients": 0, "recettes": 0, "gratuits": 0})
        for r in valid:
            e = g[r[key]]
            if r["paiement"] == "Gratuit":
                e["gratuits"] += 1
            else:
                e["clients"] += 1
                e["recettes"] += r["montant"]
        return dict(sorted(g.items(), key=lambda kv: -kv[1]["recettes"]))

    per_zone = {}
    if len(zones) > 1:
        for z in zones:
            zp = [r for r in paid if r["zone"] == z]
            zt = sum(r["montant"] for r in zp)
            per_zone[z] = {"clients": len(zp), "recettes": zt, "clients_jour": round(len(zp) / covered, 1),
                           "resultat": zt - charges_zone, "seuil_jour": seuil_zone}

    return {
        "mois": mois, "zone": zone or ("Toutes les zones" if len(zones) != 1 else zones[0]), "zones": zones,
        "jours_mois": n_days, "jours_couverts": covered, "mois_complet": covered == n_days,
        "clients": len(paid), "gratuits": len(valid) - len(paid), "annulees": len(month_rows) - len(valid),
        "cash": cash, "mobile_money": mm, "total": total,
        "charges": charges, "resultat": total - charges,
        "charges_au_prorata": round(charges * covered / n_days), "resultat_au_prorata": round(total - charges * covered / n_days),
        "clients_jour": round(len(paid) / covered, 1), "seuil_jour": seuil,
        "objectif_jour": target * nz if target is not None else None, "mois_trajectoire": idx + 1 if idx is not None and idx >= 0 else None,
        "panier_moyen": round(total / len(paid)) if paid else 0, "panier_prevu": panier,
        "seuil_reel_jour": math.ceil(charges / ((total / len(paid)) * 30)) if paid and total else None,
        "jours_au_dessus_seuil": sum(1 for _, n in days if n >= seuil),
        "jours_sans_vente": [d for d, n in days if n == 0],
        "meilleurs_jours": sorted(days, key=lambda x: -x[1])[:3],
        "pires_jours": sorted((d for d in days if d[1] > 0), key=lambda x: x[1])[:3],
        "par_forfait": group("forfait"), "par_agent": group("agent"), "par_zone": per_zone,
    }


def markdown(a, rate):
    L = []
    t = f"Bilan {a['mois']} – {a['zone']}"
    L += [f"# {t}", ""]
    if not a["mois_complet"]:
        L += [f"> Mois incomplet : données jusqu'au {a['jours_couverts']}/{a['mois'][5:]} ({a['jours_couverts']} jours sur {a['jours_mois']}). Moyennes calculées sur les jours couverts ; résultat donné aussi au prorata.", ""]
    res = a["resultat"] if a["mois_complet"] else a["resultat_au_prorata"]
    L += ["## Chiffres clés", "",
          "| Indicateur | Valeur |", "|---|---|",
          f"| Clients payants | {a['clients']} |",
          f"| Chiffre d'affaires | {fc(a['total'])} ({usd(a['total'], rate)}) |",
          f"| dont cash / Mobile Money | {fc(a['cash'])} / {fc(a['mobile_money'])} ({round(100 * a['mobile_money'] / a['total']) if a['total'] else 0} % MM) |",
          f"| Charges {'du mois' if a['mois_complet'] else 'au prorata'} | {fc(a['charges'] if a['mois_complet'] else a['charges_au_prorata'])} |",
          f"| **Résultat** | **{'+' if res >= 0 else ''}{fc(res)}** ({usd(res, rate)}) |",
          f"| Clients payants / jour | {str(a['clients_jour']).replace('.', ',')} |",
          f"| Seuil de rentabilité / jour | {a['seuil_jour']} |"]
    if a["objectif_jour"] is not None:
        L.append(f"| Objectif du mois {a['mois_trajectoire']} / jour | {a['objectif_jour']} |")
    L += [f"| Jours au-dessus du seuil | {a['jours_au_dessus_seuil']} sur {a['jours_couverts']} |",
          f"| Panier moyen (prévu {fc(a['panier_prevu'])}) | {fc(a['panier_moyen'])} |"]
    if a["seuil_reel_jour"] and a["seuil_reel_jour"] != a["seuil_jour"]:
        L.append(f"| Seuil recalculé avec le panier réel | {a['seuil_reel_jour']} clients/jour |")
    L += [f"| Vouchers gratuits | {a['gratuits']} |", f"| Ventes annulées | {a['annulees']} |", ""]

    if a["par_zone"]:
        L += ["## Par zone", "", "| Zone | Clients | Clients/jour | Recettes | Résultat (charges 1 zone) |", "|---|---|---|---|---|"]
        for z, v in a["par_zone"].items():
            L.append(f"| {z} | {v['clients']} | {str(v['clients_jour']).replace('.', ',')} (seuil {v['seuil_jour']}) | {fc(v['recettes'])} | {'+' if v['resultat'] >= 0 else ''}{fc(v['resultat'])} |")
        L.append("")
    for title, key in (("Par forfait", "par_forfait"), ("Par agent", "par_agent")):
        L += [f"## {title}", "", "| | Clients | Recettes | Gratuits |", "|---|---|---|---|"]
        for k, v in a[key].items():
            L.append(f"| {k} | {v['clients']} | {fc(v['recettes'])} | {v['gratuits']} |")
        L.append("")
    L += ["## Jours", "",
          "- Meilleurs : " + ", ".join(f"{d} ({n})" for d, n in a["meilleurs_jours"]),
          "- Plus faibles (avec ventes) : " + (", ".join(f"{d} ({n})" for d, n in a["pires_jours"]) or "—"),
          f"- Sans aucune vente : {len(a['jours_sans_vente'])}" + (f" ({', '.join(d[8:] for d in a['jours_sans_vente'])})" if a["jours_sans_vente"] else ""), ""]
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fichiers", nargs="+")
    ap.add_argument("--mois", help="AAAA-MM (défaut : dernier mois présent)")
    ap.add_argument("--lancement", help="AAAA-MM, mois 1 de la trajectoire")
    ap.add_argument("--zone")
    ap.add_argument("--charges", type=int, default=1_100_000, help="charges mensuelles par zone (FC)")
    ap.add_argument("--panier", type=int, default=750)
    ap.add_argument("--taux", type=int, default=2300)
    ap.add_argument("--objectifs", default=",".join(map(str, DEFAULT_TARGETS)))
    ap.add_argument("--json", action="store_true")
    o = ap.parse_args()

    rows = load(o.fichiers)
    if not rows:
        sys.exit("Aucune vente dans le(s) fichier(s).")
    mois = o.mois or max(r["date"][:7] for r in rows)
    if not any(r["date"].startswith(mois) for r in rows):
        sys.exit(f"Aucune vente en {mois}. Mois présents : {', '.join(sorted({r['date'][:7] for r in rows}))}")
    if o.zone and not any(r["zone"] == o.zone for r in rows):
        sys.exit(f"Zone inconnue : {o.zone}. Zones présentes : {', '.join(sorted({r['zone'] for r in rows}))}")
    targets = [int(x) for x in o.objectifs.split(",") if x.strip()]
    a = analyse(rows, mois, o.zone, o.charges, o.panier, targets, o.lancement)
    print(json.dumps(a, ensure_ascii=False, indent=1) if o.json else markdown(a, o.taux))


if __name__ == "__main__":
    main()

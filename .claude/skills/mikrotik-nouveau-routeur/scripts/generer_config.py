#!/usr/bin/env python3
"""Generates a complete RouterOS script (.rsc) that turns a MikroTik router into a
CispolStore Wi-Fi zone: security, DNS, open Wi-Fi, Hotspot with ticket login, backup.

It is applied ON TOP of MikroTik's default configuration (System > Reset Configuration,
keeping the default config): that config already provides the 'bridge', the DHCP client on
ether1 (Starlink), NAT masquerade, the firewall and the DHCP server 192.168.88.0/24.
Every step checks before adding, so importing the file twice is harmless.

Usage:
  python3 generer_config.py --modele "hAP ax2" --zone "Zone Basoko" --mot-de-passe "..." \
      [--ssid "CispolStore WiFi"] [--ros 7] [--wifi wifi|wireless|aucun] [--sortie fichier.rsc]
  python3 generer_config.py --liste-modeles
"""
import argparse
import re
import sys
import unicodedata

# Known models. wifi: 'wifi' = new WiFi menu (RouterOS v7, wifi-qcom), 'wireless' = legacy
# Wireless menu, 'aucun' = no radio (use separate access points).
MODELES = {
    "hap ax2": dict(nom="hAP ax²", ros=7, wifi="wifi", clients="60 à 100", note=""),
    "hap ax3": dict(nom="hAP ax³", ros=7, wifi="wifi", clients="100 et plus", note=""),
    "hap ac2": dict(nom="hAP ac²", ros=7, wifi="wireless", clients="40 à 60", note="Wi-Fi via le menu Wireless (pilote d'origine)."),
    "hap ac lite": dict(nom="hAP ac lite", ros=7, wifi="wireless", clients="20 à 30", note="Petit processeur : zone modeste."),
    "hap lite": dict(nom="hAP lite", ros=7, wifi="wireless", clients="une vingtaine", note="32 Mo de mémoire : surveiller System > Resources."),
    "hap mini": dict(nom="hAP mini", ros=7, wifi="wireless", clients="une vingtaine", note="32 Mo de mémoire : surveiller System > Resources."),
    "l009": dict(nom="L009UiGS", ros=7, wifi="aucun", clients="100 et plus (avec points d'accès)", note="Pas de Wi-Fi : brancher des points d'accès sur le bridge."),
    "l009 wifi": dict(nom="L009UiGS-2HaxD", ros=7, wifi="wifi", clients="60 à 100", note="Wi-Fi 2,4 GHz seulement : ajouter des points d'accès pour couvrir plus."),
    "rb951": dict(nom="RB951 (Ui ou G)", ros=7, wifi="wireless", clients="20 à 30", note="Modèle ancien, 2,4 GHz seulement. Mettre à jour RouterOS avant (6.49 minimum, v7 conseillée)."),
    "hex": dict(nom="hEX (RB750Gr3)", ros=7, wifi="aucun", clients="50 à 100 (avec points d'accès)", note="Pas de Wi-Fi : brancher des points d'accès sur le bridge."),
    "rb750": dict(nom="RB750 / hEX lite", ros=7, wifi="aucun", clients="20 à 40 (avec points d'accès)", note="Pas de Wi-Fi ; petit processeur."),
    "rb4011": dict(nom="RB4011", ros=7, wifi="aucun", clients="200 et plus (avec points d'accès)", note="Version sans Wi-Fi ; la variante 'wifi' a un Wi-Fi 5 GHz (menu Wireless)."),
}


def cle_modele(texte):
    t = texte.lower().replace("²", "2").replace("³", "3")
    t = unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\b(ax|ac) ?([23])\b", r"\1\2", t)  # "ax 2" -> "ax2"
    if t.startswith("l009"):
        return "l009 wifi" if ("2haxd" in t or "wifi" in t) else "l009"
    if t.startswith("rb951"):
        return "rb951"
    if t.startswith(("hex", "rb750gr3")):
        return "hex"
    if t.startswith("rb750"):
        return "rb750"
    if t.startswith("rb4011"):
        return "rb4011"
    return t if t in MODELES else None


def ascii_only(v):
    v = v.replace("²", "2").replace("³", "3")
    return unicodedata.normalize("NFD", v).encode("ascii", "ignore").decode()


def ros_str(v):
    return '"' + re.sub(r'([\\"$])', r"\\\1", ascii_only(v)) + '"'


def generer(modele, zone, mdp, ssid, ros, wifi, dns_name):
    ident = "CispolStore-" + re.sub(r"[^A-Za-z0-9-]", "", ascii_only(zone).replace(" ", "-"))[:40]
    L = [
        "# ===================================================================",
        f"# CispolStore - configuration complete Wi-Fi Zone",
        f"# Modele : {ascii_only(modele)} | RouterOS v{ros} | Wi-Fi : {wifi}",
        f"# Zone : {ascii_only(zone)} | Reseau : {ascii_only(ssid)}",
        "# A importer APRES une remise a zero AVEC configuration par defaut :",
        "#   System > Reset Configuration (ne PAS cocher 'No Default Configuration')",
        "#   puis Files : glisser ce fichier, et New Terminal :",
        "#   /import file-name=<nom-de-ce-fichier>.rsc verbose=yes",
        "# Reimporter ce fichier est sans danger.",
        "# ATTENTION : ce fichier contient le mot de passe admin. Apres l'import,",
        "# le supprimer du routeur (Files) et du telephone/PC.",
        "# ===================================================================",
        "",
        ":log info \"CISPOL config : debut\"",
        "",
        "# --- 1. Securite et identite ---",
        f"/user set [find name=admin] password={ros_str(mdp)}",
        "/ip service disable telnet,ftp,api,api-ssl",
        f"/system identity set name={ros_str(ident)}",
        "/system clock set time-zone-name=Africa/Kinshasa",
        "",
        "# --- 2. Internet (Starlink sur ether1) et DNS ---",
        ":if ([:len [/ip dhcp-client find interface=ether1]] = 0) do={ /ip dhcp-client add interface=ether1 disabled=no }",
        "/ip dns set allow-remote-requests=yes servers=8.8.8.8,1.1.1.1",
        "",
        "# --- 3. Wi-Fi ouvert (la protection se fait par les tickets) ---",
    ]
    if wifi == "wifi":
        L += [
            ":foreach i in=[/interface wifi find] do={",
            f"  /interface wifi set $i configuration.ssid={ros_str(ssid)} security.authentication-types=\"\" disabled=no",
            "}",
        ]
    elif wifi == "wireless":
        L += [
            "/interface wireless security-profiles set [find default=yes] mode=none",
            ":foreach i in=[/interface wireless find] do={",
            f"  /interface wireless set $i ssid={ros_str(ssid)} mode=ap-bridge security-profile=default disabled=no",
            "}",
        ]
    else:
        L += ["# Pas de Wi-Fi integre : configurer les points d'acces separes avec le SSID",
              f"# {ascii_only(ssid)} (sans mot de passe), en mode AP/bridge, branches sur le bridge."]
    L += [
        "",
        "# --- 4. Hotspot (connexion par code de ticket) ---",
        ":if ([:len [/ip hotspot profile find name=cispol]] = 0) do={",
        f"  /ip hotspot profile add name=cispol hotspot-address=192.168.88.1 dns-name={ros_str(dns_name)} html-directory=hotspot login-by=http-chap,cookie",
        "}",
        f"/ip hotspot profile set [find name=cispol] hotspot-address=192.168.88.1 dns-name={ros_str(dns_name)} login-by=http-chap,cookie",
        ":if ([:len [/ip hotspot find name=cispol]] = 0) do={",
        "  /ip hotspot add name=cispol interface=bridge address-pool=default-dhcp profile=cispol disabled=no",
        "}",
        "/ip hotspot user profile set [find default=yes] shared-users=1",
        "",
        "# --- 5. Sauvegarde de cette configuration ---",
        "/system backup save name=cispolstore-config dont-encrypt=yes",
        "/export file=cispolstore-config",
        "",
        ":log info \"CISPOL config : termine\"",
        ":put \"CispolStore : configuration appliquee. Etapes suivantes : login.html, lot de tickets d'essai, test.\"",
        "",
    ]
    return "\r\n".join(L)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--modele")
    ap.add_argument("--zone")
    ap.add_argument("--mot-de-passe", dest="mdp")
    ap.add_argument("--ssid", default="CispolStore WiFi")
    ap.add_argument("--ros", type=int, choices=[6, 7])
    ap.add_argument("--wifi", choices=["wifi", "wireless", "aucun"])
    ap.add_argument("--dns-name", default="wifi.cispolstore")
    ap.add_argument("--sortie")
    ap.add_argument("--liste-modeles", action="store_true")
    o = ap.parse_args()

    if o.liste_modeles:
        for m in MODELES.values():
            print(f"- {m['nom']} : Wi-Fi {m['wifi']} ; clients simultanes : {m['clients']}. {m['note']}".rstrip())
        return
    for k in ("modele", "zone", "mdp"):
        if not getattr(o, k):
            sys.exit(f"Il manque --{'mot-de-passe' if k == 'mdp' else k}.")

    info = MODELES.get(cle_modele(o.modele) or "")
    wifi = o.wifi or (info and info["wifi"])
    ros = o.ros or (info and info["ros"]) or 7
    if not wifi:
        sys.exit(f"Modele inconnu ({o.modele}) : preciser --wifi wifi|wireless|aucun "
                 "(menu 'WiFi' dans Winbox = wifi, menu 'Wireless' = wireless, pas de Wi-Fi = aucun).")
    if ros == 6 and wifi == "wifi":
        sys.exit("Le menu WiFi n'existe qu'en RouterOS v7 : verifier la version ou utiliser --wifi wireless.")
    if len(o.mdp) < 8 or not re.search(r"[A-Za-z]", o.mdp) or not re.search(r"\d", o.mdp):
        sys.exit("Mot de passe admin trop faible : 8 caracteres minimum, avec lettres et chiffres.")
    if ascii_only(o.mdp) != o.mdp or '"' in o.mdp or "$" in o.mdp or "\\" in o.mdp:
        sys.exit("Mot de passe admin : eviter les accents et les caracteres \" $ \\ (sources d'erreurs sur RouterOS).")
    if not 1 <= len(ascii_only(o.ssid)) <= 32:
        sys.exit("Nom du Wi-Fi (SSID) : 1 a 32 caracteres.")

    rsc = generer(info["nom"] if info else o.modele, o.zone, o.mdp, o.ssid, ros, wifi, o.dns_name)
    if o.sortie:
        with open(o.sortie, "w", encoding="ascii", newline="") as f:
            f.write(rsc)
        print(f"Script ecrit : {o.sortie} (contient le mot de passe admin : a supprimer apres import)", file=sys.stderr)
        if info and info["note"]:
            print(f"Note modele : {info['note']}", file=sys.stderr)
    else:
        print(rsc)


if __name__ == "__main__":
    main()

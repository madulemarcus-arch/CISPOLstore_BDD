---
name: mikrotik-nouveau-routeur
description: "Guide pas à pas pour installer et configurer un routeur MikroTik en Wi-Fi Zone CispolStore (Hotspot à tickets, Starlink, page de connexion login.html, import des lots de tickets de l'appli CISPOLstore Gestion), ou générer en un seul fichier sa configuration complète selon le modèle (hAP ax², L009, RB951, hEX…), puis le dépanner. À utiliser dès que l'utilisateur parle de MikroTik, Winbox, RouterOS, hotspot, portail captif, tickets qui ne marchent pas, « le Wi-Fi ne demande pas le code », import .rsc, nouveau routeur ou remplacement d'un routeur, script ou configuration complète, même s'il ne dit pas « configurer »."
---

# Nouveau routeur MikroTik pour une Wi-Fi Zone CispolStore

L'utilisateur n'est pas forcément technicien et fait souvent les manipulations sur son téléphone ou un PC Windows, pendant que tu le guides. Il ne peut pas te donner accès au routeur : c'est lui qui clique. Donc :

- **Une étape à la fois**, avec le nom exact des menus Winbox (ils sont en anglais) et ce qu'il doit voir à l'écran pour savoir que c'est bon. Attends sa confirmation (ou une capture) avant l'étape suivante.
- Pour toute commande à taper dans le terminal, donne-la dans un bloc à copier-coller tel quel.
- Ne devine pas : si une valeur dépend de son installation (nom d'interface, version), demande-la ou fais-lui afficher l'info.

Architecture visée (plan §5.1) : Starlink → MikroTik (routeur/pare-feu + Hotspot) → switch PoE → points d'accès → clients.

## 0. Avant de commencer : ce qu'il faut savoir

Demande (ou fais vérifier dans Winbox) :
1. **Modèle** du routeur : System → RouterBOARD (ex. hAP ax², hEX, RB750Gr3…). Tous les MikroTik utilisent RouterOS, donc ce guide vaut pour tous ; seuls changent le Wi-Fi (intégré ou non) et la puissance. Les petits modèles à 32 Mo de mémoire (hAP lite, hAP mini…) font tourner le Hotspot mais pour peu de clients simultanés (une vingtaine) : pour une zone fréquentée, conseiller un modèle plus récent (hAP ax², hAP ac², hEX + points d'accès). Vérifier la mémoire libre dans System → Resources.
2. **Version RouterOS** : System → Packages (v6.x ou v7.x). Ce guide vise la **v7** ; les différences v6 sont signalées. Si le routeur est en v6.48 ou plus ancien, propose la mise à jour (System → Packages → Check For Updates → Download&Install) avant de configurer.
3. **Comment arrive Internet** : Starlink en mode **bypass** (recommandé : le MikroTik reçoit Internet directement sur `ether1`) ou Starlink routeur normal (double NAT, ça marche aussi).
4. **Où diffuser le Wi-Fi** : Wi-Fi intégré du MikroTik, ou points d'accès séparés (Ubiquiti, etc.) branchés sur un port/switch.
5. Le **nom de la zone** et le **nom du réseau** (SSID) choisis dans l'appli (onglet Tickets), par défaut « CispolStore WiFi ».

Pour les débutants : Winbox se télécharge sur mikrotik.com (PC Windows). Sur téléphone, l'appli officielle « MikroTik » (Android) permet aussi le terminal et les menus.

## Deux façons de faire

- **Pas à pas** (sections 1 à 8 ci-dessous) : recommandé pour le **premier** routeur, ou quand l'utilisateur veut comprendre, ou pour un modèle inconnu.
- **Configuration complète en un fichier** (section « Mode rapide ») : pour les routeurs suivants, ou si l'utilisateur la demande. Plus rapide, mais une erreur se voit après coup ; la faire d'abord sur un routeur qui n'est pas encore en service.

Dans les deux cas, commence par l'étape 0.

## Mode rapide : configuration complète en un fichier

Le script `scripts/generer_config.py` (dans le dossier de cette compétence, Python 3 sans dépendance) produit un `.rsc` qui fait les sections 1 à 4 et 8 d'un coup : sécurité, Internet, DNS, Wi-Fi ouvert, Hotspot avec connexion CHAP, sauvegarde. Il s'applique **par-dessus la configuration par défaut** de MikroTik (bridge, client DHCP sur `ether1`, pare-feu, NAT, DHCP 192.168.88.0/24). Chaque étape vérifie avant d'ajouter : le réimporter est sans danger.

1. Recueille : modèle exact (System → RouterBOARD), version RouterOS, nom de la zone, nom du Wi-Fi (celui de l'appli, onglet Tickets), mot de passe admin choisi par l'utilisateur (8 caractères minimum, lettres et chiffres, sans accents ni `" $ \`).
2. Génère :
   ```bash
   python3 <dossier-de-la-competence>/scripts/generer_config.py --modele "hAP ax2" --zone "Zone Basoko" --mot-de-passe "..." --ssid "CispolStore WiFi" --sortie cispol-config-basoko.rsc
   ```
   `--liste-modeles` affiche les modèles connus (Wi-Fi, nombre de clients raisonnable, remarques). Pour un modèle inconnu, ajoute `--wifi wifi` (menu « WiFi » dans Winbox), `--wifi wireless` (menu « Wireless ») ou `--wifi aucun`, et `--ros 6` si le routeur est en v6.
3. Donne le fichier à l'utilisateur, puis guide :
   1. System → Reset Configuration, **sans** cocher « No Default Configuration » → le routeur redémarre (reconnexion Winbox par l'adresse MAC, onglet Neighbors).
   2. Files → glisser le fichier `.rsc`.
   3. New Terminal : `/import file-name=cispol-config-basoko.rsc verbose=yes` → la dernière ligne doit dire « CispolStore : configuration appliquée ». En cas d'erreur, demande la ligne affichée juste avant et consulte `references/depannage.md`.
   4. **Supprimer le fichier `.rsc` du routeur** (Files) et de l'appareil : il contient le mot de passe admin. Garder `cispolstore-config.backup` et `.rsc` d'export (téléchargés, hors du routeur).
4. Vérifications après import :
   - IP → Hotspot → Servers : `cispol` actif sur `bridge`.
   - Files → dossier `hotspot` présent avec `login.html` et `md5.js` (sinon : IP → Hotspot → Hotspot Setup sur `bridge` pour recréer les fichiers, puis remettre le profil `cispol`).
   - `/ping 8.8.8.8 count=4` répond.
5. Puis sections 5 (page `login.html` de l'appli), 6 (lot de tickets d'essai) et 7 (test final) comme en pas à pas.

Si le modèle n'a pas de Wi-Fi (L009, hEX…), le script le dit : configure ensuite les points d'accès (section 3).

## 1. Remise à zéro et sécurité de base

Sur un routeur neuf ou d'occasion, part d'une configuration par défaut propre (System → Reset Configuration, garder la configuration par défaut). Puis, dans **New Terminal** :

```
/user set admin password="UN-MOT-DE-PASSE-SOLIDE"
/ip service disable telnet,ftp,api,api-ssl
/system identity set name="CispolStore-NOMDELAZONE"
/system clock set time-zone-name=Africa/Kinshasa
```

Explique pourquoi : sans mot de passe, n'importe quel client du Wi-Fi pourrait administrer le routeur. Fais-lui noter le mot de passe en lieu sûr. (Ne désactive pas `winbox` ni `www` ici.)

## 2. Internet (Starlink)

Branche Starlink sur `ether1`. La configuration par défaut a déjà un client DHCP sur `ether1`. Vérifie :

```
/ip dhcp-client print
/ping 8.8.8.8 count=4
```

Attendu : statut `bound` et des réponses au ping. Sinon : câble, mode bypass de Starlink, ou interface différente (demande `/interface print`).

## 3. Wi-Fi

- **Wi-Fi intégré** : régler le SSID au nom choisi, **sans mot de passe** (réseau ouvert : la protection se fait par les tickets).
  - v7 avec WiFi « wifi/wifiwave2 » : menu WiFi → l'interface → Configuration → SSID ; Security → aucune authentification.
  - v6 ou ancien pilote : Wireless → l'interface → onglet Wireless → SSID ; Security Profile `default` en mode `none`.
- **Points d'accès séparés** : même SSID ouvert sur chaque point d'accès, en mode « bridge/AP » (pas de routeur ni DHCP sur l'AP), branchés sur un port du `bridge` du MikroTik.

## 4. Hotspot

Menu **IP → Hotspot → Hotspot Setup** (assistant) :
1. HotSpot Interface : `bridge` (celui des clients Wi-Fi). ⚠️ Jamais `ether1` (Internet).
2. Local Address : laisser celle proposée (ex. `192.168.88.1/24`).
3. Masquerade Network : cocher.
4. Address Pool : laisser.
5. Certificate : none.
6. SMTP : vide.
7. DNS Servers : `8.8.8.8` et `1.1.1.1` si vide.
8. DNS Name : un nom local, ex. `wifi.cispolstore` (évite les avertissements de certains téléphones).
9. Local HotSpot User : laisser le nom proposé, puis **supprimer cet utilisateur** ensuite (IP → Hotspot → Users) : ce compte de test ne doit pas rester.

Puis :

```
/ip hotspot profile set [find default=no] login-by=http-chap,cookie
/ip hotspot user profile set default shared-users=1
```

Pourquoi `http-chap` : la page `login.html` de l'appli envoie le code chiffré (CHAP), le mot de passe ne circule pas en clair.

## 5. Page de connexion aux couleurs CispolStore

1. Dans l'appli : onglet **Tickets** → « Télécharger login.html ».
2. Winbox → **Files** → dossier `hotspot` (ou `flash/hotspot` sur certains modèles) → glisser `login.html` dessus pour **remplacer** l'existant. Garder les autres fichiers (`md5.js`, `status.html`, etc.) : `login.html` a besoin de `md5.js`.
3. À refaire après chaque changement de prix dans l'appli.

## 6. Premiers tickets

1. Dans l'appli : Tickets → générer un **petit lot d'essai** (ex. 5 tickets « 30 minutes »). Un fichier `cispol-L….rsc` se télécharge.
2. Winbox → Files → glisser le fichier.
3. New Terminal :
   ```
   /import file-name=cispol-L20261107-01.rsc
   ```
   (avec le vrai nom). Le script crée le profil `cispol-<forfait>` (1 appareil, débit max éventuel) et les utilisateurs avec `limit-uptime`. Le réimporter ne crée pas de doublons.
4. Vérifier : IP → Hotspot → Users → les codes apparaissent avec le commentaire `CISPOL L…`.

## 7. Test final (obligatoire avant d'ouvrir)

Avec un téléphone client :
1. Se connecter au SSID → la page CispolStore doit s'ouvrir toute seule (sinon ouvrir `http://wifi.cispolstore` ou n'importe quel site en `http://`).
2. Saisir un code d'essai → navigation OK.
3. Dans Winbox : IP → Hotspot → **Active** montre le client ; Users → la colonne Uptime avance.
4. Ressaisir le même code sur un 2e téléphone pendant que le 1er est connecté → doit être refusé (1 appareil à la fois).
5. Code faux → message d'erreur sur la page.

## 8. Sauvegarde

```
/system backup save name=cispolstore-config
/export file=cispolstore-config
```

Fais télécharger les deux fichiers (Files → clic droit → Download) et les garder hors du routeur : en cas de panne, on restaure en quelques minutes.

## Dépannage

Lis `references/depannage.md` dès qu'un symptôme apparaît (page qui ne s'ouvre pas, code refusé, Internet lent, import en erreur, etc.). Demande toujours le **message exact** ou une capture : beaucoup de problèmes se reconnaissent au texte de l'erreur.

## Ce qu'il ne faut pas faire
- Mettre le Hotspot sur l'interface Internet (`ether1`) : coupe l'accès au routeur.
- Laisser le mot de passe admin vide, ou partager le mot de passe Winbox avec les agents.
- Supprimer `md5.js` du dossier hotspot.
- Importer un gros lot (500 tickets) sans avoir testé un petit lot.

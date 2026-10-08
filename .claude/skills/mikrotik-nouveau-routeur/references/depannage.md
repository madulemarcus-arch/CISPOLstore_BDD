# Dépannage Hotspot CispolStore

Toujours demander : le message exact (ou une capture), le modèle et la version RouterOS, et depuis quand le problème existe (après un changement ? une coupure de courant ?).

## La page de connexion ne s'ouvre pas
- Le téléphone teste souvent une adresse **https** : ouvrir à la main un site en `http://` (ex. `http://neverssl.com`) ou le DNS Name du hotspot (`http://wifi.cispolstore`).
- Vérifier que le Hotspot est sur le bon `bridge` / la bonne interface : IP → Hotspot → Servers.
- Le client a-t-il une adresse IP ? IP → DHCP Server → Leases. Sinon, problème Wi-Fi/DHCP, pas Hotspot.
- Données mobiles du téléphone actives : le téléphone peut ignorer le Wi-Fi « sans Internet ». Les couper pour tester.

## La page s'ouvre mais reste blanche ou sans style / le bouton ne fait rien
- `md5.js` absent du dossier hotspot (connexion CHAP impossible) : le remettre (il est recréé par un nouveau Hotspot Setup, ou copier depuis un autre routeur).
- `login.html` mal placé : il doit remplacer celui du dossier `hotspot` utilisé par le profil (IP → Hotspot → Server Profiles → HTML Directory).

## « invalid username or password » avec un bon code
- Le code est-il dans IP → Hotspot → Users ? Sinon le lot n'a pas été importé sur **ce** routeur (chaque zone a son routeur et ses lots).
- Majuscules : les codes de l'appli sont en minuscules ; le clavier du téléphone a pu mettre une majuscule au début.
- Code déjà épuisé : colonne Uptime ≥ Limit Uptime. C'est normal, le ticket est consommé.
- `login-by` doit contenir `http-chap` (IP → Hotspot → Server Profiles).

## « no more sessions are allowed for user »
Le code est déjà utilisé sur un autre appareil (shared-users=1). Déconnecter l'autre appareil : IP → Hotspot → Active → supprimer la ligne.

## L'import du script .rsc échoue
- Message `bad command name` ou `expected end of command` : demander la ligne exacte et la version RouterOS. Très ancien RouterOS (v6.4x et avant) : mettre à jour.
- `no such item` sur `/ip hotspot user profile` : le Hotspot n'est pas encore configuré (étape 4 du guide).
- Fichier introuvable : vérifier le nom exact avec `/file print` (sur certains modèles le fichier est dans `flash/`, ex. `/import file-name=flash/cispol-L….rsc`).
- Réimporter le même fichier est sans danger (doublons ignorés).

## Internet lent
- Trop de clients pour la bande passante Starlink : définir un « Débit max » par forfait dans l'appli (Réglages → Grille tarifaire, ex. `1M/2M`), régénérer un lot ou appliquer au profil existant :
  `/ip hotspot user profile set cispol-t1h rate-limit=1M/2M`
- Vérifier le débit Starlink seul (appli Starlink) pour savoir si le problème vient d'en amont.
- Points d'accès sur le même canal Wi-Fi : les répartir (1, 6, 11 en 2,4 GHz).

## Le routeur ne répond plus après une modification
- Ne pas paniquer : Winbox → onglet **Neighbors** → se connecter par l'adresse **MAC** (fonctionne même sans IP).
- En dernier recours : restaurer la sauvegarde (Files → `cispolstore-config.backup` → Restore) ou reset.

## Les tickets fonctionnent avant d'être vendus
C'est normal : un ticket importé est valable immédiatement. La sécurité repose sur la garde des tickets imprimés. Le contrôle « vendu / utilisé » complet viendra avec l'étape 2 (liaison directe appli ↔ API du routeur ; nécessitera de réactiver le service REST `www-ssl` ou `api-ssl`).

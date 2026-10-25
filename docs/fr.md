# Porsche Connect

## Présentation

Cette intégration amène dans Gladys les Porsche de votre compte **My Porsche**, via les serveurs de l’app My Porsche, comme la bibliothèque pyporscheconnectapi et son intégration Home Assistant :

- un appareil par voiture : batterie et autonomie électrique, carburant et autonomie totale, kilométrage, verrouillage, portes, coffre, capot avant, fenêtres, toit ouvrant ou capote, charge, objectif de charge, préclimatisation, pression des pneus, entretien et distance du domicile ;
- des commandes quand la voiture les accepte : verrouiller, déverrouiller, préclimatisation, objectif de charge, charge immédiate, clignotement des feux, klaxon et feux ;
- des déclencheurs et actions de scène, et un widget de tableau de bord par voiture.

L’intégration lit ce que la voiture a envoyé en dernier à Porsche, toutes les 15 minutes par défaut : elle ne la réveille jamais. Tout passe par le cloud de Porsche (transport cloud) : la voiture n’est jamais jointe sur votre réseau. C’est une intégration communautaire, sans lien avec Porsche ; les serveurs de l’app My Porsche n’ont pas de documentation publique et peuvent changer.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent (le formulaire du captcha dans le widget en a besoin).
- Une voiture avec un contrat **Porsche Connect** actif (Taycan, Macan électrique, 911 depuis la 992, 718, Panamera depuis 2021, Cayenne depuis 2017), et l’e-mail et le mot de passe du compte My Porsche.
- Le code PIN à 4 chiffres de l’app My Porsche, seulement pour déverrouiller depuis Gladys.
- Le widget **Porsche** sur un tableau de bord : Porsche demande parfois un captcha à la connexion, et c’est dans le widget que vous le saisissez.

## Configuration

| Champ                           | Ce qu’il faut saisir                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| E-mail / Mot de passe           | Le compte My Porsche                                                        |
| Code PIN (4 chiffres)           | Facultatif : utile seulement pour déverrouiller                             |
| Intervalle de lecture           | 15 minutes par défaut (de 10 à 60)                                          |
| Température de préclimatisation | 21 °C par défaut                                                            |
| Rayon du domicile               | 200 m par défaut, pour la distance du domicile et les scènes arrivée/départ |
| Langue des textes               | Automatique : la langue de votre tableau de bord                            |

Ajoutez le widget **Porsche** à un tableau de bord, puis cliquez sur **Enregistrer** et **Tester la connexion** : vos voitures s’affichent avec le nombre de commandes acceptées par chacune. Si Porsche demande un captcha, le widget en affiche l’image : cliquez sur **Saisir le code**, tapez les caractères, et l’intégration se connecte. La session est ensuite conservée et renouvelée : le captcha est rare. Les maisons de Gladys doivent avoir une position sur la carte pour la distance du domicile.

## Utilisation

### Appareils

Ouvrez **Découverte**, puis ajoutez vos voitures. Une fonctionnalité apparaît dès que la voiture a remonté sa valeur : l’intégration propose à nouveau l’appareil quand une nouvelle arrive (une première charge…). Verrouillage, préclimatisation et objectif de charge se commandent depuis le tableau de bord quand la voiture accepte ces commandes. Une commande prend de quelques secondes à une minute et demie : la voiture se réveille, l’exécute, puis l’intégration la relit.

### Widget de tableau de bord

![Le widget Porsche pour deux voitures et le captcha de connexion (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-porsche-connect/main/docs/assets/widgets.fr.png)

Le widget **Porsche** affiche la batterie ou le carburant, l’autonomie, le kilométrage, une liste d’états (verrouillage, ouvrants, charge, clim, pneus, position) et des boutons : verrouiller ou déverrouiller (le déverrouillage demande confirmation et le code PIN), préclimatiser, faire clignoter les feux, et la position sur une carte. Choisissez la voiture dans ses réglages, ou laissez vide pour la première voiture. Tant que Porsche demande un captcha, chaque widget Porsche l’affiche à la place.

### Scènes

Déclencheurs : verrouillée ou déverrouillée, verrouillée mais ouverte, état de la charge changé, câble branché ou débranché, arrivée ou départ du domicile, pression des pneus basse, problème de compte. Ils sont vus à la lecture suivante de la voiture. Actions : envoyer une commande (et attendre son exécution), lire l’état d’une voiture (avec une phrase prête pour un message).

Exemples :

- Quand la voiture est verrouillée mais ouverte → m’envoyer un message avec le résumé.
- Quand la charge passe à « Charge terminée » → me prévenir et couper la prise de charge.
- Chaque jour ouvré à 7 h 30 en hiver → envoyer la commande « Lancer la préclimatisation ».

### Transport

Le badge d’une voiture indique **cloud**. Il passe à **injoignable** quand Porsche refuse le compte ou attend un captcha, et affiche un point orange tant que Porsche limite les requêtes : les lectures sont alors espacées.

## Dépannage

- **E-mail ou mot de passe incorrect** : vérifiez-les d’abord dans l’app My Porsche, puis enregistrez à nouveau les réglages.
- **Captcha** : ouvrez le tableau de bord avec le widget Porsche et saisissez le code. Un code faux affiche une nouvelle image ; un captcha de plus de 10 minutes est remplacé.
- **Compte bloqué** : Porsche bloque un compte après trop de connexions. Débloquez-le dans l’app My Porsche ou sur le site Porsche ID, puis enregistrez les réglages.
- **Valeurs vieilles de quelques minutes** : la voiture envoie ses données en se garant, pendant la charge et après une commande. Un intervalle plus court ne la fait pas envoyer plus souvent.
- **Une valeur ou une commande manque** : toutes les voitures ne remontent pas tout, et le mode privé de la voiture masque la plupart des valeurs. Cliquez sur **Diagnostic**, puis copiez les lignes de l’onglet Journaux dans une issue GitHub : elles contiennent ce que la voiture remonte, sans VIN ni position.
- **Déverrouillage refusé** : saisissez le code PIN à 4 chiffres de l’app My Porsche.

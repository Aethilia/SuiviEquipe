# Utiliser Suivi Équipe sur plusieurs postes

Il n'y a **pas de serveur** : chaque poste installe l'application et tous pointent vers **le même dossier** sur un partage réseau.

## Mise en place

1. **Créer le dossier partagé** (une seule fois), par exemple `\\serveur\partage\SuiviEquipe`.
   Tous les utilisateurs doivent pouvoir **lire et écrire** (créer, modifier, renommer, supprimer des fichiers).
2. **Installer l'application** sur chaque poste (`Suivi Équipe Setup x.y.z.exe`, installation par utilisateur, sans droits administrateur).
3. Au **premier lancement**, l'application demande :
   * le **dossier de données** : le même chemin sur tous les postes (un chemin UNC `\\serveur\…` est préférable à une lettre de lecteur, qui peut différer d'un poste à l'autre) ;
   * le **nom du poste** (ex. « Bureau Nice 2 ») : il est enregistré avec chaque modification et affiché aux collègues.

   L'application indique si le dossier est accessible en écriture et s'il contient déjà des données.
4. **Sur un seul poste**, importer les classeurs Excel existants : Paramètres → importer (une fois par classeur).
   Les autres postes voient les données dès leur premier lancement.

## Mises à jour automatiques

Le dossier partagé sert de « magasin » de mises à jour (sous-dossier `_mises-a-jour`). **Chaque poste installe tout seul la version la plus récente qui s'y trouve, à l'ouverture de l'application.**

**Publier une nouvelle version (une seule personne, une seule fois) :**
1. Dans GitHub : *Actions → Installeur Windows → Run workflow* (laisser « Publier » coché). Chaque exécution produit une version plus récente (`1.0.<n°>`).
2. Télécharger `SuiviEquipe-Setup-X.Y.Z.exe` depuis la page *Releases* du dépôt.
3. Dans l'application : *Paramètres → Mises à jour → Publier une mise à jour…* et choisir ce fichier.
   (Équivalent : copier le fichier tel quel dans `_mises-a-jour`. Son nom doit rester `SuiviEquipe-Setup-X.Y.Z.exe`.)

**Ce que voient les autres postes :** à leur prochaine ouverture, un écran « Mise à jour vers la version X » s'affiche, l'application se ferme et **se rouvre toute seule en quelques dizaines de secondes** (il ne faut pas la relancer). Un poste qui garde l'application ouverte toute la journée peut aussi utiliser *Paramètres → Installer la version X maintenant*.

**À savoir :**
* Le **premier déploiement** reste manuel : les postes déjà installés avant la mise à jour automatique n'ont pas cette fonction ; ils doivent installer une fois la nouvelle version à la main.
* Un fichier en cours de copie est ignoré tant qu'il n'est pas complet. Si l'installation d'une version échoue, l'application s'ouvre normalement (version actuelle) et ne réessaie qu'après 30 minutes ; la cause est dans le journal.
* Si le partage est injoignable au démarrage, la vérification est abandonnée après quelques secondes et l'application s'ouvre normalement.
* Seuls les 2 installateurs les plus récents sont conservés dans le dossier.
* Les installateurs ne sont pas signés : un antivirus ou Windows 11 (Contrôle intelligent des applications) peut bloquer l'installation silencieuse. Le cas échéant, installer à la main et consulter le journal.

## Ce que voit chaque poste

* Les modifications d'un collègue apparaissent **toutes seules en 3 à 10 secondes** (le partage réseau met parfois quelques secondes à rendre un changement visible). Le bouton **↻** en haut à droite force une actualisation.
* Une case modifiée par un collègue est entourée d'**ambre** pendant quelques secondes. Au survol d'une case : *« Modifié par Bureau Nice 2, aujourd'hui à 14:32 »*.
* Si le dossier devient inaccessible (réseau coupé), l'indicateur passe au rouge et **les modifications ne sont pas enregistrées** : ne pas continuer à saisir tant qu'il est rouge.

## Si deux personnes modifient en même temps

* **Cases différentes** (même mois, même grille) : tout est conservé, c'est le cas normal.
* **La même case** : la dernière modification enregistrée l'emporte. Elle l'emporte même si l'horloge d'un poste est décalée, tant qu'elle est faite après avoir vu celle de l'autre.
* Les modifications du **référentiel** (agents, prestations, véhicules) se fusionnent de la même façon, élément par élément.
* Un **verrou très bref** (fichier `.lock` à côté du mois en cours d'écriture) évite que deux postes écrivent exactement au même instant. S'il reste un `.lock` après un plantage, il est ignoré au bout de 15 secondes.

## Sauvegardes

Avant la **première modification de la journée** d'un fichier, l'application en garde une copie dans `_sauvegardes\AAAA-MM-JJ\` (dans le dossier partagé), et supprime celles de plus de 30 jours.
Pour revenir en arrière après une erreur : fermer l'application sur tous les postes, copier le fichier voulu (ex. `hs-2026-01.json`) vers `hs\2026-01.json`, relancer.
Ces copies ne remplacent pas la sauvegarde habituelle du serveur de fichiers.

## Points d'attention

* Ne **pas ouvrir ni modifier les fichiers `.json`** à la main pendant que l'application tourne.
* Les **horloges** des postes doivent être à peu près à l'heure (c'est le cas dans un domaine Windows).
* Un **antivirus** qui analyse le dossier partagé peut ralentir les écritures de quelques centaines de millisecondes : sans conséquence, mais à exclure du scan si possible.
* Pour **changer de dossier** ou de nom de poste : Paramètres.

## Si l'application ne s'ouvre pas

Depuis cette version, un plantage au démarrage affiche un message d'erreur et est consigné dans un **journal local** :
`%APPDATA%\SuiviEquipe\suivi-equipe.log` (coller `%APPDATA%\SuiviEquipe` dans la barre d'adresse de l'Explorateur).

À vérifier, dans l'ordre :
1. **Gestionnaire des tâches** (Ctrl+Maj+Échap) : y a-t-il un processus « SuiviEquipe » déjà en cours ? Si oui, le terminer puis relancer.
2. **Windows 11 « Contrôle intelligent des applications » / SmartScreen / antivirus** : l'installeur n'est pas signé et peut être bloqué ou mis en quarantaine sans message évident. Regarder *Sécurité Windows → Protection contre les virus → Historique de protection*.
3. **Bureau à distance / Citrix / machine virtuelle** : l'accélération graphique est désactivée par l'application, mais un pilote défaillant peut encore poser problème.
4. Lancer depuis PowerShell pour voir les erreurs : `& "$env:LOCALAPPDATA\Programs\SuiviEquipe\SuiviEquipe.exe"`.

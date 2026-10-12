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

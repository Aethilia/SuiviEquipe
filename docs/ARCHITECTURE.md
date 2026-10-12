# Suivi Équipe – architecture et modèle de données

## Arborescence

```
electron/                 Processus principal (Node) – accès disque, Excel, IPC
  main.ts                 Fenêtre, handlers IPC, instance unique
  preload.ts              Pont sécurisé -> window.api (contextIsolation)
  config.ts               Config locale du poste (userData/config.json) : dossier partagé, nom du poste
  fsutil.ts               Lecture JSON, écriture atomique (tmp + rename), verrou .lock
  storage.ts              Lecture/écriture des mois et du référentiel, fusion sous verrou
  watcher.ts              Surveillance par sondage (3 s) du dossier partagé
  excel/
    load.ts               Ouverture d'un classeur (retire les « tableaux Excel » qui font planter ExcelJS)
    parseHs.ts            Lecture pure du classeur « Dimanches et fériés »
    importHs.ts           Import : rapprochement des agents, fusion sans écraser
    buildHs.ts            Construction du .xlsx d'export (mise en forme, formules)
    exportHs.ts           Export : charge l'année et écrit le fichier
src/shared/               Code pur, partagé et testé (aucune dépendance Electron)
  types.ts  calendar.ts  holidays.ts  merge.ts  stats.ts  names.ts  api.ts
src/renderer/             Interface React
  App.tsx (navigation)  hooks.ts  styles.css
  pages/ HsPage, SynthesePage, AgentsPage, FeriesPage, SettingsPage
  components/ CodePicker, CodeBadge, YearPicker
tests/                    vitest : fusion, fériés, stockage concurrent, import/export
```

## Données sur le partage réseau

```
<dossier partagé>/
  hs/2026-01.json … 2026-12.json      un fichier par mois (module Heures sup)
  poids/2026-01.json … 2026-12.json   un fichier par mois (module Poids)
  referentiel/agents.json             liste des agents
  referentiel/prestations.json        types d'heures sup (VN, OM, ES, EX… libres)
  referentiel/vehicules.json          véhicules / tournées (semaine ou dimanche)
```

### hs/AAAA-MM.json
```json
{
  "version": 1, "module": "hs", "month": "2026-01",
  "cells": {
    "<agentId>|<jour>": { "v": "VN", "t": 1767225600000, "by": "POSTE-03" }
  }
}
```
`v` = `VN` | `OM` | `ES` | `EX` | `null` (case effacée ; on garde l'horodatage pour que l'effacement se propage).

### referentiel/agents.json
```json
{ "version": 1, "agents": { "<id>": { "id": "…", "nom": "Dupont Jean", "ordre": 3, "actif": true, "matricule": "N0123380", "t": 1767225600000 } } }
```
Un agent n'est jamais supprimé, seulement désactivé : les saisies passées restent lisibles.

### poids/AAAA-MM.json
```json
{ "version": 1, "module": "poids", "month": "2026-01",
  "cells": { "<vehiculeId>|<jour>": { "v": { "p": [600, 980, 660] }, "t": 1767225600000, "by": "POSTE-03" } } }
```
`v` = `{ "p": [kg, …] }` (plusieurs valeurs = plusieurs vidages, total = somme) ou `{ "txt": "ouest" }` (ne compte pas dans les totaux) ou `null` (effacée).

### referentiel/vehicules.json
```json
{ "version": 1, "vehicules": { "<id>": { "id": "…", "nom": "FOURGON 5", "section": "semaine", "ordre": 5, "actif": true, "t": 1767225600000 } } }
```
`section` = `semaine` ou `dimanche` : « FOURGON 5 » peut exister dans les deux. Comme pour les agents : désactiver garde l'historique, supprimer masque partout.

## Import des classeurs Excel

* Les « tableaux Excel » des classeurs de l'équipe font planter ExcelJS : `excel/load.ts` les retire en mémoire avant lecture.
* L'en-tête (jours 1 à 31, souvent stockés comme du texte) est repéré dynamiquement : sa ligne varie d'un mois à l'autre.
* Poids : séparateur `DIMANCHE…`, arrêt à la ligne `… total`, additions `=600+980+660` conservées comme plusieurs vidages, textes (`ouest`) conservés.
  Les tournées nouvelles sont insérées après leur voisine de la feuille ; un doublon de nom dans une même section devient « NOM (2) ».
* Les imports n'écrasent jamais une case déjà saisie et sont idempotents.

## Concurrence (pas de serveur)

* Chaque modification est un **patch** (une case) envoyé au processus principal, qui, sous verrou :
  1. relit le fichier du disque, 2. applique la case avec `t = Date.now()`, 3. écrit de façon atomique.
  On ne réécrit donc jamais l'état d'un poste sur celui des autres.
* Fusion : par case, la modification la plus récente gagne (`t`, puis `by` pour départager). Commutative et idempotente.
* Verrou : fichier `<fichier>.lock` créé en mode exclusif, considéré périmé après 15 s.
* Écriture atomique : fichier temporaire dans le même dossier puis `rename`. Un JSON illisible n'est jamais écrasé.
* Rafraîchissement : sondage des `mtime/size` toutes les 3 s (`fs.watch` n'est pas fiable sur SMB). Les écritures du poste lui-même sont ignorées.
* Hypothèse : les horloges des postes sont à peu près synchronisées (domaine Windows).

/** Code d'une prestation (« VN », « OM »…). La liste est libre : voir `Prestation`. */
export type Code = string;

/** Prestation (type d'heure sup). Le `code` est la clé stockée dans les cases ; il ne change plus après création. */
export interface Prestation {
  code: Code;
  label: string;
  /** Couleur de la pastille, `#RRGGBB`. */
  color: string;
  ordre: number;
  actif: boolean;
  supprime?: boolean;
  t: number;
}

/** Fichier referentiel/prestations.json */
export interface PrestationsDoc {
  version: 1;
  prestations: Record<string, Prestation>;
}

/** Prestations proposées au premier lancement ; ensuite tout est modifiable. */
export const DEFAULT_PRESTATIONS: Omit<Prestation, 't'>[] = [
  { code: 'VN', label: 'Vieux Nice', color: '#2E9E5B', ordre: 1, actif: true },
  { code: 'OM', label: 'Ordures ménagères', color: '#2F80ED', ordre: 2, actif: true },
  { code: 'ES', label: 'Encombrants soir', color: '#B8661A', ordre: 3, actif: true },
  { code: 'EX', label: 'Presta ex.', color: '#8E5BD6', ordre: 4, actif: true },
];

/** Une case de la grille. `v = null` = case effacée (on garde l'horodatage pour la fusion). */
export interface CellEntry {
  v: Code | null;
  /** Horodatage (ms epoch) de la dernière modification. */
  t: number;
  /** Poste / utilisateur ayant fait la modification. */
  by: string;
}

/** Fichier hs/AAAA-MM.json */
export interface HsMonthDoc {
  version: 1;
  module: 'hs';
  /** "AAAA-MM" */
  month: string;
  /** Clé = `${agentId}|${jour}` (jour de 1 à 31). */
  cells: Record<string, CellEntry>;
}

export interface Agent {
  id: string;
  nom: string;
  ordre: number;
  actif: boolean;
  matricule?: string;
  /** Agent supprimé : masqué partout (les anciennes saisies restent dans les fichiers). */
  supprime?: boolean;
  t: number;
}

/** Fichier referentiel/agents.json */
export interface AgentsDoc {
  version: 1;
  agents: Record<string, Agent>;
}

export interface AppConfig {
  dataDir: string;
  /** Nom du poste, enregistré dans chaque modification. */
  userName: string;
}

export type ChangeEvent =
  | { kind: 'hs'; month: string }
  | { kind: 'poids'; month: string }
  | { kind: 'agents' }
  | { kind: 'prestations' }
  | { kind: 'vehicules' };

export interface ImportReport {
  agentsCrees: number;
  casesImportees: number;
  casesIgnorees: number;
  moisTrouves: string[];
  avertissements: string[];
}

// ---------- Module Poids des fourgons ----------

/** Contenu d'une case de pesée : des vidages (kg) OU un texte (« ouest », « sapins »…). */
export interface PoidsValue {
  /** Poids de chaque vidage, en kg. Plusieurs valeurs = plusieurs vidages dans la journée (le total est leur somme). */
  p?: number[];
  /** Texte libre : véhicule affecté ailleurs, absent, etc. Ne compte pas dans les totaux. */
  txt?: string;
}

export interface PoidsCellEntry {
  v: PoidsValue | null;
  t: number;
  by: string;
}

/** Fichier poids/AAAA-MM.json */
export interface PoidsMonthDoc {
  version: 1;
  module: 'poids';
  month: string;
  /** Clé = `${vehiculeId}|${jour}` */
  cells: Record<string, PoidsCellEntry>;
}

export type Section = 'semaine' | 'dimanche';

export interface Vehicule {
  id: string;
  nom: string;
  /** « semaine » = lignes du haut ; « dimanche » = bande « Tournées du dimanche ». */
  section: Section;
  ordre: number;
  actif: boolean;
  supprime?: boolean;
  t: number;
}

/** Fichier referentiel/vehicules.json */
export interface VehiculesDoc {
  version: 1;
  vehicules: Record<string, Vehicule>;
}

export interface ImportPoidsReport {
  vehiculesCrees: number;
  casesImportees: number;
  casesIgnorees: number;
  moisTrouves: string[];
  avertissements: string[];
}

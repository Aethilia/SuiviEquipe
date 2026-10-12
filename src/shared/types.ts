/** Codes de prestation des heures sup (dimanches et fériés). */
export const CODES = ['VN', 'OM', 'ES', 'EX'] as const;
export type Code = (typeof CODES)[number];

export const CODE_LABELS: Record<Code, string> = {
  VN: 'Vieux Nice',
  OM: 'Ordures ménagères',
  ES: 'Encombrants soir',
  EX: 'Presta ex.',
};

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

export type ChangeEvent = { kind: 'hs'; month: string } | { kind: 'agents' };

export interface ImportReport {
  agentsCrees: number;
  casesImportees: number;
  casesIgnorees: number;
  moisTrouves: string[];
  avertissements: string[];
}

import type { Agent, AgentsDoc, AppConfig, ChangeEvent, HsMonthDoc, ImportPoidsReport, ImportReport, Code, PoidsMonthDoc, PoidsValue, PrestationsDoc, Section, VehiculesDoc } from './types';

export interface AgentInput {
  id: string;
  nom: string;
  ordre: number;
  actif: boolean;
  matricule?: string;
  supprime?: boolean;
}

export interface VehiculeInput {
  id: string;
  nom: string;
  section: Section;
  ordre: number;
  actif: boolean;
  supprime?: boolean;
}

export interface PrestationInput {
  code: string;
  label: string;
  color: string;
  ordre: number;
  actif: boolean;
  supprime?: boolean;
}

/** API exposée au renderer via le preload (window.api). */
export interface Api {
  config: {
    get(): Promise<AppConfig>;
    set(patch: Partial<AppConfig>): Promise<AppConfig>;
    pickDir(): Promise<string | null>;
    /** Vérifie qu'un dossier (par défaut le dossier configuré) est accessible en écriture et indique s'il contient déjà des données. */
    check(dir?: string): Promise<{ ok: boolean; error?: string; files?: number }>;
  };
  hs: {
    load(month: string): Promise<HsMonthDoc>;
    loadYear(year: number): Promise<HsMonthDoc[]>;
    setCell(month: string, agentId: string, day: number, v: Code | null): Promise<HsMonthDoc>;
  };
  agents: {
    load(): Promise<AgentsDoc>;
    save(list: AgentInput[]): Promise<AgentsDoc>;
  };
  poids: {
    load(month: string): Promise<PoidsMonthDoc>;
    loadYear(year: number): Promise<PoidsMonthDoc[]>;
    setCell(month: string, vehId: string, day: number, v: PoidsValue | null): Promise<PoidsMonthDoc>;
  };
  vehicules: {
    load(): Promise<VehiculesDoc>;
    save(list: VehiculeInput[]): Promise<VehiculesDoc>;
  };
  prestations: {
    load(): Promise<PrestationsDoc>;
    save(list: PrestationInput[]): Promise<PrestationsDoc>;
  };
  excel: {
    exportHs(year: number): Promise<string | null>;
    importHs(year: number): Promise<ImportReport | null>;
    exportPoids(year: number): Promise<string | null>;
    importPoids(year: number): Promise<ImportPoidsReport | null>;
  };
  onChange(cb: (e: ChangeEvent) => void): () => void;
}

export type { Agent };
declare global {
  interface Window {
    api: Api;
  }
}

import type { Agent, AgentsDoc, AppConfig, ChangeEvent, HsMonthDoc, ImportReport, Code } from './types';

export interface AgentInput {
  id: string;
  nom: string;
  ordre: number;
  actif: boolean;
  matricule?: string;
}

/** API exposée au renderer via le preload (window.api). */
export interface Api {
  config: {
    get(): Promise<AppConfig>;
    set(patch: Partial<AppConfig>): Promise<AppConfig>;
    pickDir(): Promise<string | null>;
    /** Vérifie que le dossier est accessible en écriture. */
    check(): Promise<{ ok: boolean; error?: string }>;
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
  excel: {
    exportHs(year: number): Promise<string | null>;
    importHs(year: number): Promise<ImportReport | null>;
  };
  onChange(cb: (e: ChangeEvent) => void): () => void;
}

export type { Agent };
declare global {
  interface Window {
    api: Api;
  }
}

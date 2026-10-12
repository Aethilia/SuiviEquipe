import type { Agent, AgentsDoc, CellEntry, Code, HsMonthDoc } from './types';

type Stamped = { t: number; by?: string };

/** Vrai si `a` l'emporte sur `b` (plus récent ; à égalité, départage déterministe). */
export function wins(a: Stamped, b: Stamped): boolean {
  if (a.t !== b.t) return a.t > b.t;
  return (a.by ?? '') > (b.by ?? '');
}

export const cellKey = (agentId: string, day: number): string => `${agentId}|${day}`;

export function emptyMonth(month: string): HsMonthDoc {
  return { version: 1, module: 'hs', month, cells: {} };
}

export function emptyAgents(): AgentsDoc {
  return { version: 1, agents: {} };
}

/** Fusion case par case : la modification la plus récente gagne. Commutative et idempotente. */
export function mergeMonth(a: HsMonthDoc, b: HsMonthDoc): HsMonthDoc {
  const cells: Record<string, CellEntry> = { ...a.cells };
  for (const [k, entry] of Object.entries(b.cells)) {
    const cur = cells[k];
    if (!cur || wins(entry, cur)) cells[k] = entry;
  }
  return { ...a, cells };
}

export function mergeAgents(a: AgentsDoc, b: AgentsDoc): AgentsDoc {
  const agents: Record<string, Agent> = { ...a.agents };
  for (const [id, ag] of Object.entries(b.agents)) {
    const cur = agents[id];
    if (!cur || ag.t > cur.t || (ag.t === cur.t && ag.nom > cur.nom)) agents[id] = ag;
  }
  return { ...a, agents };
}

/** Applique une modification locale (sans muter le document d'origine). */
export function applyCell(doc: HsMonthDoc, agentId: string, day: number, v: Code | null, t: number, by: string): HsMonthDoc {
  const entry: CellEntry = { v, t, by };
  const k = cellKey(agentId, day);
  const cur = doc.cells[k];
  if (cur && !wins(entry, cur)) return doc;
  return { ...doc, cells: { ...doc.cells, [k]: entry } };
}

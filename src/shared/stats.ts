import { cellKey } from './merge';
import { CODES, type Agent, type Code, type HsMonthDoc } from './types';

export function cellValue(doc: HsMonthDoc, agentId: string, day: number): Code | null {
  return doc.cells[cellKey(agentId, day)]?.v ?? null;
}

/** Agents actifs + agents désactivés qui ont des saisies dans l'un des documents. Triés par ordre puis nom. */
export function visibleAgents(agents: Agent[], docs: HsMonthDoc[]): Agent[] {
  const used = new Set<string>();
  for (const d of docs) for (const [k, e] of Object.entries(d.cells)) if (e.v) used.add(k.split('|')[0]);
  return agents
    .filter((a) => a.actif || used.has(a.id))
    .sort((x, y) => x.ordre - y.ordre || x.nom.localeCompare(y.nom, 'fr'));
}

export interface MonthStats {
  total: number;
  byAgent: Record<string, number>;
  /** Index 0 = jour 1. */
  byDay: number[];
  byCode: Record<Code, number>;
  mobilises: number;
}

export function monthStats(doc: HsMonthDoc, agentIds: string[], nbDays: number): MonthStats {
  const ids = new Set(agentIds);
  const s: MonthStats = {
    total: 0,
    byAgent: Object.fromEntries(agentIds.map((id) => [id, 0])),
    byDay: Array.from({ length: nbDays }, () => 0),
    byCode: Object.fromEntries(CODES.map((c) => [c, 0])) as Record<Code, number>,
    mobilises: 0,
  };
  for (const [k, e] of Object.entries(doc.cells)) {
    if (!e.v) continue;
    const [id, d] = k.split('|');
    const day = Number(d);
    if (!ids.has(id) || day < 1 || day > nbDays) continue;
    s.total++;
    s.byAgent[id]++;
    s.byDay[day - 1]++;
    s.byCode[e.v]++;
  }
  s.mobilises = Object.values(s.byAgent).filter((n) => n > 0).length;
  return s;
}

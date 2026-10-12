import crypto from 'node:crypto';
import { MONTHS_FR, monthKey } from '../../src/shared/calendar';
import { cellKey, emptyMonth } from '../../src/shared/merge';
import { findMatch, nameKey } from '../../src/shared/names';
import type { HsMonthDoc, ImportReport } from '../../src/shared/types';
import { getConfig } from '../config';
import { listPrestations } from '../../src/shared/prestations';
import { loadAgents, loadPrestations, saveAgents, updateMonth } from '../storage';
import { loadWorkbook } from './load';
import { parseHsWorkbook } from './parseHs';

export async function importHs(year: number, file: string): Promise<ImportReport> {
  const codes = listPrestations(await loadPrestations()).map((p) => p.code);
  const parsed = parseHsWorkbook(await loadWorkbook(file), year, codes);
  const report: ImportReport = { agentsCrees: 0, casesImportees: 0, casesIgnorees: 0, moisTrouves: [], avertissements: parsed.warnings };

  // 1. Agents : rapprochement avec l'existant, création des autres.
  const existing = Object.values((await loadAgents()).agents).filter((a) => !a.supprime);
  const idByKey = new Map<string, string>();
  const toSave: { id: string; nom: string; ordre: number; actif: boolean; matricule?: string }[] = [];
  let ordre = existing.reduce((mx, a) => Math.max(mx, a.ordre), 0);
  const known = [...existing];
  for (const a of parsed.agents) {
    const hit = findMatch(a.nom, known, (x) => x.nom);
    let id: string;
    if (hit) {
      id = hit.item.id;
      if (hit.approx) report.avertissements.push(`« ${a.nom} » rapproché de « ${hit.item.nom} » (orthographe proche).`);
      if (a.matricule && !hit.item.matricule) toSave.push({ id, nom: hit.item.nom, ordre: hit.item.ordre, actif: hit.item.actif, matricule: a.matricule });
    } else {
      id = crypto.randomUUID();
      const created = { id, nom: a.nom, ordre: ++ordre, actif: true, matricule: a.matricule, t: 0 };
      known.push(created);
      toSave.push(created);
      report.agentsCrees++;
    }
    idByKey.set(nameKey(a.nom), id);
  }
  if (toSave.length) await saveAgents(toSave);

  // 2. Saisies : n'écrase jamais une case déjà renseignée.
  const now = Date.now();
  const by = getConfig().userName;
  for (const [mStr, entries] of Object.entries(parsed.months)) {
    const m = Number(mStr);
    if (!entries.length) continue;
    report.moisTrouves.push(MONTHS_FR[m - 1]);
    const incoming: HsMonthDoc = emptyMonth(monthKey(year, m));
    for (const e of entries) {
      const id = idByKey.get(nameKey(e.nom));
      if (id) incoming.cells[cellKey(id, e.day)] = { v: e.code, t: now, by };
    }
    await updateMonth(incoming.month, (disk) => {
      const cells = { ...disk.cells };
      for (const [k, c] of Object.entries(incoming.cells)) {
        if (cells[k]?.v) report.casesIgnorees++;
        else {
          cells[k] = c;
          report.casesImportees++;
        }
      }
      return { ...disk, cells };
    });
  }
  return report;
}

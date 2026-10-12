import crypto from 'node:crypto';
import { MONTHS_FR, monthKey } from '../../src/shared/calendar';
import { emptyPoidsMonth } from '../../src/shared/merge';
import { cellKey } from '../../src/shared/merge';
import { nameKey } from '../../src/shared/names';
import type { ImportPoidsReport, PoidsMonthDoc, Section } from '../../src/shared/types';
import { getConfig } from '../config';
import { loadVehicules, saveVehicules, updatePoidsMonth } from '../storage';
import { loadWorkbook } from './load';
import { parsePoidsWorkbook } from './parsePoids';

export async function importPoids(year: number, file: string): Promise<ImportPoidsReport> {
  const parsed = parsePoidsWorkbook(await loadWorkbook(file), year);
  const report: ImportPoidsReport = { vehiculesCrees: 0, casesImportees: 0, casesIgnorees: 0, moisTrouves: [], avertissements: parsed.warnings };

  // 1. Véhicules : rapprochement exact (section + nom normalisé) avec l'existant, création des autres.
  const existing = Object.values((await loadVehicules()).vehicules).filter((v) => !v.supprime);
  const idByKey = new Map(existing.map((v) => [`${v.section}|${nameKey(v.nom)}`, v.id]));
  let ordre = existing.reduce((m, v) => Math.max(m, v.ordre), 0);
  const toSave: { id: string; nom: string; section: Section; ordre: number; actif: boolean }[] = [];
  for (const section of ['semaine', 'dimanche'] as const) {
    for (const v of parsed.vehicules[section]) {
      const k = `${section}|${v.key}`;
      if (idByKey.has(k)) continue;
      const id = crypto.randomUUID();
      idByKey.set(k, id);
      toSave.push({ id, nom: v.nom, section, ordre: ++ordre, actif: true });
      report.vehiculesCrees++;
    }
  }
  if (toSave.length) await saveVehicules(toSave);

  // 2. Pesées : n'écrase jamais une case déjà renseignée.
  const now = Date.now();
  const by = getConfig().userName;
  for (const [mStr, entries] of Object.entries(parsed.months)) {
    const m = Number(mStr);
    if (!entries.length) continue;
    report.moisTrouves.push(MONTHS_FR[m - 1]);
    const incoming: PoidsMonthDoc = emptyPoidsMonth(monthKey(year, m));
    for (const e of entries) {
      const id = idByKey.get(`${e.section}|${e.key}`);
      if (id) incoming.cells[cellKey(id, e.day)] = { v: e.value, t: now, by };
    }
    await updatePoidsMonth(incoming.month, (disk) => {
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

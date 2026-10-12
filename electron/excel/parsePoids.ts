import type ExcelJS from 'exceljs';
import { daysInMonth, MONTHS_FR } from '../../src/shared/calendar';
import { nameKey } from '../../src/shared/names';
import type { PoidsValue, Section } from '../../src/shared/types';
import { cellText, findDayHeader, plain } from './parseHs';

export interface ParsedPoids {
  /** Véhicules dans l'ordre logique (une liste par section), nouvelles tournées insérées après leur voisine de la feuille. */
  vehicules: Record<Section, { nom: string; key: string }[]>;
  months: Record<number, { section: Section; key: string; day: number; value: PoidsValue }[]>;
  warnings: string[];
}

const cleanName = (s: string): string => s.replace(/\s+/g, ' ').trim();
const monthIndex = (name: string): number => MONTHS_FR.findIndex((m) => nameKey(m) === nameKey(name)) + 1;

/** Valeur d'une case de pesée. `simplified` est incrémenté quand une formule non reconnue est remplacée par son résultat. */
export function toPoidsValue(raw: ExcelJS.CellValue, simplified: { n: number }): PoidsValue | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !(raw instanceof Date) && 'formula' in raw && typeof raw.formula === 'string') {
    // Additions de vidages : « =600+980+660 » → on garde les trois pesées.
    if (/^[\d\s.]+(\+[\d\s.]+)+$/.test(raw.formula)) return { p: raw.formula.split('+').map(Number) };
    if (!/^[\d\s.]+$/.test(raw.formula)) simplified.n++;
  }
  if (typeof raw === 'object' && !(raw instanceof Date) && 'sharedFormula' in raw) simplified.n++;
  const v = plain(raw);
  if (v == null || v instanceof Date) return null;
  if (typeof v === 'number') return v > 0 ? { p: [v] } : null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (/^\d+([.,]\d+)?$/.test(t)) return { p: [Number(t.replace(',', '.'))] };
  return { txt: t.toLowerCase() === 'ouest' ? 'ouest' : t };
}

export function parsePoidsWorkbook(wb: ExcelJS.Workbook, year: number): ParsedPoids {
  const out: ParsedPoids = { vehicules: { semaine: [], dimanche: [] }, months: {}, warnings: [] };
  const simplified = { n: 0 };

  for (const ws of wb.worksheets) {
    const m = monthIndex(ws.name);
    if (!m) continue;
    const header = findDayHeader(ws);
    if (!header) {
      out.warnings.push(`Feuille « ${ws.name} » : ligne des jours (1 à 31) introuvable, feuille ignorée.`);
      continue;
    }
    const { headerRow, dayCol } = header;
    const firstDayCol = Math.min(...dayCol.keys());
    const nbDays = daysInMonth(year, m);
    const entries: ParsedPoids['months'][number] = [];
    const seen = new Set<string>();
    let section: Section = 'semaine';
    let prevKey: string | null = null;

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      let label = '';
      for (let c = 1; c < firstDayCol && !label; c++) label = cellText(row.getCell(c).value);
      label = cleanName(label);
      if (!label) continue;
      if (/total/i.test(label)) break;
      if (nameKey(label).startsWith('dimanche')) {
        section = 'dimanche';
        prevKey = null;
        continue;
      }

      // Même nom deux fois dans la même section et le même mois (ex. « sav » / « SAV ») : on garde les deux lignes.
      let nom = label;
      let key = nameKey(nom);
      for (let k = 2; seen.has(`${section}|${key}`); k++) {
        nom = `${label} (${k})`;
        key = nameKey(nom);
      }
      if (nom !== label) out.warnings.push(`${ws.name} : « ${label} » apparaît deux fois dans la même section, la seconde ligne devient « ${nom} ».`);
      seen.add(`${section}|${key}`);
      if (/^\d+$/.test(label) || label.length <= 2) out.warnings.push(`${ws.name} : libellé de tournée inhabituel « ${label} » (${section}) ; à renommer dans l'onglet Véhicules.`);

      const list = out.vehicules[section];
      if (!list.some((v) => v.key === key)) {
        const at = prevKey ? list.findIndex((v) => v.key === prevKey) + 1 : 0;
        list.splice(at, 0, { nom, key });
      }
      prevKey = key;

      for (const [col, day] of dayCol) {
        if (day > nbDays) continue;
        const value = toPoidsValue(row.getCell(col).value, simplified);
        if (value) entries.push({ section, key, day, value });
      }
    }
    out.months[m] = entries;
  }
  if (simplified.n) out.warnings.push(`${simplified.n} case(s) contenaient une formule autre qu'une addition de vidages : leur résultat a été gardé comme un seul poids.`);
  return out;
}

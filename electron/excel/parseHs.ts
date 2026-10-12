import type ExcelJS from 'exceljs';
import { daysInMonth, MONTHS_FR } from '../../src/shared/calendar';
import { nameKey, splitMatricule } from '../../src/shared/names';
import { CODES, type Code } from '../../src/shared/types';

export interface ParsedHs {
  /** Noms dans l'ordre d'apparition (feuilles mensuelles puis feuille « Noms des employés »). */
  agents: { nom: string; matricule?: string }[];
  /** mois (1-12) → saisies */
  months: Record<number, { nom: string; day: number; code: Code }[]>;
  warnings: string[];
}

/** Valeur "simple" d'une cellule (résultat si formule, texte si rich text). */
export function plain(v: ExcelJS.CellValue): string | number | Date | null {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number' || v instanceof Date) return v;
  if (typeof v === 'boolean') return String(v);
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('result' in v) return plain(v.result as ExcelJS.CellValue);
  if ('text' in v) return String(v.text);
  return null;
}

const text = (v: ExcelJS.CellValue): string => {
  const p = plain(v);
  return p == null || p instanceof Date ? '' : String(p).replace(/\s+/g, ' ').trim();
};

const monthIndex = (sheetName: string): number => {
  const k = nameKey(sheetName);
  return MONTHS_FR.findIndex((m) => k === nameKey(m)) + 1;
};

export function parseHsWorkbook(wb: ExcelJS.Workbook, year: number): ParsedHs {
  const out: ParsedHs = { agents: [], months: {}, warnings: [] };
  const seen = new Set<string>();
  const addAgent = (raw: string) => {
    const a = splitMatricule(raw);
    const k = nameKey(a.nom);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.agents.push(a);
  };
  const unknown = new Map<string, number>();

  for (const ws of wb.worksheets) {
    const m = monthIndex(ws.name);
    if (!m) continue;

    // En-tête : ligne contenant les jours 1..31 en nombres.
    let headerRow = 0;
    const dayCol = new Map<number, number>();
    for (let r = 1; r <= Math.min(ws.rowCount, 20) && !headerRow; r++) {
      const cols = new Map<number, number>();
      ws.getRow(r).eachCell((c, col) => {
        // Les numéros de jour sont parfois stockés comme du texte ("1") dans les classeurs de l'équipe.
        const v = plain(c.value);
        const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,2}$/.test(v.trim()) ? Number(v) : NaN;
        if (Number.isInteger(n) && n >= 1 && n <= 31) cols.set(col, n);
      });
      if (cols.size >= 28) {
        headerRow = r;
        cols.forEach((d, c) => dayCol.set(c, d));
      }
    }
    if (!headerRow) {
      out.warnings.push(`Feuille « ${ws.name} » : ligne des jours (1 à 31) introuvable, feuille ignorée.`);
      continue;
    }
    const firstDayCol = Math.min(...dayCol.keys());
    const nbDays = daysInMonth(year, m);
    const entries: ParsedHs['months'][number] = [];

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      let nom = '';
      for (let c = 1; c < firstDayCol && !nom; c++) nom = text(row.getCell(c).value);
      if (!nom) continue;
      if (/total/i.test(nom)) break; // ligne « Janvier total » : fin du tableau
      addAgent(nom);
      for (const [col, day] of dayCol) {
        const raw = text(row.getCell(col).value);
        if (!raw) continue;
        const code = raw.toUpperCase() as Code;
        if (!(CODES as readonly string[]).includes(code)) {
          unknown.set(raw, (unknown.get(raw) ?? 0) + 1);
        } else if (day <= nbDays) {
          entries.push({ nom: splitMatricule(nom).nom, day, code });
        }
      }
    }
    out.months[m] = entries;
  }

  for (const ws of wb.worksheets) {
    if (!nameKey(ws.name).startsWith('noms')) continue;
    ws.eachRow((row, r) => {
      const t = text(row.getCell(2).value) || text(row.getCell(1).value);
      if (r > 2 && t && nameKey(t) !== nameKey(ws.name)) addAgent(t);
    });
  }
  for (const [v, n] of unknown) out.warnings.push(`Valeur « ${v} » ignorée (${n} case${n > 1 ? 's' : ''}) : ce n'est pas un code VN/OM/ES/EX.`);
  return out;
}

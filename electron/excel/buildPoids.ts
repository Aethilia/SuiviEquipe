import ExcelJS from 'exceljs';
import { dateStr, daysInMonth, MONTHS_FR, WEEKDAY_LETTER, weekday } from '../../src/shared/calendar';
import { holidayMap } from '../../src/shared/holidays';
import { poidsCell, poidsStats, sumKg, visibleVehicules } from '../../src/shared/poids';
import type { PoidsMonthDoc, Vehicule } from '../../src/shared/types';
import { COLORS, box, center, fill } from './style';

const KG = '#,##0';

export function buildPoidsWorkbook(year: number, docs: PoidsMonthDoc[], allVehicules: Vehicule[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Suivi Équipe';
  wb.created = new Date();
  const feries = holidayMap(year);
  const yearTotals = new Map<string, number[]>();
  const sheetVeh = visibleVehicules(allVehicules, docs);
  for (const v of sheetVeh) yearTotals.set(v.id, []);

  docs.forEach((doc, i) => {
    const m = i + 1;
    const n = daysInMonth(year, m);
    const ws = wb.addWorksheet(MONTHS_FR[i], { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }], properties: { tabColor: { argb: COLORS.accent } } });
    const lastDayCol = 1 + n;
    const totalCol = lastDayCol + 1;
    const letter = (c: number) => ws.getColumn(c).letter;
    ws.getColumn(1).width = 28;
    for (let d = 1; d <= n; d++) ws.getColumn(1 + d).width = 7.5;
    ws.getColumn(totalCol).width = 12;

    ws.getCell('A1').value = `Calendrier des poids (kg) – ${MONTHS_FR[i]} ${year}`;
    ws.getCell('A1').font = { size: 16, bold: true, color: { argb: COLORS.dark } };
    ws.getCell('A2').value = 'Un poids en plusieurs vidages est conservé sous forme d\'addition (ex. =600+980+660). Texte grisé : véhicule affecté ailleurs.';
    ws.getCell('A2').font = { size: 9, italic: true, color: { argb: 'FF5F7471' } };

    ws.mergeCells(3, 1, 4, 1);
    ws.mergeCells(3, totalCol, 4, totalCol);
    for (const [col, label] of [[1, 'Tournée'], [totalCol, 'Total kg']] as const) {
      const c = ws.getCell(3, col);
      c.value = label;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = fill(COLORS.accent);
      c.alignment = { ...center, horizontal: col === 1 ? 'left' : 'center', indent: col === 1 ? 1 : 0 };
    }
    const kind: ('normal' | 'sunday' | 'holiday')[] = [];
    for (let d = 1; d <= n; d++) {
      const wd = weekday(year, m, d);
      const k = feries.has(dateStr(year, m, d)) ? 'holiday' : wd === 0 ? 'sunday' : 'normal';
      kind.push(k);
      const bg = k === 'holiday' ? COLORS.holidayHead : k === 'sunday' ? COLORS.sundayHead : COLORS.head;
      for (const [row, val] of [[3, WEEKDAY_LETTER[wd]], [4, d]] as const) {
        const c = ws.getCell(row, 1 + d);
        c.value = val;
        c.fill = fill(bg);
        c.font = { bold: true, size: row === 3 ? 9 : 11, color: { argb: k === 'normal' ? COLORS.dark : 'FFFFFFFF' } };
        c.alignment = center;
        c.border = box;
      }
    }

    const vehs = visibleVehicules(allVehicules, [doc]);
    const stats = poidsStats(doc, vehs.map((v) => v.id), n);
    let r = 5;
    const first = r;
    const writeRows = (list: Vehicule[]) => {
      for (const v of list) {
        const row = ws.getRow(r);
        row.height = 19;
        const nameCell = row.getCell(1);
        nameCell.value = v.nom + (v.actif ? '' : ' (inactif)');
        nameCell.alignment = { vertical: 'middle', indent: 1 };
        nameCell.border = box;
        for (let d = 1; d <= n; d++) {
          const c = row.getCell(1 + d);
          const val = poidsCell(doc, v.id, d);
          c.border = box;
          c.alignment = center;
          if (kind[d - 1] !== 'normal') c.fill = fill(kind[d - 1] === 'holiday' ? COLORS.holiday : COLORS.sunday);
          if (val?.p?.length) {
            c.numFmt = KG;
            c.value = val.p.length > 1 ? { formula: val.p.join('+'), result: sumKg(val) } : val.p[0];
          } else if (val?.txt) {
            c.value = val.txt;
            c.font = { italic: true, size: 9, color: { argb: 'FF8A9C99' } };
          }
        }
        const t = row.getCell(totalCol);
        t.value = { formula: `SUM(B${r}:${letter(lastDayCol)}${r})`, result: stats.byVehicle[v.id] ?? 0 };
        t.numFmt = KG;
        t.font = { bold: true, color: { argb: COLORS.accent } };
        t.alignment = center;
        t.border = box;
        r++;
      }
    };
    writeRows(vehs.filter((v) => v.section === 'semaine'));
    const dim = vehs.filter((v) => v.section === 'dimanche');
    if (dim.length) {
      ws.mergeCells(r, 1, r, totalCol);
      const sep = ws.getCell(r, 1);
      sep.value = 'DIMANCHE';
      sep.font = { bold: true, color: { argb: COLORS.sundayHead } };
      sep.fill = fill(COLORS.sunday);
      sep.alignment = { vertical: 'middle', indent: 1 };
      r++;
      writeRows(dim);
    }
    const last = r - 1;
    const tr = ws.getRow(r);
    tr.height = 21;
    tr.getCell(1).value = `Total ${MONTHS_FR[i].toLowerCase()}`;
    tr.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    for (let d = 1; d <= n; d++) {
      const L = letter(1 + d);
      const c = tr.getCell(1 + d);
      c.value = vehs.length ? { formula: `SUM(${L}${first}:${L}${last})`, result: stats.byDay[d - 1] } : 0;
      c.numFmt = KG;
      c.alignment = center;
    }
    const g = tr.getCell(totalCol);
    g.value = vehs.length ? { formula: `SUM(${letter(totalCol)}${first}:${letter(totalCol)}${last})`, result: stats.totalKg } : 0;
    g.numFmt = KG;
    g.alignment = center;
    for (let c = 1; c <= totalCol; c++) {
      const cell = tr.getCell(c);
      cell.fill = fill(COLORS.totalRow);
      cell.font = { bold: true, color: { argb: COLORS.dark } };
      cell.border = box;
    }
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    for (const v of vehs) yearTotals.get(v.id)![i] = stats.byVehicle[v.id] ?? 0;
  });

  // Synthèse annuelle
  const sy = wb.addWorksheet('Synthèse', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }], properties: { tabColor: { argb: COLORS.dark } } });
  sy.getColumn(1).width = 30;
  for (let c = 2; c <= 14; c++) sy.getColumn(c).width = 10;
  sy.getCell('A1').value = `Synthèse des poids ${year} (kg)`;
  sy.getCell('A1').font = { size: 16, bold: true, color: { argb: COLORS.dark } };
  ['Tournée', ...MONTHS_FR.map((x) => x.slice(0, 4) + '.'), 'Total'].forEach((h, i) => {
    const c = sy.getCell(3, 1 + i);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(COLORS.accent);
    c.alignment = { ...center, horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
  });
  let r = 4;
  const rows: number[] = [];
  for (const section of ['semaine', 'dimanche'] as const) {
    const list = sheetVeh.filter((v) => v.section === section);
    if (section === 'dimanche' && list.length) {
      sy.mergeCells(r, 1, r, 14);
      sy.getCell(r, 1).value = 'DIMANCHE';
      sy.getCell(r, 1).font = { bold: true, color: { argb: COLORS.sundayHead } };
      sy.getCell(r, 1).fill = fill(COLORS.sunday);
      r++;
    }
    for (const v of list) {
      sy.getCell(r, 1).value = v.nom;
      sy.getCell(r, 1).alignment = { indent: 1 };
      let sum = 0;
      for (let mi = 0; mi < 12; mi++) {
        const kg = yearTotals.get(v.id)![mi] ?? 0;
        const c = sy.getCell(r, 2 + mi);
        c.value = kg || null;
        c.numFmt = KG;
        c.alignment = center;
        sum += kg;
      }
      const t = sy.getCell(r, 14);
      t.value = { formula: `SUM(B${r}:M${r})`, result: sum };
      t.numFmt = KG;
      t.font = { bold: true, color: { argb: COLORS.accent } };
      t.alignment = center;
      for (let c = 1; c <= 14; c++) sy.getCell(r, c).border = box;
      rows.push(r);
      r++;
    }
  }
  sy.getCell(r, 1).value = 'Total';
  for (let c = 2; c <= 14; c++) {
    const L = sy.getColumn(c).letter;
    const result = sheetVeh.reduce((s, v) => s + (c === 14 ? yearTotals.get(v.id)!.reduce((x, y) => x + (y ?? 0), 0) : yearTotals.get(v.id)![c - 2] ?? 0), 0);
    sy.getCell(r, c).value = rows.length ? { formula: `SUM(${L}4:${L}${r - 1})`, result } : 0;
    sy.getCell(r, c).numFmt = KG;
    sy.getCell(r, c).alignment = center;
  }
  for (let c = 1; c <= 14; c++) {
    const cell = sy.getCell(r, c);
    cell.fill = fill(COLORS.totalRow);
    cell.font = { bold: true, color: { argb: COLORS.dark } };
    cell.border = box;
  }
  return wb;
}

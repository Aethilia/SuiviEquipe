import ExcelJS from 'exceljs';
import { COLORS, argb, box, center, fill } from './style';
import { dateStr, daysInMonth, MONTHS_FR, WEEKDAY_LETTER, weekday } from '../../src/shared/calendar';
import { holidayMap } from '../../src/shared/holidays';
import { cellValue, monthStats, visibleAgents } from '../../src/shared/stats';
import { FALLBACK_COLOR, textColorOn } from '../../src/shared/prestations';
import type { Agent, HsMonthDoc, Prestation } from '../../src/shared/types';

export function buildHsWorkbook(year: number, docs: HsMonthDoc[], allAgents: Agent[], prestations: Prestation[]): ExcelJS.Workbook {
  const byCode = new Map(prestations.map((p) => [p.code, p]));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Suivi Équipe';
  wb.created = new Date();
  const feries = holidayMap(year);
  const agents = visibleAgents(allAgents, docs);
  const monthTotals: Record<string, number[]> = Object.fromEntries(agents.map((a) => [a.id, []]));

  docs.forEach((doc, i) => {
    const m = i + 1;
    const n = daysInMonth(year, m);
    const ws = wb.addWorksheet(MONTHS_FR[i], { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }], properties: { tabColor: { argb: COLORS.accent } } });
    const lastDayCol = 1 + n;
    const totalCol = lastDayCol + 1;
    ws.getColumn(1).width = 30;
    for (let d = 1; d <= n; d++) ws.getColumn(1 + d).width = 5.2;
    ws.getColumn(totalCol).width = 12;

    ws.getCell('A1').value = `Dimanches et fériés – ${MONTHS_FR[i]} ${year}`;
    ws.getCell('A1').font = { name: 'DM Sans', size: 16, bold: true, color: { argb: COLORS.dark } };
    ws.getCell('A2').value = prestations.map((p) => `${p.code} = ${p.label}`).join('   ·   ');
    ws.getCell('A2').font = { size: 9, italic: true, color: { argb: 'FF5F7471' } };

    // En-têtes (ligne 3 : jour de semaine, ligne 4 : numéro)
    ws.mergeCells(3, 1, 4, 1);
    ws.mergeCells(3, totalCol, 4, totalCol);
    for (const [col, label] of [[1, 'Agent'], [totalCol, 'Total HS']] as const) {
      const c = ws.getCell(3, col);
      c.value = label;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = fill(COLORS.accent);
      c.alignment = { ...center, horizontal: col === 1 ? 'left' : 'center', indent: col === 1 ? 1 : 0 };
    }
    const dayKind: ('normal' | 'sunday' | 'holiday')[] = [];
    for (let d = 1; d <= n; d++) {
      const wd = weekday(year, m, d);
      const kind = feries.has(dateStr(year, m, d)) ? 'holiday' : wd === 0 ? 'sunday' : 'normal';
      dayKind.push(kind);
      const bg = kind === 'holiday' ? COLORS.holidayHead : kind === 'sunday' ? COLORS.sundayHead : COLORS.head;
      const fg = kind === 'normal' ? COLORS.dark : 'FFFFFFFF';
      for (const [row, val] of [[3, WEEKDAY_LETTER[wd]], [4, d]] as const) {
        const c = ws.getCell(row, 1 + d);
        c.value = val;
        c.fill = fill(bg);
        c.font = { bold: true, size: row === 3 ? 9 : 11, color: { argb: fg } };
        c.alignment = center;
        c.border = box;
      }
    }

    // Lignes agents
    const first = 5;
    agents.forEach((a, idx) => {
      const r = first + idx;
      const row = ws.getRow(r);
      row.height = 19;
      const nameCell = row.getCell(1);
      nameCell.value = a.nom + (a.actif ? '' : ' (inactif)');
      nameCell.alignment = { vertical: 'middle', indent: 1 };
      nameCell.border = box;
      let count = 0;
      for (let d = 1; d <= n; d++) {
        const c = row.getCell(1 + d);
        const code = cellValue(doc, a.id, d);
        c.border = box;
        c.alignment = center;
        if (code) {
          count++;
          c.value = code;
          const bg = byCode.get(code)?.color ?? FALLBACK_COLOR;
          c.fill = fill(argb(bg));
          c.font = { bold: true, size: 9, color: { argb: argb(textColorOn(bg)) } };
        } else if (dayKind[d - 1] !== 'normal') {
          c.fill = fill(dayKind[d - 1] === 'holiday' ? COLORS.holiday : COLORS.sunday);
        }
      }
      const t = row.getCell(totalCol);
      t.value = { formula: `COUNTA(B${r}:${ws.getColumn(lastDayCol).letter}${r})`, result: count };
      t.font = { bold: true, color: { argb: COLORS.accent } };
      t.alignment = center;
      t.border = box;
      monthTotals[a.id].push(count);
    });

    // Ligne de totaux par jour
    const last = first + agents.length - 1;
    const totalRow = last + 1;
    const stats = monthStats(doc, agents.map((a) => a.id), n);
    const tr = ws.getRow(totalRow);
    tr.height = 21;
    tr.getCell(1).value = `Total ${MONTHS_FR[i]}`;
    tr.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    for (let d = 1; d <= n; d++) {
      const col = ws.getColumn(1 + d).letter;
      const c = tr.getCell(1 + d);
      c.value = agents.length ? { formula: `COUNTA(${col}${first}:${col}${last})`, result: stats.byDay[d - 1] } : 0;
      c.alignment = center;
    }
    const g = tr.getCell(totalCol);
    g.value = agents.length ? { formula: `SUM(${ws.getColumn(totalCol).letter}${first}:${ws.getColumn(totalCol).letter}${last})`, result: stats.total } : 0;
    g.alignment = center;
    for (let c = 1; c <= totalCol; c++) {
      const cell = tr.getCell(c);
      cell.fill = fill(COLORS.totalRow);
      cell.font = { bold: true, color: { argb: COLORS.dark } };
      cell.border = box;
    }

    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  });

  // Synthèse annuelle
  const sy = wb.addWorksheet('Synthèse', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }], properties: { tabColor: { argb: COLORS.dark } } });
  sy.getColumn(1).width = 30;
  for (let c = 2; c <= 14; c++) sy.getColumn(c).width = 9;
  sy.getCell('A1').value = `Synthèse des heures sup ${year}`;
  sy.getCell('A1').font = { size: 16, bold: true, color: { argb: COLORS.dark } };
  ['Agent', ...MONTHS_FR.map((x) => x.slice(0, 4) + '.'), 'Total'].forEach((h, i) => {
    const c = sy.getCell(3, 1 + i);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(COLORS.accent);
    c.alignment = { ...center, horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
  });
  agents.forEach((a, idx) => {
    const r = 4 + idx;
    sy.getCell(r, 1).value = a.nom;
    sy.getCell(r, 1).alignment = { indent: 1 };
    let sum = 0;
    monthTotals[a.id].forEach((v, mi) => {
      const c = sy.getCell(r, 2 + mi);
      c.value = v || null;
      c.alignment = center;
      sum += v;
    });
    const t = sy.getCell(r, 14);
    t.value = { formula: `SUM(B${r}:M${r})`, result: sum };
    t.font = { bold: true, color: { argb: COLORS.accent } };
    t.alignment = center;
    for (let c = 1; c <= 14; c++) sy.getCell(r, c).border = box;
  });
  const sr = 4 + agents.length;
  sy.getCell(sr, 1).value = 'Total';
  for (let c = 2; c <= 14; c++) {
    const L = sy.getColumn(c).letter;
    const cell = sy.getCell(sr, c);
    const result = agents.reduce((s, a) => s + (c === 14 ? monthTotals[a.id].reduce((x, y) => x + y, 0) : monthTotals[a.id][c - 2] ?? 0), 0);
    cell.value = agents.length ? { formula: `SUM(${L}4:${L}${sr - 1})`, result } : 0;
    cell.alignment = center;
  }
  for (let c = 1; c <= 14; c++) {
    const cell = sy.getCell(sr, c);
    cell.fill = fill(COLORS.totalRow);
    cell.font = { bold: true, color: { argb: COLORS.dark } };
    cell.border = box;
  }
  return wb;
}

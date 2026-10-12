import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadWorkbook } from '../electron/excel/load';
import { parseHsWorkbook } from '../electron/excel/parseHs';
import { buildHsWorkbook } from '../electron/excel/buildHs';
import { applyCell, emptyMonth } from '../src/shared/merge';
import { monthKey } from '../src/shared/calendar';
import { parsePoidsWorkbook } from '../electron/excel/parsePoids';
import { buildPoidsWorkbook } from '../electron/excel/buildPoids';
import { applyPoidsCell, emptyPoidsMonth } from '../src/shared/merge';
import { sumKg } from '../src/shared/poids';

const REAL = process.env.HS_XLSX ?? '';

describe.skipIf(!REAL || !fs.existsSync(REAL))('import du vrai classeur', () => {
  it('lit les 12 mois, minuscules comprises', async () => {
    const p = parseHsWorkbook(await loadWorkbook(REAL), 2026, ['VN', 'OM', 'ES', 'EX']);
    console.log(Object.entries(p.months).map(([m, e]) => `${m}:${e.length}`).join(' '), '| agents', p.agents.length, '\n', p.warnings);
    expect(Object.keys(p.months)).toHaveLength(12);
    expect(p.months[1].length).toBe(59); // janvier : somme des "Total des jours" de la feuille
    expect(p.agents.length).toBeGreaterThan(28);
  });
});

describe('export', () => {
  it('produit un classeur avec formules et couleurs', async () => {
    const agents = [{ id: 'a', nom: 'Dupont Jean', ordre: 1, actif: true, t: 0 }];
    const docs = Array.from({ length: 12 }, (_, i) => emptyMonth(monthKey(2026, i + 1)));
    docs[0] = applyCell(docs[0], 'a', 4, 'VN', 1, 'x');
    const wb = buildHsWorkbook(2026, docs, agents, [{ code: 'VN', label: 'Vieux Nice', color: '#2E9E5B', ordre: 1, actif: true, t: 0 }]);
    expect(wb.worksheets).toHaveLength(13);
    const ws = wb.getWorksheet('Janvier')!;
    expect(ws.getCell('E5').value).toBe('VN');
    expect(ws.getCell('E5').fill).toMatchObject({ fgColor: { argb: 'FF2E9E5B' } });
    // 1er janvier = férié
    expect(ws.getCell('B4').fill).toMatchObject({ fgColor: { argb: 'FFB03A2E' } });
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(5000);
  });
});

const REAL_P = process.env.POIDS_XLSX ?? '';

describe.skipIf(!REAL_P || !fs.existsSync(REAL_P))('import du vrai classeur des poids', () => {
  it('les totaux par mois correspondent à ceux d\'Excel', async () => {
    const wb = await loadWorkbook(REAL_P);
    const p = parsePoidsWorkbook(wb, 2026);
    expect(Object.keys(p.months)).toHaveLength(12);
    // Avril, août, septembre et décembre : la ligne TOTAL du classeur d'origine est fausse ou non calculée
    // (avril omet la ligne FOURGON 1 = 27 950 kg). Les 8 autres mois doivent correspondre au kg près.
    const exact = ['Janvier', 'Février', 'Mars', 'Mai', 'Juin', 'Juillet', 'Octobre', 'Novembre'];
    for (const ws of wb.worksheets.slice(0, 12)) {
      if (!exact.includes(ws.name)) continue;
      let excel = 0;
      for (let r = 6; r <= ws.rowCount; r++) {
        const lab = ws.getRow(r).getCell(2).value;
        const t = typeof lab === 'string' ? lab : lab && typeof lab === 'object' && 'result' in lab ? String(lab.result) : '';
        if (!/total/i.test(t)) continue;
        for (let c = 3; c <= 33; c++) {
          const v = ws.getRow(r).getCell(c).value;
          excel += typeof v === 'object' && v && 'result' in v ? Number(v.result) || 0 : typeof v === 'number' ? v : 0;
        }
        break;
      }
      const mine = (p.months[wb.worksheets.indexOf(ws) + 1] ?? []).reduce((s, e) => s + sumKg(e.value), 0);
      expect(mine, ws.name).toBe(excel);
    }
    expect(p.warnings.some((w) => w.includes('« 9 »'))).toBe(true);
  });
});

describe('export poids', () => {
  it('conserve les additions de vidages sous forme de formule', async () => {
    const veh = [
      { id: 'v1', nom: 'FOURGON 1', section: 'semaine' as const, ordre: 1, actif: true, t: 0 },
      { id: 'v2', nom: 'FOURGON nord', section: 'dimanche' as const, ordre: 2, actif: true, t: 0 },
    ];
    let d = emptyPoidsMonth('2026-01');
    d = applyPoidsCell(d, 'v1', 2, { p: [600, 980, 660] }, 1, 'x');
    d = applyPoidsCell(d, 'v1', 3, { txt: 'ouest' }, 1, 'x');
    d = applyPoidsCell(d, 'v2', 4, { p: [2100] }, 1, 'x');
    const docs = Array.from({ length: 12 }, (_, i) => (i === 0 ? d : emptyPoidsMonth(monthKey(2026, i + 1))));
    const ws = buildPoidsWorkbook(2026, docs, veh).getWorksheet('Janvier')!;
    expect(ws.getCell('C5').value).toEqual({ formula: '600+980+660', result: 2240 });
    expect(ws.getCell('D5').value).toBe('ouest');
    expect(ws.getCell('A6').value).toBe('DIMANCHE');
    expect(ws.getCell('E7').value).toBe(2100);
    expect(ws.getCell('B8').value).toMatchObject({ formula: 'SUM(B5:B7)' });
  });
});

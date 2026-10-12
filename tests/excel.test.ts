import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadWorkbook } from '../electron/excel/load';
import { parseHsWorkbook } from '../electron/excel/parseHs';
import { buildHsWorkbook } from '../electron/excel/buildHs';
import { applyCell, emptyMonth } from '../src/shared/merge';
import { monthKey } from '../src/shared/calendar';

const REAL = process.env.HS_XLSX ?? '';

describe.skipIf(!REAL || !fs.existsSync(REAL))('import du vrai classeur', () => {
  it('lit les 12 mois, minuscules comprises', async () => {
    const p = parseHsWorkbook(await loadWorkbook(REAL), 2026);
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
    const wb = buildHsWorkbook(2026, docs, agents);
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

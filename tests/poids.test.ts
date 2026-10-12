import { describe, expect, it } from 'vitest';
import { formatPoidsInput, parsePoidsInput, poidsStats, weeksOfMonth } from '../src/shared/poids';
import { applyPoidsCell, emptyPoidsMonth, mergePoidsMonth } from '../src/shared/merge';

describe('saisie des poids', () => {
  it('comprend un poids, une addition, un texte ou un effacement', () => {
    expect(parsePoidsInput('1460')).toEqual({ p: [1460] });
    expect(parsePoidsInput('=600+980+660')).toEqual({ p: [600, 980, 660] });
    expect(parsePoidsInput(' 600 + 980 ')).toEqual({ p: [600, 980] });
    expect(parsePoidsInput('1 460,5')).toEqual({ p: [1460.5] });
    expect(parsePoidsInput('OUEST')).toEqual({ txt: 'ouest' });
    expect(parsePoidsInput('sapins')).toEqual({ txt: 'sapins' });
    expect(parsePoidsInput('   ')).toBeNull();
    expect(parsePoidsInput('600*2')).toBe('invalid');
  });
  it('reformate pour l\'édition', () => {
    expect(formatPoidsInput({ p: [600, 980] })).toBe('600+980');
    expect(formatPoidsInput({ txt: 'ouest' })).toBe('ouest');
    expect(formatPoidsInput(null)).toBe('');
  });
});

describe('stats poids', () => {
  it('totaux, vidages, texte ignoré, plage de jours', () => {
    let d = emptyPoidsMonth('2026-01');
    d = applyPoidsCell(d, 'a', 2, { p: [600, 980, 660] }, 1, 'x');
    d = applyPoidsCell(d, 'a', 3, { txt: 'ouest' }, 1, 'x');
    d = applyPoidsCell(d, 'b', 2, { p: [1000] }, 1, 'x');
    d = applyPoidsCell(d, 'b', 20, { p: [500] }, 1, 'x');
    const s = poidsStats(d, ['a', 'b'], 31);
    expect(s.totalKg).toBe(3740);
    expect(s.vidages).toBe(5);
    expect(s.byDay[1]).toBe(3240);
    expect(s.joursActifs).toBe(2);
    expect(poidsStats(d, ['a', 'b'], 31, 1, 7).totalKg).toBe(3240);
  });
  it('fusion : la saisie la plus récente gagne', () => {
    const base = emptyPoidsMonth('2026-01');
    const a = applyPoidsCell(base, 'a', 1, { p: [1] }, 10, 'A');
    const b = applyPoidsCell(base, 'a', 1, { p: [2] }, 20, 'B');
    expect(mergePoidsMonth(a, b).cells['a|1'].v).toEqual({ p: [2] });
    expect(mergePoidsMonth(b, a).cells['a|1'].v).toEqual({ p: [2] });
  });
  it('semaines (lundi→dimanche) : janvier 2026 commence un jeudi', () => {
    expect(weeksOfMonth(31, 4)).toEqual([{ from: 1, to: 4 }, { from: 5, to: 11 }, { from: 12, to: 18 }, { from: 19, to: 25 }, { from: 26, to: 31 }]);
    expect(weeksOfMonth(28, 0)).toEqual([{ from: 1, to: 1 }, { from: 2, to: 8 }, { from: 9, to: 15 }, { from: 16, to: 22 }, { from: 23, to: 28 }]);
  });
});

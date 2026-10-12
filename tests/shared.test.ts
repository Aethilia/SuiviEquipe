import { describe, expect, it } from 'vitest';
import { easter, holidaysOf } from '../src/shared/holidays';
import { applyCell, emptyMonth, mergeMonth } from '../src/shared/merge';
import { findMatch, splitMatricule } from '../src/shared/names';
import { monthStats } from '../src/shared/stats';

describe('jours fériés', () => {
  it('calcule Pâques', () => {
    expect(easter(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
    expect(easter(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
    expect(easter(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
  });
  it('liste les 11 fériés 2026', () => {
    const h = Object.fromEntries(holidaysOf(2026).map((x) => [x.nom, x.date]));
    expect(Object.keys(h)).toHaveLength(11);
    expect(h['Lundi de Pâques']).toBe('2026-04-06');
    expect(h['Ascension']).toBe('2026-05-14');
    expect(h['Lundi de Pentecôte']).toBe('2026-05-25');
  });
});

describe('fusion case par case', () => {
  it('garde la modification la plus récente, quel que soit l\'ordre', () => {
    const base = emptyMonth('2026-01');
    const a = applyCell(base, 'x', 4, 'VN', 100, 'A');
    const b = applyCell(base, 'x', 4, 'OM', 200, 'B');
    const c = applyCell(base, 'y', 5, 'ES', 150, 'A');
    expect(mergeMonth(a, b).cells['x|4'].v).toBe('OM');
    expect(mergeMonth(b, a).cells['x|4'].v).toBe('OM');
    expect(Object.keys(mergeMonth(mergeMonth(a, c), b).cells).sort()).toEqual(['x|4', 'y|5']);
  });
  it('effacer est une modification (tombstone) qui se propage', () => {
    const a = applyCell(emptyMonth('2026-01'), 'x', 1, 'VN', 100, 'A');
    const b = applyCell(a, 'x', 1, null, 300, 'B');
    expect(mergeMonth(a, b).cells['x|1'].v).toBeNull();
  });
  it('statistiques', () => {
    let d = emptyMonth('2026-01');
    d = applyCell(d, 'x', 4, 'VN', 1, 'A');
    d = applyCell(d, 'x', 11, 'VN', 1, 'A');
    d = applyCell(d, 'y', 4, 'OM', 1, 'A');
    d = applyCell(d, 'z', 4, null, 1, 'A');
    const s = monthStats(d, ['x', 'y', 'z'], 31);
    expect(s.total).toBe(3);
    expect(s.mobilises).toBe(2);
    expect(s.byDay[3]).toBe(2);
    expect(s.byCode.VN).toBe(2);
  });
});

describe('noms', () => {
  it('sépare le matricule', () => {
    expect(splitMatricule('Giuglaris Bastien  M0159858 ')).toEqual({ nom: 'Giuglaris Bastien', matricule: 'M0159858' });
    expect(splitMatricule('Houziaux Kevin')).toEqual({ nom: 'Houziaux Kevin' });
  });
  it('rapproche les orthographes proches mais pas les homonymes de nom de famille', () => {
    const list = ['Selvi Andreas', 'Cucchiara Brandon', 'Cucchiara Richard'];
    expect(findMatch('Selvi Andrés', list, (x) => x)?.item).toBe('Selvi Andreas');
    expect(findMatch('Oliviéri Stéphane', ['Olivieri Stephane'], (x) => x)?.approx).toBe(false);
    expect(findMatch('Cucchiara Jean', list, (x) => x)).toBeNull();
  });
});

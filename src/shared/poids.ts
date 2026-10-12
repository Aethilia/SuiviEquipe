import { cellKey } from './merge';
import type { PoidsMonthDoc, PoidsValue, Section, Vehicule } from './types';

export const sumKg = (v: PoidsValue | null | undefined): number => (v?.p ? v.p.reduce((s, x) => s + x, 0) : 0);

const num = (s: string): number => Number(s.replace(/\s/g, '').replace(',', '.'));

/**
 * Interprète ce que l'utilisateur tape dans une case.
 *  - vide → `null` (efface) ;  « 1460 » → un vidage ;  « 600+980+660 » ou « =600+980+660 » → trois vidages ;
 *  - tout le reste est du texte libre (« ouest », « sapins »). Renvoie `'invalid'` pour une addition mal formée.
 */
export function parsePoidsInput(raw: string): PoidsValue | null | 'invalid' {
  let s = raw.trim();
  if (!s) return null;
  if (s.startsWith('=')) s = s.slice(1).trim();
  if (/^[\d\s.,+]+$/.test(s) && /\d/.test(s)) {
    const parts = s.split('+').map((x) => x.trim()).filter(Boolean).map(num);
    if (!parts.length || parts.some((x) => !Number.isFinite(x) || x < 0)) return 'invalid';
    return { p: parts };
  }
  if (/^[\d\s.,+\-*/()]+$/.test(s)) return 'invalid'; // formule arithmétique non gérée : on ne la prend pas pour du texte
  return { txt: s.toLowerCase() === 'ouest' ? 'ouest' : s };
}

/** Texte à afficher dans l'éditeur pour modifier une valeur existante. */
export function formatPoidsInput(v: PoidsValue | null | undefined): string {
  if (!v) return '';
  if (v.txt != null) return v.txt;
  return (v.p ?? []).join('+');
}

export const fmtKg = (n: number): string => Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ');

/** Même rangement que la grille : par section, puis ordre, puis nom. Les véhicules inactifs ne restent que s'ils ont des pesées. */
export function visibleVehicules(vehicules: Vehicule[], docs: PoidsMonthDoc[], section?: Section): Vehicule[] {
  const used = new Set<string>();
  for (const d of docs) for (const [k, e] of Object.entries(d.cells)) if (e.v) used.add(k.split('|')[0]);
  return vehicules
    .filter((v) => !v.supprime && (!section || v.section === section) && (v.actif || used.has(v.id)))
    .sort((x, y) => x.ordre - y.ordre || x.nom.localeCompare(y.nom, 'fr'));
}

export interface PoidsStats {
  totalKg: number;
  byVehicle: Record<string, number>;
  /** Index 0 = jour 1 */
  byDay: number[];
  /** Nombre de vidages (une addition de 3 valeurs = 3). */
  vidages: number;
  /** Jours avec au moins une pesée. */
  joursActifs: number;
}

/** Statistiques sur une plage de jours [from, to] (inclus) ; les véhicules à compter sont donnés explicitement. */
export function poidsStats(doc: PoidsMonthDoc, vehIds: string[], nbDays: number, from = 1, to = nbDays): PoidsStats {
  const ids = new Set(vehIds);
  const s: PoidsStats = { totalKg: 0, byVehicle: Object.fromEntries(vehIds.map((id) => [id, 0])), byDay: Array.from({ length: nbDays }, () => 0), vidages: 0, joursActifs: 0 };
  for (const [k, e] of Object.entries(doc.cells)) {
    const kg = sumKg(e.v);
    if (!kg) continue;
    const [id, d] = k.split('|');
    const day = Number(d);
    if (!ids.has(id) || day < from || day > to || day > nbDays) continue;
    s.totalKg += kg;
    s.byVehicle[id] += kg;
    s.byDay[day - 1] += kg;
    s.vidages += e.v!.p!.length;
  }
  s.joursActifs = s.byDay.filter((x, i) => x > 0 && i + 1 >= from && i + 1 <= to).length;
  return s;
}

export const poidsCell = (doc: PoidsMonthDoc, vehId: string, day: number): PoidsValue | null => doc.cells[cellKey(vehId, day)]?.v ?? null;

/** Semaines (lundi→dimanche) recoupant le mois : [{from,to}] en numéros de jour. */
export function weeksOfMonth(nbDays: number, firstWeekday: number): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let from = 1;
  // firstWeekday : 0 = dimanche … 6 = samedi. Jours restants jusqu'au prochain dimanche inclus.
  let toSunday = (7 - firstWeekday) % 7;
  for (;;) {
    const to = Math.min(nbDays, from + toSunday);
    out.push({ from, to });
    if (to >= nbDays) break;
    from = to + 1;
    toSunday = 6;
  }
  return out;
}

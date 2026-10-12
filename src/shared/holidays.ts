import { dateStr } from './calendar';

export interface Holiday {
  /** AAAA-MM-JJ */
  date: string;
  nom: string;
}

/** Dimanche de Pâques (algorithme grégorien anonyme), en UTC. */
export function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

const fmt = (d: Date): string => dateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

/** Jours fériés légaux français (métropole) de l'année, triés par date. */
export function holidaysOf(year: number): Holiday[] {
  const p = easter(year);
  const list: Holiday[] = [
    { date: dateStr(year, 1, 1), nom: "Jour de l'An" },
    { date: fmt(addDays(p, 1)), nom: 'Lundi de Pâques' },
    { date: dateStr(year, 5, 1), nom: 'Fête du Travail' },
    { date: dateStr(year, 5, 8), nom: 'Victoire 1945' },
    { date: fmt(addDays(p, 39)), nom: 'Ascension' },
    { date: fmt(addDays(p, 50)), nom: 'Lundi de Pentecôte' },
    { date: dateStr(year, 7, 14), nom: 'Fête nationale' },
    { date: dateStr(year, 8, 15), nom: 'Assomption' },
    { date: dateStr(year, 11, 1), nom: 'Toussaint' },
    { date: dateStr(year, 11, 11), nom: 'Armistice 1918' },
    { date: dateStr(year, 12, 25), nom: 'Noël' },
  ];
  return list.sort((x, y) => x.date.localeCompare(y.date));
}

export function holidayMap(year: number): Map<string, string> {
  return new Map(holidaysOf(year).map((h) => [h.date, h.nom]));
}

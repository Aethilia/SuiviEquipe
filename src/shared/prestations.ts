import { DEFAULT_PRESTATIONS, type Code, type Prestation, type PrestationsDoc } from './types';

/** Prestations du référentiel, triées, sans les supprimées. Valeurs par défaut si le référentiel est vide. */
export function listPrestations(doc: PrestationsDoc | null | undefined, opts: { onlyActive?: boolean } = {}): Prestation[] {
  const all = doc && Object.keys(doc.prestations).length ? Object.values(doc.prestations) : DEFAULT_PRESTATIONS.map((p) => ({ ...p, t: 0 }));
  return all
    .filter((p) => !p.supprime && (!opts.onlyActive || p.actif))
    .sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code, 'fr'));
}

export const normalizeCode = (s: string): Code => s.trim().toUpperCase().replace(/\s+/g, '');

/** Texte blanc ou foncé selon la luminosité du fond choisi. */
export function textColorOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? '#0b3b37' : '#ffffff';
}

export const FALLBACK_COLOR = '#7a8b88';

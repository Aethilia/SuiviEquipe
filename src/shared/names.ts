/** Clé de comparaison de noms : sans accents, minuscules, espaces/tirets normalisés. */
export function nameKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-’'.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sépare « Nom Prénom M0161685 » en nom + matricule. */
export function splitMatricule(raw: string): { nom: string; matricule?: string } {
  const clean = raw.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.*?)\s+([A-Z]\d{6,8})$/);
  return m ? { nom: m[1], matricule: m[2] } : { nom: clean };
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Retrouve un nom parmi des candidats : égalité exacte (normalisée), sinon un unique candidat
 * à 2 fautes de frappe près (ex. « Selvi Andrés » ≈ « Selvi Andreas »).
 */
export function findMatch<T>(name: string, candidates: T[], getName: (c: T) => string): { item: T; approx: boolean } | null {
  const key = nameKey(name);
  const exact = candidates.find((c) => nameKey(getName(c)) === key);
  if (exact) return { item: exact, approx: false };
  if (key.length < 8) return null;
  const close = candidates.filter((c) => distance(key, nameKey(getName(c))) <= 2);
  return close.length === 1 ? { item: close[0], approx: true } : null;
}

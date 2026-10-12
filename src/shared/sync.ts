interface Stamped {
  t: number;
  by: string;
}

/** Clés des cases modifiées par un AUTRE poste entre deux versions d'un mois. */
export function remoteChanges(prev: Record<string, Stamped>, next: Record<string, Stamped>, me: string): string[] {
  return Object.keys(next).filter((k) => next[k].by !== me && prev[k]?.t !== next[k].t);
}

const two = (n: number) => String(n).padStart(2, '0');

/** « Modifié par POSTE-02, aujourd'hui à 14:32 » */
export function describeEdit(e: Stamped | undefined | null, now = new Date()): string | undefined {
  if (!e || !e.t) return undefined;
  const d = new Date(e.t);
  const hm = `${two(d.getHours())}:${two(d.getMinutes())}`;
  const sameDay = d.toDateString() === now.toDateString();
  return `Modifié par ${e.by}, ${sameDay ? "aujourd'hui" : `le ${two(d.getDate())}/${two(d.getMonth() + 1)}`} à ${hm}`;
}

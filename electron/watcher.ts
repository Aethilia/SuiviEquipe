import fs from 'node:fs';
import path from 'node:path';
import type { ChangeEvent } from '../src/shared/types';
import { getConfig } from './config';

const sigs = new Map<string, string>();
let timer: NodeJS.Timeout | null = null;
let primed = false;

const sigOf = (st: fs.Stats) => `${st.mtimeMs}:${st.size}`;

/** Mémorise la signature d'un fichier qu'on vient d'écrire pour ne pas la signaler comme "changement distant". */
export async function noteOwnWrite(file: string): Promise<void> {
  try {
    sigs.set(file, sigOf(await fs.promises.stat(file)));
  } catch {
    /* ignoré */
  }
}

async function scan(): Promise<ChangeEvent[]> {
  const events: ChangeEvent[] = [];
  const seen = new Set<string>();
  const root = getConfig().dataDir;
  for (const sub of ['hs', 'referentiel']) {
    let names: string[] = [];
    try {
      names = await fs.promises.readdir(path.join(root, sub));
    } catch {
      continue;
    }
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      const f = path.join(root, sub, n);
      seen.add(f);
      try {
        const sig = sigOf(await fs.promises.stat(f));
        if (sigs.get(f) !== sig) {
          sigs.set(f, sig);
          if (primed) events.push(sub === 'hs' ? { kind: 'hs', month: n.replace(/\.json$/, '') } : { kind: 'agents' });
        }
      } catch {
        /* fichier en cours de remplacement : on réessaie au prochain passage */
      }
    }
  }
  for (const f of [...sigs.keys()]) if (!seen.has(f)) sigs.delete(f);
  primed = true;
  return events;
}

/**
 * Surveillance par sondage (fs.watch n'est pas fiable sur les partages SMB).
 * Un passage toutes les 3 s : quelques `stat` sur ~13 fichiers.
 */
export function startWatcher(emit: (e: ChangeEvent) => void): void {
  stopWatcher();
  let busy = false;
  timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const e of await scan()) emit(e);
    } finally {
      busy = false;
    }
  }, 3000);
}

export function stopWatcher(): void {
  if (timer) clearInterval(timer);
  timer = null;
  sigs.clear();
  primed = false;
}

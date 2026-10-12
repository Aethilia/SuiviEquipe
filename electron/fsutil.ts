import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lit un JSON ; renvoie null si le fichier n'existe pas. Une erreur de parsing est remontée (on n'écrase jamais un fichier illisible). */
export async function readJson<T>(file: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await fs.promises.readFile(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Fichier illisible (JSON invalide) : ${file}`);
  }
}

/** Écriture atomique : fichier temporaire dans le même dossier puis renommage. */
export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 1), 'utf8');
  let lastErr: unknown;
  // Sous Windows, rename peut échouer brièvement (EPERM/EBUSY) si un antivirus ou un autre poste lit le fichier.
  for (let i = 0; i < 8; i++) {
    try {
      await fs.promises.rename(tmp, file);
      return;
    } catch (e) {
      lastErr = e;
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') break;
      await sleep(60 * (i + 1));
    }
  }
  await fs.promises.rm(tmp, { force: true }).catch(() => {});
  throw lastErr;
}

const LOCK_STALE_MS = 15_000;

/**
 * Verrou coopératif par fichier `.lock` (création exclusive), valable sur un partage réseau.
 * Le verrou est considéré périmé après 15 s (poste planté).
 */
export async function withLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const lock = `${file}.lock`;
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      const h = await fs.promises.open(lock, 'wx');
      await h.close();
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try {
        const st = await fs.promises.stat(lock);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          await fs.promises.rm(lock, { force: true });
          continue;
        }
      } catch {
        continue; // le verrou vient d'être libéré
      }
      if (Date.now() > deadline) throw new Error('Le fichier est en cours de modification par un autre poste, réessayez.');
      await sleep(80 + Math.random() * 120);
    }
  }
  try {
    return await fn();
  } finally {
    await fs.promises.rm(lock, { force: true }).catch(() => {});
  }
}

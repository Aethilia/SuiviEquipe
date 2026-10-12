import { app } from 'electron';
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareVersions, parseInstallerName } from '../src/shared/version';
import { getConfig } from './config';
import { log } from './diagnostics';

/** Sous-dossier du dossier partagé où l'on dépose les nouveaux installateurs. */
export const UPDATE_DIR = '_mises-a-jour';
const KEEP = 2; // installateurs conservés dans le dossier

export interface UpdateInfo {
  version: string;
  file: string;
}

const updateDir = (): string => path.join(getConfig().dataDir, UPDATE_DIR);
const attemptFile = (): string => path.join(app.getPath('userData'), 'update-attempt.json');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mise à jour automatique : uniquement dans l'application installée sous Windows (SUIVI_UPDATE_TEST=1 pour les tests). */
export const canAutoUpdate = (): boolean => (app.isPackaged && process.platform === 'win32') || process.env.SUIVI_UPDATE_TEST === '1';

/** Fichier complet ? Un installateur encore en cours de copie change de taille ou vient d'être modifié. */
async function isStable(file: string, waitMs: number): Promise<boolean> {
  try {
    const a = await fs.promises.stat(file);
    if (!a.size) return false;
    await sleep(waitMs);
    const b = await fs.promises.stat(file);
    return a.size === b.size && Date.now() - b.mtimeMs > waitMs;
  } catch {
    return false;
  }
}

/** Installateur le plus récent du dossier partagé, s'il est plus récent que `current` et complet. */
export async function findUpdate(current: string = app.getVersion(), dir: string = updateDir(), waitMs = 1200): Promise<UpdateInfo | null> {
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return null; // dossier absent ou inaccessible : pas de mise à jour
  }
  const candidates = names
    .map((n) => ({ n, v: parseInstallerName(n) }))
    .filter((x): x is { n: string; v: string } => !!x.v && compareVersions(x.v, current) > 0)
    .sort((a, b) => compareVersions(b.v, a.v));
  for (const c of candidates) {
    const file = path.join(dir, c.n);
    if (await isStable(file, waitMs)) return { version: c.v, file };
    log(`mise à jour ${c.v} ignorée pour l'instant : fichier incomplet ou en cours de copie`);
  }
  return null;
}

/** Évite de boucler : si l'installation de cette version vient d'être tentée sans succès, on n'insiste pas avant 30 min. */
export function recentlyAttempted(version: string): boolean {
  try {
    const a = JSON.parse(fs.readFileSync(attemptFile(), 'utf8')) as { version: string; at: number };
    return a.version === version && Date.now() - a.at < 30 * 60_000;
  } catch {
    return false;
  }
}

type Spawn = (cmd: string, args: string[], opts: { detached: boolean; stdio: 'ignore' }) => Pick<ChildProcess, 'unref' | 'on'>;

/**
 * Copie l'installateur en local puis le lance en silence (`/S`) ; `--force-run` relance l'application une fois installée.
 * L'appelant doit ensuite quitter l'application pour que l'installateur puisse remplacer les fichiers.
 */
export async function launchInstaller(u: UpdateInfo, spawn: Spawn = nodeSpawn as Spawn): Promise<void> {
  const local = path.join(os.tmpdir(), `SuiviEquipe-Setup-${u.version}.exe`);
  await fs.promises.copyFile(u.file, local);
  // Supprime la marque « téléchargé depuis Internet » (Windows) pour ne pas déclencher d'avertissement.
  await fs.promises.rm(`${local}:Zone.Identifier`, { force: true }).catch(() => {});
  if (process.platform !== 'win32') await fs.promises.chmod(local, 0o755).catch(() => {});
  fs.writeFileSync(attemptFile(), JSON.stringify({ version: u.version, at: Date.now() }));
  log(`installation de la version ${u.version} (${local})`);
  const child = spawn(local, ['/S', '--force-run'], { detached: true, stdio: 'ignore' });
  child.on('error', (e) => log(`échec du lancement de l'installateur: ${e.message}`));
  child.unref();
}

/** Dépose un installateur dans le dossier partagé (copie atomique) et garde les `KEEP` plus récents. Renvoie sa version. */
export async function publishInstaller(src: string): Promise<string> {
  const name = path.basename(src);
  const version = parseInstallerName(name);
  if (!version) throw new Error(`Le fichier doit s'appeler « SuiviEquipe-Setup-X.Y.Z.exe » (reçu : ${name}).`);
  const dir = updateDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const dest = path.join(dir, `SuiviEquipe-Setup-${version}.exe`);
  const part = `${dest}.part`;
  await fs.promises.copyFile(src, part);
  await fs.promises.rename(part, dest); // visible des autres postes seulement une fois complet
  const all = (await fs.promises.readdir(dir))
    .map((n) => ({ n, v: parseInstallerName(n) }))
    .filter((x): x is { n: string; v: string } => !!x.v)
    .sort((a, b) => compareVersions(b.v, a.v));
  for (const old of all.slice(KEEP)) await fs.promises.rm(path.join(dir, old.n), { force: true }).catch(() => {});
  log(`mise à jour ${version} publiée dans ${dir}`);
  return version;
}

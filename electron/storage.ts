import fs from 'node:fs';
import path from 'node:path';
import { isMonthKey, monthKey } from '../src/shared/calendar';
import { cellKey, applyCell, applyPoidsCell, emptyAgents, emptyMonth, emptyPoidsMonth, emptyPrestations, emptyVehicules, mergeAgents, mergeMonth, mergePrestations, mergeVehicules } from '../src/shared/merge';
import { normalizeCode } from '../src/shared/prestations';
import { DEFAULT_PRESTATIONS, type Agent, type AgentsDoc, type Code, type HsMonthDoc, type PoidsMonthDoc, type PoidsValue, type Prestation, type PrestationsDoc, type Vehicule, type VehiculesDoc } from '../src/shared/types';
import type { AgentInput, PrestationInput, VehiculeInput } from '../src/shared/api';
import { getConfig } from './config';
import { readJson, withLock, writeJsonAtomic } from './fsutil';
import { noteOwnWrite } from './watcher';

const root = () => getConfig().dataDir;
const hsFile = (month: string) => {
  if (!isMonthKey(month)) throw new Error(`Mois invalide : ${month}`);
  return path.join(root(), 'hs', `${month}.json`);
};
const agentsFile = () => path.join(root(), 'referentiel', 'agents.json');
const poidsFile = (month: string) => {
  if (!isMonthKey(month)) throw new Error(`Mois invalide : ${month}`);
  return path.join(root(), 'poids', `${month}.json`);
};
const vehiculesFile = () => path.join(root(), 'referentiel', 'vehicules.json');
const prestationsFile = () => path.join(root(), 'referentiel', 'prestations.json');

/**
 * Horodatage d'une modification : jamais antérieur à la valeur déjà présente sur le disque.
 * Ainsi, même si l'horloge d'un poste retarde sur celle d'un collègue, une modification faite
 * après avoir vu la sienne l'emporte toujours.
 */
const nextT = (prev?: number): number => Math.max(Date.now(), (prev ?? 0) + 1);

const BACKUP_DIR = '_sauvegardes';
const BACKUP_KEEP_DAYS = 30;
const today = (): string => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-JJ, heure locale

/** Avant la première écriture de la journée sur un fichier, on en garde une copie : `_sauvegardes/AAAA-MM-JJ/…`. */
async function backupOnce(file: string): Promise<void> {
  try {
    const rel = path.relative(root(), file).split(path.sep).join('-');
    const dest = path.join(root(), BACKUP_DIR, today(), rel);
    await fs.promises.access(file);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(file, dest, fs.constants.COPYFILE_EXCL);
  } catch {
    /* fichier absent (première écriture), copie déjà faite aujourd'hui, ou partage en lecture seule : sans importance */
  }
}

/** Supprime les sauvegardes de plus de 30 jours. Appelé au démarrage ; les erreurs sont ignorées. */
export async function pruneBackups(): Promise<void> {
  try {
    const base = path.join(root(), BACKUP_DIR);
    const limit = Date.now() - BACKUP_KEEP_DAYS * 86_400_000;
    for (const d of await fs.promises.readdir(base)) {
      const t = Date.parse(d);
      if (Number.isFinite(t) && t < limit) await fs.promises.rm(path.join(base, d), { recursive: true, force: true });
    }
  } catch {
    /* pas de dossier de sauvegardes */
  }
}

async function write(file: string, data: unknown) {
  await backupOnce(file);
  await writeJsonAtomic(file, data);
  await noteOwnWrite(file);
}

// ---------- Heures sup ----------

export async function loadMonth(month: string): Promise<HsMonthDoc> {
  return (await readJson<HsMonthDoc>(hsFile(month))) ?? emptyMonth(month);
}

export async function loadYear(year: number): Promise<HsMonthDoc[]> {
  return Promise.all(Array.from({ length: 12 }, (_, i) => loadMonth(monthKey(year, i + 1))));
}

/** Lecture → modification → écriture sous verrou ; le fichier du disque est toujours fusionné, jamais écrasé. */
export async function updateMonth(month: string, fn: (disk: HsMonthDoc) => HsMonthDoc): Promise<HsMonthDoc> {
  const file = hsFile(month);
  return withLock(file, async () => {
    const disk = (await readJson<HsMonthDoc>(file)) ?? emptyMonth(month);
    const next = fn(disk);
    if (next !== disk) await write(file, next);
    return next;
  });
}

export async function setCell(month: string, agentId: string, day: number, v: Code | null): Promise<HsMonthDoc> {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Jour invalide');
  return updateMonth(month, (disk) => applyCell(disk, agentId, day, v, nextT(disk.cells[cellKey(agentId, day)]?.t), getConfig().userName));
}

export function mergeIntoMonth(month: string, incoming: HsMonthDoc): Promise<HsMonthDoc> {
  return updateMonth(month, (disk) => mergeMonth(disk, incoming));
}

// ---------- Agents ----------

export async function loadAgents(): Promise<AgentsDoc> {
  return (await readJson<AgentsDoc>(agentsFile())) ?? emptyAgents();
}

/** Enregistre les agents modifiés (comparés à la version du disque) avec un nouvel horodatage. */
export async function saveAgents(list: AgentInput[]): Promise<AgentsDoc> {
  const file = agentsFile();
  return withLock(file, async () => {
    const disk = (await readJson<AgentsDoc>(file)) ?? emptyAgents();
    const changed: Record<string, Agent> = {};
    for (const a of list) {
      const nom = a.nom.trim();
      if (!nom) continue;
      const cur = disk.agents[a.id];
      if (cur && cur.nom === nom && cur.ordre === a.ordre && cur.actif === a.actif && cur.matricule === a.matricule && !!cur.supprime === !!a.supprime) continue;
      changed[a.id] = { id: a.id, nom, ordre: a.ordre, actif: a.actif, matricule: a.matricule, supprime: a.supprime || undefined, t: nextT(cur?.t) };
    }
    if (!Object.keys(changed).length) return disk;
    const next = mergeAgents(disk, { version: 1, agents: changed });
    await write(file, next);
    return next;
  });
}

// ---------- Prestations ----------

export async function loadPrestations(): Promise<PrestationsDoc> {
  return (await readJson<PrestationsDoc>(prestationsFile())) ?? emptyPrestations();
}

/** Enregistre les prestations modifiées. Un `code` nouveau crée la prestation ; il n'est plus modifiable ensuite. */
export async function savePrestations(list: PrestationInput[]): Promise<PrestationsDoc> {
  const file = prestationsFile();
  return withLock(file, async () => {
    let disk = (await readJson<PrestationsDoc>(file)) ?? emptyPrestations();
    // Première écriture : on amorce avec les prestations par défaut pour ne pas les perdre.
    if (!Object.keys(disk.prestations).length) {
      disk = { version: 1, prestations: Object.fromEntries(DEFAULT_PRESTATIONS.map((p) => [p.code, { ...p, t: 0 }])) };
    }
    const changed: Record<string, Prestation> = {};
    for (const p of list) {
      const code = normalizeCode(p.code);
      const label = p.label.trim();
      if (!code || !label) continue;
      if (!/^#[0-9a-f]{6}$/i.test(p.color)) throw new Error(`Couleur invalide : ${p.color}`);
      const cur = disk.prestations[code];
      if (cur && cur.label === label && cur.color === p.color && cur.ordre === p.ordre && cur.actif === p.actif && !!cur.supprime === !!p.supprime) continue;
      changed[code] = { code, label, color: p.color, ordre: p.ordre, actif: p.actif, supprime: p.supprime || undefined, t: nextT(cur?.t) };
    }
    if (!Object.keys(changed).length) return disk;
    const next = mergePrestations(disk, { version: 1, prestations: changed });
    await write(file, next);
    return next;
  });
}

// ---------- Poids des fourgons ----------

export async function loadPoidsMonth(month: string): Promise<PoidsMonthDoc> {
  return (await readJson<PoidsMonthDoc>(poidsFile(month))) ?? emptyPoidsMonth(month);
}

export async function loadPoidsYear(year: number): Promise<PoidsMonthDoc[]> {
  return Promise.all(Array.from({ length: 12 }, (_, i) => loadPoidsMonth(monthKey(year, i + 1))));
}

export async function updatePoidsMonth(month: string, fn: (disk: PoidsMonthDoc) => PoidsMonthDoc): Promise<PoidsMonthDoc> {
  const file = poidsFile(month);
  return withLock(file, async () => {
    const disk = (await readJson<PoidsMonthDoc>(file)) ?? emptyPoidsMonth(month);
    const next = fn(disk);
    if (next !== disk) await write(file, next);
    return next;
  });
}

function checkPoidsValue(v: PoidsValue | null): PoidsValue | null {
  if (v === null) return null;
  if (v.txt != null) return { txt: String(v.txt).slice(0, 60) };
  if (!Array.isArray(v.p) || !v.p.length || v.p.some((x) => !Number.isFinite(x) || x < 0 || x > 1_000_000)) throw new Error('Poids invalide');
  return { p: v.p };
}

export async function setPoidsCell(month: string, vehId: string, day: number, v: PoidsValue | null): Promise<PoidsMonthDoc> {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Jour invalide');
  const value = checkPoidsValue(v);
  return updatePoidsMonth(month, (disk) => applyPoidsCell(disk, vehId, day, value, nextT(disk.cells[cellKey(vehId, day)]?.t), getConfig().userName));
}

export async function loadVehicules(): Promise<VehiculesDoc> {
  return (await readJson<VehiculesDoc>(vehiculesFile())) ?? emptyVehicules();
}

export async function saveVehicules(list: VehiculeInput[]): Promise<VehiculesDoc> {
  const file = vehiculesFile();
  return withLock(file, async () => {
    const disk = (await readJson<VehiculesDoc>(file)) ?? emptyVehicules();
    const changed: Record<string, Vehicule> = {};
    for (const a of list) {
      const nom = a.nom.trim();
      if (!nom) continue;
      if (a.section !== 'semaine' && a.section !== 'dimanche') throw new Error('Section invalide');
      const cur = disk.vehicules[a.id];
      if (cur && cur.nom === nom && cur.section === a.section && cur.ordre === a.ordre && cur.actif === a.actif && !!cur.supprime === !!a.supprime) continue;
      changed[a.id] = { id: a.id, nom, section: a.section, ordre: a.ordre, actif: a.actif, supprime: a.supprime || undefined, t: nextT(cur?.t) };
    }
    if (!Object.keys(changed).length) return disk;
    const next = mergeVehicules(disk, { version: 1, vehicules: changed });
    await write(file, next);
    return next;
  });
}

// ---------- Vérification du dossier ----------

export async function checkDir(dir?: string): Promise<{ ok: boolean; error?: string; files?: number }> {
  const base = dir?.trim() || root();
  try {
    await fs.promises.mkdir(base, { recursive: true });
    const probe = path.join(base, `.test-${process.pid}.tmp`);
    await fs.promises.writeFile(probe, 'ok');
    await fs.promises.rm(probe);
    let files = 0;
    for (const sub of ['hs', 'poids']) {
      try {
        files += (await fs.promises.readdir(path.join(base, sub))).filter((f) => f.endsWith('.json')).length;
      } catch {
        /* sous-dossier pas encore créé */
      }
    }
    return { ok: true, files };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

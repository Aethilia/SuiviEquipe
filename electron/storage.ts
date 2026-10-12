import fs from 'node:fs';
import path from 'node:path';
import { isMonthKey, monthKey } from '../src/shared/calendar';
import { applyCell, emptyAgents, emptyMonth, emptyPrestations, mergeAgents, mergeMonth, mergePrestations } from '../src/shared/merge';
import { normalizeCode } from '../src/shared/prestations';
import { DEFAULT_PRESTATIONS, type Agent, type AgentsDoc, type Code, type HsMonthDoc, type Prestation, type PrestationsDoc } from '../src/shared/types';
import type { AgentInput, PrestationInput } from '../src/shared/api';
import { getConfig } from './config';
import { readJson, withLock, writeJsonAtomic } from './fsutil';
import { noteOwnWrite } from './watcher';

const root = () => getConfig().dataDir;
const hsFile = (month: string) => {
  if (!isMonthKey(month)) throw new Error(`Mois invalide : ${month}`);
  return path.join(root(), 'hs', `${month}.json`);
};
const agentsFile = () => path.join(root(), 'referentiel', 'agents.json');
const prestationsFile = () => path.join(root(), 'referentiel', 'prestations.json');

async function write(file: string, data: unknown) {
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

export function setCell(month: string, agentId: string, day: number, v: Code | null): Promise<HsMonthDoc> {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Jour invalide');
  return updateMonth(month, (disk) => applyCell(disk, agentId, day, v, Date.now(), getConfig().userName));
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
    const now = Date.now();
    const changed: Record<string, Agent> = {};
    for (const a of list) {
      const nom = a.nom.trim();
      if (!nom) continue;
      const cur = disk.agents[a.id];
      if (cur && cur.nom === nom && cur.ordre === a.ordre && cur.actif === a.actif && cur.matricule === a.matricule && !!cur.supprime === !!a.supprime) continue;
      changed[a.id] = { id: a.id, nom, ordre: a.ordre, actif: a.actif, matricule: a.matricule, supprime: a.supprime || undefined, t: now };
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
    const now = Date.now();
    const changed: Record<string, Prestation> = {};
    for (const p of list) {
      const code = normalizeCode(p.code);
      const label = p.label.trim();
      if (!code || !label) continue;
      if (!/^#[0-9a-f]{6}$/i.test(p.color)) throw new Error(`Couleur invalide : ${p.color}`);
      const cur = disk.prestations[code];
      if (cur && cur.label === label && cur.color === p.color && cur.ordre === p.ordre && cur.actif === p.actif && !!cur.supprime === !!p.supprime) continue;
      changed[code] = { code, label, color: p.color, ordre: p.ordre, actif: p.actif, supprime: p.supprime || undefined, t: now };
    }
    if (!Object.keys(changed).length) return disk;
    const next = mergePrestations(disk, { version: 1, prestations: changed });
    await write(file, next);
    return next;
  });
}

// ---------- Vérification du dossier ----------

export async function checkDir(): Promise<{ ok: boolean; error?: string }> {
  try {
    await fs.promises.mkdir(root(), { recursive: true });
    const probe = path.join(root(), `.test-${process.pid}.tmp`);
    await fs.promises.writeFile(probe, 'ok');
    await fs.promises.rm(probe);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

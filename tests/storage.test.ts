import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-'));
vi.mock('electron', () => ({ app: { getPath: () => dir } }));

describe('stockage partagé', () => {
  let storage: typeof import('../electron/storage');
  beforeAll(async () => {
    const { setConfig } = await import('../electron/config');
    setConfig({ dataDir: path.join(dir, 'partage'), userName: 'poste-test' });
    storage = await import('../electron/storage');
  });

  it('50 écritures simultanées sur le même mois : aucune perte, aucun fichier corrompu', async () => {
    await Promise.all(Array.from({ length: 50 }, (_, i) => storage.setCell('2026-01', `agent${i % 10}`, (i % 28) + 1, i % 2 ? 'VN' : 'OM')));
    const doc = await storage.loadMonth('2026-01');
    expect(Object.keys(doc.cells).length).toBeGreaterThanOrEqual(28);
    const files = fs.readdirSync(path.join(dir, 'partage', 'hs'));
    expect(files).toEqual(['2026-01.json']); // pas de .tmp ni .lock résiduel
  });

  it('une modification faite par un autre poste entre-temps est conservée', async () => {
    const file = path.join(dir, 'partage', 'hs', '2026-02.json');
    await storage.setCell('2026-02', 'a', 1, 'VN');
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    disk.cells['b|2'] = { v: 'ES', t: Date.now() + 5, by: 'autre-poste' };
    fs.writeFileSync(file, JSON.stringify(disk));
    const merged = await storage.setCell('2026-02', 'a', 3, 'OM');
    expect(Object.keys(merged.cells).sort()).toEqual(['a|1', 'a|3', 'b|2']);
  });

  it('refuse un mois invalide (pas de traversée de dossier) et ne touche pas un JSON illisible', async () => {
    await expect(storage.loadMonth('../../etc')).rejects.toThrow();
    const file = path.join(dir, 'partage', 'hs', '2026-03.json');
    fs.writeFileSync(file, '{ cassé');
    await expect(storage.setCell('2026-03', 'a', 1, 'VN')).rejects.toThrow(/illisible/);
    expect(fs.readFileSync(file, 'utf8')).toBe('{ cassé');
  });

  it('agents : création puis modification', async () => {
    await storage.saveAgents([{ id: 'u1', nom: ' Dupont Jean ', ordre: 1, actif: true }]);
    const doc = await storage.saveAgents([{ id: 'u1', nom: 'Dupont Jean', ordre: 1, actif: false }]);
    expect(doc.agents.u1).toMatchObject({ nom: 'Dupont Jean', actif: false });
  });

  it('prestations : ajout libre, modification, suppression ; couleur invalide refusée', async () => {
    const first = await storage.savePrestations([{ code: ' nu ', label: 'Nettoyage urgent', color: '#112233', ordre: 9, actif: true }]);
    expect(Object.keys(first.prestations).sort()).toEqual(['ES', 'EX', 'NU', 'OM', 'VN']); // les valeurs par défaut sont conservées
    let doc = await storage.savePrestations([{ code: 'NU', label: 'Nettoyage urgent 2', color: '#112233', ordre: 9, actif: true }]);
    expect(doc.prestations.NU.label).toBe('Nettoyage urgent 2');
    doc = await storage.savePrestations([{ code: 'NU', label: 'x', color: '#112233', ordre: 9, actif: true, supprime: true }]);
    expect(doc.prestations.NU.supprime).toBe(true);
    await expect(storage.savePrestations([{ code: 'ZZ', label: 'z', color: 'rouge', ordre: 1, actif: true }])).rejects.toThrow(/Couleur/);
  });

  it('agent supprimé : marqué supprimé, et masqué des listes visibles', async () => {
    const { visibleAgents } = await import('../src/shared/stats');
    await storage.saveAgents([{ id: 'u2', nom: 'Martin Paul', ordre: 2, actif: true }]);
    const doc = await storage.saveAgents([{ id: 'u2', nom: 'Martin Paul', ordre: 2, actif: true, supprime: true }]);
    expect(doc.agents.u2.supprime).toBe(true);
    expect(visibleAgents(Object.values(doc.agents), []).map((a) => a.id)).not.toContain('u2');
  });
});

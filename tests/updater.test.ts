import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upd-'));
vi.mock('electron', () => ({
  app: { getPath: () => root, getVersion: () => '1.0.5', isPackaged: false },
  dialog: { showErrorBox: () => {} },
}));

const share = path.join(root, 'partage');
const dir = path.join(share, '_mises-a-jour');
const put = (name: string, size = 100) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), Buffer.alloc(size, 1));
  const old = new Date(Date.now() - 60_000); // fichier « ancien » : copie terminée
  fs.utimesSync(path.join(dir, name), old, old);
};

describe('mise à jour par le dossier partagé', () => {
  let up: typeof import('../electron/updater');
  beforeAll(async () => {
    const { setConfig } = await import('../electron/config');
    setConfig({ dataDir: share, userName: 'poste-test' });
    up = await import('../electron/updater');
  });

  it('aucune mise à jour : dossier absent, ou versions égales / plus anciennes / noms étrangers', async () => {
    expect(await up.findUpdate('1.0.5', dir, 50)).toBeNull();
    put('SuiviEquipe-Setup-1.0.5.exe');
    put('SuiviEquipe-Setup-1.0.4.exe');
    put('Autre-1.2.0.exe');
    expect(await up.findUpdate('1.0.5', dir, 50)).toBeNull();
  });

  it('choisit la version la plus récente, comparée numériquement', async () => {
    put('SuiviEquipe-Setup-1.0.9.exe');
    put('SuiviEquipe-Setup-1.0.10.exe');
    const u = await up.findUpdate('1.0.5', dir, 50);
    expect(u?.version).toBe('1.0.10');
    expect(path.basename(u!.file)).toBe('SuiviEquipe-Setup-1.0.10.exe');
  });

  it('ignore un installateur encore en cours de copie (taille qui change) et prend le précédent', async () => {
    put('SuiviEquipe-Setup-1.0.11.exe', 10);
    const f = path.join(dir, 'SuiviEquipe-Setup-1.0.11.exe');
    const t = setInterval(() => fs.appendFileSync(f, 'x'.repeat(50)), 10);
    try {
      expect((await up.findUpdate('1.0.5', dir, 150))?.version).toBe('1.0.10');
    } finally {
      clearInterval(t);
    }
  });

  it('lance l\'installateur en silence avec --force-run et mémorise la tentative', async () => {
    const calls: { cmd: string; args: string[] }[] = [];
    const fake = (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { unref: () => {}, on: () => ({}) as never };
    };
    const u = { version: '1.0.10', file: path.join(dir, 'SuiviEquipe-Setup-1.0.10.exe') };
    expect(up.recentlyAttempted('1.0.10')).toBe(false);
    await up.launchInstaller(u, fake as never);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual(['/S', '--force-run']);
    expect(path.dirname(calls[0].cmd)).toBe(os.tmpdir()); // copie locale, pas lancé depuis le partage
    expect(fs.existsSync(calls[0].cmd)).toBe(true);
    expect(up.recentlyAttempted('1.0.10')).toBe(true);
    expect(up.recentlyAttempted('1.0.11')).toBe(false);
  });

  it('publie un installateur : nom contrôlé, copie atomique, ne garde que les 2 plus récents', async () => {
    const src = path.join(root, 'SuiviEquipe-Setup-2.0.0.exe');
    fs.writeFileSync(src, 'installateur');
    expect(await up.publishInstaller(src)).toBe('2.0.0');
    expect(fs.readFileSync(path.join(dir, 'SuiviEquipe-Setup-2.0.0.exe'), 'utf8')).toBe('installateur');
    const names = fs.readdirSync(dir).sort();
    expect(names.filter((n) => n.endsWith('.part'))).toEqual([]);
    expect(names.filter((n) => n.startsWith('SuiviEquipe-Setup-'))).toHaveLength(2);
    expect(names).toContain('SuiviEquipe-Setup-2.0.0.exe');
    const bad = path.join(root, 'Suivi Équipe Setup 2.0.0.exe');
    fs.writeFileSync(bad, 'x');
    await expect(up.publishInstaller(bad)).rejects.toThrow(/doit s'appeler/);
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withLock } from '../electron/fsutil';

describe('verrou de fichier', () => {
  afterEach(() => vi.restoreAllMocks());

  it('réessaie quand Windows répond EPERM (verrou en cours de suppression) au lieu de EEXIST', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-'));
    const file = path.join(dir, 'x.json');
    const real = fs.promises.open.bind(fs.promises);
    let calls = 0;
    vi.spyOn(fs.promises, 'open').mockImplementation(((p: fs.PathLike, flags?: string | number) => {
      if (String(p).endsWith('.lock') && calls++ < 2) return Promise.reject(Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' }));
      return real(p, flags);
    }) as typeof fs.promises.open);
    await expect(withLock(file, async () => 'ok')).resolves.toBe('ok');
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  });

  it('une vraie erreur (dossier inexistant en lecture seule…) n\'est pas avalée', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-'));
    vi.spyOn(fs.promises, 'open').mockRejectedValue(Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' }));
    await expect(withLock(path.join(dir, 'y.json'), async () => 1)).rejects.toThrow('ENOSPC');
  });
});

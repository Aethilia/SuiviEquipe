import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const POSTES = 6;
const WRITES = 20;

function run(worker: string, id: number, env: Record<string, string>): Promise<{ code: number | null; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [worker], { env: { ...process.env, ...env, WORKER_ID: String(id), WRITES: String(WRITES) } });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => resolve({ code, err }));
  });
}

describe('plusieurs postes en même temps (processus séparés, même dossier)', () => {
  it(`${POSTES} postes × ${WRITES} saisies : aucune perte, fichiers valides, aucun résidu`, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-'));
    const worker = path.join(tmp, 'worker.cjs');
    await build({
      entryPoints: ['tests/helpers/worker.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: worker,
      alias: { electron: path.resolve('tests/helpers/electron-stub.ts') },
      external: ['exceljs'],
      logLevel: 'silent',
    });
    const dataDir = path.join(tmp, 'partage');
    const results = await Promise.all(
      Array.from({ length: POSTES }, (_, i) => {
        const userdata = path.join(tmp, `userdata${i}`);
        fs.mkdirSync(userdata);
        return run(worker, i, { DATADIR: dataDir, USERDATA: userdata });
      }),
    );
    for (const r of results) expect(r.err, r.err).toBe('');
    expect(results.map((r) => r.code)).toEqual(Array(POSTES).fill(0));

    const hs = JSON.parse(fs.readFileSync(path.join(dataDir, 'hs', '2026-03.json'), 'utf8'));
    const poids = JSON.parse(fs.readFileSync(path.join(dataDir, 'poids', '2026-03.json'), 'utf8'));
    // chaque poste a ses 20 cases + 1 case partagée
    expect(Object.keys(hs.cells)).toHaveLength(POSTES * WRITES + 1);
    expect(Object.keys(poids.cells)).toHaveLength(POSTES * WRITES);
    for (let i = 0; i < POSTES; i++) {
      for (let d = 1; d <= WRITES; d++) {
        expect(hs.cells[`agent${i}|${d}`]?.v, `agent${i} jour ${d}`).toBe('VN');
        expect(poids.cells[`veh${i}|${d}`]?.v?.p).toEqual([100 + d - 1, 200]);
      }
    }
    // la case disputée contient la dernière valeur écrite par l'un des postes
    expect(['OM', 'ES']).toContain(hs.cells['partage|1'].v);
    // aucun fichier temporaire ni verrou oublié
    const leftovers = [...fs.readdirSync(path.join(dataDir, 'hs')), ...fs.readdirSync(path.join(dataDir, 'poids'))].filter((f) => !f.endsWith('.json'));
    expect(leftovers).toEqual([]);
  }, 120_000);
});

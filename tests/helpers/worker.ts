// Un « poste » : processus indépendant qui saisit des heures sup et des pesées dans le dossier partagé.
import { setConfig } from '../../electron/config';
import { setCell, setPoidsCell } from '../../electron/storage';

const id = process.env.WORKER_ID!;
const n = Number(process.env.WRITES ?? 20);

(async () => {
  setConfig({ dataDir: process.env.DATADIR!, userName: `poste-${id}` });
  for (let i = 0; i < n; i++) {
    await setCell('2026-03', `agent${id}`, i + 1, 'VN'); // cases propres à ce poste
    await setCell('2026-03', 'partage', 1, i % 2 ? 'OM' : 'ES'); // case disputée par tous les postes
    await setPoidsCell('2026-03', `veh${id}`, i + 1, { p: [100 + i, 200] });
  }
})().then(
  () => process.exit(0),
  (e) => {
    console.error(`poste ${id}:`, e);
    process.exit(1);
  },
);

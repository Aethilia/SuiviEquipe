import { build } from 'esbuild';

const common = { bundle: true, platform: 'node', format: 'cjs', target: 'node22', sourcemap: true, logLevel: 'info' };

await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs', external: ['electron', 'exceljs'] });
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs', external: ['electron'] });

// Lance Vite + Electron en développement.
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

await import('./build-electron.mjs');
const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5173/';
const electronBin = (await import('electron')).default;
const child = spawn(String(electronBin), ['.'], { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } });
child.on('exit', async () => { await server.close(); process.exit(0); });

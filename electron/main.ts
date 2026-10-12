import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { getConfig, setConfig } from './config';
import * as storage from './storage';
import { startWatcher, stopWatcher } from './watcher';
import { exportHs } from './excel/exportHs';
import { importHs } from './excel/importHs';
import { exportPoids } from './excel/exportPoids';
import { importPoids } from './excel/importPoids';
import { fatal, installCrashHandlers, log } from './diagnostics';
import { canAutoUpdate, findUpdate, launchInstaller, publishInstaller, recentlyAttempted, UPDATE_DIR } from './updater';

// Pilote graphique : sur certains postes (bureau à distance, vieux pilotes) Electron n'ouvre aucune fenêtre avec l'accélération matérielle.
app.disableHardwareAcceleration();
app.setAppUserModelId('fr.aethilia.suiviequipe');
installCrashHandlers();

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#EEF4F2',
    title: 'Suivi Équipe',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => fatal("Impossible d'afficher l'application", `${desc} (${code}) : ${url}`));
  win.webContents.on('preload-error', (_e, file, err) => fatal('Erreur de chargement', `${file}: ${err.message}`));
  win.once('ready-to-show', () => log('fenêtre prête'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) void win.loadURL(dev);
  else void win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.on('closed', () => {
    log('fenêtre fermée');
    win = null;
  });
  win.on('unresponsive', () => log('fenêtre ne répond plus'));
  win.webContents.on('did-finish-load', () => log('page chargée'));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function showSplash(version: string): BrowserWindow {
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:'Segoe UI',sans-serif;background:#EEF4F2;color:#0B3B37;display:flex;flex-direction:column;justify-content:center;height:100vh;padding:0 32px;box-sizing:border-box;border:1px solid #DCE7E4">
    <div style="font-size:19px;font-weight:700;margin-bottom:8px">Mise à jour vers la version ${version}</div>
    <div style="font-size:13.5px;color:#5F7471;line-height:1.5">L'application va se fermer puis se rouvrir toute seule dans quelques instants.<br><b>Merci de ne pas la relancer.</b></div></body>`;
  const w = new BrowserWindow({ width: 480, height: 190, frame: false, resizable: false, alwaysOnTop: true, center: true, backgroundColor: '#EEF4F2', webPreferences: { sandbox: true } });
  void w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return w;
}

/** Au démarrage : si un installateur plus récent est dans le dossier partagé, on l'installe puis l'application se relance. Renvoie vrai si on quitte. */
async function autoUpdateAtStartup(): Promise<boolean> {
  if (!canAutoUpdate() || !getConfig().configured) return false;
  try {
    // Un partage injoignable ne doit pas retarder l'ouverture de l'application.
    const u = await Promise.race([findUpdate(), sleep(7000).then(() => null)]);
    if (!u) return false;
    if (recentlyAttempted(u.version)) {
      log(`mise à jour ${u.version} déjà tentée il y a peu sans succès : on ouvre la version actuelle`);
      return false;
    }
    showSplash(u.version);
    await launchInstaller(u);
    await sleep(4000);
    app.quit();
    return true;
  } catch (e) {
    log(`mise à jour automatique impossible : ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

function emit(channel: string, payload: unknown) {
  win?.webContents.send(channel, payload);
}

function registerIpc() {
  ipcMain.handle('config:get', () => getConfig());
  ipcMain.handle('config:set', async (_e, patch) => {
    const next = setConfig(patch);
    await startWatcher((ev) => emit('data:changed', ev));
    void storage.pruneBackups();
    return next;
  });
  ipcMain.handle('config:pickDir', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Choisir le dossier de données partagé',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getConfig().dataDir,
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('config:check', (_e, dir?: string) => storage.checkDir(dir));

  ipcMain.handle('hs:load', (_e, month: string) => storage.loadMonth(month));
  ipcMain.handle('hs:loadYear', (_e, year: number) => storage.loadYear(year));
  ipcMain.handle('hs:setCell', (_e, month, agentId, day, v) => storage.setCell(month, agentId, day, v));

  ipcMain.handle('agents:load', () => storage.loadAgents());
  ipcMain.handle('agents:save', (_e, list) => storage.saveAgents(list));

  ipcMain.handle('poids:load', (_e, month: string) => storage.loadPoidsMonth(month));
  ipcMain.handle('poids:loadYear', (_e, year: number) => storage.loadPoidsYear(year));
  ipcMain.handle('poids:setCell', (_e, month, vehId, day, v) => storage.setPoidsCell(month, vehId, day, v));
  ipcMain.handle('vehicules:load', () => storage.loadVehicules());
  ipcMain.handle('vehicules:save', (_e, list) => storage.saveVehicules(list));

  ipcMain.handle('update:info', async () => ({
    current: app.getVersion(),
    available: (await findUpdate())?.version ?? null,
    dir: path.join(getConfig().dataDir, UPDATE_DIR),
    auto: canAutoUpdate(),
  }));
  ipcMain.handle('update:publish', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Choisir le nouvel installateur (SuiviEquipe-Setup-X.Y.Z.exe)',
      properties: ['openFile'],
      filters: [{ name: 'Installateur', extensions: ['exe'] }],
    });
    return r.canceled ? null : publishInstaller(r.filePaths[0]);
  });
  ipcMain.handle('update:installNow', async () => {
    const u = await findUpdate();
    if (!u) throw new Error('Aucune mise à jour disponible.');
    await launchInstaller(u);
    setTimeout(() => app.quit(), 1500);
  });

  ipcMain.handle('prestations:load', () => storage.loadPrestations());
  ipcMain.handle('prestations:save', (_e, list) => storage.savePrestations(list));

  ipcMain.handle('excel:exportHs', async (_e, year: number) => {
    const r = await dialog.showSaveDialog(win!, {
      title: 'Exporter les heures sup',
      defaultPath: `Dimanches et feries ${year}.xlsx`,
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }],
    });
    if (r.canceled || !r.filePath) return null;
    await exportHs(year, r.filePath);
    return r.filePath;
  });
  ipcMain.handle('excel:exportPoids', async (_e, year: number) => {
    const r = await dialog.showSaveDialog(win!, {
      title: 'Exporter les pesées',
      defaultPath: `Calendrier poids fourgons ${year}.xlsx`,
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }],
    });
    if (r.canceled || !r.filePath) return null;
    await exportPoids(year, r.filePath);
    return r.filePath;
  });
  ipcMain.handle('excel:importPoids', async (_e, year: number) => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Importer le classeur « Calendrier poids fourgons »',
      properties: ['openFile'],
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx', 'xlsm'] }],
    });
    if (r.canceled) return null;
    return importPoids(year, r.filePaths[0]);
  });
  ipcMain.handle('excel:importHs', async (_e, year: number) => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Importer le classeur « Dimanches et fériés »',
      properties: ['openFile'],
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx', 'xlsm'] }],
    });
    if (r.canceled) return null;
    return importHs(year, r.filePaths[0]);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Une autre copie tourne déjà (peut-être cachée, après un plantage) : elle va afficher sa fenêtre. On l'explique au lieu de se fermer en silence.
  log('une autre instance est déjà en cours : cette copie se ferme');
  app
    .whenReady()
    .then(() => {
      dialog.showMessageBoxSync({
        type: 'info',
        title: 'Suivi Équipe',
        message: 'Suivi Équipe est déjà en cours d\'exécution.',
        detail: 'Si aucune fenêtre n\'apparaît, fermez le processus « SuiviEquipe » dans le Gestionnaire des tâches (Ctrl+Maj+Échap), puis relancez l\'application.',
      });
    })
    .finally(() => app.quit());
} else {
  app.on('second-instance', () => {
    // Une copie déjà lancée mais sans fenêtre (plantée en arrière-plan) ne doit pas empêcher d'ouvrir l'application.
    if (!win) return createWindow();
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  void app
    .whenReady()
    .then(async () => {
      registerIpc();
      if (await autoUpdateAtStartup()) return;
      createWindow();
      void startWatcher((ev) => emit('data:changed', ev));
      void storage.pruneBackups();
    })
    .catch((e) => fatal('Démarrage impossible', e instanceof Error ? (e.stack ?? e.message) : String(e)));
  app.on('window-all-closed', () => {
    log('toutes les fenêtres sont fermées : arrêt');
    stopWatcher();
    app.quit();
  });
  app.on('will-quit', () => log('arrêt de l\'application'));
}

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { getConfig, setConfig } from './config';
import * as storage from './storage';
import { startWatcher, stopWatcher } from './watcher';
import { exportHs } from './excel/exportHs';
import { importHs } from './excel/importHs';

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
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) void win.loadURL(dev);
  else void win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.on('closed', () => (win = null));
}

function emit(channel: string, payload: unknown) {
  win?.webContents.send(channel, payload);
}

function registerIpc() {
  ipcMain.handle('config:get', () => getConfig());
  ipcMain.handle('config:set', (_e, patch) => {
    const next = setConfig(patch);
    startWatcher((ev) => emit('data:changed', ev));
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
  ipcMain.handle('config:check', () => storage.checkDir());

  ipcMain.handle('hs:load', (_e, month: string) => storage.loadMonth(month));
  ipcMain.handle('hs:loadYear', (_e, year: number) => storage.loadYear(year));
  ipcMain.handle('hs:setCell', (_e, month, agentId, day, v) => storage.setCell(month, agentId, day, v));

  ipcMain.handle('agents:load', () => storage.loadAgents());
  ipcMain.handle('agents:save', (_e, list) => storage.saveAgents(list));

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
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  void app.whenReady().then(() => {
    registerIpc();
    createWindow();
    startWatcher((ev) => emit('data:changed', ev));
  });
  app.on('window-all-closed', () => {
    stopWatcher();
    app.quit();
  });
}

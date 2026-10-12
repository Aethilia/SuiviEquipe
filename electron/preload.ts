import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from '../src/shared/api';

const call = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api: Api = {
  config: {
    get: () => call('config:get'),
    set: (patch) => call('config:set', patch),
    pickDir: () => call('config:pickDir'),
    check: (dir) => call('config:check', dir),
  },
  hs: {
    load: (month) => call('hs:load', month),
    loadYear: (year) => call('hs:loadYear', year),
    setCell: (month, agentId, day, v) => call('hs:setCell', month, agentId, day, v),
  },
  agents: {
    load: () => call('agents:load'),
    save: (list) => call('agents:save', list),
  },
  poids: {
    load: (month) => call('poids:load', month),
    loadYear: (year) => call('poids:loadYear', year),
    setCell: (month, vehId, day, v) => call('poids:setCell', month, vehId, day, v),
  },
  vehicules: {
    load: () => call('vehicules:load'),
    save: (list) => call('vehicules:save', list),
  },
  update: {
    info: () => call('update:info'),
    publish: () => call('update:publish'),
    installNow: () => call('update:installNow'),
  },
  prestations: {
    load: () => call('prestations:load'),
    save: (list) => call('prestations:save', list),
  },
  excel: {
    exportHs: (year) => call('excel:exportHs', year),
    importHs: (year) => call('excel:importHs', year),
    exportPoids: (year) => call('excel:exportPoids', year),
    importPoids: (year) => call('excel:importPoids', year),
  },
  onChange: (cb) => {
    const h = (_: unknown, e: Parameters<typeof cb>[0]) => cb(e);
    ipcRenderer.on('data:changed', h);
    return () => ipcRenderer.removeListener('data:changed', h);
  },
};

contextBridge.exposeInMainWorld('api', api);

import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from '../src/shared/api';

const call = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api: Api = {
  config: {
    get: () => call('config:get'),
    set: (patch) => call('config:set', patch),
    pickDir: () => call('config:pickDir'),
    check: () => call('config:check'),
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
  excel: {
    exportHs: (year) => call('excel:exportHs', year),
    importHs: (year) => call('excel:importHs', year),
  },
  onChange: (cb) => {
    const h = (_: unknown, e: Parameters<typeof cb>[0]) => cb(e);
    ipcRenderer.on('data:changed', h);
    return () => ipcRenderer.removeListener('data:changed', h);
  },
};

contextBridge.exposeInMainWorld('api', api);

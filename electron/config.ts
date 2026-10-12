import { app } from 'electron';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { AppConfig } from '../src/shared/types';

const file = () => path.join(app.getPath('userData'), 'config.json');

let cache: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cache) return cache;
  const defaults: AppConfig = {
    dataDir: path.join(app.getPath('documents'), 'SuiviEquipe-donnees'),
    userName: os.hostname(),
    configured: false,
  };
  try {
    cache = { ...defaults, ...JSON.parse(fs.readFileSync(file(), 'utf8')), configured: true };
  } catch {
    cache = defaults;
  }
  return cache!;
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  const next: AppConfig = { ...getConfig(), ...patch, configured: true };
  if (!next.dataDir.trim()) throw new Error('Le chemin du dossier de données est vide.');
  if (!next.userName.trim()) next.userName = os.hostname();
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify({ dataDir: next.dataDir, userName: next.userName }, null, 2));
  cache = next;
  return next;
}

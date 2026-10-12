import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppConfig } from '../shared/types';
import { errMsg, useAgents } from './hooks';
import { AgentsPage } from './pages/AgentsPage';
import { FeriesPage } from './pages/FeriesPage';
import { HsPage } from './pages/HsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SynthesePage } from './pages/SynthesePage';

type PageId = 'hs' | 'poids' | 'synthese' | 'agents' | 'vehicules' | 'feries' | 'params';

const NAV: { id: PageId; label: string; soon?: boolean }[] = [
  { id: 'hs', label: 'Heures sup' },
  { id: 'poids', label: 'Poids fourgons', soon: true },
  { id: 'synthese', label: 'Synthèse annuelle' },
  { id: 'agents', label: 'Agents' },
  { id: 'vehicules', label: 'Véhicules', soon: true },
  { id: 'feries', label: 'Jours fériés' },
  { id: 'params', label: 'Paramètres' },
];

export function App() {
  const [page, setPage] = useState<PageId>('hs');
  const [year, setYear] = useState(new Date().getFullYear());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [dirOk, setDirOk] = useState<{ ok: boolean; error?: string }>({ ok: true });
  const [toast, setToast] = useState<{ text: string; kind: 'error' | 'info' } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const timer = useRef<number>(0);

  const notify = useCallback((text: string, kind: 'error' | 'info' = 'error') => {
    setToast({ text, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 7000 : 3500);
  }, []);

  const { agents, reload: reloadAgents } = useAgents(notify);

  const checkDir = useCallback(async () => {
    try {
      setDirOk(await window.api.config.check());
    } catch (e) {
      setDirOk({ ok: false, error: errMsg(e) });
    }
  }, []);

  useEffect(() => {
    window.api.config.get().then(setConfig, (e) => notify(errMsg(e)));
    void checkDir();
    const id = window.setInterval(checkDir, 20_000);
    return () => window.clearInterval(id);
  }, [checkDir, notify]);

  const afterConfigChange = (c: AppConfig) => {
    setConfig(c);
    setRefreshKey((k) => k + 1);
    void reloadAgents();
    void checkDir();
  };
  const afterImport = () => {
    setRefreshKey((k) => k + 1);
    void reloadAgents();
  };

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand"><i /> Suivi Équipe</div>
        {NAV.map((n) => (
          <button key={n.id} className={`pill ${page === n.id ? 'active' : ''}`} disabled={n.soon} title={n.soon ? 'Prochaine étape' : undefined} onClick={() => setPage(n.id)}>
            {n.label}
          </button>
        ))}
        <div className="spacer" />
        <div className={`sync ${dirOk.ok ? '' : 'bad'}`} title={dirOk.ok ? config?.dataDir : dirOk.error} onClick={() => !dirOk.ok && setPage('params')}>
          <b /> {dirOk.ok ? 'Dossier partagé connecté' : 'Dossier inaccessible'}
        </div>
      </nav>

      {page === 'hs' && <HsPage year={year} setYear={setYear} agents={agents} notify={notify} refreshKey={refreshKey} onGoSettings={() => setPage('params')} />}
      {page === 'synthese' && <SynthesePage year={year} setYear={setYear} agents={agents} notify={notify} refreshKey={refreshKey} />}
      {page === 'agents' && <AgentsPage agents={agents} notify={notify} reload={reloadAgents} />}
      {page === 'feries' && <FeriesPage year={year} setYear={setYear} />}
      {page === 'params' && config && <SettingsPage config={config} year={year} notify={notify} onConfig={afterConfigChange} onImported={afterImport} />}

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}

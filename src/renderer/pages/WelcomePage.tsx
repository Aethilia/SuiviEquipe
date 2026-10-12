import { useEffect, useState } from 'react';
import type { AppConfig } from '../../shared/types';
import { errMsg } from '../hooks';

type Status = { ok: boolean; error?: string; files?: number } | null;

/** Premier lancement d'un poste : choix du dossier partagé et du nom du poste. */
export function WelcomePage({ config, onDone }: { config: AppConfig; onDone: (c: AppConfig) => void }) {
  const [dataDir, setDataDir] = useState(config.dataDir);
  const [userName, setUserName] = useState(config.userName);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(null);
    if (!dataDir.trim()) return;
    const t = window.setTimeout(() => window.api.config.check(dataDir).then(setStatus, (e) => setStatus({ ok: false, error: errMsg(e) })), 400);
    return () => window.clearTimeout(t);
  }, [dataDir]);

  const browse = async () => {
    const d = await window.api.config.pickDir();
    if (d) setDataDir(d);
  };
  const start = async () => {
    setBusy(true);
    try {
      onDone(await window.api.config.set({ dataDir: dataDir.trim(), userName: userName.trim() }));
    } catch (e) {
      setStatus({ ok: false, error: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="card form" style={{ maxWidth: 640, width: '100%' }}>
        <h1>Bienvenue dans Suivi Équipe</h1>
        <p className="muted" style={{ margin: 0 }}>
          Avant de commencer, indiquez le dossier où sont enregistrées les données. <b>Tous les postes doivent choisir le même dossier</b> (sur le partage réseau) :
          c'est ainsi que vous voyez le travail des collègues. Sur un nouveau poste, choisissez simplement le dossier déjà utilisé par les autres.
        </p>
        <div className="field">
          <label htmlFor="dir">Dossier de données partagé</label>
          <div className="inline">
            <input id="dir" type="text" value={dataDir} onChange={(e) => setDataDir(e.target.value)} placeholder="\\serveur\partage\SuiviEquipe" />
            <button className="btn" onClick={browse}>Parcourir…</button>
          </div>
          {status && (
            <span className={status.ok ? 'muted' : ''} style={status.ok ? undefined : { color: 'var(--danger)' }}>
              {!status.ok
                ? `Dossier inaccessible en écriture : ${status.error}`
                : status.files
                  ? `✓ Dossier accessible, données existantes trouvées (${status.files} fichier${status.files > 1 ? 's' : ''} mensuel${status.files > 1 ? 's' : ''}).`
                  : '✓ Dossier accessible et vide : il sera initialisé au premier enregistrement.'}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="user">Nom de ce poste</label>
          <input id="user" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <span className="muted">Affiché aux collègues pour savoir qui a modifié une case (ex. « Bureau Nice 2 »).</span>
        </div>
        <div><button className="btn primary" onClick={start} disabled={busy || !dataDir.trim() || !userName.trim() || status?.ok === false}>Commencer</button></div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { AppConfig, ImportPoidsReport, ImportReport } from '../../shared/types';
import { errMsg, type Notify } from '../hooks';

interface Props {
  config: AppConfig;
  year: number;
  notify: Notify;
  onConfig: (c: AppConfig) => void;
  onImported: () => void;
}

export function SettingsPage({ config, year, notify, onConfig, onImported }: Props) {
  const [dataDir, setDataDir] = useState(config.dataDir);
  const [userName, setUserName] = useState(config.userName);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reportP, setReportP] = useState<ImportPoidsReport | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = dataDir !== config.dataDir || userName !== config.userName;

  const browse = async () => {
    const d = await window.api.config.pickDir();
    if (d) setDataDir(d);
  };
  const save = async () => {
    try {
      onConfig(await window.api.config.set({ dataDir: dataDir.trim(), userName: userName.trim() }));
      const chk = await window.api.config.check();
      notify(chk.ok ? 'Paramètres enregistrés.' : `Dossier inaccessible : ${chk.error}`, chk.ok ? 'info' : 'error');
    } catch (e) {
      notify(errMsg(e));
    }
  };
  const doImport = async () => {
    setBusy(true);
    try {
      const r = await window.api.excel.importHs(year);
      if (r) {
        setReport(r);
        onImported();
      }
    } catch (e) {
      notify(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doImportPoids = async () => {
    setBusy(true);
    try {
      const r = await window.api.excel.importPoids(year);
      if (r) {
        setReportP(r);
        onImported();
      }
    } catch (e) {
      notify(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>Paramètres</h1>
      <div className="card form">
        <h2>Dossier de données partagé</h2>
        <div className="field">
          <label htmlFor="dir">Chemin du dossier (identique sur tous les postes)</label>
          <div className="inline">
            <input id="dir" type="text" value={dataDir} onChange={(e) => setDataDir(e.target.value)} placeholder="\\serveur\partage\SuiviEquipe" />
            <button className="btn" onClick={browse}>Parcourir…</button>
          </div>
          <span className="muted">Les fichiers y sont créés : hs/AAAA-MM.json, referentiel/agents.json…</span>
        </div>
        <div className="field">
          <label htmlFor="user">Nom de ce poste</label>
          <input id="user" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <span className="muted">Enregistré avec chaque modification.</span>
        </div>
        <div><button className="btn primary" onClick={save} disabled={!dirty}>Enregistrer</button></div>
      </div>

      <div className="card form">
        <h2>Importer le classeur « Dimanches et fériés » (une seule fois)</h2>
        <p className="muted" style={{ margin: 0 }}>
          Lit les onglets de janvier à décembre et la liste des employés, pour l'année <b>{year}</b> (changez d'année depuis l'onglet Heures sup).
          Le fichier Excel n'est jamais modifié, et les cases déjà saisies dans l'appli ne sont pas écrasées.
        </p>
        <div><button className="btn primary" onClick={doImport} disabled={busy}>{busy ? 'Import en cours…' : 'Choisir le classeur Excel…'}</button></div>
        {report && (
          <div className="report">
            <b>Import terminé.</b> {report.casesImportees} saisies importées ({report.moisTrouves.join(', ') || 'aucun mois'}), {report.agentsCrees} agents créés
            {report.casesIgnorees > 0 && `, ${report.casesIgnorees} cases déjà renseignées conservées`}.
            {report.avertissements.length > 0 && <ul>{report.avertissements.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
        )}
      </div>

      <div className="card form">
        <h2>Importer le classeur « Calendrier poids fourgons » (une seule fois)</h2>
        <p className="muted" style={{ margin: 0 }}>
          Lit les onglets de janvier à décembre pour l'année <b>{year}</b> : tournées de la semaine et du dimanche, poids, additions de vidages (conservées) et textes (« ouest »…).
          Les noms de tournées varient d'un mois à l'autre dans le classeur : vérifiez ensuite la liste dans l'onglet Véhicules (renommer, supprimer, réordonner).
        </p>
        <div><button className="btn primary" onClick={doImportPoids} disabled={busy}>{busy ? 'Import en cours…' : 'Choisir le classeur Excel…'}</button></div>
        {reportP && (
          <div className="report">
            <b>Import terminé.</b> {reportP.casesImportees} pesées importées ({reportP.moisTrouves.join(', ') || 'aucun mois'}), {reportP.vehiculesCrees} tournées créées
            {reportP.casesIgnorees > 0 && `, ${reportP.casesIgnorees} cases déjà renseignées conservées`}.
            {reportP.avertissements.length > 0 && <ul>{reportP.avertissements.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
        )}
      </div>
    </div>
  );
}

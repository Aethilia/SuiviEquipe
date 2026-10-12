import { useEffect, useState } from 'react';
import type { Agent } from '../../shared/types';
import { errMsg, type Notify } from '../hooks';

interface Props {
  agents: Agent[];
  notify: Notify;
  reload: () => Promise<void>;
}

type Row = { id: string; nom: string; ordre: number; actif: boolean; matricule?: string };

const sorted = (a: Row[]) => [...a].sort((x, y) => x.ordre - y.ordre || x.nom.localeCompare(y.nom, 'fr'));

export function AgentsPage({ agents, notify, reload }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => setRows(sorted(agents)), [agents]);

  const save = async (list: Row[]) => {
    try {
      await window.api.agents.save(list);
      await reload();
    } catch (e) {
      notify(errMsg(e));
    }
  };

  const patch = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const commit = (id: string) => {
    const r = rows.find((x) => x.id === id);
    if (r && r.nom.trim()) void save([r]);
  };

  const add = () => {
    const nom = newName.trim();
    if (!nom) return;
    const ordre = rows.reduce((m, r) => Math.max(m, r.ordre), 0) + 1;
    setNewName('');
    void save([{ id: crypto.randomUUID(), nom, ordre, actif: true }]);
  };

  const move = (id: string, dir: -1 | 1) => {
    const list = sorted(rows);
    const i = list.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    // On renumérote toute la liste pour que l'ordre reste cohérent.
    [list[i], list[j]] = [list[j], list[i]];
    const renum = list.map((r, k) => ({ ...r, ordre: k + 1 }));
    setRows(renum);
    void save(renum.filter((r, k) => sorted(rows)[k]?.id !== r.id || rows.find((x) => x.id === r.id)?.ordre !== r.ordre));
  };

  const shown = rows.filter((r) => showInactive || r.actif);

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Agents</h1>
        <span className="muted">{rows.filter((r) => r.actif).length} actifs</span>
        <div className="spacer" />
        <label className="muted"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Afficher les inactifs</label>
      </div>
      <div className="card form" style={{ maxWidth: 'none', flexDirection: 'row', alignItems: 'center', padding: 14 }}>
        <input type="text" placeholder="Nom Prénom du nouvel agent" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 12 }} />
        <button className="btn primary" onClick={add} disabled={!newName.trim()}>Ajouter</button>
      </div>
      <div className="card" style={{ overflow: 'auto' }}>
        <table className="list">
          <thead><tr><th style={{ width: 80 }}>Ordre</th><th>Nom</th><th style={{ width: 130 }}>Matricule</th><th style={{ width: 110 }}>Actif</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} style={r.actif ? undefined : { opacity: .6 }}>
                <td>
                  <button className="icon" onClick={() => move(r.id, -1)} aria-label="Monter">↑</button>{' '}
                  <button className="icon" onClick={() => move(r.id, 1)} aria-label="Descendre">↓</button>
                </td>
                <td><input type="text" value={r.nom} onChange={(e) => patch(r.id, { nom: e.target.value })} onBlur={() => commit(r.id)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></td>
                <td className="muted">{r.matricule ?? ''}</td>
                <td><input type="checkbox" checked={r.actif} onChange={(e) => { patch(r.id, { actif: e.target.checked }); void save([{ ...r, actif: e.target.checked }]); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">Aucun agent.</div>}
      </div>
      <p className="muted" style={{ margin: 0 }}>Un agent désactivé disparaît des nouvelles grilles mais ses saisies passées sont conservées.</p>
    </div>
  );
}

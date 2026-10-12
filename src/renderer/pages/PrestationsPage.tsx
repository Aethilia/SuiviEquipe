import { useEffect, useState } from 'react';
import { normalizeCode } from '../../shared/prestations';
import type { Prestation } from '../../shared/types';
import { CodeBadge } from '../components/CodeBadge';
import { errMsg, type Notify } from '../hooks';
import { usePrestations } from '../prestations';

type Row = Omit<Prestation, 't'>;
const sorted = (a: Row[]) => [...a].sort((x, y) => x.ordre - y.ordre || x.code.localeCompare(y.code, 'fr'));

export function PrestationsPage({ notify, onBack }: { notify: Notify; onBack: () => void }) {
  const { all, reload } = usePrestations();
  const [rows, setRows] = useState<Row[]>([]);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#0f766e');

  useEffect(() => setRows(sorted(all)), [all]);

  const save = async (list: Row[]) => {
    try {
      await window.api.prestations.save(list);
      await reload();
    } catch (e) {
      notify(errMsg(e));
    }
  };
  const patch = (c: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.code === c ? { ...r, ...p } : r)));
  const commit = (c: string) => {
    const r = rows.find((x) => x.code === c);
    if (r && r.label.trim()) void save([r]);
  };

  const add = () => {
    const c = normalizeCode(code);
    if (!c || !label.trim()) return;
    if (rows.some((r) => r.code === c)) return notify(`Le code « ${c} » existe déjà.`);
    const ordre = rows.reduce((m, r) => Math.max(m, r.ordre), 0) + 1;
    setCode('');
    setLabel('');
    void save([{ code: c, label: label.trim(), color, ordre, actif: true }]);
  };

  const move = (c: string, dir: -1 | 1) => {
    const list = sorted(rows);
    const i = list.findIndex((r) => r.code === c);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const renum = list.map((r, k) => ({ ...r, ordre: k + 1 }));
    setRows(renum);
    void save(renum);
  };

  const remove = (r: Row) => {
    if (!window.confirm(`Supprimer la prestation « ${r.code} – ${r.label} » ?\n\nLes cases déjà saisies avec ce code restent affichées en gris. Pour simplement ne plus la proposer, décochez « Proposée ».`)) return;
    void save([{ ...r, supprime: true }]);
  };

  return (
    <div className="page">
      <div className="toolbar"><button className="quiet" onClick={onBack}>‹ Heures sup</button><h1>Prestations</h1><span className="muted">Les types d'heures sup proposés dans la grille</span></div>

      <div className="card form" style={{ maxWidth: 'none', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: 14 }}>
        <input type="text" placeholder="Code (ex. NU)" value={code} maxLength={6} onChange={(e) => setCode(e.target.value)} style={{ width: 110, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 12 }} />
        <input type="text" placeholder="Libellé (ex. Nettoyage urgent)" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ flex: 1, minWidth: 200, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 12 }} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Couleur" className="colorpick" />
        <button className="btn primary" onClick={add} disabled={!normalizeCode(code) || !label.trim()}>Ajouter</button>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table className="list">
          <thead><tr><th style={{ width: 80 }}>Ordre</th><th style={{ width: 90 }}>Code</th><th>Libellé</th><th style={{ width: 80 }}>Couleur</th><th style={{ width: 90 }}>Proposée</th><th style={{ width: 110 }} /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} style={r.actif ? undefined : { opacity: .6 }}>
                <td>
                  <button className="icon" onClick={() => move(r.code, -1)} aria-label="Monter">↑</button>{' '}
                  <button className="icon" onClick={() => move(r.code, 1)} aria-label="Descendre">↓</button>
                </td>
                <td><CodeBadge code={r.code} /></td>
                <td><input type="text" value={r.label} onChange={(e) => patch(r.code, { label: e.target.value })} onBlur={() => commit(r.code)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></td>
                <td><input type="color" className="colorpick" value={r.color} onChange={(e) => patch(r.code, { color: e.target.value })} onBlur={() => commit(r.code)} /></td>
                <td><input type="checkbox" checked={r.actif} onChange={(e) => { patch(r.code, { actif: e.target.checked }); void save([{ ...r, actif: e.target.checked }]); }} /></td>
                <td><button className="btn danger" style={{ padding: '4px 10px' }} onClick={() => remove(r)}>Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">Aucune prestation.</div>}
      </div>
      <p className="muted" style={{ margin: 0 }}>Le code est la clé enregistrée dans les cases : il ne peut plus être changé après création (le libellé et la couleur, si).</p>
    </div>
  );
}

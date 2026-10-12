import { useEffect, useState } from 'react';
import type { Section, Vehicule } from '../../shared/types';
import { errMsg, type Notify } from '../hooks';

interface Props {
  vehicules: Vehicule[];
  notify: Notify;
  reload: () => Promise<void>;
  onBack: () => void;
}

type Row = { id: string; nom: string; section: Section; ordre: number; actif: boolean; supprime?: boolean };
const sorted = (a: Row[]) => [...a].sort((x, y) => x.ordre - y.ordre || x.nom.localeCompare(y.nom, 'fr'));

const SECTIONS: { id: Section; titre: string }[] = [
  { id: 'semaine', titre: 'Tournées de la semaine' },
  { id: 'dimanche', titre: 'Tournées du dimanche' },
];

export function VehiculesPage({ vehicules, notify, reload, onBack }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [nom, setNom] = useState('');
  const [section, setSection] = useState<Section>('semaine');

  useEffect(() => setRows(sorted(vehicules.filter((v) => !v.supprime))), [vehicules]);

  const save = async (list: Row[]) => {
    try {
      await window.api.vehicules.save(list);
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
    if (!nom.trim()) return;
    const ordre = rows.reduce((m, r) => Math.max(m, r.ordre), 0) + 1;
    setNom('');
    void save([{ id: crypto.randomUUID(), nom: nom.trim(), section, ordre, actif: true }]);
  };

  const move = (id: string, dir: -1 | 1) => {
    const list = sorted(rows);
    const sec = list.find((r) => r.id === id)!.section;
    const same = list.filter((r) => r.section === sec);
    const i = same.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= same.length) return;
    [same[i], same[j]] = [same[j], same[i]];
    // On renumérote : toutes les lignes d'une section gardent leur plan, les deux sections restent indépendantes.
    const others = list.filter((r) => r.section !== sec);
    const renum = [...same, ...others].map((r, k) => ({ ...r, ordre: k + 1 }));
    setRows(renum);
    void save(renum);
  };

  const remove = (r: Row) => {
    if (!window.confirm(`Supprimer « ${r.nom} » ?\n\nElle disparaîtra de toutes les grilles et des exports. Pour la garder dans l'historique, décochez plutôt « Actif ».`)) return;
    void save([{ ...r, supprime: true }]);
  };

  return (
    <div className="page">
      <div className="toolbar">
        <button className="quiet" onClick={onBack}>‹ Poids fourgons</button>
        <h1>Véhicules et tournées</h1>
        <span className="muted">{rows.filter((r) => r.actif).length} actives</span>
      </div>

      <div className="card form" style={{ maxWidth: 'none', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: 14 }}>
        <input type="text" placeholder="Nom de la tournée (ex. FOURGON 9)" value={nom} onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ flex: 1, minWidth: 220, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 12 }} />
        <select value={section} onChange={(e) => setSection(e.target.value as Section)} style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }}>
          {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.titre}</option>)}
        </select>
        <button className="btn primary" onClick={add} disabled={!nom.trim()}>Ajouter</button>
      </div>

      {SECTIONS.map((s) => {
        const list = rows.filter((r) => r.section === s.id);
        return (
          <div className="card" style={{ overflow: 'auto' }} key={s.id}>
            <table className="list">
              <thead><tr><th style={{ width: 80 }}>Ordre</th><th>{s.titre}</th><th style={{ width: 200 }}>Section</th><th style={{ width: 80 }}>Actif</th><th style={{ width: 110 }} /></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} style={r.actif ? undefined : { opacity: .6 }}>
                    <td>
                      <button className="icon" onClick={() => move(r.id, -1)} aria-label="Monter">↑</button>{' '}
                      <button className="icon" onClick={() => move(r.id, 1)} aria-label="Descendre">↓</button>
                    </td>
                    <td><input type="text" value={r.nom} onChange={(e) => patch(r.id, { nom: e.target.value })} onBlur={() => commit(r.id)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></td>
                    <td>
                      <select value={r.section} onChange={(e) => { patch(r.id, { section: e.target.value as Section }); void save([{ ...r, section: e.target.value as Section }]); }} style={{ padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }}>
                        {SECTIONS.map((x) => <option key={x.id} value={x.id}>{x.id === 'semaine' ? 'Semaine' : 'Dimanche'}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" checked={r.actif} onChange={(e) => { patch(r.id, { actif: e.target.checked }); void save([{ ...r, actif: e.target.checked }]); }} /></td>
                    <td><button className="btn danger" style={{ padding: '4px 10px' }} onClick={() => remove(r)}>Supprimer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <div className="empty" style={{ padding: 20 }}>Aucune tournée.</div>}
          </div>
        );
      })}
      <p className="muted" style={{ margin: 0 }}>« Actif » décoché : la tournée disparaît des mois où elle n'a aucune pesée, l'historique est conservé. « Supprimer » : elle disparaît partout. Deux tournées peuvent porter le même nom si elles sont dans des sections différentes (ex. FOURGON 5).</p>
    </div>
  );
}

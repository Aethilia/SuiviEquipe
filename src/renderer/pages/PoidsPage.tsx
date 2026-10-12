import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dateStr, daysInMonth, MONTHS_FR, MONTHS_SHORT, WEEKDAY_FR, WEEKDAY_LETTER, weekday } from '../../shared/calendar';
import { holidayMap } from '../../shared/holidays';
import { cellKey } from '../../shared/merge';
import { describeEdit } from '../../shared/sync';
import { fmtKg, formatPoidsInput, parsePoidsInput, poidsCell, poidsStats, sumKg, visibleVehicules, weeksOfMonth } from '../../shared/poids';
import type { Section, Vehicule } from '../../shared/types';
import { YearPicker } from '../components/YearPicker';
import { errMsg, usePoidsMonth, type Notify } from '../hooks';

interface Props {
  year: number;
  setYear: (y: number) => void;
  vehicules: Vehicule[];
  notify: Notify;
  me: string;
  refreshKey: number;
  onGoVehicules: () => void;
  onAddVehicule: (nom: string, section: Section) => Promise<void>;
  onRemoveVehicule: (v: Vehicule) => Promise<void>;
}

const tonnes = (kg: number) => (kg / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function PoidsPage({ year, setYear, vehicules, notify, me, refreshKey, onGoVehicules, onAddVehicule, onRemoveVehicule }: Props) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [view, setView] = useState<'mois' | 'semaine'>('semaine');
  const [weekIdx, setWeekIdx] = useState(0);
  const { doc, setCell, flash } = usePoidsMonth(year, month, notify, refreshKey, me);
  const [editing, setEditing] = useState<{ id: string; day: number } | null>(null);
  const skipBlur = useRef(false);
  const [adding, setAdding] = useState<Section | null>(null);
  const [newName, setNewName] = useState('');
  const [exporting, setExporting] = useState(false);

  const n = daysInMonth(year, month);
  const feries = useMemo(() => holidayMap(year), [year]);
  const weeks = useMemo(() => weeksOfMonth(n, weekday(year, month, 1)), [n, year, month]);

  // Au changement de mois, on se place sur la semaine du jour (mois courant) ou la première.
  useEffect(() => {
    const isNow = year === today.getFullYear() && month === today.getMonth() + 1;
    setWeekIdx(isNow ? Math.max(0, weeks.findIndex((w) => today.getDate() >= w.from && today.getDate() <= w.to)) : 0);
    setEditing(null);
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const wk = weeks[Math.min(weekIdx, weeks.length - 1)];
  const from = view === 'mois' ? 1 : wk.from;
  const to = view === 'mois' ? n : wk.to;
  const days = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  const semaine = useMemo(() => visibleVehicules(vehicules, [doc], 'semaine'), [vehicules, doc]);
  const dimanche = useMemo(() => visibleVehicules(vehicules, [doc], 'dimanche'), [vehicules, doc]);
  const all = useMemo(() => [...semaine, ...dimanche], [semaine, dimanche]);
  const stats = useMemo(() => poidsStats(doc, all.map((v) => v.id), n, from, to), [doc, all, n, from, to]);
  const kind = (d: number) => (feries.has(dateStr(year, month, d)) ? 'hol' : weekday(year, month, d) === 0 ? 'sun' : '');

  const ranking = useMemo(
    () => all.map((v) => ({ v, kg: stats.byVehicle[v.id] ?? 0 })).filter((x) => x.kg > 0).sort((a, b) => b.kg - a.kg).slice(0, 10),
    [all, stats],
  );
  const maxRank = ranking[0]?.kg ?? 0;
  const maxDay = Math.max(0, ...days.map((d) => stats.byDay[d - 1]));
  const avg = stats.joursActifs ? stats.totalKg / stats.joursActifs : 0;

  const commit = useCallback(
    (id: string, day: number, text: string): boolean => {
      const val = parsePoidsInput(text);
      if (val === 'invalid') {
        notify('Saisie non reconnue. Exemples : 1460, 600+980+660, ouest.');
        return false;
      }
      const before = poidsCell(doc, id, day);
      if (JSON.stringify(before ?? null) !== JSON.stringify(val)) void setCell(id, day, val);
      return true;
    },
    [doc, notify, setCell],
  );

  const move = (id: string, day: number, dir: 'down' | 'right' | 'left') => {
    const ids = all.map((v) => v.id);
    if (dir === 'down') {
      const next = ids[ids.indexOf(id) + 1];
      setEditing(next ? { id: next, day } : null);
    } else {
      const nd = day + (dir === 'right' ? 1 : -1);
      setEditing(nd >= from && nd <= to ? { id, day: nd } : null);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, id: string, day: number) => {
    const text = e.currentTarget.value;
    if (e.key === 'Escape') {
      skipBlur.current = true;
      setEditing(null);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (!commit(id, day, text)) return;
      skipBlur.current = true;
      move(id, day, e.key === 'Enter' ? 'down' : e.shiftKey ? 'left' : 'right');
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const f = await window.api.excel.exportPoids(year);
      if (f) notify(`Export enregistré : ${f}`, 'info');
    } catch (e) {
      notify(errMsg(e));
    } finally {
      setExporting(false);
    }
  };

  const addRow = (section: Section) => (
    <tr key={`add-${section}`}>
      <td className="name">
        {adding === section ? (
          <input className="addagent" type="text" autoFocus placeholder="Nom de la tournée, puis Entrée" value={newName} onChange={(e) => setNewName(e.target.value)}
            onBlur={() => { if (!newName.trim()) setAdding(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setNewName(''); setAdding(null); }
              if (e.key === 'Enter' && newName.trim()) { void onAddVehicule(newName.trim(), section); setNewName(''); }
            }} />
        ) : (
          <button className="quiet" onClick={() => { setAdding(section); setNewName(''); }}>+ Tournée</button>
        )}
      </td>
      {days.map((d) => <td key={d} className={kind(d)} />)}
      <td />
    </tr>
  );

  const renderRow = (v: Vehicule) => (
    <tr key={v.id}>
      <td className={`name ${v.actif ? '' : 'inactive'}`}>
        <div className="nm">
          <span>{v.nom}</span>
          <button className="rm" title="Supprimer cette tournée" aria-label={`Supprimer ${v.nom}`} onClick={() => void onRemoveVehicule(v)}>×</button>
        </div>
      </td>
      {days.map((d) => {
        const val = poidsCell(doc, v.id, d);
        const isEdit = editing?.id === v.id && editing.day === d;
        const kg = sumKg(val);
        return (
          <td key={d} className={`cell pcell ${val ? 'has' : kind(d)} ${isEdit ? 'sel' : ''} ${flash.has(cellKey(v.id, d)) ? 'flash' : ''}`} onClick={() => !isEdit && setEditing({ id: v.id, day: d })}
            title={[val?.p && val.p.length > 1 ? val.p.map(fmtKg).join(' + ') + ' = ' + fmtKg(kg) + ' kg' : '', describeEdit(doc.cells[cellKey(v.id, d)]) ?? ''].filter(Boolean).join('\n') || undefined}>
            {isEdit ? (
              <input className="pedit" autoFocus defaultValue={formatPoidsInput(val)} onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => onKey(e, v.id, d)}
                onBlur={(e) => {
                  if (skipBlur.current) { skipBlur.current = false; return; }
                  commit(v.id, d, e.currentTarget.value);
                  setEditing(null);
                }} />
            ) : val?.p ? (
              <span className="kg">{fmtKg(kg)}{val.p.length > 1 && <sup className="nx">×{val.p.length}</sup>}</span>
            ) : val?.txt ? (
              <span className="ptxt">{val.txt}</span>
            ) : null}
          </td>
        );
      })}
      <td className="tot"><span className={`kgtot ${stats.byVehicle[v.id] ? '' : 'zero'}`}>{stats.byVehicle[v.id] ? fmtKg(stats.byVehicle[v.id]) : '–'}</span></td>
    </tr>
  );

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Poids fourgons</h1>
        <YearPicker year={year} setYear={setYear} />
        <div className="seg" role="group" aria-label="Affichage">
          <button className={view === 'semaine' ? 'on' : ''} onClick={() => setView('semaine')}>Semaine</button>
          <button className={view === 'mois' ? 'on' : ''} onClick={() => setView('mois')}>Mois entier</button>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={doExport} disabled={exporting}>{exporting ? 'Export…' : 'Exporter en Excel'}</button>
      </div>

      <div className="tabs">
        {MONTHS_SHORT.map((m, i) => (
          <button key={m} className={`pill ${month === i + 1 ? 'active' : ''}`} onClick={() => setMonth(i + 1)}>{m}</button>
        ))}
      </div>

      {view === 'semaine' && (
        <div className="weeks">
          {weeks.map((w, i) => (
            <button key={w.from} className={`wk ${i === weekIdx ? 'on' : ''}`} onClick={() => setWeekIdx(i)}>
              {w.from === w.to ? `${w.from}` : `${w.from} – ${w.to}`}
            </button>
          ))}
        </div>
      )}

      <div className="kpis">
        <div className="card kpi"><div className="label">Tonnage – {view === 'mois' ? MONTHS_FR[month - 1] : `du ${from} au ${to} ${MONTHS_FR[month - 1].toLowerCase()}`}</div><div className="value">{tonnes(stats.totalKg)} <small>t</small></div></div>
        <div className="card kpi"><div className="label">Moyenne par jour travaillé</div><div className="value">{fmtKg(avg)} <small>kg</small></div></div>
        <div className="card kpi"><div className="label">Vidages</div><div className="value">{stats.vidages} <small>sur {stats.joursActifs} jour{stats.joursActifs > 1 ? 's' : ''}</small></div></div>
        <div className="card kpi"><div className="label">Première tournée</div><div className="value" style={{ fontSize: 20, paddingTop: 5 }}>{ranking[0] ? ranking[0].v.nom : '–'} {ranking[0] && <small>{fmtKg(ranking[0].kg)} kg</small>}</div></div>
      </div>

      <div className="card gridwrap">
        <table className="grid poids">
          <thead>
            <tr>
              <th className="name" style={{ textAlign: 'left', paddingLeft: 14 }}>Tournée</th>
              {days.map((d) => {
                const wd = weekday(year, month, d);
                const f = feries.get(dateStr(year, month, d));
                return (
                  <th key={d} className={kind(d)} title={`${WEEKDAY_FR[wd]} ${d} ${MONTHS_FR[month - 1].toLowerCase()}${f ? ' – ' + f : ''}`}>
                    <small>{WEEKDAY_LETTER[wd]}</small>{d}
                  </th>
                );
              })}
              <th>Total kg</th>
            </tr>
          </thead>
          <tbody>
            {semaine.map(renderRow)}
            {addRow('semaine')}
            <tr className="band">
              <td className="name">Tournées du dimanche</td>
              <td colSpan={days.length + 1} />
            </tr>
            {dimanche.map(renderRow)}
            {addRow('dimanche')}
          </tbody>
          <tfoot>
            <tr>
              <td className="name">Total</td>
              {days.map((d) => <td key={d}>{stats.byDay[d - 1] ? fmtKg(stats.byDay[d - 1]) : ''}</td>)}
              <td>{fmtKg(stats.totalKg)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="two">
        <div className="card pad">
          <div className="chead"><h2>Classement des véhicules</h2><button className="quiet" onClick={onGoVehicules} title="Gérer les véhicules" aria-label="Gérer les véhicules">✎</button></div>
          {ranking.length === 0 && <div className="muted">Aucune pesée sur la période.</div>}
          <ol className="rank">
            {ranking.map((x, i) => (
              <li key={x.v.id}>
                <span className="pos">{i + 1}</span>
                <span className="rname">{x.v.nom}{x.v.section === 'dimanche' && <em> · dim.</em>}</span>
                <span className="rbar"><i style={{ width: `${(x.kg / maxRank) * 100}%` }} /></span>
                <b>{fmtKg(x.kg)}</b>
              </li>
            ))}
          </ol>
        </div>
        <div className="card pad">
          <div className="chead"><h2>Tonnage par jour</h2><span className="muted">max {fmtKg(maxDay)} kg</span></div>
          <div className="bars" style={{ ['--n' as string]: days.length }}>
            {days.map((d) => {
              const kg = stats.byDay[d - 1];
              return (
                <div key={d} className={`bcol ${kind(d)}`} title={`${d} ${MONTHS_FR[month - 1].toLowerCase()} : ${fmtKg(kg)} kg`}>
                  <div className="btrack"><i style={{ height: `${maxDay ? (kg / maxDay) * 100 : 0}%` }} /></div>
                  <span>{d}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

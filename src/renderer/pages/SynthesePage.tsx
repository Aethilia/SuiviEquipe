import { Fragment, useEffect, useMemo, useState } from 'react';
import { MONTHS_SHORT } from '../../shared/calendar';
import { monthStats, visibleAgents } from '../../shared/stats';
import { fmtKg, poidsStats, visibleVehicules } from '../../shared/poids';
import type { Agent, HsMonthDoc, PoidsMonthDoc, Vehicule } from '../../shared/types';
import { usePrestations } from '../prestations';
import { CodeBadge } from '../components/CodeBadge';
import { YearPicker } from '../components/YearPicker';
import { daysInMonth } from '../../shared/calendar';
import { errMsg, type Notify } from '../hooks';

interface Props {
  vehicules: Vehicule[];
  year: number;
  setYear: (y: number) => void;
  agents: Agent[];
  notify: Notify;
  refreshKey: number;
}

function HsSynthese({ year, agents, notify, refreshKey }: Omit<Props, 'setYear' | 'vehicules'>) {
  const [docs, setDocs] = useState<HsMonthDoc[]>([]);
  const { all: prestations } = usePrestations();

  useEffect(() => {
    let alive = true;
    const load = () => window.api.hs.loadYear(year).then((d) => alive && setDocs(d), (e) => notify(errMsg(e)));
    void load();
    const off = window.api.onChange((ev) => ev.kind === 'hs' && void load());
    return () => {
      alive = false;
      off();
    };
  }, [year, notify, refreshKey]);

  const rows = useMemo(() => visibleAgents(agents, docs), [agents, docs]);
  const ids = rows.map((a) => a.id);
  const perMonth = useMemo(() => docs.map((d, i) => monthStats(d, ids, daysInMonth(year, i + 1))), [docs, ids.join(','), year]); // eslint-disable-line react-hooks/exhaustive-deps
  const yearTotal = perMonth.reduce((s, m) => s + m.total, 0);
  const codes = [...prestations.map((p) => p.code), ...new Set(perMonth.flatMap((m) => Object.keys(m.byCode)).filter((c) => !prestations.some((p) => p.code === c)))];
  const byCode = codes.map((c) => perMonth.reduce((s, m) => s + (m.byCode[c] ?? 0), 0));

  return (
    <>
      <div className="kpis">
        <div className="card kpi"><div className="label">Total HS {year}</div><div className="value">{yearTotal}</div></div>
        {codes.map((c, i) => (
          <div className="card kpi" key={c}><div className="label"><CodeBadge code={c} /></div><div className="value">{byCode[i]}</div></div>
        ))}
      </div>
      <div className="card gridwrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="name" style={{ textAlign: 'left', paddingLeft: 14 }}>Agent</th>
              {MONTHS_SHORT.map((m) => <th key={m} style={{ minWidth: 54 }}>{m}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const total = perMonth.reduce((s, m) => s + (m.byAgent[a.id] ?? 0), 0);
              return (
                <tr key={a.id}>
                  <td className={`name ${a.actif ? '' : 'inactive'}`}>{a.nom}</td>
                  {perMonth.map((m, i) => <td key={i}>{m.byAgent[a.id] || ''}</td>)}
                  <td className="tot"><span className={`ball ${total ? '' : 'zero'}`}>{total}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="name">Total</td>
              {perMonth.map((m, i) => <td key={i}>{m.total || ''}</td>)}
              <td>{yearTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

function PoidsSynthese({ year, vehicules, notify, refreshKey }: Omit<Props, 'setYear' | 'agents'>) {
  const [docs, setDocs] = useState<PoidsMonthDoc[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => window.api.poids.loadYear(year).then((d) => alive && setDocs(d), (e) => notify(errMsg(e)));
    void load();
    const off = window.api.onChange((ev) => ev.kind === 'poids' && void load());
    return () => {
      alive = false;
      off();
    };
  }, [year, notify, refreshKey]);

  const rows = useMemo(() => visibleVehicules(vehicules, docs), [vehicules, docs]);
  const perMonth = useMemo(() => docs.map((d, i) => poidsStats(d, rows.map((v) => v.id), daysInMonth(year, i + 1))), [docs, rows, year]);
  const total = perMonth.reduce((s, m) => s + m.totalKg, 0);
  const vidages = perMonth.reduce((s, m) => s + m.vidages, 0);
  const maxMonth = Math.max(0, ...perMonth.map((m) => m.totalKg));

  return (
    <>
      <div className="kpis">
        <div className="card kpi"><div className="label">Tonnage {year}</div><div className="value">{(total / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} <small>t</small></div></div>
        <div className="card kpi"><div className="label">Vidages</div><div className="value">{vidages}</div></div>
        <div className="card kpi">
          <div className="label">Tonnage par mois</div>
          <div className="bars" style={{ ['--n' as string]: 12, height: 56, marginTop: 6 }}>
            {perMonth.map((m, i) => (
              <div key={i} className="bcol" title={`${MONTHS_SHORT[i]} : ${fmtKg(m.totalKg)} kg`}>
                <div className="btrack"><i style={{ height: `${maxMonth ? (m.totalKg / maxMonth) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card gridwrap">
        <table className="grid poids">
          <thead>
            <tr>
              <th className="name" style={{ textAlign: 'left', paddingLeft: 14 }}>Tournée</th>
              {MONTHS_SHORT.map((m) => <th key={m} style={{ minWidth: 64 }}>{m}</th>)}
              <th>Total kg</th>
            </tr>
          </thead>
          <tbody>
            {(['semaine', 'dimanche'] as const).map((section) => {
              const list = rows.filter((v) => v.section === section);
              return (
                <Fragment key={section}>
                  {section === 'dimanche' && list.length > 0 && <tr className="band"><td className="name">Tournées du dimanche</td><td colSpan={13} /></tr>}
                  {list.map((v) => {
                    const t = perMonth.reduce((s, m) => s + (m.byVehicle[v.id] ?? 0), 0);
                    return (
                      <tr key={v.id}>
                        <td className={`name ${v.actif ? '' : 'inactive'}`}>{v.nom}</td>
                        {perMonth.map((m, i) => <td key={i} style={{ fontSize: 12.5 }}>{m.byVehicle[v.id] ? fmtKg(m.byVehicle[v.id]) : ''}</td>)}
                        <td className="tot"><span className={`kgtot ${t ? '' : 'zero'}`}>{t ? fmtKg(t) : '–'}</span></td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="name">Total</td>
              {perMonth.map((m, i) => <td key={i} style={{ fontSize: 12.5 }}>{m.totalKg ? fmtKg(m.totalKg) : ''}</td>)}
              <td>{fmtKg(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

export function SynthesePage(props: Props) {
  const [mod, setMod] = useState<'hs' | 'poids'>('hs');
  return (
    <div className="page">
      <div className="toolbar">
        <h1>Synthèse annuelle</h1>
        <YearPicker year={props.year} setYear={props.setYear} />
        <div className="seg" role="group" aria-label="Module">
          <button className={mod === 'hs' ? 'on' : ''} onClick={() => setMod('hs')}>Heures sup</button>
          <button className={mod === 'poids' ? 'on' : ''} onClick={() => setMod('poids')}>Poids</button>
        </div>
      </div>
      {mod === 'hs' ? <HsSynthese {...props} /> : <PoidsSynthese {...props} />}
    </div>
  );
}

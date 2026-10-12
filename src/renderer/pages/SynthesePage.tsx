import { useEffect, useMemo, useState } from 'react';
import { MONTHS_SHORT } from '../../shared/calendar';
import { monthStats, visibleAgents } from '../../shared/stats';
import { CODES, type Agent, type HsMonthDoc } from '../../shared/types';
import { CodeBadge } from '../components/CodeBadge';
import { YearPicker } from '../components/YearPicker';
import { daysInMonth } from '../../shared/calendar';
import { errMsg, type Notify } from '../hooks';

interface Props {
  year: number;
  setYear: (y: number) => void;
  agents: Agent[];
  notify: Notify;
  refreshKey: number;
}

export function SynthesePage({ year, setYear, agents, notify, refreshKey }: Props) {
  const [docs, setDocs] = useState<HsMonthDoc[]>([]);

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
  const byCode = CODES.map((c) => perMonth.reduce((s, m) => s + m.byCode[c], 0));

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Synthèse annuelle – Heures sup</h1>
        <YearPicker year={year} setYear={setYear} />
      </div>
      <div className="kpis">
        <div className="card kpi"><div className="label">Total HS {year}</div><div className="value">{yearTotal}</div></div>
        {CODES.map((c, i) => (
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
    </div>
  );
}

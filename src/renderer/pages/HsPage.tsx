import { useCallback, useMemo, useState } from 'react';
import { dateStr, daysInMonth, MONTHS_FR, MONTHS_SHORT, WEEKDAY_FR, WEEKDAY_LETTER, weekday } from '../../shared/calendar';
import { holidayMap } from '../../shared/holidays';
import { cellValue, monthStats, visibleAgents } from '../../shared/stats';
import { CODE_LABELS, CODES, type Agent, type Code } from '../../shared/types';
import { CodeBadge } from '../components/CodeBadge';
import { CodePicker } from '../components/CodePicker';
import { YearPicker } from '../components/YearPicker';
import { errMsg, useHsMonth, type Notify } from '../hooks';

interface Props {
  year: number;
  setYear: (y: number) => void;
  agents: Agent[];
  notify: Notify;
  refreshKey: number;
  onGoSettings: () => void;
}

export function HsPage({ year, setYear, agents, notify, refreshKey, onGoSettings }: Props) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const { doc, loading, setCell } = useHsMonth(year, month, notify, refreshKey);
  const [sel, setSel] = useState<{ agent: Agent; day: number; rect: DOMRect } | null>(null);
  const [exporting, setExporting] = useState(false);

  const n = daysInMonth(year, month);
  const feries = useMemo(() => holidayMap(year), [year]);
  const rows = useMemo(() => visibleAgents(agents, [doc]), [agents, doc]);
  const stats = useMemo(() => monthStats(doc, rows.map((a) => a.id), n), [doc, rows, n]);
  const days = Array.from({ length: n }, (_, i) => i + 1);
  const kind = (d: number) => (feries.has(dateStr(year, month, d)) ? 'hol' : weekday(year, month, d) === 0 ? 'sun' : '');

  const pick = useCallback(
    (v: Code | null) => {
      if (!sel) return;
      void setCell(sel.agent.id, sel.day, v);
      setSel(null);
    },
    [sel, setCell],
  );

  const doExport = async () => {
    setExporting(true);
    try {
      const file = await window.api.excel.exportHs(year);
      if (file) notify(`Export enregistré : ${file}`, 'info');
    } catch (e) {
      notify(errMsg(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Heures sup – Dimanches et fériés</h1>
        <YearPicker year={year} setYear={setYear} />
        <div className="spacer" />
        <button className="btn" onClick={doExport} disabled={exporting}>{exporting ? 'Export…' : 'Exporter en Excel'}</button>
      </div>

      <div className="tabs">
        {MONTHS_SHORT.map((m, i) => (
          <button key={m} className={`pill ${month === i + 1 ? 'active' : ''}`} onClick={() => setMonth(i + 1)}>{m}</button>
        ))}
      </div>

      <div className="kpis">
        <div className="card kpi">
          <div className="label">Total HS – {MONTHS_FR[month - 1]}</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="card kpi">
          <div className="label">Agents mobilisés</div>
          <div className="value">{stats.mobilises} <small>/ {rows.length}</small></div>
        </div>
        <div className="card kpi">
          <div className="label">Répartition par prestation</div>
          <div className="split">
            {CODES.map((c) => (
              <div className="row" key={c}>
                <CodeBadge code={c} />
                <div className="bar"><i style={{ width: `${stats.total ? (stats.byCode[c] / stats.total) * 100 : 0}%`, background: `var(--c-${c.toLowerCase()})` }} /></div>
                <b>{stats.byCode[c]}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="legend">
        {CODES.map((c) => <span key={c}><CodeBadge code={c} /> {CODE_LABELS[c]}</span>)}
        <span><i className="sw" style={{ background: 'var(--sun-bg)', border: '1px solid var(--sun-head)' }} /> Dimanche</span>
        <span><i className="sw" style={{ background: 'var(--hol-bg)', border: '1px solid var(--hol-head)' }} /> Jour férié</span>
      </div>

      <div className="card gridwrap">
        {rows.length === 0 && !loading ? (
          <div className="empty">
            Aucun agent pour l'instant. Ajoutez-les dans l'onglet « Agents », ou importez votre classeur Excel dans{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); onGoSettings(); }}>Paramètres</a>.
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th className="name" style={{ textAlign: 'left', paddingLeft: 14 }}>Agent</th>
                {days.map((d) => {
                  const k = kind(d);
                  const wd = weekday(year, month, d);
                  return (
                    <th key={d} className={k} title={`${WEEKDAY_FR[wd]} ${d} ${MONTHS_FR[month - 1].toLowerCase()}${feries.get(dateStr(year, month, d)) ? ' – ' + feries.get(dateStr(year, month, d)) : ''}`}>
                      <small>{WEEKDAY_LETTER[wd]}</small>{d}
                    </th>
                  );
                })}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className={`name ${a.actif ? '' : 'inactive'}`}>{a.nom}</td>
                  {days.map((d) => {
                    const v = cellValue(doc, a.id, d);
                    const isSel = sel?.agent.id === a.id && sel.day === d;
                    return (
                      <td
                        key={d}
                        className={`cell ${v ? 'has' : kind(d)} ${isSel ? 'sel' : ''}`}
                        onClick={(e) => setSel({ agent: a, day: d, rect: e.currentTarget.getBoundingClientRect() })}
                      >
                        {v && <CodeBadge code={v} />}
                      </td>
                    );
                  })}
                  <td className="tot"><span className={`ball ${stats.byAgent[a.id] ? '' : 'zero'}`}>{stats.byAgent[a.id]}</span></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="name">Total {MONTHS_FR[month - 1].toLowerCase()}</td>
                {stats.byDay.map((v, i) => <td key={i}>{v || ''}</td>)}
                <td>{stats.total}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {sel && (
        <CodePicker
          anchor={sel.rect}
          title={`${sel.agent.nom} – ${sel.day} ${MONTHS_FR[month - 1].toLowerCase()}`}
          current={cellValue(doc, sel.agent.id, sel.day)}
          onPick={pick}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

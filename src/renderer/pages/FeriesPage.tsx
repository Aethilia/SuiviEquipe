import { dateStr, WEEKDAY_FR, weekday } from '../../shared/calendar';
import { holidaysOf } from '../../shared/holidays';
import { YearPicker } from '../components/YearPicker';

export function FeriesPage({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  const list = holidaysOf(year);
  return (
    <div className="page">
      <div className="toolbar">
        <h1>Jours fériés</h1>
        <YearPicker year={year} setYear={setYear} />
      </div>
      <p className="muted" style={{ margin: 0 }}>Calculés automatiquement (Pâques, Ascension et Pentecôte inclus). Ils sont colorés en rouge dans les grilles.</p>
      <div className="card" style={{ maxWidth: 640 }}>
        <table className="list">
          <thead><tr><th>Date</th><th>Jour</th><th>Férié</th></tr></thead>
          <tbody>
            {list.map((h) => {
              const [y, m, d] = h.date.split('-').map(Number);
              const wd = weekday(y, m, d);
              return (
                <tr key={h.date}>
                  <td>{dateStr(y, m, d).split('-').reverse().join('/')}</td>
                  <td>{WEEKDAY_FR[wd]} {wd === 0 && <span className="chip-h sun">dimanche</span>}</td>
                  <td><span className="chip-h hol">{h.nom}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function YearPicker({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  return (
    <div className="year">
      <button onClick={() => setYear(year - 1)} aria-label="Année précédente">‹</button>
      {year}
      <button onClick={() => setYear(year + 1)} aria-label="Année suivante">›</button>
    </div>
  );
}

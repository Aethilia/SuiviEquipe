import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Code } from '../../shared/types';
import { usePrestations } from '../prestations';
import { CodeBadge } from './CodeBadge';

interface Props {
  anchor: DOMRect;
  title: string;
  current: Code | null;
  onPick: (c: Code | null) => void;
  onClose: () => void;
}

/** Menu de choix de prestation, ancré à la case cliquée. Raccourcis : 1 à 9 (dans l'ordre de la liste), Suppr. */
export function CodePicker({ anchor, title, current, onPick, onClose }: Props) {
  const { active, byCode } = usePrestations();
  // La valeur actuelle reste visible même si la prestation a été désactivée.
  const choices = current && !active.some((p) => p.code === current) ? [...active, ...(byCode.has(current) ? [byCode.get(current)!] : [])] : active;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + 4 });

  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - r.width - 8));
    const top = anchor.bottom + 4 + r.height > window.innerHeight ? Math.max(8, anchor.top - r.height - 4) : anchor.bottom + 4;
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key === 'Delete' || e.key === 'Backspace') return onPick(null);
      const idx = Number(e.key) - 1;
      if (Number.isInteger(idx) && idx >= 0 && choices[idx]) onPick(choices[idx].code);
    };
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', down);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('mousedown', down);
    };
  }, [onPick, onClose, choices]);

  return (
    <div className="picker" ref={ref} style={pos} role="menu">
      <div className="head">{title}</div>
      {choices.map((p, i) => (
        <button key={p.code} onClick={() => onPick(p.code)} role="menuitem" autoFocus={current === p.code}>
          <CodeBadge code={p.code} /> {p.label} {current === p.code && '✓'}
          {i < 9 && <kbd>{i + 1}</kbd>}
        </button>
      ))}
      {current && !byCode.has(current) && <div className="head">Valeur actuelle : {current} (supprimée du référentiel)</div>}
      <button onClick={() => onPick(null)} role="menuitem" disabled={!current}>
        <span className="code" style={{ background: '#a9bbb8' }}>–</span> Effacer <kbd>Suppr</kbd>
      </button>
    </div>
  );
}

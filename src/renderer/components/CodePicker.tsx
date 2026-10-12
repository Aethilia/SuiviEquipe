import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CODE_LABELS, CODES, type Code } from '../../shared/types';
import { CodeBadge } from './CodeBadge';

const KEYS: Record<string, Code> = { v: 'VN', o: 'OM', e: 'ES', x: 'EX' };

interface Props {
  anchor: DOMRect;
  title: string;
  current: Code | null;
  onPick: (c: Code | null) => void;
  onClose: () => void;
}

/** Petit menu de choix de prestation, ancré à la case cliquée. Raccourcis : V / O / E / X, Suppr. */
export function CodePicker({ anchor, title, current, onPick, onClose }: Props) {
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
      const c = KEYS[e.key.toLowerCase()];
      if (c) onPick(c);
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
  }, [onPick, onClose]);

  return (
    <div className="picker" ref={ref} style={pos} role="menu">
      <div className="head">{title}</div>
      {CODES.map((c) => (
        <button key={c} onClick={() => onPick(c)} role="menuitem" autoFocus={current === c}>
          <CodeBadge code={c} /> {CODE_LABELS[c]} {current === c && '✓'}
          <kbd>{[...Object.entries(KEYS)].find(([, v]) => v === c)![0].toUpperCase()}</kbd>
        </button>
      ))}
      <button onClick={() => onPick(null)} role="menuitem" disabled={!current}>
        <span className="code" style={{ background: '#a9bbb8' }}>–</span> Effacer <kbd>Suppr</kbd>
      </button>
    </div>
  );
}

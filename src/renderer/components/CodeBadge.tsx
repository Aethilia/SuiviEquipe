import { FALLBACK_COLOR, textColorOn } from '../../shared/prestations';
import type { Code } from '../../shared/types';
import { usePrestations } from '../prestations';

export function CodeBadge({ code }: { code: Code }) {
  const p = usePrestations().byCode.get(code);
  const bg = p?.color ?? FALLBACK_COLOR;
  return (
    <span className="code" style={{ background: bg, color: textColorOn(bg) }} title={p?.label ?? 'Prestation supprimée du référentiel'}>
      {code}
    </span>
  );
}

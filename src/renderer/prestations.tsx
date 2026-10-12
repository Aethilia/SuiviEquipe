import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listPrestations } from '../shared/prestations';
import type { Prestation } from '../shared/types';
import { errMsg, type Notify } from './hooks';

interface Ctx {
  /** Toutes les prestations non supprimées (actives ou non), triées. */
  all: Prestation[];
  /** Prestations proposables à la saisie. */
  active: Prestation[];
  byCode: Map<string, Prestation>;
  reload: () => Promise<void>;
}

const PrestationsContext = createContext<Ctx>({ all: [], active: [], byCode: new Map(), reload: async () => {} });
export const usePrestations = () => useContext(PrestationsContext);

export function PrestationsProvider({ notify, refreshKey, children }: { notify: Notify; refreshKey: unknown; children: React.ReactNode }) {
  const [all, setAll] = useState<Prestation[]>(() => listPrestations(null));

  const reload = useCallback(async () => {
    try {
      setAll(listPrestations(await window.api.prestations.load()));
    } catch (e) {
      notify(errMsg(e));
    }
  }, [notify]);

  useEffect(() => {
    void reload();
    return window.api.onChange((ev) => ev.kind === 'prestations' && void reload());
  }, [reload, refreshKey]);

  const value = useMemo<Ctx>(() => ({ all, active: all.filter((p) => p.actif), byCode: new Map(all.map((p) => [p.code, p])), reload }), [all, reload]);
  return <PrestationsContext.Provider value={value}>{children}</PrestationsContext.Provider>;
}

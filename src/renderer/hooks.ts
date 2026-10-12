import { useCallback, useEffect, useRef, useState } from 'react';
import { applyCell, emptyMonth } from '../shared/merge';
import type { Agent, Code, HsMonthDoc } from '../shared/types';

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e));

export type Notify = (message: string, kind?: 'error' | 'info') => void;

/** Référentiel des agents, rafraîchi quand un autre poste enregistre. */
export function useAgents(notify: Notify) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setAgents(Object.values((await window.api.agents.load()).agents));
    } catch (e) {
      notify(errMsg(e));
    } finally {
      setLoaded(true);
    }
  }, [notify]);

  useEffect(() => {
    void reload();
    return window.api.onChange((ev) => ev.kind === 'agents' && void reload());
  }, [reload]);

  return { agents, loaded, reload };
}

/** Document d'un mois, avec saisie optimiste et rafraîchissement sur modification distante. */
export function useHsMonth(year: number, month: number, notify: Notify, refreshKey: unknown) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const [doc, setDoc] = useState<HsMonthDoc>(() => emptyMonth(key));
  const [loading, setLoading] = useState(true);
  const current = useRef(key);
  current.current = key;

  const reload = useCallback(async () => {
    try {
      const d = await window.api.hs.load(key);
      if (current.current === key) setDoc(d);
    } catch (e) {
      notify(errMsg(e));
    } finally {
      if (current.current === key) setLoading(false);
    }
  }, [key, notify]);

  useEffect(() => {
    setDoc(emptyMonth(key));
    setLoading(true);
    void reload();
    return window.api.onChange((ev) => ev.kind === 'hs' && ev.month === key && void reload());
  }, [key, reload, refreshKey]);

  const setCell = useCallback(
    async (agentId: string, day: number, v: Code | null) => {
      setDoc((d) => applyCell(d, agentId, day, v, Date.now(), 'moi'));
      try {
        const saved = await window.api.hs.setCell(key, agentId, day, v);
        if (current.current === key) setDoc(saved);
      } catch (e) {
        notify(errMsg(e));
        void reload();
      }
    },
    [key, notify, reload],
  );

  return { doc, loading, setCell };
}

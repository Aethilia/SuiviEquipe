import { useCallback, useEffect, useRef, useState } from 'react';
import { remoteChanges } from '../shared/sync';
import { applyCell, applyPoidsCell, emptyMonth, emptyPoidsMonth } from '../shared/merge';
import type { Agent, Code, HsMonthDoc, PoidsMonthDoc, PoidsValue, Vehicule } from '../shared/types';

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e));

/** Cases récemment modifiées par un autre poste (mises en surbrillance quelques secondes). */
function useFlash() {
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const timer = useRef<number>(0);
  const show = useCallback((keys: string[]) => {
    if (!keys.length) return;
    setFlash(new Set(keys));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(new Set()), 4500);
  }, []);
  return { flash, show };
}

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
export function useHsMonth(year: number, month: number, notify: Notify, refreshKey: unknown, me: string) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const [doc, setDoc] = useState<HsMonthDoc>(() => emptyMonth(key));
  const [loading, setLoading] = useState(true);
  const current = useRef(key);
  current.current = key;
  const docRef = useRef(doc);
  const seen = useRef<string | null>(null); // mois déjà chargé au moins une fois
  const { flash, show } = useFlash();

  const reload = useCallback(async () => {
    try {
      const d = await window.api.hs.load(key);
      if (current.current === key) {
        if (seen.current === key) show(remoteChanges(docRef.current.cells, d.cells, me));
        seen.current = key;
        docRef.current = d;
        setDoc(d);
      }
    } catch (e) {
      notify(errMsg(e));
    } finally {
      if (current.current === key) setLoading(false);
    }
  }, [key, notify, me, show]);

  useEffect(() => {
    docRef.current = emptyMonth(key);
    setDoc(docRef.current);
    setLoading(true);
    void reload();
    return window.api.onChange((ev) => ev.kind === 'hs' && ev.month === key && void reload());
  }, [key, reload, refreshKey]);

  const setCell = useCallback(
    async (agentId: string, day: number, v: Code | null) => {
      setDoc((d) => (docRef.current = applyCell(d, agentId, day, v, Date.now(), me)));
      try {
        const saved = await window.api.hs.setCell(key, agentId, day, v);
        if (current.current === key) {
          // Les cases d'un collègue arrivées entre-temps (fusionnées par le disque) sont signalées aussi.
          show(remoteChanges(docRef.current.cells, saved.cells, me));
          docRef.current = saved;
          setDoc(saved);
        }
      } catch (e) {
        notify(errMsg(e));
        void reload();
      }
    },
    [key, notify, reload, me, show],
  );

  return { doc, loading, setCell, flash };
}

/** Référentiel des véhicules / tournées. */
export function useVehicules(notify: Notify) {
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);

  const reload = useCallback(async () => {
    try {
      setVehicules(Object.values((await window.api.vehicules.load()).vehicules));
    } catch (e) {
      notify(errMsg(e));
    }
  }, [notify]);

  useEffect(() => {
    void reload();
    return window.api.onChange((ev) => ev.kind === 'vehicules' && void reload());
  }, [reload]);

  return { vehicules, reload };
}

/** Document de pesées d'un mois, avec saisie optimiste et rafraîchissement sur modification distante. */
export function usePoidsMonth(year: number, month: number, notify: Notify, refreshKey: unknown, me: string) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const [doc, setDoc] = useState<PoidsMonthDoc>(() => emptyPoidsMonth(key));
  const current = useRef(key);
  current.current = key;
  const docRef = useRef(doc);
  const seen = useRef<string | null>(null);
  const { flash, show } = useFlash();

  const reload = useCallback(async () => {
    try {
      const d = await window.api.poids.load(key);
      if (current.current === key) {
        if (seen.current === key) show(remoteChanges(docRef.current.cells, d.cells, me));
        seen.current = key;
        docRef.current = d;
        setDoc(d);
      }
    } catch (e) {
      notify(errMsg(e));
    }
  }, [key, notify, me, show]);

  useEffect(() => {
    docRef.current = emptyPoidsMonth(key);
    setDoc(docRef.current);
    void reload();
    return window.api.onChange((ev) => ev.kind === 'poids' && ev.month === key && void reload());
  }, [key, reload, refreshKey]);

  const setCell = useCallback(
    async (vehId: string, day: number, v: PoidsValue | null) => {
      setDoc((d) => (docRef.current = applyPoidsCell(d, vehId, day, v, Date.now(), me)));
      try {
        const saved = await window.api.poids.setCell(key, vehId, day, v);
        if (current.current === key) {
          show(remoteChanges(docRef.current.cells, saved.cells, me));
          docRef.current = saved;
          setDoc(saved);
        }
      } catch (e) {
        notify(errMsg(e));
        void reload();
      }
    },
    [key, notify, reload, me, show],
  );

  return { doc, setCell, flash };
}

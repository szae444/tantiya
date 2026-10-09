import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type Assessment, type Health, type Household, type QueueState } from './api';

interface Store {
  assessments: Assessment[];
  households: Household[];
  health: Health | null;
  queue: QueueState;
  loaded: boolean;
  connected: boolean;
  upsert: (a: Assessment) => void;
  refreshHouseholds: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [queue, setQueue] = useState<QueueState>({ total: 0, done: 0, queued: 0, running: false });
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);

  const upsert = useCallback((a: Assessment) => {
    setAssessments((list) => {
      const i = list.findIndex((x) => x.id === a.id);
      if (i === -1) return [a, ...list];
      const next = list.slice();
      next[i] = a;
      return next;
    });
  }, []);

  const refreshHouseholds = useCallback(async () => setHouseholds(await api.households()), []);

  useEffect(() => {
    Promise.all([api.assessments(), api.households()])
      .then(([a, h]) => { setAssessments(a); setHouseholds(h); })
      .finally(() => setLoaded(true));

    const events = new EventSource('/api/events');
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    events.addEventListener('assessment', (e) => upsert(JSON.parse((e as MessageEvent).data)));
    events.addEventListener('assessment-deleted', (e) => {
      const { id } = JSON.parse((e as MessageEvent).data);
      setAssessments((list) => list.filter((x) => x.id !== id));
    });
    events.addEventListener('household', () => void refreshHouseholds());
    events.addEventListener('progress', (e) => setQueue(JSON.parse((e as MessageEvent).data)));
    return () => events.close();
  }, [upsert, refreshHouseholds]);

  useEffect(() => {
    let alive = true;
    const tick = () => api.health().then((h) => { if (alive) { setHealth(h); setQueue(h.queue); } }).catch(() => alive && setHealth(null));
    tick();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const value = useMemo(
    () => ({ assessments, households, health, queue, loaded, connected, upsert, refreshHouseholds }),
    [assessments, households, health, queue, loaded, connected, upsert, refreshHouseholds],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

/** Tiny hash router: #/triage, #/intake, ... */
export function useRoute(): [string, (r: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'triage';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [route, (r) => { window.location.hash = `/${r}`; }];
}

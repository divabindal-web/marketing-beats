'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

/**
 * "View as member" — lets an admin (CMO) or team lead see the app scoped to a
 * specific member (their My Tasks + personal dashboard) without logging in as
 * that person. It is a VIEW filter only: writes still run as the real signed-in
 * user, and it grants no new data access (leads/admins can already read all
 * requests under RLS). Persisted to localStorage so it survives navigation.
 */
export interface ViewAsTarget {
  id: string;          // DB uuid
  sampleId?: string;   // sample-data id, when the member exists there
  name: string;
  email: string;
  team: string | null;
}

interface ViewAsValue {
  target: ViewAsTarget | null;
  setTarget: (t: ViewAsTarget | null) => void;
}

const ViewAsContext = createContext<ViewAsValue>({ target: null, setTarget: () => {} });
const KEY = 'mb-view-as';

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<ViewAsTarget | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setTargetState(JSON.parse(raw) as ViewAsTarget);
    } catch { /* ignore malformed */ }
  }, []);

  const setTarget = (t: ViewAsTarget | null) => {
    setTargetState(t);
    try {
      if (t) window.localStorage.setItem(KEY, JSON.stringify(t));
      else window.localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  };

  return (
    <ViewAsContext.Provider value={{ target, setTarget }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}

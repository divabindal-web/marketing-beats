'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { SAMPLE_USERS } from '@/lib/sample-data';
import { User } from '@/types';

interface CurrentUserContextValue {
  currentUser: User | null;
  email: string | null;
  loading: boolean;
}

const CurrentUserContext = createContext<CurrentUserContextValue>({
  currentUser: null,
  email: null,
  loading: true,
});

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveUser = (authEmail: string | undefined) => {
    if (!authEmail) {
      setCurrentUser(null);
      setEmail(null);
      return;
    }
    const lower = authEmail.toLowerCase();
    setEmail(lower);
    const match = SAMPLE_USERS.find(
      (u) => (u.email ?? '').toLowerCase() === lower,
    );
    setCurrentUser(match ?? null);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      resolveUser(data.user?.email ?? undefined);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveUser(session?.user?.email ?? undefined);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <CurrentUserContext.Provider value={{ currentUser, email, loading }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

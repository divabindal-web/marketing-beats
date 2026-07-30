'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { SAMPLE_USERS } from '@/lib/sample-data';
import { User, UserRole } from '@/types';

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

  useEffect(() => {
    let mounted = true;
    let latest = 0; // guards against out-of-order async resolutions on fast auth switches

    const resolve = async (authEmail: string | undefined) => {
      const token = ++latest;
      if (!authEmail) {
        if (mounted) { setCurrentUser(null); setEmail(null); }
        return;
      }
      const lower = authEmail.toLowerCase();
      if (mounted) setEmail(lower);

      // Prefer the rich sample-data record when present.
      const match = SAMPLE_USERS.find((u) => (u.email ?? '').toLowerCase() === lower);
      if (match) {
        if (mounted && token === latest) setCurrentUser(match);
        return;
      }
      // Fallback: resolve from the DB so members added via User Management (and
      // therefore absent from SAMPLE_USERS) still get a real identity — id is the
      // DB uuid, which matches how their requests are keyed.
      const { data } = await supabase
        .from('users')
        .select('id, name, email, team, role, is_active, designation')
        .ilike('email', lower)
        .maybeSingle();
      if (!mounted || token !== latest) return;
      if (data) {
        const validRoles: UserRole[] = ['admin', 'manager', 'designer', 'viewer'];
        setCurrentUser({
          id: data.id,
          employee_code: '',
          name: data.name,
          email: data.email ?? lower,
          designation: data.designation ?? undefined,
          department: data.team ?? 'Marketing',
          role: validRoles.includes(data.role as UserRole) ? (data.role as UserRole) : 'viewer',
          is_active: data.is_active ?? true,
          created_at: '',
          updated_at: '',
        });
      } else {
        setCurrentUser(null);
      }
    };

    supabase.auth.getUser().then(({ data }) => {
      void resolve(data.user?.email ?? undefined).finally(() => { if (mounted) setLoading(false); });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolve(session?.user?.email ?? undefined);
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

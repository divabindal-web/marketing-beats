'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useCurrentUser } from '@/components/layout/CurrentUserContext';

/**
 * Who may see and use the password tools — the Reset Passwords page, the
 * per-row "Reset password" action, and "Set one password for all".
 *
 * This is deliberately NOT `is_lead || role = 'admin'`. Every team lead used to
 * get the password tools, and the nav filter that was meant to hide them looked
 * for a section titled 'Admin' that no longer existed, so in practice the whole
 * workspace could see them. Permission now lives in one place,
 * `users.can_manage_passwords`, held by Divya, Diva and Lalit, and is enforced
 * again in the admin-users edge function — the UI check below is only there so
 * nobody is shown a control that would refuse them.
 *
 * Change who holds it in User Management's database row, not in this file.
 */
export function usePasswordAdmin(): { allowed: boolean; loading: boolean } {
  const { email } = useCurrentUser();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('can_manage_passwords')
        .ilike('email', email)
        .maybeSingle();
      if (!active) return;
      setAllowed(data?.can_manage_passwords === true);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [email]);

  return { allowed, loading };
}

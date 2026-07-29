import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Login-page "Keep me signed in" preference key. */
export const REMEMBER_KEY = 'mb-remember-device';

/**
 * Auth storage that honours the "Keep me signed in" choice made on the login
 * page: localStorage (survives closing the browser) when kept, sessionStorage
 * (cleared when the browser closes) when not. Writing to one side always
 * clears the other so a stale token can't resurrect an old choice.
 */
const authStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const remember = window.localStorage.getItem(REMEMBER_KEY) !== 'no';
    if (remember) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage, persistSession: true },
});

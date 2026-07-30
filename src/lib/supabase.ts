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
    // Read the store that matches the current preference FIRST. Reading
    // sessionStorage first used to let a stale per-tab token shadow the valid
    // persisted one, which logged people out on refresh.
    const remember = window.localStorage.getItem(REMEMBER_KEY) !== 'no';
    const primary = remember ? window.localStorage : window.sessionStorage;
    const secondary = remember ? window.sessionStorage : window.localStorage;
    return primary.getItem(key) ?? secondary.getItem(key);
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
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

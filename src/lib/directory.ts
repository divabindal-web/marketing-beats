'use client';

/**
 * directory — the people list the UI renders, sourced from the live DB.
 *
 * This replaces `SAMPLE_USERS` as the identity source. The sample file is a
 * fixed snapshot, so anyone added through User Management was invisible to
 * every screen that looked people up by id: the manager Team-workload table,
 * assignee names in All Requests, the POC dropdowns, and the mark-complete
 * team check (which failed *open* for unknown assignees). Real symptom: work
 * assigned to Neha or Vaibhav Rana rendered as "Unassigned".
 *
 * Ids stay in the space `requests-api.fetchRequests` produces — the sample
 * slug when the person has one, the DB uuid otherwise — so existing rows and
 * saved ids keep matching. `SAMPLE_USERS` is still consulted, but only to
 * borrow that slug (and the richer HR fields); the DB is what decides who
 * exists.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SAMPLE_USERS } from '@/lib/sample-data';
import { User, UserRole } from '@/types';

/** A directory entry: a `User` the UI can render, plus the DB facts it needs. */
export interface DirectoryUser extends User {
  /** The DB uuid, always — even when `id` is a sample slug. */
  db_id: string;
  /** Team from `users.team`. The base `User` type has no team field. */
  team: string | null;
  is_lead: boolean;
}

const VALID_ROLES: UserRole[] = ['admin', 'manager', 'designer', 'viewer'];

let cache: Promise<DirectoryUser[]> | null = null;

/** Load (and memoise) the directory. Call `refreshDirectory()` after edits. */
export async function loadDirectory(): Promise<DirectoryUser[]> {
  if (!cache) {
    cache = (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, team, role, is_lead, is_active, designation, employee_code')
        .order('name');
      if (error) throw error;

      const bySampleEmail = new Map<string, User>();
      SAMPLE_USERS.forEach((u) => {
        if (u.email) bySampleEmail.set(u.email.toLowerCase(), u);
      });

      return (data ?? []).map((r): DirectoryUser => {
        const email = (r.email as string | null) ?? undefined;
        const sample = email ? bySampleEmail.get(email.toLowerCase()) : undefined;
        return {
          // Sample slug when there is one, so ids already stored on requests
          // keep resolving; DB uuid for everyone else.
          id: sample?.id ?? (r.id as string),
          db_id: r.id as string,
          employee_code: (r.employee_code as string | null) ?? sample?.employee_code ?? '',
          name: (r.name as string) ?? sample?.name ?? 'Unknown',
          email,
          level: sample?.level,
          location: sample?.location,
          designation: (r.designation as string | null) ?? sample?.designation ?? undefined,
          department: (r.team as string | null) ?? sample?.department ?? 'Marketing',
          supervisor_code: sample?.supervisor_code,
          supervisor_name: sample?.supervisor_name,
          role: VALID_ROLES.includes(r.role as UserRole) ? (r.role as UserRole) : 'designer',
          is_active: (r.is_active as boolean | null) ?? true,
          created_at: sample?.created_at ?? '',
          updated_at: sample?.updated_at ?? '',
          team: (r.team as string | null) ?? null,
          is_lead: (r.is_lead as boolean | null) ?? false,
        };
      });
    })();
  }
  return cache;
}

/** Drop the memoised copy so the next `loadDirectory()` re-reads the DB. */
export function refreshDirectory() {
  cache = null;
}

/**
 * Directory for components. Starts empty, fills on mount. Screens should treat
 * an empty array as "still loading" rather than "nobody exists".
 */
export function useDirectory(): DirectoryUser[] {
  const [dir, setDir] = useState<DirectoryUser[]>([]);
  useEffect(() => {
    let alive = true;
    loadDirectory()
      .then((d) => { if (alive) setDir(d); })
      .catch((e) => console.error('Failed to load the people directory:', e));
    return () => { alive = false; };
  }, []);
  return dir;
}

/** Look someone up by whichever id space the caller holds (slug or uuid). */
export function findInDirectory(dir: DirectoryUser[], id?: string | null): DirectoryUser | undefined {
  if (!id) return undefined;
  return dir.find((u) => u.id === id || u.db_id === id);
}

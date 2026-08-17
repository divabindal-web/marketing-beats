/**
 * work-api — subtasks, comments, attachments, notifications, projects.
 * All functions hit the live Supabase DB. User ids are DB uuids throughout
 * (bridge from sample ids via requests-api userMaps where needed).
 */
import { supabase } from '@/lib/supabase';

export interface Subtask { id: string; request_id: string; title: string; done: boolean; position: number; }
export interface CommentRow { id: string; request_id: string; author_id: string | null; author_name?: string; body: string; created_at: string; }
export interface AttachmentRow { id: string; request_id: string; file_name: string; storage_path: string; size_bytes: number | null; created_at: string; url?: string; }
export interface NotificationRow { id: string; type: string; message: string; request_id: string | null; read: boolean; created_at: string; }
export interface ProjectRow { id: string; name: string; entity: string | null; status: string; }

/* -------- current DB user (by auth email) -------- */
export interface MeRow { id: string; name: string; role: string; team: string | null; is_lead: boolean; }
// Cache keyed by the CURRENT auth email — never caches "no user", and refreshes
// automatically when someone signs out and back in as a different account
// (client-side navigation doesn't reload the page, so a naive cache goes stale).
let cachedEmail: string | null = null;
let dbUserPromise: Promise<MeRow | null> | null = null;
export async function currentDbUser(): Promise<MeRow | null> {
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email?.toLowerCase() ?? null;
  if (!email) {
    cachedEmail = null;
    dbUserPromise = null;
    return null;
  }
  if (!dbUserPromise || cachedEmail !== email) {
    cachedEmail = email;
    dbUserPromise = (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name, role, team, is_lead')
        .ilike('email', email)
        .maybeSingle();
      return (data as MeRow | null) ?? null;
    })();
  }
  return dbUserPromise;
}

/* -------- team lookup (email -> team) --------
 * SAMPLE_USERS carry no team; team lives in the DB users table. This bridges
 * them by email so UI (POC dropdowns, mark-complete scoping) can filter by team.
 * Cached for the session. */
let teamMapPromise: Promise<Map<string, string>> | null = null;
export async function userTeamByEmail(): Promise<Map<string, string>> {
  if (!teamMapPromise) {
    teamMapPromise = (async () => {
      const { data } = await supabase.from('users').select('email, team');
      const m = new Map<string, string>();
      (data ?? []).forEach((u: { email: string | null; team: string | null }) => {
        if (u.email && u.team) m.set(u.email.toLowerCase(), u.team);
      });
      return m;
    })();
  }
  return teamMapPromise;
}

/* -------- subtasks -------- */
export async function listSubtasks(requestId: string): Promise<Subtask[]> {
  const { data, error } = await supabase.from('subtasks').select('*').eq('request_id', requestId).order('position').order('created_at');
  if (error) throw error;
  return (data as Subtask[]) ?? [];
}
export async function addSubtask(requestId: string, title: string): Promise<Subtask> {
  const { data, error } = await supabase.from('subtasks').insert({ request_id: requestId, title }).select().single();
  if (error) throw error;
  return data as Subtask;
}
export async function toggleSubtask(id: string, done: boolean) {
  const { error } = await supabase.from('subtasks').update({ done }).eq('id', id);
  if (error) throw error;
}
export async function deleteSubtask(id: string) {
  const { error } = await supabase.from('subtasks').delete().eq('id', id);
  if (error) throw error;
}

/* -------- comments -------- */
export async function listComments(requestId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, request_id, author_id, body, created_at, users:author_id (name)')
    .eq('request_id', requestId)
    .order('created_at');
  if (error) throw error;
  return ((data ?? []) as unknown as (CommentRow & { users: { name: string } | null })[]).map((c) => ({
    ...c, author_name: c.users?.name ?? 'Unknown',
  }));
}
export async function addComment(requestId: string, body: string): Promise<void> {
  const me = await currentDbUser();
  const { error } = await supabase.from('comments').insert({ request_id: requestId, body, author_id: me?.id ?? null });
  if (error) throw error;
}

/* -------- attachments -------- */
export async function listAttachments(requestId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase.from('attachments').select('*').eq('request_id', requestId).order('created_at');
  if (error) throw error;
  const rows = (data as AttachmentRow[]) ?? [];
  // signed URLs (1h) so files open in the browser
  await Promise.all(rows.map(async (r) => {
    const { data: s } = await supabase.storage.from('attachments').createSignedUrl(r.storage_path, 3600);
    r.url = s?.signedUrl;
  }));
  return rows;
}
export async function uploadAttachment(requestId: string, file: File): Promise<void> {
  const me = await currentDbUser();
  const path = `${requestId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: upErr } = await supabase.storage.from('attachments').upload(path, file);
  if (upErr) throw upErr;
  const { error } = await supabase.from('attachments').insert({
    request_id: requestId, file_name: file.name, storage_path: path,
    size_bytes: file.size, uploaded_by: me?.id ?? null,
  });
  if (error) throw error;
}
export async function deleteAttachment(row: AttachmentRow): Promise<void> {
  await supabase.storage.from('attachments').remove([row.storage_path]);
  const { error } = await supabase.from('attachments').delete().eq('id', row.id);
  if (error) throw error;
}

/* -------- notifications -------- */
export async function myNotifications(limit = 20): Promise<NotificationRow[]> {
  const me = await currentDbUser();
  if (!me) return [];
  const { data, error } = await supabase
    .from('notifications').select('id, type, message, request_id, read, created_at')
    .eq('user_id', me.id).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as NotificationRow[]) ?? [];
}
export async function unreadCount(): Promise<number> {
  const me = await currentDbUser();
  if (!me) return 0;
  const { count } = await supabase.from('notifications')
    .select('*', { count: 'exact', head: true }).eq('user_id', me.id).eq('read', false);
  return count ?? 0;
}
export async function markAllRead(): Promise<void> {
  const me = await currentDbUser();
  if (!me) return;
  await supabase.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false);
}

/* -------- projects (campaigns) -------- */
export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase.from('projects').select('*').eq('status', 'active').order('name');
  if (error) throw error;
  return (data as ProjectRow[]) ?? [];
}
export async function addProject(name: string, entity: string | null): Promise<ProjectRow> {
  const me = await currentDbUser();
  const { data, error } = await supabase.from('projects').insert({ name, entity, created_by: me?.id ?? null }).select().single();
  if (error) throw error;
  return data as ProjectRow;
}

/* -------- requests: delete (leads/admins only — enforced by RLS) -------- */
export async function deleteRequestById(id: string): Promise<void> {
  const { data, error } = await supabase.from('requests').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Not permitted — only team leads and admins can delete requests.');
  }
}

/* -------- team (DB users for pickers) -------- */
/** Team options for pickers. Extend this list as new teams come on board. */
export const TEAMS = ['Azuro Marketing', 'Branding', 'Content', 'Graphics & Video', 'Paid', 'Research', 'SEO', 'Social'];
export interface DbUserRow { id: string; name: string; email: string | null; role: string; team: string | null; is_lead: boolean; is_active: boolean; designation: string | null; }
export async function listDbUsers(): Promise<DbUserRow[]> {
  const { data, error } = await supabase
    .from('users').select('id, name, email, role, team, is_lead, is_active, designation').order('name');
  if (error) throw error;
  return (data as DbUserRow[]) ?? [];
}
export async function updateDbUser(id: string, patch: Partial<Pick<DbUserRow, 'role' | 'team' | 'is_lead' | 'is_active' | 'designation'>>) {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error('Your session has expired — please sign in again.');
  const { error } = await supabase.from('users').update(patch).eq('id', id);
  if (error) throw new Error((error as { message?: string }).message ?? 'Update failed');
}
export async function deleteDbUser(id: string): Promise<void> {
  const { data, error } = await supabase.from('users').delete().eq('id', id).select('id');
  if (error) {
    if ((error as { code?: string }).code === '23503') {
      throw new Error('This person has task history and can’t be deleted. Untick Active to deactivate them instead.');
    }
    throw error;
  }
  if (!data || data.length === 0) throw new Error('Delete not permitted.');
}
/**
 * Add a member — profile row AND a sign-in account.
 *
 * This used to insert into `users` only. Creating the auth account needs the
 * service_role key, which cannot live in the browser, so five people (one of
 * them a team lead) ended up with a profile they could never log in to. The
 * `admin-users` edge function does both halves with the caller's own
 * permissions and hands back a one-time password to pass on.
 */
export async function addDbUser(u: { name: string; email: string; team?: string; role?: string; designation?: string }): Promise<{ email: string; password: string }> {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error('Your session has expired — please sign in again.');
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'create_member',
      name: u.name,
      email: u.email.trim().toLowerCase(),
      team: u.team ?? null,
      role: u.role ?? 'designer',
      designation: u.designation ?? null,
    },
  });
  // functions.invoke surfaces non-2xx as an error with the body tucked away,
  // so dig the real message out rather than showing "Edge Function returned a
  // non-2xx status code".
  if (error) {
    let msg = error.message ?? 'Could not add member';
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      try { msg = (await res.json())?.error ?? msg; } catch { /* keep msg */ }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error as string);
  return { email: data.email as string, password: data.password as string };
}

/** Set a member's password. Admins anywhere; leads within their own team. */
export async function resetMemberPassword(email: string, password?: string): Promise<{ email: string; password: string }> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'reset_password', email, password },
  });
  if (error) {
    let msg = error.message ?? 'Could not reset the password';
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      try { msg = (await res.json())?.error ?? msg; } catch { /* keep msg */ }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error as string);
  return { email: data.email as string, password: data.password as string };
}

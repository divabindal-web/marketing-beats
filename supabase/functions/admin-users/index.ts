/**
 * admin-users — the privileged member operations the browser cannot do.
 *
 * The anon key can write `public.users`, but creating a *sign-in account*
 * needs the service_role key, which must never reach the browser. Without
 * this, `addDbUser` only wrote the profile row, so people added through User
 * Management had no login at all and simply could not use the tool.
 *
 * Actions:
 *   create_member   — auth account + profile row, returns a one-time password
 *   reset_password  — set a new password for an existing member
 *
 * The caller's own JWT decides what they may do: admins anywhere, team leads
 * only inside their own team. Never trust a caller-supplied role.
 *
 * Setting *someone else's* password is narrower than managing members: it
 * needs `users.can_manage_passwords`, held only by Divya, Diva and Lalit. It
 * used to be open to every team lead, which is how the password tools ended up
 * in front of people who should not have them.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/** Readable temporary password; the member is told to change it on first sign-in. */
function tempPassword(): string {
  const words = ['beats', 'square', 'design', 'studio', 'canvas', 'motion', 'pixel', 'frame'];
  const bytes = crypto.getRandomValues(new Uint32Array(3));
  const word = words[bytes[0] % words.length];
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}-${bytes[1] % 9000 + 1000}-${(bytes[2] % 9000 + 1000)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Resolve the caller from their own token, then read their role from the DB.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData } = await asCaller.auth.getUser();
  const callerEmail = authData?.user?.email?.toLowerCase();
  if (!callerEmail) return json({ error: 'Not signed in' }, 401);

  const { data: caller } = await admin
    .from('users')
    .select('id, role, team, is_lead, can_manage_passwords')
    .ilike('email', callerEmail)
    .maybeSingle();

  const isAdmin = caller?.role === 'admin';
  const isLead = caller?.is_lead === true;
  const canManagePasswords = caller?.can_manage_passwords === true;
  if (!isAdmin && !isLead) {
    return json({ error: 'Only the CMO or a team lead can manage members.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Malformed request body' }, 400);
  }
  const action = String(body.action ?? '');

  /* ---------------- create_member ---------------- */
  if (action === 'create_member') {
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const designation = body.designation ? String(body.designation).trim() : null;
    // A lead may only add into their own team, whatever the client sent.
    const team = isAdmin ? (body.team ? String(body.team) : null) : (caller?.team ?? null);
    // Only an admin may grant admin/lead; a lead's additions are plain members.
    const requestedRole = String(body.role ?? 'designer');
    const role = isAdmin && ['admin', 'manager', 'designer', 'viewer'].includes(requestedRole)
      ? requestedRole
      : requestedRole === 'admin' ? 'designer' : requestedRole;

    if (!name || !email) return json({ error: 'Name and email are required.' }, 400);
    if (!email.endsWith('@squareyards.in')) {
      return json({ error: 'Use a @squareyards.in email address.' }, 400);
    }

    const { data: existingProfile } = await admin
      .from('users').select('id').ilike('email', email).maybeSingle();
    if (existingProfile) return json({ error: 'A member with this email already exists.' }, 409);

    const password = tempPassword();

    // Reuse an orphaned auth account if one exists, otherwise make a new one.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingAuth = list?.users?.find((u) => u.email?.toLowerCase() === email);

    let authId: string;
    if (existingAuth) {
      authId = existingAuth.id;
      const { error } = await admin.auth.admin.updateUserById(authId, { password });
      if (error) return json({ error: `Could not set the password: ${error.message}` }, 400);
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error || !created?.user) {
        return json({ error: `Could not create the sign-in account: ${error?.message ?? 'unknown'}` }, 400);
      }
      authId = created.user.id;
    }

    const { error: profileErr } = await admin.from('users').insert({
      employee_code: 'NEW-' + Date.now().toString(36).toUpperCase(),
      name, email, team, role, designation, is_active: true, is_lead: false,
    });
    if (profileErr) {
      // Don't strand an auth account with no profile behind it.
      if (!existingAuth) await admin.auth.admin.deleteUser(authId);
      return json({ error: profileErr.message }, 400);
    }

    return json({ ok: true, email, password });
  }

  /* ---------------- reset_password ---------------- */
  if (action === 'reset_password') {
    // Being a lead — or even an admin — is not enough on its own.
    if (!canManagePasswords) {
      return json(
        { error: 'Setting someone else’s password is limited to Divya, Diva and Lalit.' },
        403,
      );
    }

    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) return json({ error: 'An email address is required.' }, 400);

    const { data: target } = await admin
      .from('users').select('id, team').ilike('email', email).maybeSingle();
    if (!target) return json({ error: 'No member with that email.' }, 404);
    if (!isAdmin && target.team !== caller?.team) {
      return json({ error: 'You can only reset passwords for your own team.' }, 403);
    }

    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = list?.users?.find((u) => u.email?.toLowerCase() === email);
    const password = String(body.password ?? '').trim() || tempPassword();
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

    if (!authUser) {
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
    } else {
      const { error } = await admin.auth.admin.updateUserById(authUser.id, { password });
      if (error) return json({ error: error.message }, 400);
    }
    return json({ ok: true, email, password });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});

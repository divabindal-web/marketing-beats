/**
 * requests-api — real persistence for design requests.
 *
 * Bridges the existing UI (which keys users by sample ids like
 * 'user-lalit-bhardwaj') to the live Supabase backend (uuid keys), matching
 * by email. Pages stay unchanged in how they render; they just load/save
 * through these functions instead of holding sample state.
 *
 * DB tables: requests, stage_transitions (see supabase/schema.sql).
 * The transitions log is append-only; `stage_transitions.stage` stores the
 * to-stage, and from_stage is reconstructed from the previous row on load.
 */
import { supabase } from '@/lib/supabase';
import { SAMPLE_USERS } from '@/lib/sample-data';
import { Request, RequestStage, StageTransition } from '@/types';

/* ---------------- user id bridge (sample id ⇄ db uuid, via email) -------- */

let mapsPromise: Promise<{ toDb: Map<string, string>; toUi: Map<string, string> }> | null = null;

async function userMaps() {
  if (!mapsPromise) {
    mapsPromise = (async () => {
      const { data, error } = await supabase.from('users').select('id, email');
      if (error) throw error;
      const byEmail = new Map<string, string>();
      (data ?? []).forEach((u) => u.email && byEmail.set(u.email.toLowerCase(), u.id));
      const toDb = new Map<string, string>();
      const toUi = new Map<string, string>();
      SAMPLE_USERS.forEach((su) => {
        const dbId = su.email ? byEmail.get(su.email.toLowerCase()) : undefined;
        if (dbId) {
          toDb.set(su.id, dbId);
          toUi.set(dbId, su.id);
        }
      });
      return { toDb, toUi };
    })();
  }
  return mapsPromise;
}

const isUuid = (s?: string | null) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function u2db(map: Map<string, string>, id?: string | null): string | null {
  if (!id) return null;
  if (isUuid(id)) return id;
  return map.get(id) ?? null;
}
function u2ui(map: Map<string, string>, id?: string | null): string | undefined {
  if (!id) return undefined;
  return map.get(id) ?? id;
}

/* ---------------- row mapping ---------------- */

type DbRequestRow = {
  id: string; type: Request['type']; requested_by: Request['requested_by'];
  title: string; description: string | null; requestor_name: string;
  requestor_id: string | null; entity: string | null; need_by: string;
  reference_link: string | null; current_stage: RequestStage;
  assigned_to: string | null; social_poc: string | null; video_poc: string | null;
  design_poc: string | null; shoot_date: string | null; revisions: number;
  project_id: string | null;
  created_at: string; updated_at: string;
};
type DbTransitionRow = {
  id: string; request_id: string; stage: RequestStage;
  transitioned_at: string; transitioned_by: string | null;
};

function rowToRequest(
  row: DbRequestRow,
  transitionRows: DbTransitionRow[],
  toUi: Map<string, string>,
): Request {
  const sorted = [...transitionRows].sort(
    (a, b) => new Date(a.transitioned_at).getTime() - new Date(b.transitioned_at).getTime(),
  );
  const transitions: StageTransition[] = sorted.map((t, i) => ({
    id: t.id,
    request_id: t.request_id,
    from_stage: i === 0 ? null : sorted[i - 1].stage,
    to_stage: t.stage,
    transitioned_at: t.transitioned_at,
    transitioned_by: u2ui(toUi, t.transitioned_by) ?? 'user-divya-krishnan',
  }));
  return {
    id: row.id,
    type: row.type,
    requested_by: row.requested_by,
    title: row.title,
    description: row.description ?? undefined,
    requestor_name: row.requestor_name,
    requestor_id: u2ui(toUi, row.requestor_id),
    need_by: row.need_by,
    reference_link: row.reference_link ?? undefined,
    current_stage: row.current_stage,
    assigned_to: u2ui(toUi, row.assigned_to),
    social_poc: u2ui(toUi, row.social_poc),
    video_poc: u2ui(toUi, row.video_poc),
    design_poc: u2ui(toUi, row.design_poc),
    shoot_date: row.shoot_date ?? undefined,
    project_id: row.project_id ?? undefined,
    revisions: row.revisions ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    transitions,
  };
}

function requestToRow(req: Request | Partial<Request>, toDb: Map<string, string>) {
  return {
    type: req.type,
    requested_by: req.requested_by,
    title: req.title,
    description: req.description ?? null,
    requestor_name: req.requestor_name ?? '',
    requestor_id: u2db(toDb, req.requestor_id),
    entity: (req as { entity?: string }).entity ?? null,
    need_by: req.need_by,
    reference_link: req.reference_link ?? null,
    current_stage: req.current_stage,
    assigned_to: u2db(toDb, req.assigned_to),
    social_poc: u2db(toDb, req.social_poc),
    video_poc: u2db(toDb, req.video_poc),
    design_poc: u2db(toDb, req.design_poc),
    shoot_date: req.shoot_date ?? null,
    project_id: (req as { project_id?: string }).project_id ?? null,
    revisions: req.revisions ?? 0,
  };
}

/* ---------------- public API ---------------- */

export async function fetchRequests(): Promise<Request[]> {
  const { toUi } = await userMaps();
  const [{ data: reqRows, error: reqErr }, { data: trRows, error: trErr }] = await Promise.all([
    supabase.from('requests').select('*').order('created_at', { ascending: false }),
    supabase.from('stage_transitions').select('*'),
  ]);
  if (reqErr) throw reqErr;
  if (trErr) throw trErr;
  const byRequest = new Map<string, DbTransitionRow[]>();
  ((trRows ?? []) as DbTransitionRow[]).forEach((t) => {
    const list = byRequest.get(t.request_id) ?? [];
    list.push(t);
    byRequest.set(t.request_id, list);
  });
  return ((reqRows ?? []) as DbRequestRow[]).map((r) =>
    rowToRequest(r, byRequest.get(r.id) ?? [], toUi),
  );
}

/** Insert a new request plus its initial transition; returns the persisted Request. */
export async function createRequest(req: Request): Promise<Request> {
  const { toDb, toUi } = await userMaps();
  const { data, error } = await supabase
    .from('requests')
    .insert(requestToRow(req, toDb))
    .select()
    .single();
  if (error) throw error;
  const row = data as DbRequestRow;
  const first = req.transitions?.[0];
  const { data: trData, error: trError } = await supabase
    .from('stage_transitions')
    .insert({
      request_id: row.id,
      stage: first?.to_stage ?? row.current_stage,
      transitioned_by: u2db(toDb, first?.transitioned_by ?? req.requestor_id),
    })
    .select();
  if (trError) throw trError;
  return rowToRequest(row, (trData ?? []) as DbTransitionRow[], toUi);
}

/**
 * Persist field changes + any new transitions (append-only tail).
 * Safe to call with the full updated Request object the pages already build.
 */
export async function updateRequest(req: Request): Promise<void> {
  if (!isUuid(req.id)) return; // sample/local rows are not persisted
  const { toDb } = await userMaps();
  const { error } = await supabase
    .from('requests')
    .update({ ...requestToRow(req, toDb), updated_at: new Date().toISOString() })
    .eq('id', req.id);
  if (error) throw error;

  const { count, error: cntErr } = await supabase
    .from('stage_transitions')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', req.id);
  if (cntErr) throw cntErr;
  const tail = (req.transitions ?? []).slice(count ?? 0);
  if (tail.length) {
    const { error: insErr } = await supabase.from('stage_transitions').insert(
      tail.map((t) => ({
        request_id: req.id,
        stage: t.to_stage,
        transitioned_at: t.transitioned_at,
        transitioned_by: u2db(toDb, t.transitioned_by),
      })),
    );
    if (insErr) throw insErr;
  }
}

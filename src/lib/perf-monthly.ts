'use client';

/**
 * perf-monthly — the monthly close for ORM / SEO / Social.
 *
 * The planning sheet keeps these three as wide month-by-month grids that
 * someone fills by hand: ~40 GMB listings × 3 columns × 12 months is roughly
 * 1,200 cells a year for ORM alone, each one requiring a trip to a Maps link.
 * The numbers already live in `perf_metric_series`; what was missing was a
 * way to *work* a month — see what is still blank, what missed target, and
 * type the value next to the link you read it from.
 *
 * Shapes here are deliberately month-centric: one selected month, the month
 * before it for comparison, and the target that applies.
 */
import { supabase } from '@/lib/supabase';

export type Domain = 'orm' | 'seo' | 'social';

export const DOMAIN_LABEL: Record<Domain, string> = {
  orm: 'ORM & reviews',
  seo: 'SEO',
  social: 'Social',
};

/** Metrics where a *lower* number is the better outcome. None today, but the
 *  scoring below reads better with the intent stated than assumed. */
const LOWER_IS_BETTER = new Set<string>([]);

export interface EntityRow {
  entity: string;
  label: string;
  grp: string | null;
  kind: string | null;
  link: string | null;
  sort: number;
}

export interface Cell {
  metric: string;
  value: number | null;
  prev: number | null;
  target: number | null;
  baseline: number | null;
  is_pct: boolean;
}

export interface MonthRow extends EntityRow {
  cells: Cell[];
}

export interface MonthView {
  domain: Domain;
  month: string;
  prevMonth: string;
  metrics: string[];
  rows: MonthRow[];
  filled: number;
  total: number;
  offTarget: number;
}

/* ---------------- month helpers ---------------- */

/** First day of the month, as the DATE column stores it. */
export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

export const shiftMonth = (key: string, by: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return monthKey(d);
};

export const monthLabel = (key: string) =>
  new Date(key + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });

export const shortMonth = (key: string) =>
  new Date(key + 'T00:00:00').toLocaleString('en-US', { month: 'short', year: '2-digit' });

/** The month the team would normally be closing: the one that just ended. */
export const defaultMonth = () => shiftMonth(monthKey(new Date()), -1);

/* ---------------- status of a value against its target ---------------- */

export type Status = 'missing' | 'on-target' | 'off-target' | 'no-target';

export function statusOf(c: Cell): Status {
  if (c.value == null) return 'missing';
  if (c.target == null) return 'no-target';
  const better = LOWER_IS_BETTER.has(c.metric) ? c.value <= c.target : c.value >= c.target;
  return better ? 'on-target' : 'off-target';
}

/* ---------------- loading ---------------- */

/** Most recent month that actually has a value, so views open on real data. */
export async function latestMonthWithData(domain: Domain): Promise<string | null> {
  const { data, error } = await supabase
    .from('perf_metric_series')
    .select('month')
    .eq('domain', domain)
    .not('value', 'is', null)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String(data.month).slice(0, 10) : null;
}

export async function fetchEntities(domain: Domain): Promise<EntityRow[]> {
  const { data, error } = await supabase
    .from('perf_entity')
    .select('entity, label, grp, kind, link, sort')
    .eq('domain', domain)
    .eq('is_active', true)
    .order('sort');
  if (error) throw new Error(error.message);
  return (data ?? []) as EntityRow[];
}

/**
 * Build the grid for one month: every registered entity gets a row, every
 * metric seen for that domain gets a column — including metrics with no value
 * yet, which is the whole point (a blank cell is the thing to chase).
 */
export async function fetchMonth(domain: Domain, month: string): Promise<MonthView> {
  const prevMonth = shiftMonth(month, -1);
  const [entities, { data, error }] = await Promise.all([
    fetchEntities(domain),
    supabase
      .from('perf_metric_series')
      .select('entity, metric, month, value, baseline, target, is_pct')
      .eq('domain', domain)
      .in('month', [month, prevMonth]),
  ]);
  if (error) throw new Error(error.message);

  type Row = { entity: string; metric: string; month: string; value: number | null; baseline: number | null; target: number | null; is_pct: boolean };
  const rows = (data ?? []) as Row[];
  const norm = (m: string) => String(m).slice(0, 10);

  // Every metric this domain uses, so a brand-new month still shows columns.
  const metrics = [...new Set(rows.map((r) => r.metric))].sort();

  const cur = new Map<string, Row>();
  const prev = new Map<string, Row>();
  for (const r of rows) {
    (norm(r.month) === month ? cur : prev).set(`${r.entity}|${r.metric}`, r);
  }

  // Targets carry forward: a target set in an earlier month still applies.
  const targetFor = (entity: string, metric: string) =>
    cur.get(`${entity}|${metric}`)?.target ?? prev.get(`${entity}|${metric}`)?.target ?? null;
  const baselineFor = (entity: string, metric: string) =>
    cur.get(`${entity}|${metric}`)?.baseline ?? prev.get(`${entity}|${metric}`)?.baseline ?? null;

  let filled = 0;
  let total = 0;
  let offTarget = 0;

  const out: MonthRow[] = entities.map((e) => {
    const cells: Cell[] = metrics.map((metric) => {
      const c = cur.get(`${e.entity}|${metric}`);
      const p = prev.get(`${e.entity}|${metric}`);
      const cell: Cell = {
        metric,
        value: c?.value ?? null,
        prev: p?.value ?? null,
        target: targetFor(e.entity, metric),
        baseline: baselineFor(e.entity, metric),
        is_pct: c?.is_pct ?? p?.is_pct ?? false,
      };
      // Only count a cell as "expected" if this entity has ever had that
      // metric — otherwise every entity would owe every column.
      if (c || p) {
        total += 1;
        if (cell.value != null) filled += 1;
        if (statusOf(cell) === 'off-target') offTarget += 1;
      }
      return cell;
    });
    return { ...e, cells };
  });

  return { domain, month, prevMonth, metrics, rows: out, filled, total, offTarget };
}

/** Write one cell. Blank clears the value but keeps baseline/target intact. */
export async function saveCell(
  domain: Domain,
  entity: string,
  metric: string,
  month: string,
  value: number | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from('perf_metric_series')
    .select('baseline, target, is_pct')
    .eq('domain', domain).eq('entity', entity).eq('metric', metric).eq('month', month)
    .maybeSingle();

  // Carry the target forward from the previous month when this month has no
  // row yet, so a freshly-entered value is scored against something.
  let baseline = existing?.baseline ?? null;
  let target = existing?.target ?? null;
  let isPct = existing?.is_pct ?? false;
  if (!existing) {
    const { data: prior } = await supabase
      .from('perf_metric_series')
      .select('baseline, target, is_pct')
      .eq('domain', domain).eq('entity', entity).eq('metric', metric)
      .lt('month', month).order('month', { ascending: false }).limit(1).maybeSingle();
    baseline = prior?.baseline ?? null;
    target = prior?.target ?? null;
    isPct = prior?.is_pct ?? false;
  }

  const { error } = await supabase.from('perf_metric_series').upsert(
    { domain, entity, metric, month, value, baseline, target, is_pct: isPct },
    { onConflict: 'domain,entity,metric,month' },
  );
  if (error) throw new Error(error.message);
}

/* ---------------- month sign-off ---------------- */

export interface MonthStatus {
  domain: string;
  month: string;
  state: 'open' | 'submitted' | 'reviewed';
  submitted_at: string | null;
  owner_id: string | null;
  owner_name: string | null;
  due_on: string | null;
}

/**
 * The close went stale in the sheet because no month of no domain belonged to
 * anyone in particular. An owner answers "who", a due date answers "by when",
 * and `standingOf` below turns the pair into the one thing worth showing.
 *
 * Convention is the 5th of the following month, stored per row rather than
 * derived so a particular month can be given more or less room.
 */
export const defaultDueOn = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m, 1)).slice(0, 8) + '05';
};

export type Standing = 'signed-off' | 'overdue' | 'due-soon' | 'open' | 'unassigned';

/** `today` is passed in so callers can be tested and so the caller's timezone
 *  decides what "today" means, not the module's load time. */
export function standingOf(st: MonthStatus | undefined, today: string): Standing {
  if (st && st.state !== 'open') return 'signed-off';
  const due = st?.due_on ?? null;
  if (!st?.owner_id) return due && due < today ? 'overdue' : 'unassigned';
  if (!due) return 'open';
  if (due < today) return 'overdue';
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  return days <= 3 ? 'due-soon' : 'open';
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const dueLabel = (due: string | null) =>
  due ? new Date(due + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—';

export async function fetchMonthStatuses(month: string): Promise<MonthStatus[]> {
  const { data, error } = await supabase
    .from('perf_month_status')
    .select('domain, month, state, submitted_at, owner_id, due_on, owner:users!perf_month_status_owner_id_fkey(name)')
    .eq('month', month);
  if (error) throw new Error(error.message);
  type Raw = Omit<MonthStatus, 'owner_name'> & { owner?: { name: string } | { name: string }[] | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const o = Array.isArray(r.owner) ? r.owner[0] : r.owner;
    return {
      domain: r.domain,
      month: String(r.month).slice(0, 10),
      state: r.state,
      submitted_at: r.submitted_at,
      owner_id: r.owner_id ?? null,
      owner_name: o?.name ?? null,
      due_on: r.due_on ? String(r.due_on).slice(0, 10) : null,
    };
  });
}

/** Assign (or clear) the person responsible for closing one domain-month.
 *  `state` is left out of the payload deliberately: it defaults to 'open' on
 *  insert, and omitting it means reassigning an owner cannot undo a sign-off. */
export async function setMonthOwner(
  domain: Domain,
  month: string,
  ownerId: string | null,
): Promise<void> {
  // Seed the due date on first assignment, but never overwrite one that has
  // already been set by hand.
  const { data: existing } = await supabase
    .from('perf_month_status')
    .select('due_on')
    .eq('domain', domain).eq('month', month)
    .maybeSingle();

  const { error } = await supabase.from('perf_month_status').upsert(
    {
      domain,
      month,
      owner_id: ownerId,
      due_on: existing?.due_on ?? defaultDueOn(month),
    },
    { onConflict: 'domain,month' },
  );
  if (error) throw new Error(error.message);
}

export async function setMonthDue(domain: Domain, month: string, dueOn: string | null): Promise<void> {
  const { error } = await supabase.from('perf_month_status').upsert(
    { domain, month, due_on: dueOn },
    { onConflict: 'domain,month' },
  );
  if (error) throw new Error(error.message);
}

export interface Assignee { id: string; name: string }

export async function fetchAssignees(): Promise<Assignee[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Assignee[];
}

export async function setMonthState(
  domain: Domain,
  month: string,
  state: MonthStatus['state'],
  userId: string | null,
): Promise<void> {
  const { error } = await supabase.from('perf_month_status').upsert(
    {
      domain, month, state,
      submitted_at: state === 'open' ? null : new Date().toISOString(),
      submitted_by: state === 'open' ? null : userId,
    },
    { onConflict: 'domain,month' },
  );
  if (error) throw new Error(error.message);
}

/* ---------------- computed suggestions ---------------- */

/**
 * "Videos produced" is the one Social row Design Ops already knows the answer
 * to: a video request that reached 'Uploaded' in the month IS a video produced
 * that month. v_videos_produced does the counting.
 *
 * Returned as a suggestion rather than written automatically — the plan is a
 * reported number that someone signs off on, and silently overwriting a typed
 * value with a derived one would be the wrong kind of helpful.
 */
export const VIDEOS_METRIC = 'Videos produced';

export async function fetchVideosProduced(month: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('v_videos_produced')
    .select('entity, videos')
    .eq('month', month);
  if (error) return {}; // a missing view should not take the whole page down
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { entity: string; videos: number }[]) out[r.entity] = r.videos;
  return out;
}

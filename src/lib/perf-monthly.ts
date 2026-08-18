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
}

export async function fetchMonthStatuses(month: string): Promise<MonthStatus[]> {
  const { data, error } = await supabase
    .from('perf_month_status')
    .select('domain, month, state, submitted_at')
    .eq('month', month);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, month: String(r.month).slice(0, 10) })) as MonthStatus[];
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

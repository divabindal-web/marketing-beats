'use client';

/**
 * perf-detail — everything the four performance tabs render.
 *
 * The planning sheet holds three shapes of number and they need different
 * treatment, so they live in three tables rather than being forced into one:
 *
 *   perf_metric_series  a value per month        -> trends, close, variance
 *   perf_plan           a value per named period -> FY totals, Q1-Q4, targets
 *   perf_pillar         no value at all          -> the content pillar library
 *
 * This module reads all three for a domain in one go so a page is a single
 * await rather than a waterfall.
 */
import { supabase } from '@/lib/supabase';
import { EntityRow } from '@/lib/perf-monthly';

export interface PlanRow { entity: string; metric: string; period: string; value: number | null; sort: number }
export interface PillarRow { entity: string; pillar: string; funnel: string | null; is_new: boolean; sort: number }
export interface SeriesRow {
  entity: string; metric: string; month: string;
  value: number | null; baseline: number | null; target: number | null; is_pct: boolean;
}

export interface DomainData {
  entities: EntityRow[];
  plan: PlanRow[];
  series: SeriesRow[];
  pillars: PillarRow[];
  months: string[];
}

export async function fetchDomain(domain: string, withPillars = false): Promise<DomainData> {
  const [ents, plan, series, pillars] = await Promise.all([
    supabase.from('perf_entity').select('entity,label,grp,kind,link,sort').eq('domain', domain).eq('is_active', true).order('sort'),
    supabase.from('perf_plan').select('entity,metric,period,value,sort').eq('domain', domain).order('sort'),
    supabase.from('perf_metric_series').select('entity,metric,month,value,baseline,target,is_pct').eq('domain', domain).order('month'),
    withPillars
      ? supabase.from('perf_pillar').select('entity,pillar,funnel,is_new,sort').order('sort')
      : Promise.resolve({ data: [], error: null } as never),
  ]);
  for (const r of [ents, plan, series, pillars]) {
    if (r && 'error' in r && r.error) throw new Error(r.error.message);
  }
  const s = ((series.data ?? []) as SeriesRow[]).map((r) => ({ ...r, month: String(r.month).slice(0, 10) }));
  return {
    entities: (ents.data ?? []) as EntityRow[],
    plan: (plan.data ?? []) as PlanRow[],
    series: s,
    pillars: (pillars.data ?? []) as PillarRow[],
    months: [...new Set(s.map((r) => r.month))].sort(),
  };
}

/* ---------------- formatting ---------------- */

/** Indian-market friendly: crore / lakh above a million, else thousands. */
export function fmtNum(n: number | null, isPct = false): string {
  if (n == null) return '—';
  if (isPct) return (n * 100).toFixed(1) + '%';
  const a = Math.abs(n);
  if (a >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return (n / 1e5).toFixed(2) + ' L';
  if (a >= 1000) return Math.round(n).toLocaleString('en-IN');
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export const monthShort = (m: string) =>
  new Date(m + 'T00:00:00').toLocaleString('en-US', { month: 'short', year: '2-digit' });

/** Signed delta as a percentage of `from`. */
export function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

export const FUNNEL_ORDER = ['Awareness', 'Consideration', 'Conversion', 'Engagement', 'Retention'];

export const FUNNEL_TONE: Record<string, { bg: string; fg: string }> = {
  Awareness:     { bg: 'var(--info-bg)',    fg: 'var(--info)' },
  Consideration: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  Conversion:    { bg: 'var(--success-bg)', fg: 'var(--success)' },
  Engagement:    { bg: 'var(--brand-soft)', fg: 'var(--accent-text)' },
  Retention:     { bg: 'var(--error-bg)',   fg: 'var(--error)' },
};

/** Pivot plan rows into metric -> period -> value for table rendering. */
export function pivotPlan(rows: PlanRow[], entity: string) {
  const out = new Map<string, Map<string, number | null>>();
  for (const r of rows) {
    if (r.entity !== entity) continue;
    const m = out.get(r.metric) ?? new Map();
    m.set(r.period, r.value);
    out.set(r.metric, m);
  }
  return out;
}

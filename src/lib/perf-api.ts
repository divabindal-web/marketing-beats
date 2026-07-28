/**
 * Performance Data API — live Supabase-backed metric series.
 *
 * All dashboard numbers live in one table, `perf_metric_series`
 * (see supabase/performance_data_schema.sql):
 *   domain ('seo'|'orm'|'paid'|'social') · entity · metric · month (DATE)
 *   value · baseline · target · is_pct
 *
 * The /performance-data/* pages read via fetchSeries() and the Upload Data
 * page writes via parsePerfCsv() + upsertSeries().
 */
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';

export interface SeriesRow {
  domain: string;
  entity: string;
  metric: string;
  month: string;
  value: number | null;
  baseline: number | null;
  target: number | null;
  is_pct: boolean;
}

const toNum = (v: unknown): number | null =>
  v == null || v === '' ? null : Number(v);

/** All rows for one domain, ordered by month (then entity/metric for stable grouping). */
export async function fetchSeries(domain: string): Promise<SeriesRow[]> {
  const { data, error } = await supabase
    .from('perf_metric_series')
    .select('domain, entity, metric, month, value, baseline, target, is_pct')
    .eq('domain', domain)
    .order('month', { ascending: true })
    .order('entity', { ascending: true })
    .order('metric', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    domain: r.domain,
    entity: r.entity,
    metric: r.metric,
    month: String(r.month).slice(0, 10),
    value: toNum(r.value),
    baseline: toNum(r.baseline),
    target: toNum(r.target),
    is_pct: !!r.is_pct,
  }));
}

/** Upsert rows keyed on (domain, entity, metric, month). Returns the number of rows written. */
export async function upsertSeries(
  rows: (Omit<SeriesRow, 'is_pct'> & { is_pct?: boolean })[],
): Promise<number> {
  if (!rows.length) return 0;
  const { error, count } = await supabase
    .from('perf_metric_series')
    .upsert(
      rows.map((r) => ({
        domain: r.domain,
        entity: r.entity,
        metric: r.metric,
        month: r.month,
        value: r.value,
        baseline: r.baseline,
        target: r.target,
        is_pct: r.is_pct ?? false,
      })),
      { onConflict: 'domain,entity,metric,month', count: 'exact' },
    );
  if (error) throw new Error(error.message);
  return count ?? rows.length;
}

const MONTH_RE = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

/** Percentage-style metrics keep their is_pct flag when re-uploaded. */
const isPctMetric = (metric: string) => /share|pct|percent|%/i.test(metric);

/**
 * Parse a performance CSV. Columns (header row, case-insensitive):
 * Domain, Entity, Metric, Month, Value, Baseline, Target.
 * Month accepts YYYY-MM or YYYY-MM-DD (normalised to YYYY-MM-01).
 * Numeric fields may contain commas. Bad rows are skipped and reported.
 */
export function parsePerfCsv(text: string): { rows: SeriesRow[]; errors: string[] } {
  const rows: SeriesRow[] = [];
  const errors: string[] = [];

  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: 'greedy' });
  const data = parsed.data.filter((r) => r.some((c) => c && c.trim() !== ''));
  if (!data.length) return { rows, errors: ['The file is empty.'] };

  const header = data[0].map((h) => (h ?? '').trim().toLowerCase());
  const idx = {
    domain: header.indexOf('domain'),
    entity: header.indexOf('entity'),
    metric: header.indexOf('metric'),
    month: header.indexOf('month'),
    value: header.indexOf('value'),
    baseline: header.indexOf('baseline'),
    target: header.indexOf('target'),
  };
  const missing = (['domain', 'entity', 'metric', 'month', 'value'] as const).filter(
    (c) => idx[c] === -1,
  );
  if (missing.length) {
    return {
      rows,
      errors: [
        `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
          'Expected header: Domain,Entity,Metric,Month,Value,Baseline,Target',
      ],
    };
  }

  const cell = (line: string[], i: number) => (i === -1 ? '' : (line[i] ?? '').trim());

  const parseNum = (raw: string): { ok: boolean; v: number | null } => {
    if (raw === '') return { ok: true, v: null };
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? { ok: true, v: n } : { ok: false, v: null };
  };

  for (let li = 1; li < data.length; li++) {
    const line = data[li];
    const rowNo = li + 1;

    const domain = cell(line, idx.domain).toLowerCase();
    const entity = cell(line, idx.entity);
    const metric = cell(line, idx.metric);
    const monthRaw = cell(line, idx.month);

    if (!domain || !entity || !metric || !monthRaw) {
      errors.push(`Row ${rowNo}: Domain, Entity, Metric and Month are all required — skipped.`);
      continue;
    }

    const mm = MONTH_RE.exec(monthRaw);
    const monthNum = mm ? Number(mm[2]) : 0;
    if (!mm || monthNum < 1 || monthNum > 12) {
      errors.push(`Row ${rowNo}: invalid month "${monthRaw}" (use YYYY-MM or YYYY-MM-DD) — skipped.`);
      continue;
    }
    const month = `${mm[1]}-${mm[2]}-01`;

    const value = parseNum(cell(line, idx.value));
    const baseline = parseNum(cell(line, idx.baseline));
    const target = parseNum(cell(line, idx.target));
    if (!value.ok || !baseline.ok || !target.ok) {
      const bad = [
        !value.ok ? `Value "${cell(line, idx.value)}"` : null,
        !baseline.ok ? `Baseline "${cell(line, idx.baseline)}"` : null,
        !target.ok ? `Target "${cell(line, idx.target)}"` : null,
      ]
        .filter(Boolean)
        .join(', ');
      errors.push(`Row ${rowNo}: not a number — ${bad} — skipped.`);
      continue;
    }

    rows.push({
      domain,
      entity,
      metric,
      month,
      value: value.v,
      baseline: baseline.v,
      target: target.v,
      is_pct: isPctMetric(metric),
    });
  }

  return { rows, errors };
}

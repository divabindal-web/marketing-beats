/**
 * Performance Data — shared formatting helpers and static Hootsuite metadata.
 *
 * The metric values themselves now live in Supabase (`perf_metric_series`,
 * see supabase/performance_data_schema.sql) and are read via src/lib/perf-api.ts.
 * Only display helpers and the connected-accounts list remain here.
 */

/* ---------------- helpers ---------------- */
export function fmtCompact(n: number | null): string {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e7) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e5) return (n / 1e3).toFixed(0) + 'K';
  if (a >= 1000) return n.toLocaleString('en-IN');
  return '' + n;
}
export function momDelta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/* ---------------- Social (Hootsuite) ---------------- */
/** Fallback period label for the Hootsuite custom report (used when no data is loaded yet). */
export const HOOTSUITE_PERIOD = 'Mar 1 – Mar 31, 2026';

/** Connected report sources by network (from the report's source list). */
export const HOOTSUITE_SOURCES = [
  { network: 'LinkedIn', accounts: ['Square Yards', 'Azuro by Square Yards', 'Superagent.me', 'Urban Money UAE'] },
  { network: 'Facebook', accounts: ['Square Yards', 'Square Yards UAE', 'Square Yards Australia', 'Square Yards Canada', 'Square Connect', 'Urban Money India', 'Urban Money Canada', 'Urban Money Oceania', 'Urban Money UAE', 'Azuro by Square Yards'] },
  { network: 'Instagram', accounts: ['square_yards', 'urbanmoney_india', 'urbanmoneyoceania', 'urbanmoneyuae', 'squareyards_australia', 'squareyards.ca'] },
];

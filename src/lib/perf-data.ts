/**
 * Performance Data — SEO, ORM and Paid metrics.
 *
 * Seeded from the CMO's marketing tracker sheet (FY 2026-27, Apr–Jun actuals).
 * These are real Square Yards numbers used to build the dashboards. When the
 * live upload pipeline lands, these arrays are replaced by Supabase queries
 * (tables in supabase/performance_data_schema.sql) — the page components read
 * from these helpers, so swapping the source is a one-file change.
 */

export const PERF_MONTHS = ['Apr', 'May', 'Jun'] as const;

export interface SeoMetric {
  base: number | null;
  target: number | null;
  m: (number | null)[]; // Apr, May, Jun
  pct?: boolean;
  cr?: boolean;
}
export type SeoEntity = Record<string, SeoMetric>;

export const SEO_DATA: Record<string, SeoEntity> = {
  'SQY - SEO': {
    clicks: { base: 613017, target: 757424, m: [566703, 584065, 591129] },
    impressions: { base: 52068634, target: null, m: [47087695, 58524316, 49568997] },
    leadVol: { base: 95301, target: 98465, m: [96269, 109737, 88979] },
    orgLeadVol: { base: 34457, target: 42574, m: [48265, 72801, 68670] },
    orgShare: { base: 36.16, target: 43.24, m: [50.14, 66.34, 77.18], pct: true },
    revenueCr: { base: null, target: null, m: [1.29, 3.33, 9.36], cr: true },
  },
  'INCO - IN': {
    clicks: { base: 52905, target: 110251, m: [65067, 90163, 107753] },
    impressions: { base: 8147204, target: null, m: [9993271, 12700678, 13534904] },
    leadVol: { base: 1538, target: 2205, m: [627, 1228, 1309] },
    orgLeadVol: { base: 540, target: 1125, m: [443, 701, 807] },
    orgShare: { base: 35.11, target: 51.03, m: [70.65, 57.08, 61.65], pct: true },
    revenueCr: { base: null, target: null, m: [0.42, 0.86, 1.09], cr: true },
  },
  UM: {
    clicks: { base: 14069, target: 42908, m: [112108, 112856, 86984] },
    impressions: { base: 30087405, target: null, m: [18833936, 16960078, 7243339] },
    leadVol: { base: 860, target: 2574, m: [264783, 84859, 85995] },
    orgLeadVol: { base: 742, target: 2263, m: [56049, 58319, 58355] },
    orgShare: { base: 86.28, target: 87.9, m: [21.17, 68.72, 67.86], pct: true },
  },
};
export const SEO_ENTITIES = Object.keys(SEO_DATA);

export const SEO_METRIC_ROWS: { label: string; key: string }[] = [
  { label: 'Organic Clicks', key: 'clicks' },
  { label: 'Impressions', key: 'impressions' },
  { label: 'Lead Volume', key: 'leadVol' },
  { label: 'Organic Lead Volume', key: 'orgLeadVol' },
  { label: 'Organic Lead Share %', key: 'orgShare' },
  { label: 'Organic Revenue (Cr)', key: 'revenueCr' },
];

/* ---------------- ORM ---------------- */
export const ORM_PLATFORMS = [
  { n: 'Glassdoor', prev: 3.3, cur: 3.6, yoy: 9 },
  { n: 'MouthShut', prev: 2.1, cur: 4.5, yoy: 114 },
  { n: 'TrustPilot', prev: 1.4, cur: 4.7, yoy: 236 },
  { n: 'AmbitionBox', prev: 3.6, cur: 3.6, yoy: 0 },
];
export const ORM_GMB = [
  { n: 'INCO', prev: 4.52, cur: 4.58 },
  { n: 'SQY', prev: 4.01, cur: 4.21 },
  { n: 'UM', prev: null as number | null, cur: 4.23 },
];
export const ORM_REVIEWS = { customer: 18611, employeePrev: 721, employeeCur: 6191, employeeYoy: 88 };

/* ---------------- Paid ---------------- */
export const PAID_TEAMS = [
  { n: 'INCO-GCC', spent: 20947826, rev: 229625047, roas: 11, share: 41, revCr: 25 },
  { n: 'INCO-IN', spent: 45406019, rev: 301597622, roas: 7, share: 45, revCr: 31 },
  { n: 'Australia', spent: 29398811, rev: 93654515, roas: 3, share: 48, revCr: 9.3 },
  { n: 'Canada', spent: 41682134, rev: 64123686, roas: 2, share: 27, revCr: 6.4 },
  { n: 'IPM', spent: 6162381, rev: 23199602, roas: 4, share: 5, revCr: 2.4 },
];
export const PAID_CPL = [
  { c: 'Chennai', a: 4001, b: 1697 },
  { c: 'Hyderabad', a: 3016, b: 802 },
  { c: 'Mumbai', a: 1457, b: 597 },
  { c: 'Noida', a: 735, b: 237 },
  { c: 'Pune', a: 1420, b: 828 },
  { c: 'Bangalore', a: 1341, b: 1092 },
  { c: 'Dubai', a: 3695, b: 1665 },
];
export const PAID_LEADS = [
  { s: 'Paid', v: 404132 },
  { s: 'Direct/Walk-in', v: 141007 },
  { s: 'Calling', v: 134677 },
  { s: 'Organic+Web', v: 83016 },
  { s: 'Referral', v: 1386 },
  { s: 'Social', v: 342 },
];
export const PAID_TOTALS = { revCr: 74.1, blendedRoas: 5, spendCr: 14.4, paidLeads: 404132 };

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
/** March 2026 totals from the Hootsuite custom report (all networks, all entities). */
export const HOOTSUITE_PERIOD = 'Mar 1 – Mar 31, 2026';
export const HOOTSUITE_TOTALS = [
  { n: 'Followers', v: 740095, unit: 'followers' },
  { n: 'Page & profile impressions', v: 4847308, unit: 'impressions' },
  { n: 'Page & profile reach', v: 3518284, unit: 'people' },
  { n: 'Post reach', v: 457493, unit: 'people' },
  { n: 'Post link clicks', v: 17981, unit: 'clicks' },
  { n: 'Reactions & likes', v: 9078, unit: 'reactions' },
  { n: 'Shares', v: 1041, unit: 'shares' },
  { n: 'Comments & replies', v: 214, unit: 'comments' },
];
/** Connected report sources by network (from the report's source list). */
export const HOOTSUITE_SOURCES = [
  { network: 'LinkedIn', accounts: ['Square Yards', 'Azuro by Square Yards', 'Superagent.me', 'Urban Money UAE'] },
  { network: 'Facebook', accounts: ['Square Yards', 'Square Yards UAE', 'Square Yards Australia', 'Square Yards Canada', 'Square Connect', 'Urban Money India', 'Urban Money Canada', 'Urban Money Oceania', 'Urban Money UAE', 'Azuro by Square Yards'] },
  { network: 'Instagram', accounts: ['square_yards', 'urbanmoney_india', 'urbanmoneyoceania', 'urbanmoneyuae', 'squareyards_australia', 'squareyards.ca'] },
];

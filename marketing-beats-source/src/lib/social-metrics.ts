/**
 * Social metrics — sample data, helpers, and aggregations.
 *
 * Mocks 3 months (Jan, Feb, Mar 2026) × 4 platforms.
 * Numbers are deliberately rough but realistic for a mid-sized real-estate
 * brand: YouTube grows slowly with high reach per video, LinkedIn is
 * thought-leader heavy, Instagram is the volume play, Facebook is
 * declining gracefully.
 */

import {
  SocialMetricRow,
  SocialMetricTarget,
  SocialMetricPlatform,
  SOCIAL_METRIC_PLATFORMS,
} from '@/types';

/* ------------------------------------------------------------------ */
/*  Sample monthly snapshots                                          */
/* ------------------------------------------------------------------ */

const today = new Date().toISOString();

function row(
  platform: SocialMetricPlatform,
  month: string,
  data: Omit<SocialMetricRow, 'id' | 'platform' | 'month' | 'uploaded_by' | 'uploaded_at' | 'source_file'>,
): SocialMetricRow {
  return {
    id: `sm-${platform.toLowerCase()}-${month}`,
    platform,
    month,
    uploaded_by: 'user-divya-krishnan',
    uploaded_at: today,
    source_file: `${platform.toLowerCase()}_${month.slice(0, 7)}.csv`,
    ...data,
  };
}

export const SAMPLE_SOCIAL_METRICS: SocialMetricRow[] = [
  // ------- YouTube -------
  row('YouTube', '2026-01-01', {
    followers: 18420,
    followers_gained: 220,
    impressions: 142000,
    reach: 96000,
    likes: 4250,
    comments: 312,
    shares: 540,
    profile_views: 6800,
    link_clicks: 410,
    posts: 8,
    engagement_rate: 5.32,
  }),
  row('YouTube', '2026-02-01', {
    followers: 18790,
    followers_gained: 370,
    impressions: 158000,
    reach: 105000,
    likes: 4880,
    comments: 365,
    shares: 612,
    profile_views: 7150,
    link_clicks: 478,
    posts: 9,
    engagement_rate: 5.58,
  }),
  row('YouTube', '2026-03-01', {
    followers: 19340,
    followers_gained: 550,
    impressions: 184000,
    reach: 122000,
    likes: 5710,
    comments: 421,
    shares: 728,
    profile_views: 7820,
    link_clicks: 535,
    posts: 11,
    engagement_rate: 5.62,
  }),

  // ------- LinkedIn -------
  row('LinkedIn', '2026-01-01', {
    followers: 41200,
    followers_gained: 850,
    impressions: 312000,
    reach: 198000,
    likes: 8420,
    comments: 612,
    shares: 1240,
    saves: 320,
    profile_views: 11200,
    link_clicks: 1860,
    posts: 24,
    engagement_rate: 5.18,
  }),
  row('LinkedIn', '2026-02-01', {
    followers: 42180,
    followers_gained: 980,
    impressions: 348000,
    reach: 215000,
    likes: 9120,
    comments: 698,
    shares: 1390,
    saves: 365,
    profile_views: 12050,
    link_clicks: 2050,
    posts: 26,
    engagement_rate: 5.21,
  }),
  row('LinkedIn', '2026-03-01', {
    followers: 43450,
    followers_gained: 1270,
    impressions: 405000,
    reach: 248000,
    likes: 10620,
    comments: 812,
    shares: 1605,
    saves: 421,
    profile_views: 13100,
    link_clicks: 2390,
    posts: 28,
    engagement_rate: 5.26,
  }),

  // ------- Instagram -------
  row('Instagram', '2026-01-01', {
    followers: 86400,
    followers_gained: 1820,
    impressions: 642000,
    reach: 412000,
    likes: 28400,
    comments: 1840,
    shares: 4120,
    saves: 2150,
    profile_views: 24800,
    link_clicks: 980,
    posts: 42,
    engagement_rate: 6.18,
  }),
  row('Instagram', '2026-02-01', {
    followers: 88950,
    followers_gained: 2550,
    impressions: 695000,
    reach: 438000,
    likes: 30150,
    comments: 1980,
    shares: 4480,
    saves: 2380,
    profile_views: 26100,
    link_clicks: 1080,
    posts: 45,
    engagement_rate: 6.25,
  }),
  row('Instagram', '2026-03-01', {
    followers: 92180,
    followers_gained: 3230,
    impressions: 754000,
    reach: 469000,
    likes: 32820,
    comments: 2185,
    shares: 4920,
    saves: 2640,
    profile_views: 28200,
    link_clicks: 1240,
    posts: 48,
    engagement_rate: 6.39,
  }),

  // ------- Facebook -------
  row('Facebook', '2026-01-01', {
    followers: 124800,
    followers_gained: 320,
    impressions: 412000,
    reach: 215000,
    likes: 6820,
    comments: 412,
    shares: 980,
    profile_views: 9400,
    link_clicks: 1820,
    posts: 36,
    engagement_rate: 3.82,
  }),
  row('Facebook', '2026-02-01', {
    followers: 125100,
    followers_gained: 300,
    impressions: 398000,
    reach: 208000,
    likes: 6620,
    comments: 395,
    shares: 940,
    profile_views: 9100,
    link_clicks: 1755,
    posts: 34,
    engagement_rate: 3.83,
  }),
  row('Facebook', '2026-03-01', {
    followers: 125380,
    followers_gained: 280,
    impressions: 386000,
    reach: 201000,
    likes: 6450,
    comments: 380,
    shares: 905,
    profile_views: 8900,
    link_clicks: 1690,
    posts: 33,
    engagement_rate: 3.85,
  }),
];

/* ------------------------------------------------------------------ */
/*  Targets — flat across the quarter for the demo                    */
/* ------------------------------------------------------------------ */

export const SAMPLE_SOCIAL_TARGETS: SocialMetricTarget[] = [
  { platform: 'YouTube',   followers: 20000,  impressions: 200000, engagement_rate: 6.0, posts: 12 },
  { platform: 'LinkedIn',  followers: 45000,  impressions: 420000, engagement_rate: 5.5, posts: 28 },
  { platform: 'Instagram', followers: 95000,  impressions: 780000, engagement_rate: 6.5, posts: 48 },
  { platform: 'Facebook',  followers: 126000, impressions: 410000, engagement_rate: 4.0, posts: 36 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns metrics sorted ascending by month for the given platform. */
export function metricsForPlatform(
  rows: SocialMetricRow[],
  platform: SocialMetricPlatform,
): SocialMetricRow[] {
  return rows
    .filter((r) => r.platform === platform)
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Returns the most recent month present in the dataset. */
export function latestMonth(rows: SocialMetricRow[]): string | null {
  if (rows.length === 0) return null;
  return rows.map((r) => r.month).sort().at(-1) ?? null;
}

/** Returns the latest snapshot for each platform. */
export function latestPerPlatform(
  rows: SocialMetricRow[],
): Partial<Record<SocialMetricPlatform, SocialMetricRow>> {
  const map: Partial<Record<SocialMetricPlatform, SocialMetricRow>> = {};
  for (const platform of SOCIAL_METRIC_PLATFORMS) {
    const latest = metricsForPlatform(rows, platform).at(-1);
    if (latest) map[platform] = latest;
  }
  return map;
}

/** Month-over-month delta for a numeric metric. Returns null if comparison impossible. */
export function momDelta(
  rows: SocialMetricRow[],
  platform: SocialMetricPlatform,
  field: keyof SocialMetricRow,
): { current: number; previous: number; deltaPct: number } | null {
  const series = metricsForPlatform(rows, platform);
  if (series.length < 2) return null;
  const current = series.at(-1)![field];
  const previous = series.at(-2)![field];
  if (typeof current !== 'number' || typeof previous !== 'number') return null;
  if (previous === 0) return { current, previous, deltaPct: 0 };
  return {
    current,
    previous,
    deltaPct: Math.round(((current - previous) / previous) * 1000) / 10,
  };
}

/** Format big numbers for stat cards. 1280 → "1.3K", 1_240_000 → "1.2M". */
export function formatCompact(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Format month string ("2026-03-01") → "Mar 2026" */
export function formatMonth(month: string): string {
  const d = new Date(month);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Format month string → "Mar" only */
export function formatMonthShort(month: string): string {
  const d = new Date(month);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

/** Brand colour for each platform — used in subtle pill backgrounds. */
export const PLATFORM_COLOR: Record<
  SocialMetricPlatform,
  { bg: string; text: string; border: string; dot: string }
> = {
  YouTube: {
    bg: 'rgba(220, 38, 38, 0.08)',
    text: '#b91c1c',
    border: 'rgba(220, 38, 38, 0.18)',
    dot: '#dc2626',
  },
  LinkedIn: {
    bg: 'rgba(10, 102, 194, 0.08)',
    text: '#0a66c2',
    border: 'rgba(10, 102, 194, 0.18)',
    dot: '#0a66c2',
  },
  Instagram: {
    bg: 'rgba(193, 53, 132, 0.08)',
    text: '#a32a72',
    border: 'rgba(193, 53, 132, 0.18)',
    dot: '#c13584',
  },
  Facebook: {
    bg: 'rgba(24, 119, 242, 0.08)',
    text: '#1565c0',
    border: 'rgba(24, 119, 242, 0.18)',
    dot: '#1877f2',
  },
};

/** Find a target row for a platform. */
export function targetFor(platform: SocialMetricPlatform): SocialMetricTarget | undefined {
  return SAMPLE_SOCIAL_TARGETS.find((t) => t.platform === platform);
}

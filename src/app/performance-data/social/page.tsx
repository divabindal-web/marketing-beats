'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Download } from 'lucide-react';
import { fmtCompact, HOOTSUITE_SOURCES, HOOTSUITE_PERIOD } from '@/lib/perf-data';
import { fetchSeries, type SeriesRow } from '@/lib/perf-api';
import { HBars, StatCard } from '@/components/perf/Charts';

/** Display metadata for the Hootsuite metric keys stored in the database. */
const METRIC_META: Record<string, { label: string; unit: string }> = {
  followers: { label: 'Followers', unit: 'followers' },
  impressions: { label: 'Page & profile impressions', unit: 'impressions' },
  profile_reach: { label: 'Page & profile reach', unit: 'people' },
  post_reach: { label: 'Post reach', unit: 'people' },
  link_clicks: { label: 'Post link clicks', unit: 'clicks' },
  reactions: { label: 'Reactions & likes', unit: 'reactions' },
  shares: { label: 'Shares', unit: 'shares' },
  comments: { label: 'Comments & replies', unit: 'comments' },
};
const KPI_KEYS = ['followers', 'impressions', 'profile_reach', 'post_reach'];
const ENGAGEMENT_KEYS = ['link_clicks', 'reactions', 'shares', 'comments'];
const REACH_KEYS = ['impressions', 'profile_reach', 'post_reach', 'followers'];

const monthYear = (m: string) =>
  new Date(m + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });

export default function SocialHootsuitePage() {
  const [rows, setRows] = useState<SeriesRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSeries('social')
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const model = useMemo(() => {
    if (!rows || !rows.length) return null;
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const latestMonth = months[months.length - 1];
    const latest = rows.filter((r) => r.month === latestMonth);
    const entities = [...new Set(latest.map((r) => r.entity))].sort();
    const entity = entities.includes('All accounts') ? 'All accounts' : entities[0];
    const vals = new Map<string, number | null>();
    for (const r of latest) if (r.entity === entity) vals.set(r.metric, r.value);
    const metric = (k: string) => ({
      n: METRIC_META[k]?.label ?? k,
      unit: METRIC_META[k]?.unit ?? '',
      v: vals.get(k) ?? 0,
    });
    return {
      entity,
      period: monthYear(latestMonth),
      kpis: KPI_KEYS.filter((k) => vals.has(k)).map(metric),
      engagement: ENGAGEMENT_KEYS.filter((k) => vals.has(k)).map(metric),
      reach: REACH_KEYS.filter((k) => vals.has(k)).map((k) => {
        const m = metric(k);
        return { ...m, n: m.n.replace('Page & profile ', 'P&P ') };
      }),
    };
  }, [rows]);

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Social — Hootsuite</h1>
          <p className="gb-page-description">
            All networks &amp; entities · {model?.period ?? HOOTSUITE_PERIOD} · from the Hootsuite custom report
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-faint)' }}>
            Live from database · updated via Upload Data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/performance-data/upload" className="gb-btn gb-btn-secondary">
            <Download size={14} strokeWidth={2} />
            Template
          </Link>
          <Link href="/performance-data/upload" className="gb-btn gb-btn-primary">
            <Upload size={14} strokeWidth={2.25} />
            Upload report
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-[12.5px] mb-4" style={{ color: 'var(--error)' }}>
          Couldn&apos;t load Social data: {error}
        </p>
      )}
      {!error && !rows && (
        <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
          Loading…
        </p>
      )}
      {!error && rows && !model && (
        <div className="gb-card p-6 text-center mb-4">
          <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            No Social data yet
          </p>
          <p className="gb-page-description">
            Upload a CSV on the{' '}
            <Link href="/performance-data/upload" style={{ textDecoration: 'underline' }}>
              Upload Data
            </Link>{' '}
            page to populate this dashboard.
          </p>
        </div>
      )}

      {model && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {model.kpis.map((k) => (
              <StatCard key={k.n} label={k.n} value={fmtCompact(k.v)} sub={k.unit} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Engagement — {model.period}</h3>
              <p className="gb-page-description mb-3">clicks, reactions, shares, comments across all accounts</p>
              <HBars items={model.engagement.map((e) => ({ n: e.n, v: e.v ?? 0 }))} labelW={150} color="#e87ba4" />
            </div>
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Reach &amp; impressions</h3>
              <p className="gb-page-description mb-3">audience scale this month</p>
              <HBars items={model.reach.map((e) => ({ n: e.n, v: e.v ?? 0 }))} labelW={130} color="#2a78d6" />
            </div>
          </div>
        </>
      )}

      <div className="gb-card p-4">
        <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Connected accounts (report sources)</h3>
        <p className="gb-page-description mb-3">
          20 accounts across LinkedIn, Facebook and Instagram — SQY, Urban Money and Azuro
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {HOOTSUITE_SOURCES.map((s) => (
            <div key={s.network}>
              <div className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {s.network} · {s.accounts.length}
              </div>
              <ul className="space-y-1">
                {s.accounts.map((a) => (
                  <li key={a} className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] mt-4" style={{ color: 'var(--text-faint)' }}>
          Live numbers from the database. Upload the next Hootsuite export on the Upload Data page — month-over-month
          trends appear once two or more periods are in.
        </p>
      </div>
    </div>
  );
}

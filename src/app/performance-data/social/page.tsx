'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Download } from 'lucide-react';
import { fmtCompact, HOOTSUITE_SOURCES, HOOTSUITE_PERIOD } from '@/lib/perf-data';
import { fetchSeries, type SeriesRow } from '@/lib/perf-api';
import { StatCard } from '@/components/perf/Charts';

/** Display metadata for the Hootsuite metric keys stored in the database. */
const METRIC_META: Record<string, { label: string; unit: string }> = {
  followers: { label: 'Followers', unit: 'total across accounts' },
  impressions: { label: 'Impressions', unit: 'pages & profiles' },
  profile_reach: { label: 'Profile reach', unit: 'people' },
  post_reach: { label: 'Post reach', unit: 'people' },
  link_clicks: { label: 'Link clicks', unit: 'from posts' },
  reactions: { label: 'Reactions & likes', unit: '' },
  shares: { label: 'Shares', unit: '' },
  comments: { label: 'Comments', unit: '' },
};
const ORDER = ['followers', 'impressions', 'profile_reach', 'post_reach', 'link_clicks', 'reactions', 'shares', 'comments'];

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
    const prevMonth = months.length > 1 ? months[months.length - 2] : null;
    const at = (month: string, metric: string) =>
      rows.find((r) => r.month === month && r.metric === metric)?.value ?? null;
    const tiles = ORDER.filter((k) => at(latestMonth, k) != null).map((k) => {
      const cur = at(latestMonth, k)!;
      const prev = prevMonth ? at(prevMonth, k) : null;
      const mom = prev != null && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;
      return { k, label: METRIC_META[k]?.label ?? k, unit: METRIC_META[k]?.unit ?? '', cur, mom };
    });
    return { period: monthYear(latestMonth), tiles, hasTrend: prevMonth != null };
  }, [rows]);

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Social — Hootsuite</h1>
          <p className="gb-page-description">
            {model?.period ?? HOOTSUITE_PERIOD} · totals across all 20 connected accounts
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
            Upload a report on the{' '}
            <Link href="/performance-data/upload" style={{ textDecoration: 'underline' }}>
              Upload Data
            </Link>{' '}
            page.
          </p>
        </div>
      )}

      {model && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {model.tiles.map((t) => (
              <StatCard
                key={t.k}
                label={t.label}
                value={fmtCompact(t.cur)}
                delta={t.mom != null ? { up: t.mom >= 0, txt: Math.abs(t.mom).toFixed(1) + '% MoM' } : null}
                sub={t.unit || undefined}
              />
            ))}
          </div>
          {!model.hasTrend && (
            <p className="text-[11.5px] mb-6" style={{ color: 'var(--text-faint)' }}>
              These are combined totals for one month. Month-over-month change appears automatically when the next
              month&apos;s report is uploaded; per-account and per-platform breakdowns appear when the report is
              exported per account instead of as totals.
            </p>
          )}
        </>
      )}

      <div className="gb-card p-4">
        <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Connected accounts</h3>
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
      </div>
    </div>
  );
}

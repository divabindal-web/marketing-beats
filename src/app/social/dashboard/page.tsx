'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, Upload, BookOpen, Target } from 'lucide-react';
import { SocialMetricPlatform, SOCIAL_METRIC_PLATFORMS } from '@/types';
import {
  SAMPLE_SOCIAL_METRICS,
  PLATFORM_COLOR,
  formatCompact,
  formatMonth,
  formatMonthShort,
  latestPerPlatform,
  metricsForPlatform,
  momDelta,
  targetFor,
} from '@/lib/social-metrics';

type MetricKey = 'followers' | 'impressions' | 'engagement_rate' | 'posts';

const METRIC_LABELS: Record<MetricKey, string> = {
  followers: 'Followers',
  impressions: 'Impressions',
  engagement_rate: 'Engagement Rate',
  posts: 'Posts',
};

export default function SocialDashboardPage() {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('followers');
  const rows = SAMPLE_SOCIAL_METRICS;

  const latest = useMemo(() => latestPerPlatform(rows), [rows]);
  const months = useMemo(() => {
    const set = new Set(rows.map((r) => r.month));
    return Array.from(set).sort();
  }, [rows]);

  const latestMonthLabel = months.at(-1) ? formatMonth(months.at(-1)!) : '—';

  // Aggregate top-line totals across all platforms for the latest month
  const topline = useMemo(() => {
    const lastMonth = months.at(-1);
    if (!lastMonth) {
      return { followers: 0, impressions: 0, engagement: 0, posts: 0 };
    }
    const lastRows = rows.filter((r) => r.month === lastMonth);
    return {
      followers: lastRows.reduce((sum, r) => sum + r.followers, 0),
      impressions: lastRows.reduce((sum, r) => sum + r.impressions, 0),
      engagement:
        lastRows.length === 0
          ? 0
          : Math.round(
              (lastRows.reduce((sum, r) => sum + (r.engagement_rate ?? 0), 0) /
                lastRows.length) *
                100,
            ) / 100,
      posts: lastRows.reduce((sum, r) => sum + r.posts, 0),
    };
  }, [rows, months]);

  return (
    <div>
      {/* Page header */}
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Social Dashboard</h1>
          <p className="gb-page-description">
            Monthly performance across YouTube, LinkedIn, Instagram and Facebook. Latest snapshot:{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{latestMonthLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/social/how-to-fetch" className="gb-btn gb-btn-secondary">
            <BookOpen size={14} strokeWidth={2} />
            How to fetch
          </Link>
          <Link href="/social/upload" className="gb-btn gb-btn-primary">
            <Upload size={14} strokeWidth={2.25} />
            Upload metrics
          </Link>
        </div>
      </div>

      {/* Top-line stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <TopStat label="Total followers" value={formatCompact(topline.followers)} />
        <TopStat label="Total impressions" value={formatCompact(topline.impressions)} />
        <TopStat label="Avg engagement" value={`${topline.engagement.toFixed(2)}%`} />
        <TopStat label="Posts published" value={topline.posts.toString()} />
      </div>

      {/* Per-platform cards */}
      <section className="mb-8">
        <h2 className="gb-section-title">Platforms</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {SOCIAL_METRIC_PLATFORMS.map((platform) => (
            <PlatformCard key={platform} platform={platform} latest={latest[platform]} rows={rows} />
          ))}
        </div>
      </section>

      {/* Trend section with metric selector */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="gb-section-title" style={{ marginBottom: 0 }}>
            Monthly trend
          </h2>
          <div className="gb-tabs">
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                className={`gb-tab ${activeMetric === key ? 'gb-tab-active' : ''}`}
              >
                {METRIC_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="gb-card overflow-hidden">
          <table className="gb-table">
            <thead>
              <tr>
                <th>Platform</th>
                {months.map((m) => (
                  <th key={m} style={{ textAlign: 'right' }}>
                    {formatMonthShort(m)}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>MoM</th>
                <th style={{ textAlign: 'right' }}>vs Target</th>
              </tr>
            </thead>
            <tbody>
              {SOCIAL_METRIC_PLATFORMS.map((platform) => {
                const series = metricsForPlatform(rows, platform);
                const delta = momDelta(rows, platform, activeMetric);
                const target = targetFor(platform);
                const latestRow = series.at(-1);
                const targetValue = target?.[activeMetric];
                const currentValue = latestRow?.[activeMetric] as number | undefined;
                const targetPct =
                  targetValue && currentValue !== undefined
                    ? Math.round((currentValue / targetValue) * 100)
                    : null;

                return (
                  <tr key={platform}>
                    <td>
                      <PlatformPill platform={platform} />
                    </td>
                    {months.map((m) => {
                      const r = series.find((s) => s.month === m);
                      const val = r?.[activeMetric];
                      return (
                        <td key={m} style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                          {formatMetric(activeMetric, val as number | undefined)}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right' }}>
                      {delta ? <DeltaBadge value={delta.deltaPct} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {targetPct !== null ? <TargetBadge pct={targetPct} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Engagement rate spotlight */}
      <section>
        <h2 className="gb-section-title">Engagement rate (latest month)</h2>
        <div className="gb-card overflow-hidden">
          <table className="gb-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th style={{ textAlign: 'right' }}>Likes</th>
                <th style={{ textAlign: 'right' }}>Comments</th>
                <th style={{ textAlign: 'right' }}>Shares</th>
                <th style={{ textAlign: 'right' }}>Reach</th>
                <th style={{ textAlign: 'right' }}>Engagement Rate</th>
              </tr>
            </thead>
            <tbody>
              {SOCIAL_METRIC_PLATFORMS.map((platform) => {
                const r = latest[platform];
                if (!r) return null;
                return (
                  <tr key={platform}>
                    <td>
                      <PlatformPill platform={platform} />
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCompact(r.likes)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCompact(r.comments)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCompact(r.shares)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCompact(r.reach)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {r.engagement_rate?.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TopStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="gb-stat-card">
      <div className="gb-stat-label mb-1">{label}</div>
      <div className="gb-stat-value">{value}</div>
    </div>
  );
}

function PlatformCard({
  platform,
  latest,
  rows,
}: {
  platform: SocialMetricPlatform;
  latest: ReturnType<typeof latestPerPlatform>[SocialMetricPlatform];
  rows: typeof SAMPLE_SOCIAL_METRICS;
}) {
  const color = PLATFORM_COLOR[platform];
  const followersDelta = momDelta(rows, platform, 'followers');
  const target = targetFor(platform);
  const followers = latest?.followers ?? 0;
  const targetPct = target ? Math.round((followers / target.followers) * 100) : null;

  return (
    <div className="gb-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: color.dot }}
          />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {platform}
          </span>
        </div>
        {followersDelta && <DeltaBadge value={followersDelta.deltaPct} />}
      </div>
      <div className="gb-stat-value mb-1">{formatCompact(followers)}</div>
      <div className="text-[11px] mb-3" style={{ color: 'var(--text-faint)' }}>
        followers
      </div>
      {target && targetPct !== null && (
        <div>
          <div
            className="flex items-center justify-between text-[11px] mb-1"
            style={{ color: 'var(--text-faint)' }}
          >
            <span className="flex items-center gap-1">
              <Target size={10} strokeWidth={2} />
              Target {formatCompact(target.followers)}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{targetPct}%</span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, targetPct)}%`,
                backgroundColor: targetPct >= 100 ? 'var(--success)' : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformPill({ platform }: { platform: SocialMetricPlatform }) {
  const color = PLATFORM_COLOR[platform];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.dot }} />
      {platform}
    </span>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="gb-badge gb-badge-green inline-flex items-center gap-0.5">
        <ArrowUp size={10} strokeWidth={2.5} />
        {value.toFixed(1)}%
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="gb-badge gb-badge-red inline-flex items-center gap-0.5">
        <ArrowDown size={10} strokeWidth={2.5} />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="gb-badge inline-flex items-center gap-0.5" style={{ color: 'var(--text-faint)' }}>
      <ArrowRight size={10} strokeWidth={2.5} />
      0%
    </span>
  );
}

function TargetBadge({ pct }: { pct: number }) {
  let badgeClass = 'gb-badge gb-badge-red';
  if (pct >= 100) badgeClass = 'gb-badge gb-badge-green';
  else if (pct >= 80) badgeClass = 'gb-badge gb-badge-yellow';
  return <span className={badgeClass}>{pct}%</span>;
}

function formatMetric(metric: MetricKey, value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  if (metric === 'engagement_rate') return `${value.toFixed(2)}%`;
  if (metric === 'posts') return value.toString();
  return formatCompact(value);
}

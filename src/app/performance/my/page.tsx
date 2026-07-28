'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Clock,
  RefreshCw,
  ArrowUpRight,
  Target,
} from 'lucide-react';
import { SAMPLE_REQUESTS, SAMPLE_USERS, getUserById } from '@/lib/sample-data';
import {
  computeTeamMetrics,
  extractDeliveriesByUser,
  getCurrentQuarter,
  getQuarterRange,
  formatBusinessHours,
  formatSLAStatus,
  SLA_HOURS,
  PerformanceMetrics,
  SLAStatus,
} from '@/lib/tat';
import { Request, StageTransition } from '@/types';

// ─── Maker pool ──────────────────────────────────────────────────────────────
const MAKER_IDS = [
  'user-namita-aggarwal',
  'user-sandeep-chaurasia',
  'user-garima-banwala',
  'user-rishabh-singh',
  'user-sidharth-bharti',
  'user-john-antony',
  'user-ankit-rawat',
  'user-rahul-chatterjee',
  'user-akash-bhatt',
  'user-himani-rajput',
  'user-abhay-gupta',
];

const STATUS_COLOR: Record<SLAStatus, { bg: string; text: string; ring: string }> = {
  green: { bg: 'rgba(22, 163, 74, 0.1)', text: '#15803d', ring: '#16a34a' },
  yellow: { bg: 'rgba(234, 179, 8, 0.12)', text: '#a16207', ring: '#eab308' },
  red: { bg: 'rgba(220, 38, 38, 0.1)', text: '#b91c1c', ring: '#dc2626' },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function MyPerformancePage() {
  return (
    <Suspense fallback={<div className="p-6" style={{ color: 'var(--text-muted)' }}>Loading performance…</div>}>
      <MyPerformancePageInner />
    </Suspense>
  );
}

function MyPerformancePageInner() {
  const searchParams = useSearchParams();
  const urlUser = searchParams?.get('user');
  const initialUser =
    urlUser && MAKER_IDS.includes(urlUser) ? urlUser : 'user-john-antony';
  const [activeUserId, setActiveUserId] = useState(initialUser);
  const [quarterKey] = useState(getCurrentQuarter());

  // Sync when the user arrives via a deep link (?user=...) after mount.
  useEffect(() => {
    if (urlUser && MAKER_IDS.includes(urlUser) && urlUser !== activeUserId) {
      setActiveUserId(urlUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlUser]);

  // Use Q1 2026 since that's where the data lives
  const effectiveQuarter = '2026-Q1';
  const quarterRange = getQuarterRange(effectiveQuarter);

  const { metrics, lastQuarter, deliveriesList, quarterLabel } = useMemo(() => {
    const requestsWithTransitions = SAMPLE_REQUESTS as Array<
      Request & { transitions: StageTransition[] }
    >;

    const team = computeTeamMetrics(requestsWithTransitions, MAKER_IDS, {
      ...quarterRange,
      key: effectiveQuarter,
    });
    const userMetric = team.metrics.find((m) => m.userId === activeUserId);

    // Compare vs previous quarter to show trend
    const prevQuarterKey = effectiveQuarter === '2026-Q1' ? '2025-Q4' : '2026-Q1';
    const prevRange = getQuarterRange(prevQuarterKey);
    const prevTeam = computeTeamMetrics(requestsWithTransitions, MAKER_IDS, {
      ...prevRange,
      key: prevQuarterKey,
    });
    const prevUserMetric = prevTeam.metrics.find((m) => m.userId === activeUserId);

    const deliveriesByUser = extractDeliveriesByUser(requestsWithTransitions, quarterRange);
    const myDeliveries = deliveriesByUser.get(activeUserId) ?? [];

    return {
      metrics: userMetric,
      lastQuarter: prevUserMetric,
      deliveriesList: myDeliveries,
      quarterLabel: effectiveQuarter.replace('-', ' '),
    };
  }, [activeUserId, quarterRange, effectiveQuarter]);

  const user = getUserById(activeUserId);
  const makerUsers = SAMPLE_USERS.filter((u) => MAKER_IDS.includes(u.id));

  if (!metrics || !user) {
    return <div>User not found.</div>;
  }

  const status = metrics.slaStatus;
  const statusColor = STATUS_COLOR[status];
  const weightedSLA = metrics.byType.Video
    ? SLA_HOURS.Video
    : SLA_HOURS.Graphics;

  // Build improvement hints from stage breakdown + worst requests
  const hints: string[] = [];
  if (metrics.breachRate > 0.2) {
    hints.push(
      `${Math.round(metrics.breachRate * 100)}% of your deliveries breached SLA this quarter. Focus on keeping active work stages short.`
    );
  }
  if (metrics.changeRequestsReceived / Math.max(metrics.deliveries, 1) > 0.25) {
    hints.push(
      `You received ${metrics.changeRequestsReceived} change requests on ${metrics.deliveries} deliveries. Align with the requestor earlier to reduce rework.`
    );
  }
  const topStage = metrics.stageBreakdown[0];
  if (topStage && topStage.hours > weightedSLA * 0.6) {
    hints.push(
      `On average, most of your time goes to ${topStage.stage} (${formatBusinessHours(
        topStage.hours
      )}). Consider breaking this stage into smaller checkpoints.`
    );
  }
  if (hints.length === 0) {
    hints.push('You are on track. Keep the momentum going.');
  }

  return (
    <div>
      {/* Page header */}
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">My Performance</h1>
          <p className="gb-page-description">
            Track your SLA compliance, delivery volume, and improvement areas quarter-by-quarter.
            SLA clock runs Mon–Fri 10am–7pm IST (business hours only).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={activeUserId}
            onChange={(e) => setActiveUserId(e.target.value)}
            className="gb-input"
            style={{ width: 220 }}
          >
            {makerUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.designation}
              </option>
            ))}
          </select>
          <div
            className="gb-badge"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              padding: '6px 10px',
            }}
          >
            {quarterLabel}
          </div>
        </div>
      </div>

      {/* Hero status card */}
      <div
        className="gb-card mb-6"
        style={{
          padding: 24,
          borderLeft: `3px solid ${statusColor.ring}`,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: 72,
                height: 72,
                background: statusColor.bg,
                border: `3px solid ${statusColor.ring}`,
              }}
            >
              {status === 'green' ? (
                <CheckCircle2 size={32} style={{ color: statusColor.text }} strokeWidth={1.75} />
              ) : status === 'yellow' ? (
                <Target size={32} style={{ color: statusColor.text }} strokeWidth={1.75} />
              ) : (
                <AlertTriangle size={32} style={{ color: statusColor.text }} strokeWidth={1.75} />
              )}
            </div>
            <div>
              <div
                className="text-[12px] uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}
              >
                Overall SLA status
              </div>
              <div
                className="text-[28px] font-semibold leading-tight"
                style={{ color: statusColor.text }}
              >
                {formatSLAStatus(status)}
              </div>
              <div className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                {user.name} · {user.designation}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-[11px] uppercase tracking-wider"
              style={{ color: 'var(--text-faint)' }}
            >
              Performance score
            </div>
            <div
              className="text-[44px] font-bold leading-none"
              style={{ color: statusColor.text }}
            >
              {metrics.performanceScore}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              / 100
              {lastQuarter && lastQuarter.deliveries > 0 && (
                <span style={{ marginLeft: 6 }}>
                  (prev: {lastQuarter.performanceScore})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="gb-stat-card">
          <div className="flex items-center justify-between mb-1">
            <div className="gb-stat-label">Deliveries</div>
            <CheckCircle2 size={14} strokeWidth={1.75} style={{ color: 'var(--success)' }} />
          </div>
          <div className="gb-stat-value">{metrics.deliveries}</div>
        </div>
        <div className="gb-stat-card">
          <div className="flex items-center justify-between mb-1">
            <div className="gb-stat-label">Avg TAT</div>
            <Clock size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="gb-stat-value">
            {formatBusinessHours(metrics.avgTATHours)}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
            SLA {formatBusinessHours(weightedSLA)}
          </div>
        </div>
        <div className="gb-stat-card">
          <div className="flex items-center justify-between mb-1">
            <div className="gb-stat-label">Breach rate</div>
            <AlertTriangle
              size={14}
              strokeWidth={1.75}
              style={{ color: metrics.breachRate > 0.2 ? 'var(--error)' : 'var(--text-muted)' }}
            />
          </div>
          <div
            className="gb-stat-value"
            style={{
              color:
                metrics.breachRate > 0.2
                  ? 'var(--error)'
                  : metrics.breachRate > 0
                  ? 'var(--warning)'
                  : 'var(--success)',
            }}
          >
            {Math.round(metrics.breachRate * 100)}%
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {metrics.breachCount} of {metrics.deliveries}
          </div>
        </div>
        <div className="gb-stat-card">
          <div className="flex items-center justify-between mb-1">
            <div className="gb-stat-label">Change requests</div>
            <RefreshCw size={14} strokeWidth={1.75} style={{ color: '#9333ea' }} />
          </div>
          <div className="gb-stat-value">{metrics.changeRequestsReceived}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
            on your deliveries
          </div>
        </div>
      </div>

      {/* Two column: Stage breakdown + Worst requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Stage breakdown */}
        <section>
          <h2 className="gb-section-title">Where your time goes</h2>
          <div className="gb-card" style={{ padding: 18 }}>
            {metrics.stageBreakdown.length === 0 ? (
              <div
                style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '20px 0' }}
              >
                No deliveries yet this quarter.
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.stageBreakdown.map((row, idx) => {
                  const maxHours = metrics.stageBreakdown[0]?.hours || 1;
                  const pct = Math.max(4, Math.round((row.hours / maxHours) * 100));
                  const barColor = idx === 0 ? 'var(--accent)' : 'var(--border-strong, #cbd5e1)';
                  return (
                    <div key={row.stage}>
                      <div
                        className="flex items-center justify-between mb-1 text-[13px]"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span>{row.stage}</span>
                        <span
                          className="text-[12px]"
                          style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatBusinessHours(row.hours)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: 'var(--bg-tertiary)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: barColor,
                            transition: 'width .3s',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div
              className="mt-4 pt-3 border-t text-[11px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}
            >
              Average business hours per delivery. Pause stages (Content, Change Req,
              Shooting Scheduled) do not count against your TAT.
            </div>
          </div>
        </section>

        {/* Worst offenders */}
        <section>
          <h2 className="gb-section-title">Requests that hurt your score</h2>
          <div className="gb-card overflow-hidden">
            {metrics.worstRequests.length === 0 ? (
              <div
                style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '24px' }}
              >
                No problem requests this quarter.
              </div>
            ) : (
              <table className="gb-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>TAT vs SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.worstRequests.map((req) => {
                    const badgeClass =
                      req.ratio > 1
                        ? 'gb-badge gb-badge-red'
                        : req.ratio > 0.8
                        ? 'gb-badge gb-badge-yellow'
                        : 'gb-badge gb-badge-green';
                    return (
                      <tr key={req.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          <div>{req.title}</div>
                          <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                            {req.id}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {req.type === 'Social Media Graphics' ? 'SMG' : req.type}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={badgeClass}>
                            {formatBusinessHours(req.tatHours)} /{' '}
                            {formatBusinessHours(req.slaHours)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Improvement hints */}
      <section className="mb-6">
        <h2 className="gb-section-title">Where to improve</h2>
        <div className="gb-card" style={{ padding: 18 }}>
          <ul className="space-y-3">
            {hints.map((hint, i) => (
              <li key={i} className="flex items-start gap-3">
                <ArrowUpRight
                  size={16}
                  strokeWidth={2}
                  style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }}
                />
                <div className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                  {hint}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* All deliveries table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="gb-section-title" style={{ marginBottom: 0 }}>
            All deliveries this quarter
          </h2>
          <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {deliveriesList.length} requests delivered
          </span>
        </div>
        <div className="gb-card overflow-hidden">
          <table className="gb-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Delivered</th>
                <th style={{ textAlign: 'right' }}>TAT</th>
                <th style={{ textAlign: 'right' }}>CRs</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveriesList
                .sort(
                  (a, b) =>
                    new Date(b.deliveredAt).getTime() -
                    new Date(a.deliveredAt).getTime()
                )
                .map((d) => {
                  const statusKey: SLAStatus =
                    d.ratio <= 0.8 ? 'green' : d.ratio <= 1 ? 'yellow' : 'red';
                  return (
                    <tr key={d.request.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {d.request.title}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {d.request.type === 'Social Media Graphics' ? 'SMG' : d.request.type}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(d.deliveredAt).toLocaleDateString()}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatBusinessHours(d.tatHours)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: d.changeReqCount > 0 ? '#9333ea' : 'var(--text-faint)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {d.changeReqCount || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          className={`gb-badge ${
                            statusKey === 'green'
                              ? 'gb-badge-green'
                              : statusKey === 'yellow'
                              ? 'gb-badge-yellow'
                              : 'gb-badge-red'
                          }`}
                        >
                          {formatSLAStatus(statusKey)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {deliveriesList.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: 'center',
                      color: 'var(--text-faint)',
                      padding: '24px',
                    }}
                  >
                    No deliveries this quarter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

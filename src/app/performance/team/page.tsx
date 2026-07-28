'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Users,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { SAMPLE_REQUESTS, SAMPLE_USERS, getUserById, getInitials } from '@/lib/sample-data';
import {
  computeTeamMetrics,
  getQuarterRange,
  formatBusinessHours,
  formatSLAStatus,
  SLA_HOURS,
  PerformanceMetrics,
  SLAStatus,
} from '@/lib/tat';
import { Request, StageTransition, RequestType } from '@/types';

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

const STATUS_COLOR: Record<SLAStatus, { bg: string; text: string; border: string }> = {
  green: { bg: 'rgba(22, 163, 74, 0.1)',  text: '#15803d', border: 'rgba(22, 163, 74, 0.25)' },
  yellow: { bg: 'rgba(234, 179, 8, 0.12)', text: '#a16207', border: 'rgba(234, 179, 8, 0.3)' },
  red: { bg: 'rgba(220, 38, 38, 0.1)',  text: '#b91c1c', border: 'rgba(220, 38, 38, 0.3)' },
};

type TeamFilter = 'all' | 'Graphics' | 'Video' | 'low' | 'eligible';

type TeamRow = PerformanceMetrics & {
  isLowPerformer: boolean;
  eligibleForRanking: boolean;
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function TeamPerformancePage() {
  const [filter, setFilter] = useState<TeamFilter>('all');
  const [quarterKey, setQuarterKey] = useState('2026-Q1');

  const { rows, cohort } = useMemo(() => {
    const requestsWithTransitions = SAMPLE_REQUESTS as Array<
      Request & { transitions: StageTransition[] }
    >;
    const range = getQuarterRange(quarterKey);
    const team = computeTeamMetrics(requestsWithTransitions, MAKER_IDS, {
      ...range,
      key: quarterKey,
    });

    return {
      rows: team.metrics,
      cohort: {
        medianDeliveries: team.cohortMedianDeliveries,
        avgTAT: team.cohortAvgTAT,
        breachRate: team.cohortBreachRate,
      },
    };
  }, [quarterKey]);

  // Enrich with primary type label (whichever has more deliveries) for filtering.
  const enrichedRows = useMemo(() => {
    return rows.map((row) => {
      const typeEntries = Object.entries(row.byType) as Array<[
        RequestType,
        { deliveries: number; avgTATHours: number; breachRate: number; slaHours: number }
      ]>;
      const primaryType: RequestType | null = typeEntries.length
        ? (typeEntries.sort((a, b) => b[1].deliveries - a[1].deliveries)[0][0] as RequestType)
        : null;
      const user = getUserById(row.userId);
      return { ...row, primaryType, user };
    });
  }, [rows]);

  const filteredRows = useMemo(() => {
    let out = [...enrichedRows];
    if (filter === 'Graphics' || filter === 'Video') {
      out = out.filter((r) => r.primaryType === filter);
    } else if (filter === 'low') {
      out = out.filter((r) => r.isLowPerformer);
    } else if (filter === 'eligible') {
      out = out.filter((r) => r.eligibleForRanking);
    }
    // Rank by performance score desc (ineligible users sunk to the bottom).
    return out.sort((a, b) => {
      if (a.eligibleForRanking !== b.eligibleForRanking) {
        return a.eligibleForRanking ? -1 : 1;
      }
      return b.performanceScore - a.performanceScore;
    });
  }, [enrichedRows, filter]);

  // Cohort-level summary tiles
  const totalDeliveries = enrichedRows.reduce((s, r) => s + r.deliveries, 0);
  const totalChangeReqs = enrichedRows.reduce((s, r) => s + r.changeRequestsReceived, 0);
  const lowPerformers = enrichedRows.filter((r) => r.isLowPerformer);
  const topPerformers = enrichedRows
    .filter((r) => r.eligibleForRanking)
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 3);

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }} className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="gb-page-header flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="gb-page-title">Team Performance</h1>
            <p className="gb-page-description">
              Quarterly scoreboard for the graphics &amp; video makers. Bottom 20% flagged as
              low performers (min 5 deliveries to be ranked).
            </p>
          </div>

          {/* Quarter picker */}
          <div className="flex items-center gap-2">
            <label
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-faint)' }}
            >
              Quarter
            </label>
            <select
              value={quarterKey}
              onChange={(e) => setQuarterKey(e.target.value)}
              className="gb-select"
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            >
              <option value="2025-Q4">2025 Q4</option>
              <option value="2026-Q1">2026 Q1</option>
              <option value="2026-Q2">2026 Q2</option>
            </select>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryTile
            icon={<Users size={16} />}
            label="Makers ranked"
            value={`${enrichedRows.filter((r) => r.eligibleForRanking).length} / ${enrichedRows.length}`}
            hint="≥5 deliveries this quarter"
          />
          <SummaryTile
            icon={<CheckCircle2 size={16} />}
            label="Team deliveries"
            value={totalDeliveries.toString()}
            hint={`median ${cohort.medianDeliveries} per person`}
          />
          <SummaryTile
            icon={<TrendingUp size={16} />}
            label="Cohort avg TAT"
            value={formatBusinessHours(cohort.avgTAT)}
            hint={`breach rate ${(cohort.breachRate * 100).toFixed(0)}%`}
          />
          <SummaryTile
            icon={<RefreshCw size={16} />}
            label="Change requests"
            value={totalChangeReqs.toString()}
            hint="received on delivered work"
          />
        </div>

        {/* Low performer alert + top performer highlight */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Low performers card */}
          <div
            className="gb-card"
            style={{
              padding: '20px',
              borderLeft: '3px solid #dc2626',
              backgroundColor: 'rgba(220, 38, 38, 0.03)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} style={{ color: '#dc2626' }} />
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Needs attention ({lowPerformers.length})
              </h3>
            </div>

            {lowPerformers.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                No low performers flagged for this quarter.
              </p>
            ) : (
              <div className="space-y-2">
                {lowPerformers.map((r) => (
                  <div
                    key={r.userId}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-md"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                        style={{
                          backgroundColor: 'rgba(220, 38, 38, 0.1)',
                          color: '#b91c1c',
                          border: '1px solid rgba(220, 38, 38, 0.2)',
                        }}
                      >
                        {getInitials(r.user?.name ?? '?')}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-[13px] font-medium truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {r.user?.name ?? r.userId}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                          {r.deliveries} delivered • {(r.breachRate * 100).toFixed(0)}% breached
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#b91c1c' }}>
                        {r.performanceScore}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        score
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top performers card */}
          <div
            className="gb-card"
            style={{
              padding: '20px',
              borderLeft: '3px solid #16a34a',
              backgroundColor: 'rgba(22, 163, 74, 0.03)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} style={{ color: '#16a34a' }} />
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Top performers
              </h3>
            </div>

            {topPerformers.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No eligible performers.</p>
            ) : (
              <div className="space-y-2">
                {topPerformers.map((r, idx) => (
                  <div
                    key={r.userId}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-md"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-6 text-center text-[13px] font-semibold"
                        style={{ color: 'var(--text-faint)' }}
                      >
                        #{idx + 1}
                      </div>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                        style={{
                          backgroundColor: 'rgba(22, 163, 74, 0.1)',
                          color: '#15803d',
                          border: '1px solid rgba(22, 163, 74, 0.2)',
                        }}
                      >
                        {getInitials(r.user?.name ?? '?')}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-[13px] font-medium truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {r.user?.name ?? r.userId}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                          {r.deliveries} delivered • avg {formatBusinessHours(r.avgTATHours)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#15803d' }}>
                        {r.performanceScore}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        score
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Filter size={13} style={{ color: 'var(--text-faint)' }} />
          {(
            [
              { key: 'all', label: 'All makers' },
              { key: 'eligible', label: 'Ranked only' },
              { key: 'Graphics', label: 'Graphics' },
              { key: 'Video', label: 'Video' },
              { key: 'low', label: 'Low performers' },
            ] as Array<{ key: TeamFilter; label: string }>
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="gb-pill"
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                backgroundColor:
                  filter === key ? 'var(--accent-light)' : 'var(--bg-primary)',
                color:
                  filter === key ? 'var(--accent-text)' : 'var(--text-muted)',
                fontWeight: filter === key ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Ranking table */}
        <div className="gb-card overflow-hidden" style={{ padding: 0 }}>
          <div className="overflow-x-auto">
            <table className="gb-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>#</th>
                  <th>Maker</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Delivered</th>
                  <th style={{ textAlign: 'right' }}>Avg TAT</th>
                  <th style={{ textAlign: 'right' }}>Breach</th>
                  <th style={{ textAlign: 'right' }}>Change req</th>
                  <th style={{ textAlign: 'right' }}>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: '32px',
                        textAlign: 'center',
                        color: 'var(--text-faint)',
                      }}
                    >
                      No makers match this filter.
                    </td>
                  </tr>
                )}
                {filteredRows.map((row, idx) => {
                  const statusColor = STATUS_COLOR[row.slaStatus];
                  const rankDisplay = row.eligibleForRanking ? `#${idx + 1}` : '—';
                  const slaForType =
                    row.primaryType === 'Video' ? SLA_HOURS.Video : SLA_HOURS.Graphics;
                  return (
                    <tr
                      key={row.userId}
                      style={{
                        backgroundColor: row.isLowPerformer
                          ? 'rgba(220, 38, 38, 0.04)'
                          : undefined,
                      }}
                    >
                      <td
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-faint)',
                        }}
                      >
                        {rankDisplay}
                      </td>
                      <td>
                        <Link
                          href={`/performance/my?user=${row.userId}`}
                          className="flex items-center gap-2.5 min-w-0 hover:opacity-80"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                            style={{
                              backgroundColor: 'var(--accent-light)',
                              color: 'var(--accent-text)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {getInitials(row.user?.name ?? '?')}
                          </div>
                          <div className="min-w-0">
                            <div
                              className="text-[13px] font-medium truncate flex items-center gap-1.5"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {row.user?.name ?? row.userId}
                              {row.isLowPerformer && (
                                <span
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: 'rgba(220, 38, 38, 0.12)',
                                    color: '#b91c1c',
                                  }}
                                >
                                  LOW
                                </span>
                              )}
                            </div>
                            <div
                              className="text-[11px] truncate"
                              style={{ color: 'var(--text-faint)' }}
                            >
                              {row.user?.email ?? ''}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {row.primaryType ?? '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 500,
                        }}
                      >
                        {row.deliveries || '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {row.deliveries > 0 ? (
                          <span
                            style={{
                              color:
                                row.avgTATHours > slaForType
                                  ? '#b91c1c'
                                  : row.avgTATHours > slaForType * 0.8
                                  ? '#a16207'
                                  : 'var(--text-primary)',
                              fontWeight: 500,
                            }}
                          >
                            {formatBusinessHours(row.avgTATHours)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {row.deliveries > 0 ? (
                          <span
                            style={{
                              color:
                                row.breachRate > 0.3
                                  ? '#b91c1c'
                                  : row.breachRate > 0.15
                                  ? '#a16207'
                                  : 'var(--text-primary)',
                              fontWeight: 500,
                            }}
                          >
                            {(row.breachRate * 100).toFixed(0)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {row.changeRequestsReceived || '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          fontSize: '14px',
                        }}
                      >
                        {row.eligibleForRanking ? (
                          <span style={{ color: statusColor.text }}>{row.performanceScore}</span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              color: 'var(--text-faint)',
                            }}
                          >
                            n/a
                          </span>
                        )}
                      </td>
                      <td>
                        {row.deliveries > 0 ? (
                          <span
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{
                              backgroundColor: statusColor.bg,
                              color: statusColor.text,
                              border: `1px solid ${statusColor.border}`,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: statusColor.text,
                                display: 'inline-block',
                              }}
                            />
                            {formatSLAStatus(row.slaStatus)}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-faint)',
                            }}
                          >
                            No data
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer hint */}
        <div
          className="mt-4 text-[11px] flex items-center gap-2"
          style={{ color: 'var(--text-faint)' }}
        >
          <ArrowUpRight size={12} />
          <span>
            Score = 45% TAT + 35% breach rate + 20% volume. SLA: Graphics &lt; {SLA_HOURS.Graphics}h
            business hours, Video &lt; {SLA_HOURS.Video}h business hours. Click a row to drill
            into an individual's performance.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="gb-card" style={{ padding: '16px' }}>
      <div
        className="flex items-center gap-1.5 mb-2 text-[11px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-faint)' }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: '22px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '4px',
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  TrendingDown,
  Users,
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
} from 'lucide-react';
import { SAMPLE_REQUESTS, SAMPLE_USERS, getUserById, getInitials, formatDate } from '@/lib/sample-data';
import {
  computeTeamMetrics,
  extractDeliveriesByUser,
  getQuarterRange,
  formatBusinessHours,
  SLA_HOURS,
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

interface ChangeRequestEvent {
  requestId: string;
  requestTitle: string;
  requestType: RequestType;
  maker: string; // userId
  makerName: string;
  transitionedAt: string;
  fromStage: string | null;
  tatHours: number; // TAT for the whole request
  slaHours: number;
  deliveredAt: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ChangeRequestsPage() {
  const [quarterKey, setQuarterKey] = useState('2026-Q1');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Graphics' | 'Video'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  const { makerRows, events, cohort } = useMemo(() => {
    const requestsWithTransitions = SAMPLE_REQUESTS as Array<
      Request & { transitions: StageTransition[] }
    >;
    const range = getQuarterRange(quarterKey);

    const team = computeTeamMetrics(requestsWithTransitions, MAKER_IDS, {
      ...range,
      key: quarterKey,
    });

    // Build a flat list of change request events attributed to whoever delivered
    // the parent request (same semantics as computeUserMetrics.changeRequestsReceived).
    const deliveriesByUser = extractDeliveriesByUser(requestsWithTransitions, range);
    const flatEvents: ChangeRequestEvent[] = [];

    for (const [userId, deliveries] of deliveriesByUser.entries()) {
      const user = getUserById(userId);
      for (const d of deliveries) {
        const crTransitions = d.request.transitions.filter(
          (t) => t.to_stage === 'Change Req'
        );
        for (const t of crTransitions) {
          flatEvents.push({
            requestId: d.request.id,
            requestTitle: d.request.title,
            requestType: d.request.type,
            maker: userId,
            makerName: user?.name ?? userId,
            transitionedAt: t.transitioned_at,
            fromStage: t.from_stage,
            tatHours: d.tatHours,
            slaHours: d.slaHours,
            deliveredAt: d.deliveredAt,
          });
        }
      }
    }

    // Rows for the "change requests by person" ranking — highest to lowest.
    const rows = team.metrics
      .map((m) => {
        const user = getUserById(m.userId);
        const crRate =
          m.deliveries > 0 ? m.changeRequestsReceived / m.deliveries : 0;
        return {
          userId: m.userId,
          user,
          deliveries: m.deliveries,
          changeRequests: m.changeRequestsReceived,
          crRate,
          isLowPerformer: m.isLowPerformer,
          eligible: m.eligibleForRanking,
          types: Object.keys(m.byType).join(' + ') || '—',
        };
      })
      .sort((a, b) => b.changeRequests - a.changeRequests);

    return {
      makerRows: rows,
      events: flatEvents.sort(
        (a, b) =>
          new Date(b.transitionedAt).getTime() - new Date(a.transitionedAt).getTime()
      ),
      cohort: {
        medianDeliveries: team.cohortMedianDeliveries,
      },
    };
  }, [quarterKey]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== 'all' && e.requestType !== typeFilter) return false;
      if (userFilter !== 'all' && e.maker !== userFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.requestTitle.toLowerCase().includes(q) &&
          !e.makerName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [events, search, typeFilter, userFilter]);

  // Summary tiles
  const totalCRs = events.length;
  const totalDeliveries = makerRows.reduce((s, r) => s + r.deliveries, 0);
  const teamCRRate = totalDeliveries > 0 ? totalCRs / totalDeliveries : 0;
  const worstOffender = makerRows[0];
  const maxCRRate =
    makerRows
      .filter((r) => r.deliveries >= 5)
      .sort((a, b) => b.crRate - a.crRate)[0] ?? null;

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }} className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="gb-page-header flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="gb-page-title">Change Requests</h1>
            <p className="gb-page-description">
              Track change requests per maker as a quality signal. High change-request rates
              often correlate with rework loops and breached SLAs.
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
            icon={<RefreshCw size={16} />}
            label="Total change reqs"
            value={totalCRs.toString()}
            hint={`${totalDeliveries} deliveries this quarter`}
          />
          <SummaryTile
            icon={<TrendingDown size={16} />}
            label="Team CR rate"
            value={`${(teamCRRate * 100).toFixed(0)}%`}
            hint="change reqs ÷ deliveries"
          />
          <SummaryTile
            icon={<AlertTriangle size={16} />}
            label="Most change reqs"
            value={worstOffender?.user?.name.split(' ')[0] ?? '—'}
            hint={worstOffender ? `${worstOffender.changeRequests} change reqs` : ''}
          />
          <SummaryTile
            icon={<Users size={16} />}
            label="Highest CR rate"
            value={maxCRRate?.user?.name.split(' ')[0] ?? '—'}
            hint={maxCRRate ? `${(maxCRRate.crRate * 100).toFixed(0)}% rework rate` : ''}
          />
        </div>

        {/* By-person table */}
        <div className="mb-6">
          <h3 className="gb-section-title">Change requests by maker</h3>
          <div className="gb-card overflow-hidden" style={{ padding: 0 }}>
            <div className="overflow-x-auto">
              <table className="gb-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Maker</th>
                    <th>Specialty</th>
                    <th style={{ textAlign: 'right' }}>Delivered</th>
                    <th style={{ textAlign: 'right' }}>Change reqs</th>
                    <th style={{ textAlign: 'right' }}>CR rate</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {makerRows.map((r) => {
                    const signal =
                      r.crRate >= 0.35
                        ? 'high'
                        : r.crRate >= 0.2
                        ? 'medium'
                        : 'low';
                    const signalColor =
                      signal === 'high'
                        ? { bg: 'rgba(220, 38, 38, 0.1)', text: '#b91c1c' }
                        : signal === 'medium'
                        ? { bg: 'rgba(234, 179, 8, 0.12)', text: '#a16207' }
                        : { bg: 'rgba(22, 163, 74, 0.1)', text: '#15803d' };
                    return (
                      <tr
                        key={r.userId}
                        style={{
                          backgroundColor: r.isLowPerformer
                            ? 'rgba(220, 38, 38, 0.04)'
                            : undefined,
                          cursor: 'pointer',
                        }}
                        onClick={() => setUserFilter(r.userId)}
                      >
                        <td>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                              style={{
                                backgroundColor: 'var(--accent-light)',
                                color: 'var(--accent-text)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {getInitials(r.user?.name ?? '?')}
                            </div>
                            <div className="min-w-0">
                              <div
                                className="text-[13px] font-medium truncate flex items-center gap-1.5"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {r.user?.name ?? r.userId}
                                {r.isLowPerformer && (
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
                                {r.user?.email ?? ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {r.types}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 500,
                          }}
                        >
                          {r.deliveries || '—'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                            color:
                              r.changeRequests >= 5
                                ? '#b91c1c'
                                : r.changeRequests >= 2
                                ? '#a16207'
                                : 'var(--text-primary)',
                          }}
                        >
                          {r.changeRequests}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {r.deliveries > 0 ? `${(r.crRate * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td>
                          {r.deliveries > 0 ? (
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                              style={{
                                backgroundColor: signalColor.bg,
                                color: signalColor.text,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: signalColor.text,
                                  display: 'inline-block',
                                }}
                              />
                              {signal === 'high'
                                ? 'High rework'
                                : signal === 'medium'
                                ? 'Moderate'
                                : 'Healthy'}
                            </span>
                          ) : (
                            <span
                              style={{ fontSize: '11px', color: 'var(--text-faint)' }}
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
        </div>

        {/* Full event log */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <h3 className="gb-section-title" style={{ marginBottom: 0 }}>
              Change request log ({filteredEvents.length})
            </h3>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="gb-search" style={{ minWidth: 220 }}>
                <Search
                  size={13}
                  strokeWidth={1.75}
                  style={{ color: 'var(--text-faint)' }}
                />
                <input
                  type="text"
                  placeholder="Search request or maker..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'Graphics' | 'Video')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              >
                <option value="all">All types</option>
                <option value="Graphics">Graphics</option>
                <option value="Video">Video</option>
              </select>

              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  maxWidth: 180,
                }}
              >
                <option value="all">All makers</option>
                {SAMPLE_USERS.filter((u) => MAKER_IDS.includes(u.id)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>

              {(search || typeFilter !== 'all' || userFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('all');
                    setUserFilter('all');
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="gb-card overflow-hidden" style={{ padding: 0 }}>
            <div className="overflow-x-auto">
              <table className="gb-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Type</th>
                    <th>Maker</th>
                    <th>Happened during</th>
                    <th>Change req date</th>
                    <th style={{ textAlign: 'right' }}>Total TAT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: '32px',
                          textAlign: 'center',
                          color: 'var(--text-faint)',
                        }}
                      >
                        No change requests match your filters.
                      </td>
                    </tr>
                  )}
                  {filteredEvents.map((e, idx) => {
                    const ratio = e.tatHours / e.slaHours;
                    return (
                      <tr key={`${e.requestId}-${idx}`}>
                        <td>
                          <Link
                            href={`/design-ops/requests?open=${e.requestId}`}
                            className="flex items-center gap-1.5 hover:opacity-80"
                            style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              maxWidth: 280,
                            }}
                          >
                            <span className="truncate">{e.requestTitle}</span>
                            <ArrowRight
                              size={11}
                              style={{ color: 'var(--text-faint)', flexShrink: 0 }}
                            />
                          </Link>
                        </td>
                        <td>
                          <span
                            className="text-[11px] font-medium px-2 py-0.5 rounded"
                            style={{
                              backgroundColor:
                                e.requestType === 'Video'
                                  ? 'rgba(52, 109, 219, 0.1)'
                                  : 'rgba(168, 85, 247, 0.1)',
                              color:
                                e.requestType === 'Video' ? '#346ddb' : '#a855f7',
                            }}
                          >
                            {e.requestType}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/performance/my?user=${e.maker}`}
                            className="flex items-center gap-2 hover:opacity-80"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                              style={{
                                backgroundColor: 'var(--accent-light)',
                                color: 'var(--accent-text)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {getInitials(e.makerName)}
                            </div>
                            <span
                              style={{
                                fontSize: '12px',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {e.makerName}
                            </span>
                          </Link>
                        </td>
                        <td
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {e.fromStage ?? 'Initial'}
                        </td>
                        <td
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatDate(e.transitionedAt)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span
                            style={{
                              color:
                                ratio > 1
                                  ? '#b91c1c'
                                  : ratio > 0.8
                                  ? '#a16207'
                                  : 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 500,
                            }}
                          >
                            {formatBusinessHours(e.tatHours)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div
          className="mt-4 text-[11px] flex items-center gap-2"
          style={{ color: 'var(--text-faint)' }}
        >
          <RefreshCw size={12} />
          <span>
            Change requests are attributed to whoever delivered the parent request. Signal
            is High &ge; 35% CR rate, Moderate &ge; 20%, Healthy below that.
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

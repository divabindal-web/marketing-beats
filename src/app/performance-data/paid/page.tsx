'use client';

/**
 * Paid Campaigns tab.
 *
 * The sheet's own monthly tracker is broken from Jul-26 onward — its targets
 * referenced a "Team Config" tab that no longer exists, so every cell reads
 * #REF! — and its budget column mixed lakhs with rupees, which made the
 * variance column meaningless. Both are handled on import: only real figures
 * came across, and spend was normalised to lakhs throughout.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, PencilLine } from 'lucide-react';
import { DomainData, fetchDomain, fmtNum, monthShort } from '@/lib/perf-detail';
import { EmptyNote, Kpi, PlanMatrix, Section, TargetBar, ValueVsTarget } from '@/components/perf/PerfBlocks';

const TEAMS = ['INCO - GCC', 'INCO - IN', 'Australia', 'Canada', 'IPM'];
const CITIES = ['Bangalore', 'Chennai', 'Hyderabad', 'Mumbai', 'Pune', 'Gurgaon', 'Noida', 'AbuDhabi', 'Dubai'];
const CITY_METRICS = ['Total spend', 'CPL Apr 2025', 'CPL Feb 2026', 'CPL decrease', 'CPL avg', 'CPC avg', 'Qualification avg'];

export default function PaidPage() {
  const [data, setData] = useState<DomainData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchDomain('paid').then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const plan = (entity: string, metric: string, period: string) =>
    data?.plan.find((r) => r.entity === entity && r.metric === metric && r.period === period)?.value ?? null;

  const totals = useMemo(() => {
    if (!data) return null;
    const spend = TEAMS.reduce((s, t) => s + (plan(t, 'Total spend (Cr)', 'FY25-26') ?? 0), 0);
    const rev = TEAMS.reduce((s, t) => s + (plan(t, 'Marketing revenue', 'FY25-26') ?? 0), 0);
    const leads = data.plan.filter((r) => r.entity === 'All sources' && r.period === 'FY25-26')
      .reduce((s, r) => s + (r.value ?? 0), 0);
    return { spend, rev, roas: spend ? rev / (spend * 1e7) : null, leads };
  }, [data]);

  const monthly = useMemo(() => {
    if (!data) return { months: [], rows: [] as { team: string; byMonth: Record<string, { v: number | null; t: number | null }> }[] };
    const spend = data.series.filter((r) => r.metric === 'Spend (Lakh)');
    const months = [...new Set(spend.map((r) => r.month))].sort();
    const teams = [...new Set(spend.map((r) => r.entity))];
    return {
      months,
      rows: teams.map((team) => ({
        team,
        byMonth: Object.fromEntries(months.map((m) => {
          const row = spend.find((r) => r.entity === team && r.month === m);
          return [m, { v: row?.value ?? null, t: row?.target ?? null }];
        })),
      })),
    };
  }, [data]);

  const leadSources = useMemo(() => {
    if (!data) return [];
    return data.plan
      .filter((r) => r.entity === 'All sources' && r.period === 'FY25-26')
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .map((r) => ({ label: r.metric.replace('Leads — ', ''), value: r.value ?? 0 }));
  }, [data]);
  const leadMax = leadSources[0]?.value || 1;

  const cityRows = useMemo(() => {
    if (!data) return [];
    return CITY_METRICS.map((metric) => ({
      metric,
      values: Object.fromEntries(CITIES.map((c) => [c, plan('City · ' + c, metric, 'FY25-26')])),
    }));
  }, [data]);

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="gb-page-title">Paid Campaigns</h1>
          <p className="gb-page-description">
            Spend, return and cost per lead by team and city — FY25-26 close and this year&apos;s run-rate.
          </p>
        </div>
        <Link href="/performance-data/monthly" className="gb-btn gb-btn-primary">
          <PencilLine size={14} strokeWidth={2.25} /> Enter this month
        </Link>
      </div>

      {err && <p className="text-[12.5px] mb-4" style={{ color: 'var(--error)' }}>{err}</p>}
      {!err && !data && <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>Loading…</p>}

      {data && totals && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mb-stagger">
            <Kpi label="Spend FY25-26" value={`₹${totals.spend.toFixed(2)} Cr`} tone="brand" />
            <Kpi label="Marketing revenue" value={`₹${(totals.rev / 1e7).toFixed(1)} Cr`} tone="success" />
            <Kpi label="Blended ROAS" value={totals.roas ? `${totals.roas.toFixed(1)}x` : '—'} tone="warning" />
            <Kpi label="Leads all sources" value={fmtNum(totals.leads)} tone="neutral" />
          </div>

          <div className="gb-card p-4 mb-8" style={{ borderColor: 'var(--warning)' }}>
            <div className="text-[12.5px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--warning)' }}>
              <AlertTriangle size={14} /> The sheet&apos;s monthly tracker is broken from July onward
            </div>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              Its targets referenced a &ldquo;Team Config&rdquo; tab that no longer exists, so every cell from Jul-26
              reads #REF!. Only April to June carried real figures. Spend was also mixed between lakhs and rupees
              in one column and has been normalised to lakhs here.
            </p>
          </div>

          <Section title="Team scorecard — FY25-26" subtitle="Closing position and the FY26-27 targets set against it">
            <div className="gb-card overflow-x-auto">
              <table className="gb-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th style={{ textAlign: 'right' }}>Spend</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Rev share</th>
                    <th style={{ textAlign: 'right' }}>ROAS</th>
                    <th style={{ textAlign: 'right' }}>ROAS target</th>
                    <th style={{ textAlign: 'right' }}>CPL</th>
                    <th style={{ textAlign: 'right' }}>CPL target</th>
                    <th style={{ textAlign: 'right' }}>Qualification</th>
                    <th style={{ textAlign: 'right', minWidth: 120 }}>vs qual. target</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAMS.map((t) => {
                    const roas = plan(t, 'ROAS', 'FY25-26');
                    const roasT = plan(t, 'ROAS target', 'FY26-27');
                    const cpl = plan(t, 'CPL', 'FY25-26');
                    const cplT = plan(t, 'Target CPL', 'FY26-27');
                    const qual = plan(t, 'Qualification', 'FY25-26');
                    const qualT = plan(t, 'Target qualification', 'FY26-27');
                    return (
                      <tr key={t}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t}</td>
                        <td style={{ textAlign: 'right' }} className="tabular-nums">₹{(plan(t, 'Total spend (Cr)', 'FY25-26') ?? 0).toFixed(2)} Cr</td>
                        <td style={{ textAlign: 'right' }} className="tabular-nums">₹{((plan(t, 'Marketing revenue', 'FY25-26') ?? 0) / 1e7).toFixed(1)} Cr</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }} className="tabular-nums">{fmtNum(plan(t, 'Revenue share %', 'FY25-26'), true)}</td>
                        <td style={{ textAlign: 'right' }}><ValueVsTarget value={roas} target={roasT} /></td>
                        <td style={{ textAlign: 'right', color: 'var(--text-faint)' }} className="tabular-nums">{roasT ? `${roasT}x` : '—'}</td>
                        <td style={{ textAlign: 'right' }}><ValueVsTarget value={cpl} target={cplT} lowerIsBetter /></td>
                        <td style={{ textAlign: 'right', color: 'var(--text-faint)' }} className="tabular-nums">{fmtNum(cplT)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }} className="tabular-nums">{fmtNum(qual, true)}</td>
                        <td style={{ textAlign: 'right' }}><TargetBar value={qual} target={qualT} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Monthly spend against budget" subtitle="April to June 2026 — the only months the sheet's tracker still holds">
            {monthly.rows.length === 0 ? <EmptyNote text="No monthly spend recorded." /> : (
              <div className="gb-card overflow-x-auto">
                <table className="gb-table" style={{ minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th>Team</th>
                      {monthly.months.map((m) => (
                        <th key={m} style={{ textAlign: 'right' }} colSpan={2}>{monthShort(m)}</th>
                      ))}
                    </tr>
                    <tr>
                      <th />
                      {monthly.months.map((m) => (
                        <React.Fragment key={m}>
                          <th style={{ textAlign: 'right', fontWeight: 400, fontSize: 10 }}>spend</th>
                          <th style={{ textAlign: 'right', fontWeight: 400, fontSize: 10 }}>budget</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.rows.map((r) => (
                      <tr key={r.team}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.team}</td>
                        {monthly.months.map((m) => {
                          const c = r.byMonth[m];
                          const over = c.v != null && c.t != null && c.v > c.t;
                          return (
                            <React.Fragment key={m}>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: over ? 'var(--error)' : 'var(--text-primary)' }} className="tabular-nums">
                                {c.v != null ? c.v.toFixed(1) : '—'}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-faint)' }} className="tabular-nums">
                                {c.t != null ? c.t.toFixed(1) : '—'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 text-[11px]" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
                  All figures in ₹ lakh. Red means spend ran over budget that month.
                </div>
              </div>
            )}
          </Section>

          <Section title="Leads by source — FY25-26" subtitle="Where every lead came from last year">
            <div className="gb-card p-5">
              <div className="space-y-3">
                {leadSources.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="text-[12.5px] flex-shrink-0" style={{ width: 190, color: 'var(--text-secondary)' }}>{s.label}</div>
                    <div className="flex-1 h-5 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                      <div className="h-full rounded transition-[width] duration-700"
                           style={{ width: `${Math.max(1, (s.value / leadMax) * 100)}%`, backgroundColor: 'var(--brand)' }} />
                    </div>
                    <div className="text-[12.5px] font-semibold tabular-nums flex-shrink-0" style={{ width: 90, textAlign: 'right', color: 'var(--text-primary)' }}>
                      {s.value.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="City economics — FY25-26" subtitle="Spend, cost per lead and qualification rate by city">
            <PlanMatrix rows={cityRows} cols={CITIES.map((c) => ({ key: c, label: c }))}
                        pctMetrics={['CPL decrease', 'Qualification avg']} />
          </Section>
        </>
      )}
    </div>
  );
}

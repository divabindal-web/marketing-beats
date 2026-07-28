'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Download } from 'lucide-react';
import { fmtCompact } from '@/lib/perf-data';
import { fetchSeries, type SeriesRow } from '@/lib/perf-api';
import { Bars, GroupedBars, HBars, Legend, StatCard } from '@/components/perf/Charts';

const monthYear = (m: string) =>
  new Date(m + 'T00:00:00').toLocaleString('en-US', { month: 'short' }) +
  '-' +
  m.slice(0, 4);

export default function PaidPage() {
  const [rows, setRows] = useState<SeriesRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSeries('paid')
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const model = useMemo(() => {
    if (!rows || !rows.length) return null;

    // rows are ordered by month asc — a Map keeps the latest value per entity+metric
    const latest = new Map<string, number | null>();
    const series = new Map<string, SeriesRow[]>(); // entity|metric → all months asc
    for (const r of rows) {
      const k = r.entity + '|' + r.metric;
      latest.set(k, r.value);
      const list = series.get(k) ?? [];
      list.push(r);
      series.set(k, list);
    }
    const val = (entity: string, metric: string) => latest.get(entity + '|' + metric) ?? null;

    // Teams: entities that report ROAS
    const teamNames = [...new Set(rows.filter((r) => r.metric === 'roas').map((r) => r.entity))];
    const teams = teamNames
      .map((n) => {
        const spent = val(n, 'spend') ?? 0;
        const rev = val(n, 'revenue') ?? 0;
        return { n, spent, rev, roas: val(n, 'roas') ?? 0, revCr: +(rev / 1e7).toFixed(1) };
      })
      .sort((a, b) => b.rev - a.rev);
    const totalRev = teams.reduce((s, t) => s + t.rev, 0);
    const totalSpend = teams.reduce((s, t) => s + t.spent, 0);
    const withShare = teams.map((t) => ({ ...t, share: totalRev > 0 ? Math.round((t.rev / totalRev) * 100) : 0 }));

    // CPL: two months per city (older = a, newer = b)
    const cplEntities = [...new Set(rows.filter((r) => r.metric === 'cpl').map((r) => r.entity))];
    const cpl = cplEntities.map((c) => {
      const m = (series.get(c + '|cpl') ?? []).filter((r) => r.value != null);
      const bRow = m[m.length - 1];
      const aRow = m.length > 1 ? m[m.length - 2] : null;
      return { c, a: aRow?.value ?? null, b: bRow?.value ?? null };
    });
    const cplMonths = [...new Set(rows.filter((r) => r.metric === 'cpl').map((r) => r.month))].sort();
    const cplA = cplMonths.length > 1 ? monthYear(cplMonths[0]) : 'Previous';
    const cplB = cplMonths.length ? monthYear(cplMonths[cplMonths.length - 1]) : 'Current';

    // Leads by source (latest month per entity)
    const leads = [...new Set(rows.filter((r) => r.metric === 'leads').map((r) => r.entity))]
      .map((s) => ({ s, v: val(s, 'leads') ?? 0 }))
      .sort((a, b) => b.v - a.v);
    const paidLeads = leads.find((l) => l.s === 'Paid')?.v ?? leads[0]?.v ?? 0;

    return {
      teams: withShare,
      cpl,
      cplA,
      cplB,
      leads,
      totals: {
        revCr: +(totalRev / 1e7).toFixed(1),
        spendCr: +(totalSpend / 1e7).toFixed(1),
        blendedRoas: totalSpend > 0 ? totalRev / totalSpend : 0,
        paidLeads,
      },
    };
  }, [rows]);

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Paid Campaigns</h1>
          <p className="gb-page-description">Spend, revenue &amp; ROAS by team</p>
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
            Upload month
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-[12.5px] mb-4" style={{ color: 'var(--error)' }}>
          Couldn&apos;t load Paid data: {error}
        </p>
      )}
      {!error && !rows && (
        <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
          Loading…
        </p>
      )}
      {!error && rows && !model && (
        <div className="gb-card p-6 text-center">
          <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            No Paid data yet
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
            <StatCard label="Marketing Revenue" value={`₹${model.totals.revCr} Cr`} sub="across teams" />
            <StatCard label="Blended ROAS" value={`${model.totals.blendedRoas.toFixed(1)}×`} sub="revenue ÷ spend" />
            <StatCard label="Total Ad Spend" value={`₹${model.totals.spendCr} Cr`} sub="across teams" />
            <StatCard label="Paid Leads" value={fmtCompact(model.totals.paidLeads)} sub="largest source" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>ROAS by team</h3>
              <p className="gb-page-description mb-3">return on ad spend (×)</p>
              <Bars
                vals={model.teams.map((t) => t.roas)}
                labels={model.teams.map((t) => t.n)}
                color="#eda100"
                fmt={(v) => v + '×'}
              />
            </div>
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Revenue vs Spend by team</h3>
              <p className="gb-page-description mb-3">₹ Crore</p>
              <GroupedBars
                items={model.teams.map((t) => ({ n: t.n, spend: +(t.spent / 1e7).toFixed(1), rev: t.revCr }))}
                keys={['spend', 'rev']}
                colors={['#c9c7bf', '#008300']}
                fmt={(v) => '' + v}
              />
              <Legend names={['Spend (Cr)', 'Revenue (Cr)']} colors={['#c9c7bf', '#008300']} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>CPL improvement by city</h3>
              <p className="gb-page-description mb-3">
                cost per lead: {model.cplA} → {model.cplB} (lower is better)
              </p>
              <GroupedBars
                items={model.cpl.map((x) => ({ n: x.c, a: x.a, b: x.b }))}
                keys={['a', 'b']}
                colors={['#c9c7bf', '#eb6834']}
                fmt={(v) => '₹' + fmtCompact(v)}
              />
              <Legend names={[model.cplA, model.cplB]} colors={['#c9c7bf', '#eb6834']} />
            </div>
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Leads by source</h3>
              <p className="gb-page-description mb-3">where leads come from</p>
              <HBars items={model.leads.map((x) => ({ n: x.s, v: x.v }))} labelW={100} color="#2a78d6" />
            </div>
          </div>

          <div className="gb-card p-4">
            <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Team performance table</h3>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ color: 'var(--text-faint)' }}>
                  <th className="text-left py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Team</th>
                  <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Spent</th>
                  <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Revenue</th>
                  <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">ROAS</th>
                  <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Rev share</th>
                </tr>
              </thead>
              <tbody>
                {model.teams.map((t) => (
                  <tr key={t.n} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="text-left py-2 px-2.5">{t.n}</td>
                    <td className="text-right py-2 px-2.5">₹{fmtCompact(t.spent)}</td>
                    <td className="text-right py-2 px-2.5">₹{t.revCr} Cr</td>
                    <td className="text-right py-2 px-2.5 font-bold">{t.roas}×</td>
                    <td className="text-right py-2 px-2.5">{t.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-faint)' }}>
              Live data. The full monthly plan-vs-actual tracker (budget, qualified, meetings, win, CPC) also lives in the tracker and drops into this view.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

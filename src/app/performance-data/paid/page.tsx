'use client';

import { Upload, Download } from 'lucide-react';
import { PAID_TEAMS, PAID_CPL, PAID_LEADS, PAID_TOTALS, fmtCompact } from '@/lib/perf-data';
import { Bars, GroupedBars, HBars, Legend, StatCard } from '@/components/perf/Charts';

export default function PaidPage() {
  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Paid Campaigns</h1>
          <p className="gb-page-description">Spend, revenue &amp; ROAS · FY 2025-26</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="gb-btn gb-btn-secondary"><Download size={14} strokeWidth={2} />Template</button>
          <button className="gb-btn gb-btn-primary"><Upload size={14} strokeWidth={2.25} />Upload month</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Marketing Revenue" value={`₹${PAID_TOTALS.revCr} Cr`} delta={{ up: true, txt: 'FY 25-26' }} />
        <StatCard label="Blended ROAS" value={`${PAID_TOTALS.blendedRoas.toFixed(1)}×`} sub="revenue ÷ spend" />
        <StatCard label="Total Ad Spend" value={`₹${PAID_TOTALS.spendCr} Cr`} sub="across teams" />
        <StatCard label="Paid Leads" value={fmtCompact(PAID_TOTALS.paidLeads)} sub="largest source" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>ROAS by team</h3>
          <p className="gb-page-description mb-3">return on ad spend (×)</p>
          <Bars vals={PAID_TEAMS.map((t) => t.roas)} labels={PAID_TEAMS.map((t) => t.n)} color="#eda100" fmt={(v) => v + '×'} />
        </div>
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Revenue vs Spend by team</h3>
          <p className="gb-page-description mb-3">₹ Crore</p>
          <GroupedBars
            items={PAID_TEAMS.map((t) => ({ n: t.n, spend: +(t.spent / 1e7).toFixed(1), rev: t.revCr }))}
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
          <p className="gb-page-description mb-3">cost per lead: Apr-2025 → Feb-2026 (lower is better)</p>
          <GroupedBars
            items={PAID_CPL.map((x) => ({ n: x.c, a: x.a, b: x.b }))}
            keys={['a', 'b']}
            colors={['#c9c7bf', '#eb6834']}
            fmt={(v) => '₹' + fmtCompact(v)}
          />
          <Legend names={['Apr-2025', 'Feb-2026']} colors={['#c9c7bf', '#eb6834']} />
        </div>
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Leads by source</h3>
          <p className="gb-page-description mb-3">where leads come from</p>
          <HBars items={PAID_LEADS.map((x) => ({ n: x.s, v: x.v }))} labelW={100} color="#2a78d6" />
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
            {PAID_TEAMS.map((t) => (
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
          Real data. The full monthly plan-vs-actual tracker (budget, qualified, meetings, win, CPC) also lives in the tracker and drops into this view.
        </p>
      </div>
    </div>
  );
}

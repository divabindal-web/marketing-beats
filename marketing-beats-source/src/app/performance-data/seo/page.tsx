'use client';

import { useState } from 'react';
import { Upload, Download } from 'lucide-react';
import {
  SEO_DATA,
  SEO_ENTITIES,
  SEO_METRIC_ROWS,
  PERF_MONTHS,
  fmtCompact,
  momDelta,
} from '@/lib/perf-data';
import { Bars, HBars, StatCard } from '@/components/perf/Charts';

export default function SeoPage() {
  const [ent, setEnt] = useState(SEO_ENTITIES[0]);
  const D = SEO_DATA[ent];

  const fmtMetric = (v: number | null, m: { pct?: boolean; cr?: boolean }) =>
    v == null ? '—' : m.pct ? v.toFixed(1) + '%' : m.cr ? v.toFixed(2) : fmtCompact(v);

  const kpis: { label: string; key: string; fmt: (v: number | null) => string }[] = [
    { label: 'Organic Clicks', key: 'clicks', fmt: fmtCompact },
    { label: 'Organic Leads', key: 'orgLeadVol', fmt: fmtCompact },
    { label: 'Organic Lead Share', key: 'orgShare', fmt: (v) => (v == null ? '—' : v.toFixed(1) + '%') },
    { label: 'Organic Revenue', key: 'revenueCr', fmt: (v) => (v == null ? '—' : '₹' + v.toFixed(2) + ' Cr') },
    { label: 'Lead Volume', key: 'leadVol', fmt: fmtCompact },
  ];

  const compare = SEO_ENTITIES.map((e) => ({
    n: e.replace(' - SEO', '').replace(' - ', ' '),
    v: SEO_DATA[e].clicks.m[2] ?? 0,
  }));

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">SEO Performance</h1>
          <p className="gb-page-description">
            Organic search, month-over-month · FY 2026-27 · sourced from the marketing tracker
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="gb-btn gb-btn-secondary">
            <Download size={14} strokeWidth={2} />
            Template
          </button>
          <button className="gb-btn gb-btn-primary">
            <Upload size={14} strokeWidth={2.25} />
            Upload month
          </button>
        </div>
      </div>

      {/* entity tabs */}
      <div className="gb-tabs mb-5">
        {SEO_ENTITIES.map((e) => (
          <button key={e} onClick={() => setEnt(e)} className={`gb-tab ${e === ent ? 'gb-tab-active' : ''}`}>
            {e}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {kpis.map((k) => {
          const d = D[k.key];
          if (!d) return null;
          const cur = d.m[2];
          const prev = d.m[1];
          const mom = momDelta(cur, prev);
          return (
            <StatCard
              key={k.key}
              label={k.label}
              value={k.fmt(cur)}
              delta={mom != null ? { up: mom >= 0, txt: Math.abs(mom).toFixed(1) + '% MoM' } : null}
              sub={d.target != null ? `Target: ${d.pct ? d.target + '%' : fmtCompact(d.target)}` : undefined}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Organic Clicks — monthly</h3>
          <p className="gb-page-description mb-3">Apr → Jun 2026, vs 2027 target</p>
          <Bars vals={D.clicks.m} labels={PERF_MONTHS} target={D.clicks.target} />
        </div>
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Organic Lead Share %</h3>
          <p className="gb-page-description mb-3">Share of leads that are organic — vs target</p>
          {D.orgShare ? (
            <Bars vals={D.orgShare.m} labels={PERF_MONTHS} target={D.orgShare.target} color="var(--success, #1baf7a)" fmt={(v) => (v == null ? '—' : v.toFixed(0) + '%')} />
          ) : (
            <p className="gb-page-description">—</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Organic Lead Volume — monthly</h3>
          <p className="gb-page-description mb-3">Actual organic leads produced</p>
          {D.orgLeadVol && <Bars vals={D.orgLeadVol.m} labels={PERF_MONTHS} target={D.orgLeadVol.target} color="#008300" />}
        </div>
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Clicks — entities compared (Jun)</h3>
          <p className="gb-page-description mb-3">SQY vs INCO-IN vs UM</p>
          <HBars items={compare} labelW={100} />
        </div>
      </div>

      <div className="gb-card p-4">
        <h3 className="gb-section-title" style={{ marginBottom: 2 }}>
          Month-over-month table <span className="gb-badge">{ent}</span>
        </h3>
        <p className="gb-page-description mb-3">baseline · target · actuals · MoM change</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr style={{ color: 'var(--text-faint)' }}>
                <th className="text-left py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Metric</th>
                <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Baseline</th>
                <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Target</th>
                {PERF_MONTHS.map((m) => (
                  <th key={m} className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">{m}</th>
                ))}
                <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">MoM</th>
              </tr>
            </thead>
            <tbody>
              {SEO_METRIC_ROWS.map(({ label, key }) => {
                const d = D[key];
                if (!d) return null;
                const mom = momDelta(d.m[2], d.m[1]);
                return (
                  <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="text-left py-2 px-2.5">{label}</td>
                    <td className="text-right py-2 px-2.5">{d.base == null ? '—' : d.pct ? d.base + '%' : fmtCompact(d.base)}</td>
                    <td className="text-right py-2 px-2.5">{d.target == null ? '—' : d.pct ? d.target + '%' : fmtCompact(d.target)}</td>
                    {d.m.map((v, i) => (
                      <td key={i} className="text-right py-2 px-2.5" style={i === 2 ? { fontWeight: 700 } : undefined}>
                        {fmtMetric(v, d)}
                      </td>
                    ))}
                    <td className="text-right py-2 px-2.5" style={{ color: mom == null ? undefined : mom >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                      {mom == null ? '—' : (mom >= 0 ? '+' : '') + mom.toFixed(1) + '%'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-faint)' }}>
          Real data from the tracker sheet. Upload next month&apos;s file and this refreshes automatically.
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Download } from 'lucide-react';
import { fmtCompact, momDelta } from '@/lib/perf-data';
import { fetchSeries, type SeriesRow } from '@/lib/perf-api';
import { Bars, HBars, StatCard } from '@/components/perf/Charts';

interface SeoMetric {
  base: number | null;
  target: number | null;
  m: (number | null)[]; // aligned to model.months
  pct?: boolean;
  cr?: boolean;
}
type SeoEntity = Record<string, SeoMetric>;

const METRIC_ROWS: { label: string; key: string }[] = [
  { label: 'Organic Clicks', key: 'clicks' },
  { label: 'Impressions', key: 'impressions' },
  { label: 'Lead Volume', key: 'leadVol' },
  { label: 'Organic Lead Volume', key: 'orgLeadVol' },
  { label: 'Organic Lead Share %', key: 'orgShare' },
  { label: 'Organic Revenue (Cr)', key: 'revenueCr' },
];

const monthLabel = (m: string) =>
  new Date(m + 'T00:00:00').toLocaleString('en-US', { month: 'short' });

export default function SeoPage() {
  const [rows, setRows] = useState<SeriesRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entSel, setEntSel] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSeries('seo')
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const model = useMemo(() => {
    if (!rows || !rows.length) return null;
    const entities = [...new Set(rows.map((r) => r.entity))].sort();
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const labels = months.map(monthLabel);
    const data: Record<string, SeoEntity> = {};
    for (const e of entities) data[e] = {};
    for (const r of rows) {
      const d = data[r.entity];
      if (!d[r.metric]) {
        d[r.metric] = {
          base: null,
          target: null,
          m: months.map(() => null),
          pct: false,
          cr: r.metric === 'revenueCr',
        };
      }
      const m = d[r.metric];
      m.m[months.indexOf(r.month)] = r.value;
      if (r.baseline != null) m.base = r.baseline;
      if (r.target != null) m.target = r.target;
      if (r.is_pct) m.pct = true;
    }
    return { entities, months, labels, data, last: months.length - 1 };
  }, [rows]);

  const ent = model ? (entSel && model.entities.includes(entSel) ? entSel : model.entities[0]) : null;
  const D = model && ent ? model.data[ent] : null;

  const fmtMetric = (v: number | null, m: { pct?: boolean; cr?: boolean }) =>
    v == null ? '—' : m.pct ? v.toFixed(1) + '%' : m.cr ? v.toFixed(2) : fmtCompact(v);

  const kpis: { label: string; key: string; fmt: (v: number | null) => string }[] = [
    { label: 'Organic Clicks', key: 'clicks', fmt: fmtCompact },
    { label: 'Organic Leads', key: 'orgLeadVol', fmt: fmtCompact },
    { label: 'Organic Lead Share', key: 'orgShare', fmt: (v) => (v == null ? '—' : v.toFixed(1) + '%') },
    { label: 'Organic Revenue', key: 'revenueCr', fmt: (v) => (v == null ? '—' : '₹' + v.toFixed(2) + ' Cr') },
    { label: 'Lead Volume', key: 'leadVol', fmt: fmtCompact },
  ];

  const compare = model
    ? model.entities.map((e) => ({
        n: e.replace(' - SEO', '').replace(' - ', ' '),
        v: model.data[e].clicks?.m[model.last] ?? 0,
      }))
    : [];

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">SEO Performance</h1>
          <p className="gb-page-description">Organic search, month-over-month · sourced from the marketing tracker</p>
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
          Couldn&apos;t load SEO data: {error}
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
            No SEO data yet
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

      {model && ent && D && (
        <>
          {/* entity tabs */}
          <div className="gb-tabs mb-5">
            {model.entities.map((e) => (
              <button key={e} onClick={() => setEntSel(e)} className={`gb-tab ${e === ent ? 'gb-tab-active' : ''}`}>
                {e}
              </button>
            ))}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            {kpis.map((k) => {
              const d = D[k.key];
              if (!d) return null;
              const cur = d.m[model.last];
              const prev = model.last > 0 ? d.m[model.last - 1] : null;
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
              <p className="gb-page-description mb-3">
                {model.labels[0]} → {model.labels[model.last]}, vs target
              </p>
              {D.clicks ? (
                <Bars vals={D.clicks.m} labels={model.labels} target={D.clicks.target} />
              ) : (
                <p className="gb-page-description">—</p>
              )}
            </div>
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Organic Lead Share %</h3>
              <p className="gb-page-description mb-3">Share of leads that are organic — vs target</p>
              {D.orgShare ? (
                <Bars
                  vals={D.orgShare.m}
                  labels={model.labels}
                  target={D.orgShare.target}
                  color="var(--success, #1baf7a)"
                  fmt={(v) => (v == null ? '—' : v.toFixed(0) + '%')}
                />
              ) : (
                <p className="gb-page-description">—</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Organic Lead Volume — monthly</h3>
              <p className="gb-page-description mb-3">Actual organic leads produced</p>
              {D.orgLeadVol && <Bars vals={D.orgLeadVol.m} labels={model.labels} target={D.orgLeadVol.target} color="#008300" />}
            </div>
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>
                Clicks — entities compared ({model.labels[model.last]})
              </h3>
              <p className="gb-page-description mb-3">latest month across entities</p>
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
                    {model.labels.map((m) => (
                      <th key={m} className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">{m}</th>
                    ))}
                    <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">MoM</th>
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map(({ label, key }) => {
                    const d = D[key];
                    if (!d) return null;
                    const mom = momDelta(d.m[model.last], model.last > 0 ? d.m[model.last - 1] : null);
                    return (
                      <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="text-left py-2 px-2.5">{label}</td>
                        <td className="text-right py-2 px-2.5">{d.base == null ? '—' : d.pct ? d.base + '%' : fmtCompact(d.base)}</td>
                        <td className="text-right py-2 px-2.5">{d.target == null ? '—' : d.pct ? d.target + '%' : fmtCompact(d.target)}</td>
                        {d.m.map((v, i) => (
                          <td key={i} className="text-right py-2 px-2.5" style={i === model.last ? { fontWeight: 700 } : undefined}>
                            {fmtMetric(v, d)}
                          </td>
                        ))}
                        <td
                          className="text-right py-2 px-2.5"
                          style={{ color: mom == null ? undefined : mom >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}
                        >
                          {mom == null ? '—' : (mom >= 0 ? '+' : '') + mom.toFixed(1) + '%'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-faint)' }}>
              Live data from the database. Upload next month&apos;s file and this refreshes automatically.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

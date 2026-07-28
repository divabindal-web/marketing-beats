'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Download } from 'lucide-react';
import { fmtCompact, momDelta } from '@/lib/perf-data';
import { fetchSeries, type SeriesRow } from '@/lib/perf-api';
import { GroupedBars, Legend, StatCard } from '@/components/perf/Charts';

interface PrevCur {
  n: string;
  prev: number | null;
  cur: number | null;
  yoy: number | null;
}

const monthYear = (m: string) =>
  new Date(m + 'T00:00:00').toLocaleString('en-US', { month: 'short', year: 'numeric' });

export default function OrmPage() {
  const [rows, setRows] = useState<SeriesRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSeries('orm')
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const model = useMemo(() => {
    if (!rows || !rows.length) return null;
    const byEntity = new Map<string, SeriesRow[]>();
    for (const r of rows) {
      const list = byEntity.get(r.entity) ?? [];
      list.push(r);
      byEntity.set(r.entity, list);
    }
    const prevCur = (list: SeriesRow[], metric: string): PrevCur | null => {
      const m = list.filter((r) => r.metric === metric).sort((a, b) => a.month.localeCompare(b.month));
      if (!m.length) return null;
      const curRow = m[m.length - 1];
      const prevRow = m.length > 1 ? m[m.length - 2] : null;
      const cur = curRow.value;
      const prev = prevRow ? prevRow.value : null;
      const yoy = momDelta(cur, prev);
      return { n: '', prev, cur, yoy };
    };

    const platforms: PrevCur[] = [];
    const gmb: PrevCur[] = [];
    const reviews: PrevCur[] = [];
    for (const [entity, list] of byEntity) {
      const rating = prevCur(list, 'rating');
      if (rating) {
        if (/^GMB\b/i.test(entity)) gmb.push({ ...rating, n: entity.replace(/^GMB\s*-\s*/i, '') });
        else platforms.push({ ...rating, n: entity });
      }
      const rev = prevCur(list, 'reviews');
      if (rev) reviews.push({ ...rev, n: entity });
    }
    platforms.sort((a, b) => a.n.localeCompare(b.n));
    gmb.sort((a, b) => a.n.localeCompare(b.n));

    const ratingMonths = [...new Set(rows.filter((r) => r.metric === 'rating').map((r) => r.month))].sort();
    const prevLabel = ratingMonths.length > 1 ? monthYear(ratingMonths[0]) : 'Previous';
    const curLabel = ratingMonths.length ? monthYear(ratingMonths[ratingMonths.length - 1]) : 'Current';

    return { platforms, gmb, reviews, prevLabel, curLabel };
  }, [rows]);

  const customer = model?.reviews.find((r) => r.n === 'Customer Reviews') ?? null;
  const employee = model?.reviews.find((r) => r.n === 'Employee Reviews') ?? null;
  const trustPilot = model?.platforms.find((r) => r.n === 'TrustPilot') ?? null;
  const gmbSqy = model?.gmb.find((r) => r.n === 'SQY') ?? null;

  const yoyTxt = (yoy: number | null) =>
    yoy == null ? null : { up: yoy >= 0, txt: (yoy >= 0 ? '+' : '') + Math.round(yoy) + '% YoY' };

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">ORM — Online Reputation</h1>
          <p className="gb-page-description">Review sites &amp; Google ratings · year over year</p>
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
          Couldn&apos;t load ORM data: {error}
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
            No ORM data yet
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
            <StatCard
              label="Customer Reviews"
              value={customer?.cur != null ? fmtCompact(customer.cur) : '—'}
              sub={model.curLabel}
            />
            <StatCard
              label="Employee Reviews"
              value={employee?.cur != null ? fmtCompact(employee.cur) : '—'}
              delta={employee ? yoyTxt(employee.yoy) : null}
              sub={employee?.prev != null ? `from ${fmtCompact(employee.prev)}` : undefined}
            />
            <StatCard
              label="TrustPilot"
              value={trustPilot?.cur != null ? trustPilot.cur.toFixed(1) + '★' : '—'}
              delta={trustPilot ? yoyTxt(trustPilot.yoy) : null}
              sub={trustPilot?.prev != null ? `from ${trustPilot.prev.toFixed(1)}★` : undefined}
            />
            <StatCard
              label="GMB — SQY"
              value={gmbSqy?.cur != null ? gmbSqy.cur.toFixed(2) + '★' : '—'}
              delta={
                gmbSqy?.yoy != null
                  ? { up: gmbSqy.yoy >= 0, txt: (gmbSqy.yoy >= 0 ? '+' : '') + gmbSqy.yoy.toFixed(2) + '% YoY' }
                  : null
              }
              sub={gmbSqy?.prev != null ? `from ${gmbSqy.prev.toFixed(2)}★` : undefined}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Review-site ratings — YoY</h3>
              <p className="gb-page-description mb-3">
                {model.prevLabel} vs {model.curLabel} (out of 5)
              </p>
              <GroupedBars
                items={model.platforms.map((x) => ({ n: x.n, prev: x.prev, cur: x.cur }))}
                keys={['prev', 'cur']}
                colors={['#c9c7bf', '#e87ba4']}
                fmt={(v) => v.toFixed(1)}
              />
              <Legend names={[model.prevLabel, model.curLabel]} colors={['#c9c7bf', '#e87ba4']} />
            </div>
            <div className="gb-card p-4">
              <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Google (GMB) rating by entity</h3>
              <p className="gb-page-description mb-3">
                {model.prevLabel} vs {model.curLabel}
              </p>
              <GroupedBars
                items={model.gmb.map((x) => ({ n: x.n, prev: x.prev, cur: x.cur }))}
                keys={['prev', 'cur']}
                colors={['#c9c7bf', '#2a78d6']}
                fmt={(v) => v.toFixed(2)}
              />
              <Legend names={[model.prevLabel, model.curLabel]} colors={['#c9c7bf', '#2a78d6']} />
            </div>
          </div>

          <div className="gb-card p-4">
            <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Reputation table</h3>
            <p className="gb-page-description mb-3">rating change year over year</p>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ color: 'var(--text-faint)' }}>
                  <th className="text-left py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Platform</th>
                  <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">{model.prevLabel}</th>
                  <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">{model.curLabel}</th>
                  <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">YoY</th>
                </tr>
              </thead>
              <tbody>
                {model.platforms.map((x) => (
                  <tr key={x.n} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="text-left py-2 px-2.5">{x.n}</td>
                    <td className="text-right py-2 px-2.5">{x.prev ?? '—'}</td>
                    <td className="text-right py-2 px-2.5 font-bold">{x.cur ?? '—'}</td>
                    <td
                      className="text-right py-2 px-2.5"
                      style={{ color: (x.yoy ?? 0) >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}
                    >
                      {x.yoy == null ? '—' : (x.yoy >= 0 ? '+' : '') + Math.round(x.yoy) + '%'}
                    </td>
                  </tr>
                ))}
                {employee && (
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="text-left py-2 px-2.5">Employee Reviews</td>
                    <td className="text-right py-2 px-2.5">{employee.prev != null ? employee.prev.toLocaleString('en-IN') : '—'}</td>
                    <td className="text-right py-2 px-2.5 font-bold">{employee.cur != null ? employee.cur.toLocaleString('en-IN') : '—'}</td>
                    <td
                      className="text-right py-2 px-2.5"
                      style={{ color: (employee.yoy ?? 0) >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}
                    >
                      {employee.yoy == null ? '—' : (employee.yoy >= 0 ? '+' : '') + Math.round(employee.yoy) + '%'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-faint)' }}>
              Live data. The monthly per-location GMB detail (per city, with map links) also lives in the tracker and slots into this view.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

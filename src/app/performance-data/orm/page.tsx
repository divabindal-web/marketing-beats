'use client';

/**
 * ORM — reputation across review sites and the Google Business estate.
 *
 * Anchored to a single month, deliberately. The previous version derived its
 * "previous vs current" labels from the earliest and latest month anywhere in
 * the table while comparing each row's own last two months — fine when every
 * row shared one history, wrong as soon as the per-location listings arrived
 * with a different span from the old rolled-up ones.
 *
 * Sorted worst-against-target first: the reason to open this page is to find
 * out which listings need work, not to admire the ones that are fine.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, PencilLine } from 'lucide-react';
import {
  Cell, MonthRow, MonthView, defaultMonth, fetchMonth, latestMonthWithData,
  monthLabel, shiftMonth, shortMonth, statusOf,
} from '@/lib/perf-monthly';
import { StatCard } from '@/components/perf/Charts';

const RATING = 'rating';
const REVIEWS = 'reviews';

const cellOf = (r: MonthRow, metric: string): Cell | undefined =>
  r.cells.find((c) => c.metric === metric);

const num = (n: number | null, dp = 1) => (n == null ? '—' : n.toFixed(dp));

export default function OrmPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [view, setView] = useState<MonthView | null>(null);
  const [err, setErr] = useState('');

  // Open on the latest month that has data rather than the calendar month,
  // so the page is never empty just because the close hasn't happened yet.
  useEffect(() => {
    latestMonthWithData('orm')
      .then((m) => setMonth(m ?? defaultMonth()))
      .catch(() => setMonth(defaultMonth()));
  }, []);

  const load = useCallback(() => {
    if (!month) return;
    fetchMonth('orm', month)
      .then((v) => { setView(v); setErr(''); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const model = useMemo(() => {
    if (!view) return null;
    // Only rows that actually carry a rating this month or last; this drops
    // the legacy rolled-up entities whose history stops in Mar 2026.
    const rows = view.rows.filter((r) => {
      const c = cellOf(r, RATING);
      return c && (c.value != null || c.prev != null);
    });
    const rated = rows.filter((r) => cellOf(r, RATING)?.value != null);
    const below = rated.filter((r) => statusOf(cellOf(r, RATING)!) === 'off-target');
    const slipped = rated.filter((r) => {
      const c = cellOf(r, RATING)!;
      return c.prev != null && c.value != null && c.value < c.prev;
    });
    const avg = rated.length
      ? rated.reduce((s, r) => s + (cellOf(r, RATING)!.value ?? 0), 0) / rated.length
      : null;
    const totalReviews = rows.reduce((s, r) => s + (cellOf(r, REVIEWS)?.value ?? 0), 0);

    // Worst gap to target first.
    const gap = (r: MonthRow) => {
      const c = cellOf(r, RATING)!;
      if (c.value == null || c.target == null) return 99;
      return c.value - c.target;
    };
    const sorted = [...rows].sort((a, b) => gap(a) - gap(b));
    return { rows: sorted, below, slipped, avg, totalReviews, rated };
  }, [view]);

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="gb-page-title">ORM — Online Reputation</h1>
          <p className="gb-page-description">
            Review sites and the Google Business estate, against FY26-27 targets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/performance-data/monthly" className="gb-btn gb-btn-primary">
            <PencilLine size={14} strokeWidth={2.25} />
            Enter this month
          </Link>
        </div>
      </div>

      {month && (
        <div className="flex items-center gap-2 mb-5">
          <button className="gb-icon-btn" title="Previous month" onClick={() => setMonth((m) => shiftMonth(m!, -1))}>
            <ArrowLeft size={15} />
          </button>
          <div className="text-[13.5px] font-semibold tabular-nums px-1" style={{ color: 'var(--text-primary)', minWidth: 128, textAlign: 'center' }}>
            {monthLabel(month)}
          </div>
          <button className="gb-icon-btn" title="Next month" onClick={() => setMonth((m) => shiftMonth(m!, 1))}>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {err && <p className="text-[12.5px] mb-4" style={{ color: 'var(--error)' }}>Couldn&apos;t load ORM data: {err}</p>}
      {!err && !view && <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>Loading…</p>}

      {model && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 mb-stagger">
            <StatCard label="Listings rated" value={String(model.rated.length)} />
            <StatCard label="Average rating" value={num(model.avg, 2)} />
            <StatCard label="Below target" value={String(model.below.length)}
                      sub={model.rated.length ? `of ${model.rated.length} rated` : undefined} />
            <StatCard label="Total reviews" value={model.totalReviews.toLocaleString('en-IN')} />
          </div>

          {model.slipped.length > 0 && (
            <div className="gb-card p-4 mb-6" style={{ borderColor: 'var(--warning)' }}>
              <div className="text-[13px] font-semibold inline-flex items-center gap-1.5 mb-1" style={{ color: 'var(--warning)' }}>
                <AlertTriangle size={14} />
                {model.slipped.length} listing{model.slipped.length === 1 ? '' : 's'} dropped since {shortMonth(view!.prevMonth)}
              </div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {model.slipped.slice(0, 8).map((r) => r.label).join(' · ')}
                {model.slipped.length > 8 ? ` and ${model.slipped.length - 8} more` : ''}
              </div>
            </div>
          )}

          <div className="gb-card overflow-x-auto">
            <table className="gb-table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Group</th>
                  <th style={{ textAlign: 'right' }}>Rating</th>
                  <th style={{ textAlign: 'right' }}>Target</th>
                  <th style={{ textAlign: 'right' }}>Gap</th>
                  <th style={{ textAlign: 'right' }}>vs {shortMonth(view!.prevMonth)}</th>
                  <th style={{ textAlign: 'right' }}>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((r) => {
                  const rating = cellOf(r, RATING)!;
                  const reviews = cellOf(r, REVIEWS);
                  const st = statusOf(rating);
                  const gap = rating.value != null && rating.target != null ? rating.value - rating.target : null;
                  const mom = rating.value != null && rating.prev != null ? rating.value - rating.prev : null;
                  return (
                    <tr key={r.entity}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{r.label}</span>
                          {r.link && (
                            <a href={r.link} target="_blank" rel="noopener noreferrer" title="Open in Google Maps"
                               style={{ color: 'var(--link)', display: 'inline-flex' }}>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-faint)', fontSize: 12 }}>{r.grp ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600,
                                   color: st === 'off-target' ? 'var(--error)' : st === 'on-target' ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {num(rating.value, 1)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-faint)' }}>{num(rating.target, 1)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {gap == null ? <span style={{ color: 'var(--text-faint)' }}>—</span>
                          : gap >= 0
                            ? <span className="inline-flex items-center gap-1" style={{ color: 'var(--success)' }}><CheckCircle2 size={11} />+{gap.toFixed(1)}</span>
                            : <span className="gb-badge gb-badge-red">{gap.toFixed(1)}</span>}
                      </td>
                      <td style={{ textAlign: 'right', color: mom == null ? 'var(--text-faint)' : mom < 0 ? 'var(--error)' : mom > 0 ? 'var(--success)' : 'var(--text-faint)' }}>
                        {mom == null ? '—' : mom === 0 ? '±0' : (mom > 0 ? '+' : '') + mom.toFixed(1)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {reviews?.value != null ? reviews.value.toLocaleString('en-IN') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

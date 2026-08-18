'use client';

/**
 * Shared building blocks for the performance tabs.
 *
 * The four tabs show the same *kinds* of thing — a headline number, a plan
 * matrix, a monthly trend, a ranked table — so they share components rather
 * than each inventing its own table. That is what makes SEO, ORM, Paid and
 * Social feel like one product instead of four spreadsheets.
 */
import { ReactNode } from 'react';
import { fmtNum, pctChange } from '@/lib/perf-detail';

/* ---------------- layout ---------------- */

export function Section({
  title, subtitle, right, children,
}: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h2 className="gb-section-title" style={{ marginBottom: subtitle ? 2 : 0 }}>{title}</h2>
          {subtitle && (
            <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Headline figure. `delta` is rendered green/red with an arrow. */
export function Kpi({
  label, value, sub, delta, tone = 'neutral',
}: {
  label: string; value: string; sub?: string;
  delta?: number | null;
  tone?: 'brand' | 'success' | 'warning' | 'error' | 'neutral';
}) {
  const bar = {
    brand: 'var(--brand)', success: 'var(--success)', warning: 'var(--warning)',
    error: 'var(--error)', neutral: 'var(--border-strong)',
  }[tone];
  return (
    <div className="gb-stat-card gb-card-hover relative overflow-hidden">
      <span className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: bar }} />
      <div className="gb-stat-label">{label}</div>
      <div className="gb-stat-value tabular-nums">{value}</div>
      <div className="flex items-center gap-2 mt-1">
        {delta != null && (
          <span className="text-[11.5px] font-semibold tabular-nums"
                style={{ color: delta >= 0 ? 'var(--success)' : 'var(--error)' }}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}%
          </span>
        )}
        {sub && <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{sub}</span>}
      </div>
    </div>
  );
}

/** Progress toward a target, as a labelled bar. Caps the fill, not the label. */
export function TargetBar({ value, target, isPct = false }: { value: number | null; target: number | null; isPct?: boolean }) {
  if (value == null || target == null || target === 0) {
    return <span style={{ color: 'var(--text-faint)' }}>—</span>;
  }
  const pct = (value / target) * 100;
  const hit = pct >= 100;
  const color = hit ? 'var(--success)' : pct >= 80 ? 'var(--warning)' : 'var(--error)';
  return (
    <div className="inline-flex items-center gap-2 justify-end w-full">
      <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ backgroundColor: 'var(--bg-tertiary)', maxWidth: 90 }}>
        <div className="h-full rounded-full transition-[width] duration-500"
             style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11.5px] font-semibold tabular-nums" style={{ color, minWidth: 38, textAlign: 'right' }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

/** A value cell that colours itself against a target. */
export function ValueVsTarget({
  value, target, isPct = false, lowerIsBetter = false,
}: { value: number | null; target: number | null; isPct?: boolean; lowerIsBetter?: boolean }) {
  if (value == null) return <span style={{ color: 'var(--text-faint)' }}>—</span>;
  if (target == null) return <span style={{ color: 'var(--text-secondary)' }}>{fmtNum(value, isPct)}</span>;
  const good = lowerIsBetter ? value <= target : value >= target;
  return (
    <span className="tabular-nums font-semibold" style={{ color: good ? 'var(--success)' : 'var(--error)' }}>
      {fmtNum(value, isPct)}
    </span>
  );
}

/* ---------------- tables ---------------- */

export interface MatrixCol { key: string; label: string; align?: 'left' | 'right' }

/**
 * Metric-by-period grid: rows are metrics, columns are named periods.
 * Used for the plan views (FY25-26 / FY26-27 / Q1-Q4, Baseline / Target).
 */
export function PlanMatrix({
  rows, cols, pctMetrics = [],
}: {
  rows: { metric: string; values: Record<string, number | null> }[];
  cols: MatrixCol[];
  pctMetrics?: string[];
}) {
  if (!rows.length) {
    return <EmptyNote text="Nothing recorded for this yet in the sheet." />;
  }
  return (
    <div className="gb-card overflow-x-auto">
      <table className="gb-table" style={{ minWidth: 520 }}>
        <thead>
          <tr>
            <th>Metric</th>
            {cols.map((c) => (
              <th key={c.key} style={{ textAlign: c.align ?? 'right', whiteSpace: 'nowrap' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isPct = pctMetrics.includes(r.metric) || /%/.test(r.metric);
            return (
              <tr key={r.metric}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.metric}</td>
                {cols.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? 'right', color: 'var(--text-secondary)' }}
                      className="tabular-nums">
                    {fmtNum(r.values[c.key] ?? null, isPct)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Two-period comparison with the swing between them — the shape the sheet
 * uses for FY24-25 vs FY25-26.
 */
export function CompareTable({
  rows, fromLabel, toLabel,
}: {
  rows: { metric: string; group: string; from: number | null; to: number | null; isPct?: boolean }[];
  fromLabel: string; toLabel: string;
}) {
  if (!rows.length) return <EmptyNote text="No comparison data." />;
  return (
    <div className="gb-card overflow-x-auto">
      <table className="gb-table" style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Entity</th>
            <th style={{ textAlign: 'right' }}>{fromLabel}</th>
            <th style={{ textAlign: 'right' }}>{toLabel}</th>
            <th style={{ textAlign: 'right' }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const d = pctChange(r.from, r.to);
            return (
              <tr key={r.metric + r.group + i}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.metric}</td>
                <td style={{ color: 'var(--text-faint)', fontSize: 12 }}>{r.group}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }} className="tabular-nums">{fmtNum(r.from, r.isPct)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 500 }} className="tabular-nums">{fmtNum(r.to, r.isPct)}</td>
                <td style={{ textAlign: 'right' }}>
                  {d == null ? <span style={{ color: 'var(--text-faint)' }}>—</span> : (
                    <span className={`gb-badge ${d >= 0 ? 'gb-badge-green' : 'gb-badge-red'}`}>
                      {d >= 0 ? '+' : ''}{Math.round(d)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Monthly trend: rows are metrics, one column per month, plus target. */
export function TrendTable({
  months, monthLabels, rows,
}: {
  months: string[];
  monthLabels: string[];
  rows: { metric: string; isPct: boolean; target: number | null; baseline: number | null; byMonth: Record<string, number | null> }[];
}) {
  if (!rows.length) return <EmptyNote text="No monthly figures recorded yet." />;
  return (
    <div className="gb-card overflow-x-auto">
      <table className="gb-table" style={{ minWidth: 620 }}>
        <thead>
          <tr>
            <th>Metric</th>
            <th style={{ textAlign: 'right' }}>Baseline</th>
            {monthLabels.map((l) => <th key={l} style={{ textAlign: 'right' }}>{l}</th>)}
            <th style={{ textAlign: 'right' }}>Target</th>
            <th style={{ textAlign: 'right', minWidth: 130 }}>Latest vs target</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const latest = [...months].reverse().map((m) => r.byMonth[m]).find((v) => v != null) ?? null;
            return (
              <tr key={r.metric}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.metric}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-faint)' }} className="tabular-nums">{fmtNum(r.baseline, r.isPct)}</td>
                {months.map((m) => (
                  <td key={m} style={{ textAlign: 'right', color: 'var(--text-secondary)' }} className="tabular-nums">
                    {fmtNum(r.byMonth[m] ?? null, r.isPct)}
                  </td>
                ))}
                <td style={{ textAlign: 'right', color: 'var(--text-faint)' }} className="tabular-nums">{fmtNum(r.target, r.isPct)}</td>
                <td style={{ textAlign: 'right' }}><TargetBar value={latest} target={r.target} isPct={r.isPct} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyNote({ text }: { text: string }) {
  return (
    <div className="gb-card px-5 py-8 text-center">
      <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>{text}</p>
    </div>
  );
}

/** Segmented control used to switch entity on the detail tabs. */
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md p-0.5 gap-0.5" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="px-3 py-1.5 rounded text-[12.5px] font-medium transition-colors"
            style={active
              ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-xs)' }
              : { color: 'var(--text-muted)' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

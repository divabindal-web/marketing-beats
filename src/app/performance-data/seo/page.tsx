'use client';

/**
 * SEO tab — the whole SEO sheet, in three layers:
 *   1. this year's monthly run-rate per vertical, against the 2027 target
 *   2. the plan itself (Baseline 2026 -> Target 2027)
 *   3. last year's close (FY24-25 vs FY25-26) including GEO
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PencilLine, TrendingUp } from 'lucide-react';
import {
  DomainData, fetchDomain, fmtNum, monthShort, pctChange, pivotPlan,
} from '@/lib/perf-detail';
import { CompareTable, Kpi, PlanMatrix, Section, Segmented, TrendTable, EmptyNote } from '@/components/perf/PerfBlocks';

/** Verticals tracked month-to-month this year. */
const VERTICALS = ['SQY - SEO', 'SQY - GEO', 'INCO - IN', 'INCO - GCC', 'UM'];
/** Entities used by last year's close, which is grouped by brand not vertical. */
const YOY_ENTITIES = ['SQY', 'INCO', 'UM'];

export default function SeoPage() {
  const [data, setData] = useState<DomainData | null>(null);
  const [err, setErr] = useState('');
  const [vertical, setVertical] = useState('SQY - SEO');

  useEffect(() => {
    fetchDomain('seo').then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const label = (e: string) => data?.entities.find((x) => x.entity === e)?.label ?? e;

  const trend = useMemo(() => {
    if (!data) return { months: [], rows: [] as never[] };
    const rows = data.series.filter((r) => r.entity === vertical);
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const metrics = [...new Set(rows.map((r) => r.metric))];
    return {
      months,
      rows: metrics.map((metric) => {
        const rs = rows.filter((r) => r.metric === metric);
        const byMonth: Record<string, number | null> = {};
        rs.forEach((r) => { byMonth[r.month] = r.value; });
        return {
          metric, isPct: rs[0]?.is_pct ?? false,
          target: rs.find((r) => r.target != null)?.target ?? null,
          baseline: rs.find((r) => r.baseline != null)?.baseline ?? null,
          byMonth,
        };
      }),
    };
  }, [data, vertical]);

  const planRows = useMemo(() => {
    if (!data) return [];
    const p = pivotPlan(data.plan, vertical);
    return [...p.entries()]
      .filter(([, v]) => v.has('Baseline 2026') || v.has('Target 2027'))
      .map(([metric, v]) => ({
        metric,
        values: { base: v.get('Baseline 2026') ?? null, target: v.get('Target 2027') ?? null },
      }));
  }, [data, vertical]);

  const yoy = useMemo(() => {
    if (!data) return [];
    const out: { metric: string; group: string; from: number | null; to: number | null }[] = [];
    const metrics = [...new Set(data.plan.filter((r) => r.period === 'FY24-25').map((r) => r.metric))];
    for (const metric of metrics) {
      for (const g of YOY_ENTITIES) {
        const from = data.plan.find((r) => r.entity === g && r.metric === metric && r.period === 'FY24-25')?.value ?? null;
        const to = data.plan.find((r) => r.entity === g && r.metric === metric && r.period === 'FY25-26')?.value ?? null;
        if (from != null || to != null) out.push({ metric, group: g, from, to });
      }
    }
    return out;
  }, [data]);

  // Headline: the most recent month with a value for the selected vertical.
  // Metrics are matched by exact name — an earlier version used startsWith,
  // which made "Organic Lead Volume" match the "... Share %" row first and
  // render a blank tile.
  const kpis = useMemo(() => {
    if (!trend.months.length) return null;
    const last = trend.months[trend.months.length - 1];
    const prev = trend.months[trend.months.length - 2];
    const row = (name: string) => trend.rows.find((r) => r.metric === name);
    return {
      last,
      prev,
      traffic: row('Traffic (Clicks)') ?? row('Traffic (Sessions)'),
      leads: row('Organic Lead Volume') ?? row('LLM Lead Volume'),
      share: row('Organic Lead Volume Share %'),
      rev: row('Revenue from Organic Leads (Cr)'),
    };
  }, [trend]);

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="gb-page-title">SEO</h1>
          <p className="gb-page-description">
            Organic and GEO performance by vertical — run-rate, plan and last year&apos;s close.
          </p>
        </div>
        <Link href="/performance-data/monthly" className="gb-btn gb-btn-primary">
          <PencilLine size={14} strokeWidth={2.25} /> Enter this month
        </Link>
      </div>

      {err && <p className="text-[12.5px] mb-4" style={{ color: 'var(--error)' }}>{err}</p>}
      {!err && !data && <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>Loading…</p>}

      {data && (
        <>
          <div className="mb-6">
            <Segmented
              value={vertical}
              onChange={setVertical}
              options={VERTICALS.map((v) => ({ value: v, label: label(v) }))}
            />
          </div>

          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 mb-stagger">
              <Kpi label="Traffic" tone="brand"
                   value={fmtNum(kpis.traffic?.byMonth[kpis.last] ?? null)}
                   sub={monthShort(kpis.last)}
                   delta={pctChange(kpis.traffic?.byMonth[kpis.prev] ?? null, kpis.traffic?.byMonth[kpis.last] ?? null)} />
              <Kpi label="Organic leads" tone="success"
                   value={fmtNum(kpis.leads?.byMonth[kpis.last] ?? null)}
                   sub={monthShort(kpis.last)}
                   delta={pctChange(kpis.leads?.byMonth[kpis.prev] ?? null, kpis.leads?.byMonth[kpis.last] ?? null)} />
              <Kpi label="Organic lead share" tone="warning"
                   value={fmtNum(kpis.share?.byMonth[kpis.last] ?? null, true)}
                   sub={kpis.share?.target != null ? `target ${fmtNum(kpis.share.target, true)}` : undefined} />
              <Kpi label="Revenue from organic" tone="neutral"
                   value={kpis.rev?.byMonth[kpis.last] != null ? `₹${fmtNum(kpis.rev!.byMonth[kpis.last])} Cr` : '—'}
                   sub={monthShort(kpis.last)} />
            </div>
          )}

          <Section title="Monthly run-rate" subtitle={`${label(vertical)} · every metric the sheet tracks, against the 2027 target`}>
            <TrendTable months={trend.months} monthLabels={trend.months.map(monthShort)} rows={trend.rows} />
          </Section>

          <Section title="The plan" subtitle="Baseline 2026 and the 2027 target, as set in the sheet">
            <PlanMatrix
              rows={planRows}
              cols={[{ key: 'base', label: 'Baseline 2026' }, { key: 'target', label: 'Target 2027' }]}
            />
          </Section>

          <Section
            title="Last year's close"
            subtitle="FY24-25 against FY25-26 across SQY, INCO and Urban Money — including GEO"
            right={<span className="text-[11.5px] inline-flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
              <TrendingUp size={12} /> {yoy.length} comparisons
            </span>}
          >
            {yoy.length ? <CompareTable rows={yoy} fromLabel="FY24-25" toLabel="FY25-26" />
                        : <EmptyNote text="No year-on-year data." />}
          </Section>
        </>
      )}
    </div>
  );
}

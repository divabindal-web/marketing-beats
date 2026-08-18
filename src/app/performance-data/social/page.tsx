'use client';

/**
 * Social tab — the Social sheet in full.
 *
 * Note this tab is plan-heavy and actuals-light, and that is the sheet's own
 * state rather than a gap here: it sets LinkedIn, Instagram and video targets
 * with a Q1-Q4 split, but records no monthly actuals against them. The empty
 * "this year" column is the finding, so it is shown rather than hidden.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PencilLine, Sparkles } from 'lucide-react';
import {
  DomainData, FUNNEL_ORDER, FUNNEL_TONE, fetchDomain, fmtNum, pivotPlan,
} from '@/lib/perf-detail';
import { EmptyNote, Kpi, PlanMatrix, Section, Segmented } from '@/components/perf/PerfBlocks';

const PLAN_ENTITIES = ['SQY', 'INCO', 'UM', 'UAE'];
const CHANNEL_ENTITIES = ['SQY', 'INCO', 'UM', 'SQY UAE'];
const CHANNEL_METRICS = [
  'LinkedIn impressions', 'LinkedIn followers',
  'Facebook followers', 'Facebook views',
  'Instagram reach', 'Instagram followers',
  'Viral videos (100k+)', 'YouTube watchtime (hours)',
];
const PILLAR_ENTITIES = ['SQY', 'INCO', 'UM'];

export default function SocialPage() {
  const [data, setData] = useState<DomainData | null>(null);
  const [err, setErr] = useState('');
  const [entity, setEntity] = useState('SQY');
  const [pillarEntity, setPillarEntity] = useState('SQY');

  useEffect(() => {
    fetchDomain('social', true).then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const planRows = useMemo(() => {
    if (!data) return [];
    const p = pivotPlan(data.plan, entity);
    return [...p.entries()]
      .filter(([, v]) => v.has('FY26-27') || v.has('Q1'))
      .map(([metric, v]) => ({
        metric,
        values: {
          fy: v.get('FY25-26') ?? null, target: v.get('FY26-27') ?? null,
          q1: v.get('Q1') ?? null, q2: v.get('Q2') ?? null,
          q3: v.get('Q3') ?? null, q4: v.get('Q4') ?? null,
        },
      }));
  }, [data, entity]);

  /** Channel snapshot: metric rows, one column per brand. */
  const channelRows = useMemo(() => {
    if (!data) return [];
    return CHANNEL_METRICS.map((metric) => ({
      metric,
      values: Object.fromEntries(CHANNEL_ENTITIES.map((e) => [
        e, data.plan.find((r) => r.entity === e && r.metric === metric && r.period === 'FY25-26')?.value ?? null,
      ])),
    })).filter((r) => Object.values(r.values).some((v) => v != null));
  }, [data]);

  const pillars = useMemo(
    () => (data?.pillars ?? []).filter((p) => p.entity === pillarEntity),
    [data, pillarEntity],
  );

  const totals = useMemo(() => {
    if (!data) return null;
    const sum = (metric: string, period: string) =>
      data.plan.filter((r) => r.metric === metric && r.period === period && PLAN_ENTITIES.includes(r.entity))
        .reduce((s, r) => s + (r.value ?? 0), 0);
    return {
      videos25: sum('Videos produced', 'FY25-26'),
      videos26: sum('Videos produced', 'FY26-27'),
      li: sum('LinkedIn impressions', 'FY26-27'),
      ig: sum('Instagram reach', 'FY26-27'),
      pillars: (data.pillars ?? []).length,
    };
  }, [data]);

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="gb-page-title">Social</h1>
          <p className="gb-page-description">
            Reach and video targets by brand, last year&apos;s channel numbers, and the content pillar library.
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 mb-stagger">
            <Kpi label="Videos planned 26-27" value={fmtNum(totals.videos26)} tone="brand"
                 sub={`${fmtNum(totals.videos25)} produced last year`} />
            <Kpi label="LinkedIn impressions target" value={fmtNum(totals.li)} tone="success" sub="all brands" />
            <Kpi label="Instagram reach target" value={fmtNum(totals.ig)} tone="warning" sub="all brands" />
            <Kpi label="Content pillars" value={String(totals.pillars)} tone="neutral" sub="across SQY, INCO and UM" />
          </div>

          <Section
            title="Targets and quarterly split"
            subtitle="Exactly as the sheet sets them — last year's actual, this year's target, and the Q1–Q4 phasing"
            right={<Segmented value={entity} onChange={setEntity}
                              options={PLAN_ENTITIES.map((e) => ({ value: e, label: e === 'UAE' ? 'SQY UAE' : e }))} />}
          >
            <PlanMatrix
              rows={planRows}
              cols={[
                { key: 'fy', label: 'FY25-26' }, { key: 'target', label: 'FY26-27 target' },
                { key: 'q1', label: 'Q1' }, { key: 'q2', label: 'Q2' },
                { key: 'q3', label: 'Q3' }, { key: 'q4', label: 'Q4' },
              ]}
            />
          </Section>

          <Section title="Channel snapshot — FY25-26" subtitle="Every channel figure the sheet closed the year with">
            <PlanMatrix
              rows={channelRows}
              cols={CHANNEL_ENTITIES.map((e) => ({ key: e, label: e }))}
            />
          </Section>

          <Section
            title="Content pillars"
            subtitle="The posting library, mapped to funnel stage"
            right={<Segmented value={pillarEntity} onChange={setPillarEntity}
                              options={PILLAR_ENTITIES.map((e) => ({ value: e, label: e }))} />}
          >
            {pillars.length === 0 ? <EmptyNote text="No pillars recorded." /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {FUNNEL_ORDER.map((stage) => {
                  const list = pillars.filter((p) => p.funnel === stage);
                  if (!list.length) return null;
                  const tone = FUNNEL_TONE[stage];
                  return (
                    <div key={stage} className="gb-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                              style={{ backgroundColor: tone.bg, color: tone.fg }}>
                          {stage}
                        </span>
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>{list.length}</span>
                      </div>
                      <ul className="space-y-1.5">
                        {list.map((p) => (
                          <li key={p.pillar} className="text-[12.5px] flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                            <span className="mt-[6px] w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: tone.fg }} />
                            <span>
                              {p.pillar}
                              {p.is_new && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold"
                                      style={{ color: 'var(--accent-text)' }}>
                                  <Sparkles size={9} /> new
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

'use client';

import { Upload, Download } from 'lucide-react';
import { HOOTSUITE_TOTALS, HOOTSUITE_SOURCES, HOOTSUITE_PERIOD, fmtCompact } from '@/lib/perf-data';
import { HBars, StatCard } from '@/components/perf/Charts';

export default function SocialHootsuitePage() {
  const kpis = HOOTSUITE_TOTALS.slice(0, 4);
  const engagement = HOOTSUITE_TOTALS.filter((t) =>
    ['Post link clicks', 'Reactions & likes', 'Shares', 'Comments & replies'].includes(t.n),
  );

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Social — Hootsuite</h1>
          <p className="gb-page-description">
            All networks &amp; entities · {HOOTSUITE_PERIOD} · from the Hootsuite custom report
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="gb-btn gb-btn-secondary"><Download size={14} strokeWidth={2} />Template</button>
          <button className="gb-btn gb-btn-primary"><Upload size={14} strokeWidth={2.25} />Upload report</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {kpis.map((k) => (
          <StatCard key={k.n} label={k.n} value={fmtCompact(k.v)} sub={k.unit} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Engagement — March 2026</h3>
          <p className="gb-page-description mb-3">clicks, reactions, shares, comments across all accounts</p>
          <HBars items={engagement.map((e) => ({ n: e.n, v: e.v }))} labelW={150} color="#e87ba4" />
        </div>
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Reach &amp; impressions</h3>
          <p className="gb-page-description mb-3">audience scale this month</p>
          <HBars
            items={HOOTSUITE_TOTALS.filter((t) =>
              ['Page & profile impressions', 'Page & profile reach', 'Post reach', 'Followers'].includes(t.n),
            ).map((e) => ({ n: e.n.replace('Page & profile ', 'P&P '), v: e.v }))}
            labelW={130}
            color="#2a78d6"
          />
        </div>
      </div>

      <div className="gb-card p-4">
        <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Connected accounts (report sources)</h3>
        <p className="gb-page-description mb-3">20 accounts across LinkedIn, Facebook and Instagram — SQY, Urban Money and Azuro</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {HOOTSUITE_SOURCES.map((s) => (
            <div key={s.network}>
              <div className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {s.network} · {s.accounts.length}
              </div>
              <ul className="space-y-1">
                {s.accounts.map((a) => (
                  <li key={a} className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] mt-4" style={{ color: 'var(--text-faint)' }}>
          Real numbers from your Hootsuite export (Mar 2026). Next: the scheduled Hootsuite email report feeds
          this automatically each week — including month-over-month trends once two or more periods are in.
        </p>
      </div>
    </div>
  );
}

'use client';

import { Upload, Download } from 'lucide-react';
import { ORM_PLATFORMS, ORM_GMB, ORM_REVIEWS, fmtCompact } from '@/lib/perf-data';
import { GroupedBars, Legend, StatCard } from '@/components/perf/Charts';

export default function OrmPage() {
  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">ORM — Online Reputation</h1>
          <p className="gb-page-description">Review sites &amp; Google ratings · year over year</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="gb-btn gb-btn-secondary"><Download size={14} strokeWidth={2} />Template</button>
          <button className="gb-btn gb-btn-primary"><Upload size={14} strokeWidth={2.25} />Upload month</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Customer Reviews" value={fmtCompact(ORM_REVIEWS.customer)} sub="FY 25-26" />
        <StatCard label="Employee Reviews" value={fmtCompact(ORM_REVIEWS.employeeCur)} delta={{ up: true, txt: '+88% YoY' }} sub="from 721" />
        <StatCard label="TrustPilot" value="4.7★" delta={{ up: true, txt: '+236% YoY' }} sub="from 1.4★" />
        <StatCard label="GMB — SQY" value="4.21★" delta={{ up: true, txt: '+4.75% YoY' }} sub="from 4.01★" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Review-site ratings — YoY</h3>
          <p className="gb-page-description mb-3">2024-25 vs 2025-26 (out of 5)</p>
          <GroupedBars
            items={ORM_PLATFORMS.map((x) => ({ n: x.n, prev: x.prev, cur: x.cur }))}
            keys={['prev', 'cur']}
            colors={['#c9c7bf', '#e87ba4']}
            fmt={(v) => v.toFixed(1)}
          />
          <Legend names={['2024-25', '2025-26']} colors={['#c9c7bf', '#e87ba4']} />
        </div>
        <div className="gb-card p-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Google (GMB) rating by entity</h3>
          <p className="gb-page-description mb-3">2024-25 vs 2025-26</p>
          <GroupedBars
            items={ORM_GMB.map((x) => ({ n: x.n, prev: x.prev, cur: x.cur }))}
            keys={['prev', 'cur']}
            colors={['#c9c7bf', '#2a78d6']}
            fmt={(v) => v.toFixed(2)}
          />
          <Legend names={['2024-25', '2025-26']} colors={['#c9c7bf', '#2a78d6']} />
        </div>
      </div>

      <div className="gb-card p-4">
        <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Reputation table</h3>
        <p className="gb-page-description mb-3">rating change year over year</p>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr style={{ color: 'var(--text-faint)' }}>
              <th className="text-left py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">Platform</th>
              <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">2024-25</th>
              <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">2025-26</th>
              <th className="text-right py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide">YoY</th>
            </tr>
          </thead>
          <tbody>
            {ORM_PLATFORMS.map((x) => (
              <tr key={x.n} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="text-left py-2 px-2.5">{x.n}</td>
                <td className="text-right py-2 px-2.5">{x.prev}</td>
                <td className="text-right py-2 px-2.5 font-bold">{x.cur}</td>
                <td className="text-right py-2 px-2.5" style={{ color: x.yoy >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                  {x.yoy > 0 ? '+' : ''}{x.yoy}%
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td className="text-left py-2 px-2.5">Employee Reviews</td>
              <td className="text-right py-2 px-2.5">721</td>
              <td className="text-right py-2 px-2.5 font-bold">6,191</td>
              <td className="text-right py-2 px-2.5" style={{ color: 'var(--success)', fontWeight: 600 }}>+88%</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-faint)' }}>
          Real data. The monthly per-location GMB detail (per city, with map links) also lives in the tracker and slots into this view.
        </p>
      </div>
    </div>
  );
}

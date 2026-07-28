'use client';
/**
 * Lightweight inline-SVG charts for the Performance Data dashboards.
 * No chart lib needed — self-contained, themed via CSS vars, and consistent
 * with the app's gb- design language.
 */
import { fmtCompact } from '@/lib/perf-data';

const ACCENT = 'var(--accent, #2a78d6)';

export function StatCard({
  label,
  value,
  delta,
  sub,
}: {
  label: string;
  value: string;
  delta?: { up: boolean; txt: string } | null;
  sub?: string;
}) {
  return (
    <div className="gb-stat-card">
      <div className="gb-stat-label">{label}</div>
      <div className="gb-stat-value">{value}</div>
      {delta && (
        <div
          className="gb-stat-delta"
          style={{ color: delta.up ? 'var(--success)' : 'var(--error)' }}
        >
          {delta.up ? '▲' : '▼'} {delta.txt}
        </div>
      )}
      {sub && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Bars({
  vals,
  labels,
  target,
  color = ACCENT,
  fmt = fmtCompact,
}: {
  vals: (number | null)[];
  labels: readonly string[];
  target?: number | null;
  color?: string;
  fmt?: (n: number | null) => string;
}) {
  const W = 460,
    H = 190,
    pad = 30;
  const clean = vals.filter((v): v is number => v != null);
  const max = Math.max(...clean, target || 0) * 1.15 || 1;
  const gap = (W - 2 * pad) / vals.length;
  const bw = Math.min(70, gap - 16);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {target != null && (() => {
        const ty = H - pad - (target / max) * (H - 2 * pad);
        return (
          <g>
            <line x1={pad} y1={ty} x2={W - pad} y2={ty} stroke="var(--error)" strokeDasharray="5 4" strokeWidth={1.5} />
            <text x={W - pad} y={ty - 5} textAnchor="end" fontSize={10} fill="var(--error)">
              target {fmt(target)}
            </text>
          </g>
        );
      })()}
      {vals.map((v, i) => {
        if (v == null) return null;
        const h = (v / max) * (H - 2 * pad);
        const x = pad + gap * i + (gap - bw) / 2;
        const y = H - pad - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx={5} fill={color} />
            <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-primary)">
              {fmt(v)}
            </text>
            <text x={x + bw / 2} y={H - pad + 15} textAnchor="middle" fontSize={10.5} fill="var(--text-faint)">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GroupedBars({
  items,
  keys,
  colors,
  fmt = (v: number) => '' + v,
}: {
  items: Record<string, number | null | string>[];
  keys: string[];
  colors: string[];
  fmt?: (n: number) => string;
}) {
  const W = 460,
    H = 200,
    pad = 34;
  let max = 0;
  items.forEach((it) => keys.forEach((k) => {
    const v = it[k];
    if (typeof v === 'number') max = Math.max(max, v);
  }));
  max = max * 1.15 || 1;
  const gp = (W - 2 * pad) / items.length;
  const bw = Math.min(26, (gp - 14) / keys.length);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {items.map((it, i) => {
        const gx = pad + gp * i + (gp - bw * keys.length) / 2;
        return (
          <g key={i}>
            {keys.map((k, ki) => {
              const v = it[k];
              if (typeof v !== 'number') return null;
              const h = (v / max) * (H - 2 * pad);
              const x = gx + ki * bw;
              const y = H - pad - h;
              return (
                <g key={ki}>
                  <rect x={x} y={y} width={bw - 3} height={h} rx={3} fill={colors[ki]} />
                  <text x={x + (bw - 3) / 2} y={y - 4} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--text-muted)">
                    {fmt(v)}
                  </text>
                </g>
              );
            })}
            <text x={gx + (bw * keys.length) / 2} y={H - pad + 15} textAnchor="middle" fontSize={10.5} fill="var(--text-faint)">
              {String(it.n)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({
  items,
  color = 'var(--accent, #eda100)',
  labelW = 110,
  fmt = fmtCompact,
}: {
  items: { n: string; v: number }[];
  color?: string;
  labelW?: number;
  fmt?: (n: number | null) => string;
}) {
  const W = 460,
    rh = 34,
    pad = 8;
  const H = items.length * rh + 10;
  const max = Math.max(...items.map((i) => i.v)) * 1.05 || 1;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {items.map((it, i) => {
        const y = pad + i * rh;
        const w = (it.v / max) * (W - labelW - 70);
        return (
          <g key={i}>
            <text x={0} y={y + 16} fontSize={11.5} fill="var(--text-primary)">
              {it.n}
            </text>
            <rect x={labelW} y={y + 4} width={w} height={16} rx={4} fill={color} />
            <text x={labelW + w + 6} y={y + 16} fontSize={11} fontWeight={700} fill="var(--text-muted)">
              {fmt(it.v)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ names, colors }: { names: string[]; colors: string[] }) {
  return (
    <div className="flex gap-4 flex-wrap mt-2.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
      {names.map((n, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colors[i] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

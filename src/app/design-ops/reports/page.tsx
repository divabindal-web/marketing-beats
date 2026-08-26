'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { listDbUsers, DbUserRow } from '@/lib/work-api';
import { BUSINESS_HOURS, calculateActiveTAT, getStageBreakdown } from '@/lib/tat';
import { RequestStage, RequestType, StageTransition, getTATCategoriesForType } from '@/types';

interface ReqRow {
  id: string; title: string; type: string; entity: string | null;
  assigned_to: string | null; current_stage: string;
}

/** The three request types keep different stage sets, so the breakdown is
 *  read one type at a time — a video's "Video editing" has no counterpart in
 *  a graphics job, and averaging them together hides both. */
const TYPES: RequestType[] = ['Video', 'Graphics', 'Social Media Graphics'];
interface TransitionRow {
  request_id: string; stage: string; transitioned_at: string;
}
interface CompletedItem {
  request: ReqRow;
  completedAt: string;
  /** Total active business hours, pauses excluded. */
  tatHours: number;
  /** Hours spent in each stage on the way there — the shoot, the edit and the
   *  review are separate pieces of work and are reported separately. */
  perStage: Partial<Record<RequestStage, number>>;
}

const FINAL_STAGES = ['Done', 'Uploaded'];

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonthValue());
  const [type, setType] = useState<RequestType>('Video');
  const [requests, setRequests] = useState<ReqRow[]>([]);
  const [transitions, setTransitions] = useState<TransitionRow[]>([]);
  const [users, setUsers] = useState<DbUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [reqRes, trRes, dbUsers] = await Promise.all([
          supabase.from('requests').select('id, title, type, entity, assigned_to, current_stage'),
          supabase.from('stage_transitions').select('request_id, stage, transitioned_at'),
          listDbUsers(),
        ]);
        if (reqRes.error) throw reqRes.error;
        if (trRes.error) throw trRes.error;
        setRequests((reqRes.data as ReqRow[]) ?? []);
        setTransitions((trRes.data as TransitionRow[]) ?? []);
        setUsers(dbUsers);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const completed = useMemo<CompletedItem[]>(() => {
    const byRequest = new Map<string, TransitionRow[]>();
    transitions.forEach((t) => {
      const list = byRequest.get(t.request_id) ?? [];
      list.push(t);
      byRequest.set(t.request_id, list);
    });
    const items: CompletedItem[] = [];
    requests.forEach((r) => {
      const trs = (byRequest.get(r.id) ?? []).slice().sort(
        (a, b) => new Date(a.transitioned_at).getTime() - new Date(b.transitioned_at).getTime(),
      );
      if (trs.length === 0) return;
      const final = trs.find((t) => FINAL_STAGES.includes(t.stage));
      if (!final) return;
      if (final.transitioned_at.slice(0, 7) !== month) return;
      // Only the history up to delivery. Handing in transitions dated after
      // `final` alongside asOf=final would measure intervals that run
      // backwards, if a request were ever reopened after being completed.
      const upToDelivery = trs
        .filter((t) => t.transitioned_at <= final.transitioned_at)
        .map((t) => ({ to_stage: t.stage, transitioned_at: t.transitioned_at })) as StageTransition[];
      const tatHours = calculateActiveTAT(upToDelivery, final.transitioned_at);

      const perStage: Partial<Record<RequestStage, number>> = {};
      for (const { stage, hours } of getStageBreakdown(upToDelivery, final.transitioned_at)) {
        perStage[stage] = hours;
      }

      items.push({ request: r, completedAt: final.transitioned_at, tatHours, perStage });
    });
    return items;
  }, [requests, transitions, month]);

  const usersById = useMemo(() => {
    const m = new Map<string, DbUserRow>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  /** One row of the report: a person or a team, with hours banked per stage. */
  interface Agg {
    key: string;
    name: string;
    team: string;
    /** Shown because Divya asked to see what each person actually does. */
    designation: string;
    role: string;
    count: number;
    totalTat: number;
    perStage: Partial<Record<RequestStage, number>>;
  }

  const addStages = (into: Partial<Record<RequestStage, number>>, from: Partial<Record<RequestStage, number>>) => {
    for (const [stage, hours] of Object.entries(from)) {
      const k = stage as RequestStage;
      into[k] = (into[k] ?? 0) + (hours ?? 0);
    }
  };

  // Only the selected type, so each column means one thing.
  const forType = useMemo(
    () => completed.filter((c) => c.request.type === type),
    [completed, type],
  );

  const perPerson = useMemo<Agg[]>(() => {
    const m = new Map<string, Agg>();
    forType.forEach((c) => {
      const u = c.request.assigned_to ? usersById.get(c.request.assigned_to) : undefined;
      const key = u?.id ?? 'unassigned';
      const cur = m.get(key) ?? {
        key,
        name: u?.name ?? 'Unassigned',
        team: u?.team ?? 'Unassigned',
        designation: u?.designation ?? '—',
        role: u?.role ?? '—',
        count: 0, totalTat: 0, perStage: {},
      };
      cur.count += 1;
      cur.totalTat += c.tatHours;
      addStages(cur.perStage, c.perStage);
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [forType, usersById]);

  const perTeam = useMemo<Agg[]>(() => {
    const m = new Map<string, Agg>();
    forType.forEach((c) => {
      const u = c.request.assigned_to ? usersById.get(c.request.assigned_to) : undefined;
      const team = u?.team ?? 'Unassigned';
      const cur = m.get(team) ?? {
        key: team, name: team, team, designation: '—', role: '—',
        count: 0, totalTat: 0, perStage: {},
      };
      cur.count += 1;
      cur.totalTat += c.tatHours;
      addStages(cur.perStage, c.perStage);
      m.set(team, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [forType, usersById]);

  /** The stages this type actually passes through, in workflow order, minus
   *  the terminal one (which by definition has no duration). */
  const stageCols = useMemo<{ stage: RequestStage; label: string }[]>(
    () => getTATCategoriesForType(type)
      .filter((c) => c.days > 0)
      .map((c) => ({ stage: c.stage, label: c.description })),
    [type],
  );

  const totalCompleted = forType.length;
  const avgTat = totalCompleted
    ? (forType.reduce((s, c) => s + c.tatHours, 0) / totalCompleted).toFixed(1)
    : '—';
  const activePeople = perPerson.filter((p) => p.key !== 'unassigned').length;

  /** The single slowest stage across everything delivered this month — the
   *  one worth doing something about. */
  const slowestStage = useMemo(() => {
    const tally: Partial<Record<RequestStage, { hours: number; n: number }>> = {};
    forType.forEach((c) => {
      for (const [stage, hours] of Object.entries(c.perStage)) {
        const k = stage as RequestStage;
        const cur = tally[k] ?? { hours: 0, n: 0 };
        cur.hours += hours ?? 0;
        cur.n += 1;
        tally[k] = cur;
      }
    });
    const ranked = stageCols
      .map((col) => ({ ...col, avg: tally[col.stage] ? tally[col.stage]!.hours / tally[col.stage]!.n : 0 }))
      .filter((r) => r.avg > 0)
      .sort((a, b) => b.avg - a.avg);
    return ranked[0] ?? null;
  }, [forType, stageCols]);

  const renderTable = (rows: Agg[], firstCol: string, showPerson: boolean) => (
    <div className="gb-card p-0 overflow-x-auto">
      <table className="w-full text-[12.5px]" style={{ minWidth: 820 }}>
        <thead>
          <tr style={{ color: 'var(--text-faint)' }}>
            <th className="text-left py-2.5 px-4 font-semibold uppercase text-[10.5px] tracking-wide">{firstCol}</th>
            {showPerson && (
              <>
                {/* Divya asked to see what each person's role actually is,
                    not just their name against a number. */}
                <th className="text-left py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Role</th>
                <th className="text-left py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Team</th>
              </>
            )}
            <th className="text-right py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Done</th>
            <th className="text-right py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide"
                style={{ borderRight: '1px solid var(--border)' }}>Total</th>
            {stageCols.map((c) => (
              <th key={c.stage} className="text-right py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide"
                  title={c.stage}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-2.5 px-4" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</td>
              {showPerson && (
                <>
                  <td className="py-2.5 px-3" style={{ color: 'var(--text-secondary)' }}>{r.designation}</td>
                  <td className="py-2.5 px-3">{r.team}</td>
                </>
              )}
              <td className="py-2.5 px-3 text-right tabular-nums">{r.count}</td>
              <td className="py-2.5 px-3 text-right tabular-nums font-semibold"
                  style={{ borderRight: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {(r.totalTat / r.count).toFixed(1)}
              </td>
              {stageCols.map((c) => {
                const hrs = r.perStage[c.stage];
                return (
                  <td key={c.stage} className="py-2.5 px-3 text-right tabular-nums"
                      style={{ color: hrs ? 'var(--text-primary)' : 'var(--text-faint)' }}>
                    {hrs ? (hrs / r.count).toFixed(1) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Team Output &amp; TAT</h1>
          <p className="gb-page-description">Completed work and turnaround time per person and per team, from the live database.</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input-base"
        />
      </div>

      {loading && <p className="gb-page-description">Loading…</p>}
      {err && <p className="text-[12.5px]" style={{ color: 'var(--error)' }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* One type at a time — a video's shoot and edit have no counterpart
              in a graphics job, so the stage columns only mean something when
              the rows all follow the same workflow. */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`gb-btn ${type === t ? 'gb-btn-primary' : 'gb-btn-secondary'}`}
                style={{ padding: '5px 12px', fontSize: '12.5px' }}
              >
                {t}
              </button>
            ))}
          </div>

          <p className="text-[11.5px] mb-4" style={{ color: 'var(--text-faint)' }}>
            Every figure is active business hours ({BUSINESS_HOURS.startHour}:00–{BUSINESS_HOURS.endHour}:00, Mon–Fri).
            Each stage is counted on its own, so the shoot, the edit and the review are
            separate numbers rather than one lump — read across a row to see where a
            {' '}{type.toLowerCase()} actually spends its time.
          </p>

          {/* Stat strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: `${type} completed`, value: String(totalCompleted) },
              { label: 'Avg total (bus. hrs)', value: String(avgTat) },
              { label: 'Slowest stage',
                value: slowestStage ? `${slowestStage.label} · ${slowestStage.avg.toFixed(1)}h` : '—' },
              { label: 'Active people', value: String(activePeople) },
            ].map((s) => (
              <div key={s.label} className="gb-card p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
                  {s.label}
                </div>
                <div className="text-[22px] font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {totalCompleted === 0 ? (
            <div className="gb-card p-8 text-center" style={{ color: 'var(--text-faint)' }}>
              No completed work in this month yet.
            </div>
          ) : (
            <>
              <h2 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>By person</h2>
              <div className="mb-6">{renderTable(perPerson, 'Person', true)}</div>

              <h2 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>By team</h2>
              {renderTable(perTeam, 'Team', false)}
            </>
          )}
        </>
      )}
    </div>
  );
}

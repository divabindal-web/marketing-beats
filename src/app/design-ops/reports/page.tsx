'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { listDbUsers, DbUserRow } from '@/lib/work-api';
import { SLA_HOURS, BUSINESS_HOURS, calculateActiveTAT } from '@/lib/tat';
import { RequestType, StageTransition } from '@/types';

interface ReqRow {
  id: string; title: string; type: string; entity: string | null;
  assigned_to: string | null; current_stage: string;
}
interface TransitionRow {
  request_id: string; stage: string; transitioned_at: string;
}
interface CompletedItem {
  request: ReqRow;
  completedAt: string;
  /** Active business hours, pauses excluded — the same measure the dashboard
   *  and the request list already judge SLA by. */
  tatHours: number;
  withinSla: boolean;
}

const FINAL_STAGES = ['Done', 'Uploaded'];

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonthValue());
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
      // Was wall-clock elapsed between the first and last transition, which
      // counted nights, weekends and time spent waiting on the requestor. The
      // dashboard and the request list already score SLA on active business
      // hours, so this reported a different number for the same request.
      // Only the history up to delivery. Handing in transitions dated after
      // `final` alongside asOf=final would measure intervals that run
      // backwards, if a request were ever reopened after being completed.
      const upToDelivery = trs
        .filter((t) => t.transitioned_at <= final.transitioned_at)
        .map((t) => ({ to_stage: t.stage, transitioned_at: t.transitioned_at })) as StageTransition[];
      const tatHours = calculateActiveTAT(upToDelivery, final.transitioned_at);
      const sla = SLA_HOURS[r.type as RequestType];
      items.push({
        request: r,
        completedAt: final.transitioned_at,
        tatHours,
        withinSla: sla == null ? true : tatHours <= sla,
      });
    });
    return items;
  }, [requests, transitions, month]);

  const usersById = useMemo(() => {
    const m = new Map<string, DbUserRow>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  interface Agg { key: string; name: string; team: string; count: number; totalTat: number; withinSla: number; }

  const perPerson = useMemo<Agg[]>(() => {
    const m = new Map<string, Agg>();
    completed.forEach((c) => {
      const u = c.request.assigned_to ? usersById.get(c.request.assigned_to) : undefined;
      const key = u?.id ?? 'unassigned';
      const cur = m.get(key) ?? {
        key, name: u?.name ?? 'Unassigned', team: u?.team ?? 'Unassigned', count: 0, totalTat: 0, withinSla: 0,
      };
      cur.count += 1;
      cur.totalTat += c.tatHours;
      if (c.withinSla) cur.withinSla += 1;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [completed, usersById]);

  const perTeam = useMemo<Agg[]>(() => {
    const m = new Map<string, Agg>();
    completed.forEach((c) => {
      const u = c.request.assigned_to ? usersById.get(c.request.assigned_to) : undefined;
      const team = u?.team ?? 'Unassigned';
      const cur = m.get(team) ?? { key: team, name: team, team, count: 0, totalTat: 0, withinSla: 0 };
      cur.count += 1;
      cur.totalTat += c.tatHours;
      if (c.withinSla) cur.withinSla += 1;
      m.set(team, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [completed, usersById]);

  const totalCompleted = completed.length;
  const avgTat = totalCompleted
    ? (completed.reduce((s, c) => s + c.tatHours, 0) / totalCompleted).toFixed(1)
    : '—';
  const slaMet = completed.filter((c) => c.withinSla).length;
  const slaPct = totalCompleted ? Math.round((slaMet / totalCompleted) * 100) : null;
  const activePeople = perPerson.filter((p) => p.key !== 'unassigned').length;

  const renderTable = (rows: Agg[], firstCol: string, showTeam: boolean) => (
    <div className="gb-card p-0 overflow-hidden">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr style={{ color: 'var(--text-faint)' }}>
            <th className="text-left py-2.5 px-4 font-semibold uppercase text-[10.5px] tracking-wide">{firstCol}</th>
            {showTeam && (
              <th className="text-left py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Team</th>
            )}
            <th className="text-right py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Completed</th>
            <th className="text-right py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Avg TAT (bus. hrs)</th>
            <th className="text-right py-2.5 px-4 font-semibold uppercase text-[10.5px] tracking-wide">Within SLA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-2.5 px-4" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</td>
              {showTeam && <td className="py-2.5 px-3">{r.team}</td>}
              <td className="py-2.5 px-3 text-right">{r.count}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{(r.totalTat / r.count).toFixed(1)}</td>
              <td className="py-2.5 px-4 text-right tabular-nums"
                  style={{ color: r.withinSla === r.count ? 'var(--success)'
                          : r.withinSla / r.count < 0.5 ? 'var(--error)' : 'var(--text-primary)' }}>
                {r.withinSla}/{r.count} · {Math.round((r.withinSla / r.count) * 100)}%
              </td>
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
          <p className="text-[11.5px] mb-4" style={{ color: 'var(--text-faint)' }}>
            TAT counts active business hours only ({BUSINESS_HOURS.startHour}:00–{BUSINESS_HOURS.endHour}:00, Mon–Fri),
            excluding time parked in Content, Change Req or Shooting Scheduled.
            SLA: Graphics {SLA_HOURS.Graphics}h · Social Media Graphics {SLA_HOURS['Social Media Graphics']}h · Video {SLA_HOURS.Video}h.
          </p>

          {/* Stat strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total completed', value: String(totalCompleted) },
              { label: 'Avg TAT (bus. hrs)', value: String(avgTat) },
              // The point of the page: a TAT figure means nothing without the
              // target beside it. SLA_HOURS already existed and was already
              // used per-request; it just never reached the manager's view.
              { label: 'Within SLA', value: slaPct == null ? '—' : `${slaPct}%` },
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

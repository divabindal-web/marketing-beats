'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { listDbUsers, DbUserRow } from '@/lib/work-api';

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
  tatDays: number;
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
      const tatMs = new Date(final.transitioned_at).getTime() - new Date(trs[0].transitioned_at).getTime();
      items.push({
        request: r,
        completedAt: final.transitioned_at,
        tatDays: Math.round((tatMs / 86400000) * 10) / 10,
      });
    });
    return items;
  }, [requests, transitions, month]);

  const usersById = useMemo(() => {
    const m = new Map<string, DbUserRow>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  interface Agg { key: string; name: string; team: string; count: number; totalTat: number; }

  const perPerson = useMemo<Agg[]>(() => {
    const m = new Map<string, Agg>();
    completed.forEach((c) => {
      const u = c.request.assigned_to ? usersById.get(c.request.assigned_to) : undefined;
      const key = u?.id ?? 'unassigned';
      const cur = m.get(key) ?? {
        key, name: u?.name ?? 'Unassigned', team: u?.team ?? 'Unassigned', count: 0, totalTat: 0,
      };
      cur.count += 1;
      cur.totalTat += c.tatDays;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [completed, usersById]);

  const perTeam = useMemo<Agg[]>(() => {
    const m = new Map<string, Agg>();
    completed.forEach((c) => {
      const u = c.request.assigned_to ? usersById.get(c.request.assigned_to) : undefined;
      const team = u?.team ?? 'Unassigned';
      const cur = m.get(team) ?? { key: team, name: team, team, count: 0, totalTat: 0 };
      cur.count += 1;
      cur.totalTat += c.tatDays;
      m.set(team, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [completed, usersById]);

  const totalCompleted = completed.length;
  const avgTat = totalCompleted
    ? (completed.reduce((s, c) => s + c.tatDays, 0) / totalCompleted).toFixed(1)
    : '—';
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
            <th className="text-right py-2.5 px-4 font-semibold uppercase text-[10.5px] tracking-wide">Avg TAT (days)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-2.5 px-4" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</td>
              {showTeam && <td className="py-2.5 px-3">{r.team}</td>}
              <td className="py-2.5 px-3 text-right">{r.count}</td>
              <td className="py-2.5 px-4 text-right">{(r.totalTat / r.count).toFixed(1)}</td>
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
          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total completed', value: String(totalCompleted) },
              { label: 'Avg TAT (days)', value: String(avgTat) },
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

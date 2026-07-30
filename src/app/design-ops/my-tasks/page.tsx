'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { currentDbUser } from '@/lib/work-api';
import { useRequestsRealtime } from '@/lib/use-requests-realtime';
import { useViewAs } from '@/components/layout/ViewAsContext';

interface Row {
  id: string; title: string; type: string; entity: string | null;
  current_stage: string; need_by: string | null; requestor_name: string;
}

const FINAL_STAGES = ['Done', 'Uploaded'];
type Tab = 'upcoming' | 'overdue' | 'completed';

export default function MyTasksPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const { target } = useViewAs();
  const load = useCallback(async () => {
    try {
      const me = await currentDbUser();
      // When a lead/admin is "viewing as" a member, show that member's tasks.
      const effId = target?.id ?? me?.id;
      if (!effId) { setErr('Your login is not linked to a team member record.'); setLoading(false); return; }
      // "Mine" = owned (assigned_to) OR a point of contact (social / video /
      // design POC). Any of these should surface here.
      const { data, error } = await supabase
        .from('requests')
        .select('id, title, type, entity, current_stage, need_by, requestor_name')
        .or(`assigned_to.eq.${effId},social_poc.eq.${effId},video_poc.eq.${effId},design_poc.eq.${effId}`)
        .order('need_by', { ascending: true });
      if (error) throw error;
      setRows((data as Row[]) ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [target]);
  // Load on mount, and live-refresh when anyone changes a request or stage.
  useEffect(() => { load(); }, [load]);
  useRequestsRealtime(load);

  const today = new Date().toISOString().slice(0, 10);
  const buckets = useMemo(() => ({
    upcoming: rows.filter((r) => !FINAL_STAGES.includes(r.current_stage) && (!r.need_by || r.need_by >= today)),
    overdue: rows.filter((r) => !FINAL_STAGES.includes(r.current_stage) && r.need_by != null && r.need_by < today),
    completed: rows.filter((r) => FINAL_STAGES.includes(r.current_stage)),
  }), [rows, today]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'upcoming', label: `Upcoming (${buckets.upcoming.length})`, icon: <CalendarClock size={14} /> },
    { key: 'overdue', label: `Overdue (${buckets.overdue.length})`, icon: <AlertTriangle size={14} /> },
    { key: 'completed', label: `Completed (${buckets.completed.length})`, icon: <CheckCircle2 size={14} /> },
  ];

  const list = buckets[tab];

  return (
    <div>
      <div className="gb-page-header">
        <h1 className="gb-page-title">My Tasks</h1>
        <p className="gb-page-description">Everything assigned to you or where you&apos;re a point of contact, from the live database.</p>
      </div>

      <div className="gb-tabs mb-5">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`gb-tab ${tab === t.key ? 'gb-tab-active' : ''}`}>
            <span className="inline-flex items-center gap-1.5">{t.icon}{t.label}</span>
          </button>
        ))}
      </div>

      {loading && <p className="gb-page-description">Loading…</p>}
      {err && <p className="text-[12.5px]" style={{ color: 'var(--error)' }}>{err}</p>}
      {!loading && !err && list.length === 0 && (
        <div className="gb-card p-8 text-center" style={{ color: 'var(--text-faint)' }}>
          Nothing here. {tab === 'overdue' ? 'No overdue work — good.' : tab === 'upcoming' ? 'You have no open assignments.' : 'No completed work yet.'}
        </div>
      )}

      {list.length > 0 && (
        <div className="gb-card p-0 overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr style={{ color: 'var(--text-faint)' }}>
                <th className="text-left py-2.5 px-4 font-semibold uppercase text-[10.5px] tracking-wide">Task</th>
                <th className="text-left py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Type</th>
                <th className="text-left py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Entity</th>
                <th className="text-left py-2.5 px-3 font-semibold uppercase text-[10.5px] tracking-wide">Stage</th>
                <th className="text-right py-2.5 px-4 font-semibold uppercase text-[10.5px] tracking-wide">Due</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const late = tab !== 'completed' && r.need_by != null && r.need_by < today;
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2.5 px-4">
                      <Link href="/design-ops/requests" className="hover:underline" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {r.title}
                      </Link>
                      <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>from {r.requestor_name}</div>
                    </td>
                    <td className="py-2.5 px-3">{r.type}</td>
                    <td className="py-2.5 px-3">{r.entity ?? '—'}</td>
                    <td className="py-2.5 px-3">{r.current_stage}</td>
                    <td className="py-2.5 px-4 text-right" style={late ? { color: 'var(--error)', fontWeight: 600 } : undefined}>
                      {r.need_by ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

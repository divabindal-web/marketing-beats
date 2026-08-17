'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, AlertTriangle, CheckCircle2, ChevronRight, Inbox } from 'lucide-react';
import { Request } from '@/types';
import { fetchRequests, updateRequest } from '@/lib/requests-api';
import { formatDate, getDaysUntilDue } from '@/lib/sample-data';
import { useDirectory } from '@/lib/directory';
import { useRequestsRealtime } from '@/lib/use-requests-realtime';
import { useCurrentUser } from '@/components/layout/CurrentUserContext';
import { useViewAs } from '@/components/layout/ViewAsContext';
import DetailPanel from '@/components/design-ops/DetailPanel';

const FINAL_STAGES = ['Done', 'Uploaded'];
type Tab = 'upcoming' | 'overdue' | 'completed';

const stagePill = (stage: string, overdue: boolean): string => {
  if (FINAL_STAGES.includes(stage)) return 'gb-badge-green';
  if (overdue) return 'gb-badge-red';
  if (stage === 'Change Req') return 'gb-badge-yellow';
  return 'gb-badge-blue';
};

export default function MyTasksPage() {
  const { currentUser } = useCurrentUser();
  const directory = useDirectory();
  const { target } = useViewAs();
  const [requests, setRequests] = useState<Request[]>([]);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<Request | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Effective identity (view-as aware), in both id spaces so it matches how
  // fetchRequests keys people (sample slug for known users, DB uuid otherwise).
  const effectiveIds = useMemo(
    () => (target
      ? ([target.id, target.sampleId].filter(Boolean) as string[])
      : (currentUser?.id ? [currentUser.id] : [])),
    [target, currentUser],
  );

  const load = useCallback(() => {
    fetchRequests()
      .then((all) => { setRequests(all); setErr(''); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useRequestsRealtime(load);

  // "Mine" = owned (assigned_to) OR a point of contact (social/video/design).
  const mine = useMemo(
    () => (effectiveIds.length
      ? requests.filter((r) => effectiveIds.some((id) =>
          id === r.assigned_to || id === r.social_poc || id === r.video_poc || id === r.design_poc))
      : []),
    [requests, effectiveIds],
  );

  const today = new Date().toISOString().slice(0, 10);
  const buckets = useMemo(() => ({
    upcoming: mine.filter((r) => !FINAL_STAGES.includes(r.current_stage) && (!r.need_by || r.need_by >= today)),
    overdue: mine.filter((r) => !FINAL_STAGES.includes(r.current_stage) && r.need_by != null && r.need_by < today),
    completed: mine.filter((r) => FINAL_STAGES.includes(r.current_stage)),
  }), [mine, today]);

  const openTask = (r: Request) => { setSelected(r); setPanelOpen(true); };
  const handleUpdate = (updated: Request) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelected(updated);
    updateRequest(updated).catch((e) => alert('Could not save the change: ' + (e?.message ?? String(e))));
  };
  const handleDelete = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);
    setPanelOpen(false);
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; tone: string }[] = [
    { key: 'upcoming', label: 'Upcoming', icon: <CalendarClock size={14} />, tone: 'var(--accent-text)' },
    { key: 'overdue', label: 'Overdue', icon: <AlertTriangle size={14} />, tone: 'var(--error)' },
    { key: 'completed', label: 'Completed', icon: <CheckCircle2 size={14} />, tone: 'var(--success)' },
  ];

  const list = buckets[tab];
  const notLinked = !loading && !err && effectiveIds.length === 0;

  return (
    <div>
      <div className="gb-page-header">
        <h1 className="gb-page-title">My Tasks</h1>
        <p className="gb-page-description">
          {target ? `Viewing ${target.name}'s tasks` : 'Everything assigned to you or where you’re a point of contact'} — click any task to open and update it.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-6 mb-stagger">
        {tabs.map((t) => {
          const count = buckets[t.key].length;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="gb-card gb-card-hover p-4 text-left"
              style={isActive ? { borderColor: 'var(--border-strong)', boxShadow: 'var(--shadow-sm)' } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: t.tone }}>
                  {t.icon}{t.label}
                </span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--brand)' }} />}
              </div>
              <div className="mt-2 text-[28px] font-semibold leading-none" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="gb-card p-0 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: i ? '1px solid var(--border-light)' : undefined }}>
              <div className="mb-skeleton w-1.5 h-9 rounded-full" />
              <div className="flex-1">
                <div className="mb-skeleton h-3 rounded" style={{ width: '40%' }} />
                <div className="mb-skeleton h-2.5 rounded mt-2" style={{ width: '25%' }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {err && <p className="text-[12.5px]" style={{ color: 'var(--error)' }}>{err}</p>}
      {notLinked && (
        <div className="gb-card p-8 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
          Your login isn&apos;t linked to a team member record yet.
        </div>
      )}

      {!loading && !err && !notLinked && list.length === 0 && (
        <div className="gb-card p-12 text-center mb-fade-in">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-faint)' }}>
            <Inbox size={22} />
          </div>
          <p className="text-[13.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            {tab === 'overdue' ? 'Nothing overdue — nicely done.' : tab === 'upcoming' ? 'No open assignments right now.' : 'No completed work yet.'}
          </p>
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="gb-card p-0 overflow-hidden mb-stagger">
          {list.map((r, i) => {
            const late = tab !== 'completed' && r.need_by != null && r.need_by < today;
            const done = FINAL_STAGES.includes(r.current_stage);
            const accent = done ? 'var(--success)' : late ? 'var(--error)' : 'var(--brand)';
            const daysOver = late ? Math.abs(getDaysUntilDue(r.need_by)) : 0;
            return (
              <button
                key={r.id}
                onClick={() => openTask(r)}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors group hover:bg-[var(--bg-hover)]"
                style={{ borderTop: i ? '1px solid var(--border-light)' : undefined }}
              >
                <span className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {r.title}
                  </div>
                  <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>
                    {r.type}{r.entity ? ` · ${r.entity}` : ''} · from {r.requestor_name}
                  </div>
                </div>
                <span className={`gb-badge ${stagePill(r.current_stage, late)} flex-shrink-0`}>{r.current_stage}</span>
                <div className="text-right flex-shrink-0" style={{ width: 96 }}>
                  <div className="text-[12px] font-medium" style={{ color: late ? 'var(--error)' : 'var(--text-secondary)' }}>
                    {r.need_by ? formatDate(r.need_by) : '—'}
                  </div>
                  {late && <div className="text-[10px] font-semibold" style={{ color: 'var(--error)' }}>{daysOver}d overdue</div>}
                </div>
                <ChevronRight size={16} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-faint)' }} />
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <DetailPanel
          request={selected}
          users={directory}
          isOpen={panelOpen}
          onClose={() => { setPanelOpen(false); setSelected(null); }}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

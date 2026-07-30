'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { fetchRequests, createRequest, updateRequest } from '@/lib/requests-api';
import { useRequestsRealtime } from '@/lib/use-requests-realtime';
import Link from 'next/link';
import {
  Plus,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Activity,
  ArrowRight,
  AlertTriangle,
  UserX,
  Repeat,
} from 'lucide-react';
import {
  SAMPLE_USERS,
  SAMPLE_REQUESTS,
  getUserById,
  getStagesForType,
  isFinal,
  isOverdue,
  getInitials,
  formatDate,
  getDaysUntilDue,
} from '@/lib/sample-data';
import { Request, RequestType } from '@/types';
import {
  getDeliveryTAT,
  getStageBreakdown,
  calculateActiveTAT,
  formatBusinessHours,
  SLA_HOURS,
} from '@/lib/tat';
import RequestModal from '@/components/design-ops/RequestModal';
import DetailPanel from '@/components/design-ops/DetailPanel';
import { useRole } from '@/components/layout/RoleContext';
import { useCurrentUser } from '@/components/layout/CurrentUserContext';
import { useViewAs } from '@/components/layout/ViewAsContext';
import { currentDbUser } from '@/lib/work-api';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

// Team roster — anyone who can have work assigned to them shows up in the
// manager's workload table. We derive this from SAMPLE_USERS so new joiners
// show up automatically.
const MAKER_IDS = SAMPLE_USERS.filter((u) => u.is_active).map((u) => u.id);

export default function DashboardPage() {
  const { role } = useRole();
  const { currentUser } = useCurrentUser();
  const { target: viewAsTarget } = useViewAs();
  const [requests, setRequests] = useState<Request[]>(SAMPLE_REQUESTS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Effective identity for the personal view: the "view as" member when a
  // lead/admin has one selected, else the signed-in user. Both id spaces
  // (sample id + DB uuid) are included so the filter matches either.
  const effectiveIds = viewAsTarget
    ? ([viewAsTarget.id, viewAsTarget.sampleId].filter(Boolean) as string[])
    : (currentUser?.id ? [currentUser.id] : []);
  const effectiveName = viewAsTarget?.name ?? currentUser?.name ?? null;

  // Load persisted requests from Supabase on mount, and again whenever anyone
  // changes a request or moves a stage (live updates across all users).
  const loadRequests = useCallback(() => {
    fetchRequests()
      .then(setRequests)
      .catch((err) => console.error('Failed to load requests:', err));
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);
  useRequestsRealtime(loadRequests);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Lead scoping: a team lead's manager view shows only their team's work.
  // Divya (admin) sees everything. The scope set holds both DB uuids and the
  // matching sample ids so it works whichever id space a request row uses.
  const [teamScope, setTeamScope] = useState<Set<string> | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const me = await currentDbUser();
        if (!me || !me.is_lead || me.role === 'admin' || !me.team) return;
        const { data } = await supabase.from('users').select('id, email').eq('team', me.team);
        const ids = new Set<string>();
        (data ?? []).forEach((u: { id: string; email: string | null }) => {
          ids.add(u.id);
          const s = SAMPLE_USERS.find(
            (su) => (su.email ?? '').toLowerCase() === (u.email ?? '').toLowerCase(),
          );
          if (s) ids.add(s.id);
        });
        setTeamScope(ids);
        setTeamName(me.team);
      } catch { /* fall back to unscoped */ }
    })();
  }, []);

  const managerRequests = useMemo(() => {
    if (!teamScope) return requests;
    return requests.filter(
      (r) =>
        (r.assigned_to && teamScope.has(r.assigned_to)) ||
        (r.requestor_id && teamScope.has(r.requestor_id)),
    );
  }, [requests, teamScope]);

  const handleSaveRequest = (newRequest: Partial<Request>) => {
    const id = 'req-' + Math.random().toString(36).substr(2, 9);
    const nowIso = new Date().toISOString();
    const firstStage = newRequest.current_stage || 'Assigned';
    const fullRequest: Request = {
      id,
      type: newRequest.type || 'Graphics',
      requested_by: newRequest.requested_by || 'Social Team',
      title: newRequest.title || '',
      description: newRequest.description,
      requestor_name: newRequest.requestor_name || '',
      requestor_id: newRequest.requestor_id,
      need_by: newRequest.need_by || '',
      reference_link: newRequest.reference_link,
      current_stage: firstStage,
      assigned_to: newRequest.assigned_to,
      social_poc: newRequest.social_poc,
      video_poc: newRequest.video_poc,
      design_poc: newRequest.design_poc,
      shoot_date: newRequest.shoot_date,
      revisions: newRequest.revisions || 0,
      created_at: newRequest.created_at || nowIso,
      updated_at: newRequest.updated_at || nowIso,
      transitions: newRequest.transitions ?? [{
        id: `tr-${id}-0`, request_id: id, from_stage: null, to_stage: firstStage,
        transitioned_at: nowIso, transitioned_by: newRequest.requestor_id || 'user-divya-krishnan',
      }],
      stage_timestamps: newRequest.stage_timestamps || { [firstStage]: nowIso },
    };
    setRequests([...requests, fullRequest]);
    setIsModalOpen(false);
    // Persist to Supabase; swap the temp row for the saved one (real id)
    createRequest(fullRequest)
      .then((saved) => setRequests((prev) => prev.map((r) => (r.id === id ? saved : r))))
      .catch((err) => alert('Could not save the request: ' + (err?.message ?? String(err))));
  };

  const handleUpdateRequest = (updated: Request) => {
    setRequests(requests.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRequest(updated);
    updateRequest(updated).catch((err) => alert('Could not save the change: ' + (err?.message ?? String(err))));
  };

  const handleOpenRequest = (request: Request) => {
    setSelectedRequest(request);
    setIsPanelOpen(true);
  };

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Design Operations</h1>
          <p className="gb-page-description">
            {role === 'individual'
              ? 'Your personal work queue — pending tasks, TAT alerts, and priorities.'
              : teamName
                ? `${teamName} team overview — performance, bottlenecks, and reassignment controls.`
                : 'Team overview — performance, bottlenecks, and reassignment controls.'}
          </p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="gb-btn gb-btn-primary">
          <Plus size={14} strokeWidth={2.25} />
          New Request
        </button>
      </div>

      {role === 'individual' ? (
        <IndividualDashboard
          requests={requests}
          onOpen={handleOpenRequest}
          currentUserIds={effectiveIds}
          currentUserName={effectiveName}
        />
      ) : (
        <ManagerDashboard requests={managerRequests} onOpen={handleOpenRequest} onUpdate={handleUpdateRequest} />
      )}

      <RequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveRequest} />
      {selectedRequest && (
        <DetailPanel
          request={selectedRequest}
          users={SAMPLE_USERS}
          isOpen={isPanelOpen}
          onClose={() => { setIsPanelOpen(false); setSelectedRequest(null); }}
          onUpdate={handleUpdateRequest}
          onDelete={(id) => { setRequests((prev) => prev.filter((r) => r.id !== id)); setSelectedRequest(null); setIsPanelOpen(false); }}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Individual Dashboard                                               */
/* ================================================================== */

function IndividualDashboard({
  requests,
  onOpen,
  currentUserIds,
  currentUserName,
}: {
  requests: Request[];
  onOpen: (r: Request) => void;
  currentUserIds: string[];
  currentUserName: string | null;
}) {
  const myRequests = useMemo(
    () => (currentUserIds.length
      ? requests.filter((r) =>
          currentUserIds.some((id) =>
            id === r.assigned_to ||
            id === r.social_poc ||
            id === r.video_poc ||
            id === r.design_poc))
      : []),
    [requests, currentUserIds],
  );

  const pending = myRequests.filter((r) => !isFinal(r));
  const completed = myRequests.filter((r) => isFinal(r));
  const overdue = pending.filter((r) => isOverdue(r));
  const breachingSLA = pending.filter((r) => {
    const active = calculateActiveTAT(r.transitions ?? []);
    const sla = SLA_HOURS[r.type];
    return active > sla * 0.8;
  });

  // Priority queue: overdue first, then closest-to-SLA first
  const priorityQueue = useMemo(() => {
    return [...pending].sort((a, b) => {
      const aOverdue = isOverdue(a) ? 0 : 1;
      const bOverdue = isOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      // Sort by how much of SLA is consumed (descending)
      const aRatio = calculateActiveTAT(a.transitions ?? []) / SLA_HOURS[a.type];
      const bRatio = calculateActiveTAT(b.transitions ?? []) / SLA_HOURS[b.type];
      return bRatio - aRatio;
    });
  }, [pending]);

  const userName = currentUserName ?? 'You';

  return (
    <>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {userName.split(' ')[0]}
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · here’s your workload at a glance
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 mb-stagger">
        <StatCard label="My pending" value={pending.length} icon={Clock} tone="brand" />
        <StatCard label="Completed" value={completed.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Overdue" value={overdue.length} icon={AlertCircle} tone={overdue.length > 0 ? 'error' : 'neutral'} />
        <StatCard label="Near SLA" value={breachingSLA.length} icon={AlertTriangle} tone={breachingSLA.length > 0 ? 'warning' : 'neutral'} />
      </div>

      {/* Priority work queue */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="gb-section-title" style={{ marginBottom: 0 }}>
            Priority queue
          </h2>
          <Link href="/design-ops/requests" className="text-[12px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
            View all <ArrowRight size={10} />
          </Link>
        </div>
        {priorityQueue.length === 0 ? (
          <EmptyState icon={CheckCircle2} text="Nothing pending — you're all caught up." />
        ) : (
          <div className="gb-card overflow-hidden">
            <table className="gb-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Stage</th>
                  <th>Need By</th>
                  <th style={{ textAlign: 'right' }}>TAT Used</th>
                  <th style={{ textAlign: 'right' }}>SLA %</th>
                </tr>
              </thead>
              <tbody>
                {priorityQueue.slice(0, 10).map((req) => {
                  const active = calculateActiveTAT(req.transitions ?? []);
                  const sla = SLA_HOURS[req.type];
                  const ratio = active / sla;
                  const pct = Math.round(ratio * 100);
                  const isOvd = isOverdue(req);
                  return (
                    <tr key={req.id} onClick={() => onOpen(req)} style={{ cursor: 'pointer', backgroundColor: isOvd ? 'var(--error-bg)' : 'transparent' }}>
                      <td style={{ fontWeight: 500, color: 'var(--accent)' }}>{req.title}</td>
                      <td><span className="gb-badge gb-badge-blue">{req.type === 'Social Media Graphics' ? 'SMG' : req.type}</span></td>
                      <td><span className={`gb-badge ${isOvd ? 'gb-badge-red' : 'gb-badge-blue'}`}>{req.current_stage}</span></td>
                      <td style={{ color: isOvd ? 'var(--error)' : 'var(--text-secondary)', fontWeight: 500 }}>
                        {formatDate(req.need_by)}
                        {isOvd && <span className="ml-1 text-[10px] font-bold" style={{ color: 'var(--error)' }}>OVERDUE</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}><span style={{ color: ratio > 1 ? 'var(--error)' : ratio > 0.8 ? 'var(--warning)' : 'var(--success)', fontWeight: 500 }}>{formatBusinessHours(active)}</span></td>
                      <td style={{ textAlign: 'right' }}><SLABar pct={pct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* TAT breaches */}
      {breachingSLA.length > 0 && (
        <section>
          <h2 className="gb-section-title flex items-center gap-1.5">
            <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
            Approaching / Exceeding SLA
          </h2>
          <div className="gb-card overflow-hidden">
            <table className="gb-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Stage</th>
                  <th style={{ textAlign: 'right' }}>TAT</th>
                  <th style={{ textAlign: 'right' }}>SLA limit</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {breachingSLA.map((req) => {
                  const active = calculateActiveTAT(req.transitions ?? []);
                  const sla = SLA_HOURS[req.type];
                  const pct = Math.round((active / sla) * 100);
                  return (
                    <tr key={req.id} onClick={() => onOpen(req)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500, color: 'var(--accent)' }}>{req.title}</td>
                      <td><span className="gb-badge gb-badge-yellow">{req.current_stage}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 500, color: pct > 100 ? 'var(--error)' : 'var(--warning)' }}>{formatBusinessHours(active)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-faint)' }}>{formatBusinessHours(sla)}</td>
                      <td style={{ textAlign: 'right' }}><SLABar pct={pct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/* ================================================================== */
/*  Manager Dashboard                                                  */
/* ================================================================== */

function ManagerDashboard({
  requests,
  onOpen,
  onUpdate,
}: {
  requests: Request[];
  onOpen: (r: Request) => void;
  onUpdate: (r: Request) => void;
}) {
  const totalRequests = requests.length;
  const completedRequests = requests.filter((r) => isFinal(r)).length;
  const activeRequests = requests.filter((r) => !isFinal(r)).length;
  const overdueRequests = requests.filter((r) => isOverdue(r)).length;
  const changeRequests = requests.filter((r) => r.current_stage === 'Change Req').length;

  const deliveredTATs = requests.map((r) => getDeliveryTAT(r.transitions, r.type)).filter((t): t is number => t !== null);
  const avgTAT = deliveredTATs.length ? Math.round((deliveredTATs.reduce((a, b) => a + b, 0) / deliveredTATs.length) * 10) / 10 : 0;

  // Per-member performance
  const memberPerf = useMemo(() => {
    return MAKER_IDS.map((uid) => {
      const user = getUserById(uid);
      const userReqs = requests.filter((r) => r.assigned_to === uid);
      const pending = userReqs.filter((r) => !isFinal(r));
      const completed = userReqs.filter((r) => isFinal(r));
      const overdueCount = pending.filter((r) => isOverdue(r)).length;
      const avgTat =
        completed.length > 0
          ? completed
              .map((r) => getDeliveryTAT(r.transitions, r.type))
              .filter((t): t is number => t !== null)
              .reduce((sum, t, _, arr) => sum + t / arr.length, 0)
          : 0;
      const breaching = pending.filter((r) => {
        const active = calculateActiveTAT(r.transitions ?? []);
        return active > SLA_HOURS[r.type];
      }).length;
      return {
        uid,
        name: user?.name ?? uid,
        total: userReqs.length,
        pending: pending.length,
        completed: completed.length,
        overdue: overdueCount,
        avgTat,
        breaching,
      };
    }).filter((m) => m.total > 0)
      .sort((a, b) => b.overdue - a.overdue || b.breaching - a.breaching);
  }, [requests]);

  const overdueList = requests.filter((r) => isOverdue(r)).sort((a, b) => new Date(a.need_by).getTime() - new Date(b.need_by).getTime()).slice(0, 8);
  const changeRequestsList = requests.filter((r) => r.current_stage === 'Change Req').slice(0, 5);

  // Who to watch (overdue or SLA breach)
  const watchList = memberPerf.filter((m) => m.overdue > 0 || m.breaching > 0);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 mb-stagger">
        <StatCard label="Total" value={totalRequests} icon={Activity} tone="brand" />
        <StatCard label="Completed" value={completedRequests} icon={CheckCircle2} tone="success" />
        <StatCard label="Active" value={activeRequests} icon={Clock} tone="neutral" />
        <StatCard label="Overdue" value={overdueRequests} icon={AlertCircle} tone={overdueRequests > 0 ? 'error' : 'neutral'} />
        <StatCard label="Avg TAT" value={`${avgTAT}h`} icon={TrendingUp} tone="brand" />
        <StatCard label="Change Req" value={changeRequests} icon={RefreshCw} tone={changeRequests > 0 ? 'warning' : 'neutral'} />
      </div>

      {/* Watch list — members with issues */}
      {watchList.length > 0 && (
        <section className="mb-8">
          <h2 className="gb-section-title flex items-center gap-1.5">
            <UserX size={14} style={{ color: 'var(--error)' }} />
            Needs attention
          </h2>
          <p className="text-[12px] mb-3" style={{ color: 'var(--text-faint)' }}>
            Team members with overdue requests or SLA breaches. Consider reassigning their workload.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {watchList.map((m) => (
              <div key={m.uid} className="gb-card p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>
                    {getInitials(m.name)}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{m.pending} pending · {m.completed} done</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.overdue > 0 && <span className="gb-badge gb-badge-red">{m.overdue} overdue</span>}
                  {m.breaching > 0 && <span className="gb-badge gb-badge-yellow">{m.breaching} SLA breach</span>}
                </div>
                {m.avgTat > 0 && (
                  <div className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
                    Avg delivery: {formatBusinessHours(m.avgTat)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team performance table */}
      <section className="mb-8">
        <h2 className="gb-section-title">Team workload</h2>
        <div className="gb-card overflow-hidden">
          <table className="gb-table">
            <thead>
              <tr>
                <th>Member</th>
                <th style={{ textAlign: 'right' }}>Pending</th>
                <th style={{ textAlign: 'right' }}>Completed</th>
                <th style={{ textAlign: 'right' }}>Overdue</th>
                <th style={{ textAlign: 'right' }}>SLA Breaches</th>
                <th style={{ textAlign: 'right' }}>Avg TAT</th>
              </tr>
            </thead>
            <tbody>
              {memberPerf.map((m) => (
                <tr key={m.uid}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                        style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>
                        {getInitials(m.name)}
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{m.pending}</td>
                  <td style={{ textAlign: 'right' }}>{m.completed}</td>
                  <td style={{ textAlign: 'right' }}>
                    {m.overdue > 0 ? <span className="gb-badge gb-badge-red">{m.overdue}</span> : <span style={{ color: 'var(--text-faint)' }}>0</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {m.breaching > 0 ? <span className="gb-badge gb-badge-yellow">{m.breaching}</span> : <span style={{ color: 'var(--text-faint)' }}>0</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {m.avgTat > 0 ? formatBusinessHours(m.avgTat) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two-column: Overdue + Change Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="gb-section-title">Overdue requests</h2>
          {overdueList.length > 0 ? (
            <div className="gb-card overflow-hidden">
              <table className="gb-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Assigned</th>
                    <th style={{ textAlign: 'right' }}>Days Over</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueList.map((req) => {
                    const daysOver = Math.abs(getDaysUntilDue(req.need_by));
                    const assignee = getUserById(req.assigned_to);
                    return (
                      <tr key={req.id} onClick={() => onOpen(req)} style={{ cursor: 'pointer' }}>
                        <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{req.title}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{assignee?.name ?? 'Unassigned'}</td>
                        <td style={{ textAlign: 'right' }}><span className="gb-badge gb-badge-red">{daysOver}d</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} text="Nothing overdue. Nice work." />
          )}
        </section>

        <section>
          <h2 className="gb-section-title">Change requests</h2>
          {changeRequestsList.length > 0 ? (
            <div className="gb-card overflow-hidden">
              <table className="gb-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Assigned</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {changeRequestsList.map((req) => {
                    const assignee = getUserById(req.assigned_to);
                    return (
                      <tr key={req.id} onClick={() => onOpen(req)} style={{ cursor: 'pointer' }}>
                        <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{req.title}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{assignee?.name ?? '—'}</td>
                        <td>{req.type.split(' ')[0]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} text="No active change requests." />
          )}
        </section>
      </div>
    </>
  );
}

/* ================================================================== */
/*  Shared components                                                  */
/* ================================================================== */

type Tone = 'brand' | 'success' | 'warning' | 'error' | 'neutral';
const TONES: Record<Tone, { fg: string; chip: string; bar: string }> = {
  brand:   { fg: 'var(--accent-text)', chip: 'var(--brand-soft)',   bar: 'var(--brand)' },
  success: { fg: 'var(--success)',     chip: 'var(--success-bg)',   bar: 'var(--success)' },
  warning: { fg: 'var(--warning)',     chip: 'var(--warning-bg)',   bar: 'var(--warning)' },
  error:   { fg: 'var(--error)',       chip: 'var(--error-bg)',     bar: 'var(--error)' },
  neutral: { fg: 'var(--text-muted)',  chip: 'var(--bg-tertiary)',  bar: 'var(--border-strong)' },
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  caption,
}: {
  label: string;
  value: number | string;
  icon: any;
  tone?: Tone;
  caption?: string;
}) {
  const t = TONES[tone];
  return (
    <div className="gb-stat-card gb-card-hover relative overflow-hidden">
      <span className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: t.bar }} />
      <div className="flex items-center justify-between mb-3">
        <div className="gb-stat-label" style={{ marginBottom: 0 }}>{label}</div>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: t.chip, color: t.fg }}>
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      <div className="gb-stat-value" style={tone === 'error' && value !== 0 ? { color: 'var(--error)' } : undefined}>
        {value}
      </div>
      {caption && <div className="gb-stat-delta">{caption}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="gb-card px-5 py-12 text-center mb-fade-in">
      <div className="w-11 h-11 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  );
}

function SLABar({ pct }: { pct: number }) {
  const color = pct > 100 ? 'var(--error)' : pct > 80 ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="inline-flex items-center gap-2 justify-end">
      <div className="w-16 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${color}, ${color})`, boxShadow: pct > 100 ? '0 0 6px var(--error)' : undefined }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

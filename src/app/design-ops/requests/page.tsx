'use client';

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchRequests, updateRequest } from '@/lib/requests-api';
import { useRequestsRealtime } from '@/lib/use-requests-realtime';
import { currentDbUser, userTeamByEmail, deleteRequestById } from '@/lib/work-api';
import { List, Columns3, CalendarDays, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Request, RequestType } from '@/types';
import {
  SAMPLE_REQUESTS,
  SAMPLE_USERS,
  getUserById,
  formatDate,
  getInitials,
  isOverdue,
  getDaysUntilDue,
  getStagesForType,
} from '@/lib/sample-data';
import {
  getDeliveryTAT,
  calculateActiveTAT,
  formatBusinessHours,
  SLA_HOURS,
} from '@/lib/tat';
import DetailPanel from '@/components/design-ops/DetailPanel';

type ViewType = 'list' | 'kanban' | 'calendar';
type SortField = 'need_by' | 'created_at' | null;

function AllRequestsPageInner() {
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<Request[]>(SAMPLE_REQUESTS);
  const [currentView, setCurrentView] = useState<ViewType>('list');

  // Load persisted requests from Supabase on mount, and live-refresh whenever
  // anyone changes a request or moves a stage.
  const loadRequests = useCallback(() => {
    fetchRequests()
      .then(setRequests)
      .catch((err) => console.error('Failed to load requests:', err));
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);
  useRequestsRealtime(loadRequests);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [typeFilters, setTypeFilters] = useState<RequestType[]>([]);
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('need_by');
  const [sortAscending, setSortAscending] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date('2026-04-01'));
  const [draggedRequest, setDraggedRequest] = useState<Request | null>(null);

  const handleOpenRequest = (req: Request) => {
    setSelectedRequest(req);
    setIsPanelOpen(true);
  };

  const handleUpdateRequest = (updated: Request) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRequest(updated);
    updateRequest(updated).catch((err) => alert('Could not save the change: ' + (err?.message ?? String(err))));
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedRequest(null);
  };

  const handleDeleteRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setSelectedRequest(null);
    setIsPanelOpen(false);
  };

  // Per-row delete in the list — leads/admins only (RLS enforces server-side too)
  const [me, setMe] = useState<{ role: string; team: string | null; is_lead: boolean } | null>(null);
  const [teamByEmail, setTeamByEmail] = useState<Map<string, string>>(new Map());
  const [pendingRowDelete, setPendingRowDelete] = useState<string | null>(null);
  const [rowDeleting, setRowDeleting] = useState(false);
  useEffect(() => {
    let alive = true;
    currentDbUser()
      .then((m) => { if (alive) setMe(m); })
      .catch(() => {});
    userTeamByEmail()
      .then((m) => { if (alive) setTeamByEmail(m); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const canManageReq = !!me && (me.is_lead || me.role === 'admin');

  // Mark-complete (moving to a final stage) is limited to the CMO or the lead of
  // the task's team (assignee's team). Mirrors the rule enforced in DetailPanel.
  const isFinalStage = (s: string) => s === 'Done' || s === 'Uploaded';
  const canCompleteReq = (req: Request) => {
    if (!me) return false;
    if (me.role === 'admin') return true;
    if (!me.is_lead) return false;
    const assignee = SAMPLE_USERS.find((u) => u.id === req.assigned_to);
    const team = assignee?.email ? teamByEmail.get(assignee.email.toLowerCase()) ?? null : null;
    return !team || team === me.team;
  };

  const handleRowDelete = async (id: string) => {
    if (rowDeleting) return;
    setRowDeleting(true);
    try {
      await deleteRequestById(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete this request.');
    } finally {
      setRowDeleting(false);
      setPendingRowDelete(null);
    }
  };

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let filtered = requests.filter(req => {
      const matchesSearch =
        req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.requestor_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilters.length === 0 || typeFilters.includes(req.type);
      const matchesStage = stageFilters.length === 0 || stageFilters.includes(req.current_stage);

      return matchesSearch && matchesType && matchesStage;
    });

    if (sortField) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortField as keyof Request];
        let bVal: any = b[sortField as keyof Request];
        if (!aVal || !bVal) return 0;
        if (sortField === 'need_by' || sortField === 'created_at') {
          aVal = new Date(aVal as string).getTime();
          bVal = new Date(bVal as string).getTime();
        }
        if (aVal < bVal) return sortAscending ? -1 : 1;
        if (aVal > bVal) return sortAscending ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [requests, searchQuery, typeFilters, stageFilters, sortField, sortAscending]);

  const allStages = useMemo(() => {
    const stages = new Set<string>();
    requests.forEach(req => stages.add(req.current_stage));
    return Array.from(stages).sort();
  }, [requests]);

  const kanbanStages = useMemo(() => {
    const stagesWithRequests = new Set<string>();
    filteredRequests.forEach(req => stagesWithRequests.add(req.current_stage));
    return Array.from(stagesWithRequests).sort();
  }, [filteredRequests]);

  const typeColors: Record<RequestType, { badge: string; dot: string }> = {
    Video: { badge: 'gb-badge-blue', dot: 'var(--info)' },
    'Social Media Graphics': { badge: 'gb-badge-green', dot: 'var(--success)' },
    Graphics: { badge: 'gb-badge-yellow', dot: 'var(--warning)' }
  };

  const stageBadgeClasses: Record<string, string> = {
    'Done': 'gb-badge-green', 'Uploaded': 'gb-badge-green',
    'Change Req': 'gb-badge-red', 'Assigned': 'gb-badge-blue',
    'Ready to Upload': 'gb-badge-yellow', 'Design Done': 'gb-badge-yellow',
    'Editing Done': 'gb-badge-yellow', 'Shoot Done': 'gb-badge-yellow',
    'Design In Progress': 'gb-badge-blue', 'Editing In Progress': 'gb-badge-blue',
    'Content': 'gb-badge-blue', 'Planning': 'gb-badge-blue',
    'Shooting Scheduled': 'gb-badge-blue'
  };

  const toggleTypeFilter = (type: RequestType) =>
    setTypeFilters(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  const toggleStageFilter = (stage: string) =>
    setStageFilters(prev => prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAscending(!sortAscending);
    else { setSortField(field); setSortAscending(true); }
  };

  const handleDragStart = (e: React.DragEvent, request: Request) => {
    setDraggedRequest(request);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    if (draggedRequest && isFinalStage(newStage) && !canCompleteReq(draggedRequest)) {
      alert('Only the team lead or CMO can mark a task complete.');
      setDraggedRequest(null);
      return;
    }
    if (draggedRequest && newStage !== draggedRequest.current_stage) {
      const nowIso = new Date().toISOString();
      const updated: Request = {
        ...draggedRequest,
        current_stage: newStage as Request['current_stage'],
        updated_at: nowIso,
        transitions: [
          ...(draggedRequest.transitions ?? []),
          {
            id: `tr-${draggedRequest.id}-${Date.now()}`,
            request_id: draggedRequest.id,
            from_stage: draggedRequest.current_stage,
            to_stage: newStage as Request['current_stage'],
            transitioned_at: nowIso,
            transitioned_by: draggedRequest.assigned_to ?? 'user-divya-krishnan',
          },
        ],
      };
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      updateRequest(updated).catch((err) => alert('Could not save the change: ' + (err?.message ?? String(err))));
    }
    setDraggedRequest(null);
  };

  /* ---- Quick inline stage change on list view ---- */
  const handleInlineStageChange = (req: Request, newStage: string) => {
    if (newStage === req.current_stage) return;
    if (isFinalStage(newStage) && !canCompleteReq(req)) {
      alert('Only the team lead or CMO can mark a task complete.');
      return;
    }
    const nowIso = new Date().toISOString();
    const updated: Request = {
      ...req,
      current_stage: newStage as Request['current_stage'],
      updated_at: nowIso,
      transitions: [
        ...(req.transitions ?? []),
        {
          id: `tr-${req.id}-${Date.now()}`,
          request_id: req.id,
          from_stage: req.current_stage,
          to_stage: newStage as Request['current_stage'],
          transitioned_at: nowIso,
          transitioned_by: req.assigned_to ?? 'user-divya-krishnan',
        },
      ],
    };
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    updateRequest(updated).catch((err) => alert('Could not save the change: ' + (err?.message ?? String(err))));
  };

  const requestsByDate = useMemo(() => {
    const map: Record<string, Request[]> = {};
    filteredRequests.forEach(req => {
      if (!map[req.need_by]) map[req.need_by] = [];
      map[req.need_by].push(req);
    });
    return map;
  }, [filteredRequests]);

  const renderListView = () => (
    <div className="gb-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="gb-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Requestor</th>
              <th>Stage</th>
              <th>Assigned To</th>
              <th onClick={() => handleSort('need_by')} style={{ cursor: 'pointer' }}>
                Need By {sortField === 'need_by' && (sortAscending ? '↑' : '↓')}
              </th>
              <th>TAT</th>
              {canManageReq && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map(req => {
              const assignee = getUserById(req.assigned_to);
              const isRowOverdue = isOverdue(req);
              const stages = getStagesForType(req.type);
              return (
                <tr key={req.id} style={{ backgroundColor: isRowOverdue ? 'var(--error-bg)' : 'transparent' }}>
                  <td
                    style={{ fontWeight: 500, color: 'var(--accent)', cursor: 'pointer' }}
                    onClick={() => handleOpenRequest(req)}
                  >
                    {req.title}
                  </td>
                  <td>
                    <span className={`gb-badge ${typeColors[req.type].badge}`}>
                      {req.type === 'Social Media Graphics' ? 'SMG' : req.type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{req.requestor_name}</td>
                  <td>
                    <select
                      value={req.current_stage}
                      onChange={(e) => handleInlineStageChange(req, e.target.value)}
                      className="input-base text-[11px] py-0.5 px-1.5"
                      style={{ minWidth: '120px' }}
                    >
                      {stages.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {assignee ? assignee.name : 'Unassigned'}
                  </td>
                  <td style={{ fontWeight: 500, color: isRowOverdue ? 'var(--error)' : 'var(--text-secondary)' }}>
                    {formatDate(req.need_by)}
                    {isRowOverdue && <span style={{ marginLeft: '6px', fontWeight: 'bold', color: 'var(--error)', fontSize: '10px' }}>OVERDUE</span>}
                  </td>
                  <td>
                    {(() => {
                      const delivered = getDeliveryTAT(req.transitions ?? [], req.type);
                      const active = delivered ?? calculateActiveTAT(req.transitions ?? []);
                      const sla = SLA_HOURS[req.type];
                      const ratio = active / sla;
                      const color = ratio <= 0.8 ? 'var(--success)' : ratio <= 1.0 ? 'var(--warning)' : 'var(--error)';
                      return <span style={{ color, fontWeight: 500 }}>{formatBusinessHours(active)}</span>;
                    })()}
                  </td>
                  {canManageReq && (
                    <td>
                      {pendingRowDelete === req.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            className="gb-btn"
                            style={{ padding: '3px 8px', fontSize: '11.5px', backgroundColor: 'var(--error)', color: '#fff' }}
                            disabled={rowDeleting}
                            onClick={() => void handleRowDelete(req.id)}
                          >
                            {rowDeleting ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            className="gb-btn gb-btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11.5px' }}
                            onClick={() => setPendingRowDelete(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="gb-icon-btn"
                          title="Delete this request"
                          onClick={() => setPendingRowDelete(req.id)}
                        >
                          <Trash2 size={14} strokeWidth={1.75} style={{ color: 'var(--error)' }} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-tertiary)', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)' }}>
        {filteredRequests.length} of {requests.length} requests
      </div>
    </div>
  );

  const renderKanbanView = () => (
    <div className="overflow-x-auto">
      <div className="flex gap-4 pb-4 min-w-max">
        {kanbanStages.map(stage => {
          const stageRequests = filteredRequests.filter(r => r.current_stage === stage);
          return (
            <div key={stage} className="flex-shrink-0 w-72 gb-card" style={{ display: 'flex', flexDirection: 'column' }}
              onDragOver={handleDragOver} onDrop={e => handleDrop(e, stage)}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {stage}
                  <span className="gb-badge gb-badge-blue">{stageRequests.length}</span>
                </h3>
              </div>
              <div style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
                {stageRequests.map(req => {
                  const assignee = getUserById(req.assigned_to);
                  const daysUntilDue = getDaysUntilDue(req.need_by);
                  const isOverdueReq = daysUntilDue < 0;
                  return (
                    <div key={req.id} draggable onDragStart={e => handleDragStart(e, req)}
                      className="gb-card gb-card-hover" style={{ padding: '10px', cursor: 'move' }}
                      onClick={() => handleOpenRequest(req)}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`gb-badge ${typeColors[req.type].badge}`}>
                          {req.type === 'Social Media Graphics' ? 'SMG' : req.type}
                        </span>
                      </div>
                      <h4 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {req.title}
                      </h4>
                      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {assignee ? assignee.name.split(' ')[0] : 'Unassigned'}
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: isOverdueReq ? 'var(--error)' : 'var(--text-muted)' }}>
                          {isOverdueReq ? 'OVERDUE' : formatDate(req.need_by)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCalendarView = () => {
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    while (days.length % 7 !== 0) days.push(null);

    const todayStr = new Date().toISOString().split('T')[0];

    return (
      <div className="gb-card" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="gb-icon-btn"><ChevronLeft size={14} /></button>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="gb-icon-btn"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider py-1" style={{ color: 'var(--text-faint)' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} className="min-h-[70px] rounded-md" style={{ backgroundColor: 'var(--bg-secondary)', opacity: 0.4 }} />;
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayReqs = requestsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            return (
              <div key={day} className="min-h-[70px] rounded-md p-1.5" style={{
                border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                backgroundColor: isToday ? 'var(--accent-light)' : 'var(--bg-card)',
              }}>
                <div className="text-[11px] font-semibold mb-1" style={{ color: isToday ? 'var(--accent-text)' : 'var(--text-muted)' }}>{day}</div>
                {dayReqs.slice(0, 2).map(req => (
                  <div key={req.id} onClick={() => handleOpenRequest(req)}
                    className="text-[10px] px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-text)' }} title={req.title}>
                    {req.title}
                  </div>
                ))}
                {dayReqs.length > 2 && <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>+{dayReqs.length - 2}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">All Requests</h1>
          <p className="gb-page-description">Browse, filter, and manage every design request. Click any title to open the detail panel, or change the stage directly from the table.</p>
        </div>
        <div className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
          {filteredRequests.length} of {requests.length}
        </div>
      </div>

      <div className="gb-tabs" style={{ marginBottom: '20px' }}>
        {[
          { id: 'list' as const, icon: List, label: 'List' },
          { id: 'kanban' as const, icon: Columns3, label: 'Kanban' },
          { id: 'calendar' as const, icon: CalendarDays, label: 'Calendar' }
        ].map(view => {
          const Icon = view.icon;
          return (
            <div key={view.id} onClick={() => setCurrentView(view.id)}
              className={`gb-tab ${currentView === view.id ? 'gb-tab-active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Icon size={14} />{view.label}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '20px' }}>
        <div className="gb-search" style={{ marginBottom: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>&#128269;</span>
          <input type="text" placeholder="Search by title, ID, or requestor..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>Type:</span>
          {['All', 'Video', 'Social Media Graphics', 'Graphics'].map(type => {
            const isActive = type === 'All' ? typeFilters.length === 0 : typeFilters.includes(type as RequestType);
            return (
              <button key={type} onClick={() => type === 'All' ? setTypeFilters([]) : toggleTypeFilter(type as RequestType)}
                className={`gb-btn ${isActive ? 'gb-btn-primary' : 'gb-btn-secondary'}`}>{type === 'Social Media Graphics' ? 'SMG' : type}</button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text-faint)' }}>Stage:</span>
          <button onClick={() => setStageFilters([])} className={`gb-btn ${stageFilters.length === 0 ? 'gb-btn-primary' : 'gb-btn-secondary'}`}>All</button>
          {allStages.map(stage => (
            <button key={stage} onClick={() => toggleStageFilter(stage)}
              className={`gb-btn ${stageFilters.includes(stage) ? 'gb-btn-primary' : 'gb-btn-secondary'}`}>{stage}</button>
          ))}
        </div>
      </div>

      {currentView === 'list' && renderListView()}
      {currentView === 'kanban' && renderKanbanView()}
      {currentView === 'calendar' && renderCalendarView()}

      {/* Detail Panel */}
      {selectedRequest && (
        <DetailPanel
          request={selectedRequest}
          users={SAMPLE_USERS}
          isOpen={isPanelOpen}
          onClose={handleClosePanel}
          onUpdate={handleUpdateRequest}
          onDelete={handleDeleteRequest}
        />
      )}
    </div>
  );
}

export default function AllRequestsPage() {
  return (
    <Suspense fallback={null}>
      <AllRequestsPageInner />
    </Suspense>
  );
}

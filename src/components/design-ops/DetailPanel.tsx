'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, Circle, ChevronRight, ExternalLink, Link2, Trash2, Undo2, Pencil } from 'lucide-react';
import { Request, RequestLeg, StageTransition, getTATCategoriesForType } from '@/types';
import { getStagesForType, isOverdue } from '@/lib/sample-data';
import { DirectoryUser } from '@/lib/directory';
import { getLegTAT, getStageBreakdown, formatBusinessHours, isLegSLABreached } from '@/lib/tat';
import { fetchRequestById, markLegDone, reopenLeg } from '@/lib/requests-api';
import { supabase } from '@/lib/supabase';
import {
  CommentRow,
  listComments,
  addComment,
  currentDbUser,
  userTeamByEmail,
  deleteRequestById,
  MeRow,
} from '@/lib/work-api';

const UUID_RE = /^[0-9a-f-]{36}$/i;

function formatCommentDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

interface DetailPanelProps {
  request: Request;
  /** Live people directory (see src/lib/directory.ts), not the sample list. */
  users: DirectoryUser[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Request) => void;
  /** Called after the request is deleted from the DB so the parent list can drop it. */
  onDelete?: (id: string) => void;
}

export default function DetailPanel({ request, users, isOpen, onClose, onUpdate, onDelete }: DetailPanelProps) {
  const [uploadLinks, setUploadLinks] = useState({
    youtube_link: request.youtube_link || '',
    instagram_link: request.instagram_link || '',
    linkedin_link: request.linkedin_link || '',
    pinterest_link: request.pinterest_link || '',
  });

  const isDbRequest = UUID_RE.test(request.id);

  // Project summary (DB-backed "comments" table, only for real uuid requests)
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState('');

  // Leads/admins: can delete requests and reassign people. Members: read-only on
  // assignment (their lead assigns work to them), no delete.
  const [me, setMe] = useState<MeRow | null>(null);
  const [teamByEmail, setTeamByEmail] = useState<Map<string, string>>(new Map());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [stageError, setStageError] = useState('');

  // Per-stakeholder legs. Kept in local state so a mark-done reflects
  // immediately even before the realtime refetch reaches the parent page.
  const [legs, setLegs] = useState<RequestLeg[]>(request.legs ?? []);
  const [legBusy, setLegBusy] = useState<string | null>(null);
  const [legError, setLegError] = useState('');
  useEffect(() => {
    setLegs(request.legs ?? []);
    setLegError('');
  }, [request.id, request.legs]);

  useEffect(() => {
    let cancelled = false;
    currentDbUser()
      .then((m) => { if (!cancelled) setMe(m); })
      .catch(() => {});
    userTeamByEmail()
      .then((m) => { if (!cancelled) setTeamByEmail(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Team comes straight off the directory row; the email map is only a
  // fallback for anyone the directory hasn't loaded yet.
  const teamOf = (u?: DirectoryUser) =>
    u?.team ?? (u?.email ? teamByEmail.get(u.email.toLowerCase()) ?? null : null);

  const canDelete = !!me && (me.is_lead || me.role === 'admin');
  const canAssign = canDelete;

  const handleDeleteRequest = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteRequestById(request.id);
      onDelete?.(request.id);
      onClose();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete this request.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    setComments([]);
    setNewComment('');
    setCommentError('');
    setConfirmDelete(false);
    setDeleteError('');
    if (!UUID_RE.test(request.id)) return;
    let cancelled = false;
    listComments(request.id)
      .then((rows) => { if (!cancelled) setComments(rows); })
      .catch(() => { if (!cancelled) setCommentError('Could not load the project summary.'); });
    return () => { cancelled = true; };
  }, [request.id]);

  if (!isOpen) {
    return null;
  }

  const handleAddComment = async () => {
    const body = newComment.trim();
    if (!body) return;
    setCommentError('');
    setPosting(true);
    try {
      await addComment(request.id, body);
      setNewComment('');
      setComments(await listComments(request.id));
    } catch {
      setCommentError('Could not post the project summary.');
    } finally {
      setPosting(false);
    }
  };

  const stages = getStagesForType(request.type);
  const currentStageIndex = stages.indexOf(request.current_stage as any);
  const nextStage = currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1] : null;
  const isFinal = request.current_stage === 'Done' || request.current_stage === 'Uploaded';
  const isReadyToUpload = request.current_stage === 'Ready to Upload';

  // "Mark complete" = moving a task into a final stage. Restricted to the CMO
  // (admin) or the lead of the task's team (the assignee's team). Members and
  // leads of other teams cannot complete a task.
  const isFinalStage = (s: string) => s === 'Done' || s === 'Uploaded';
  const assigneeTeam = teamOf(users.find((u) => u.id === request.assigned_to));
  // Unknown assignee team used to mean "allow", which let any lead complete
  // another team's work. Now an unresolved team blocks instead of permitting.
  const canMarkComplete =
    !!me && (me.role === 'admin' || (me.is_lead && !!assigneeTeam && assigneeTeam === me.team));
  const completeBlockedMsg = 'Only the team lead or CMO can mark a task complete.';

  // POC dropdowns are scoped to the relevant team: Social POC -> Social team,
  // Design & Video POC -> Graphics & Video team. Any person already saved on the
  // request is kept in the list so an existing off-team value is never lost.
  const pocOptions = (team: string, currentId?: string) => {
    const list = users.filter((u) => teamOf(u) === team);
    if (currentId && !list.some((u) => u.id === currentId)) {
      const cur = users.find((u) => u.id === currentId);
      if (cur) return [cur, ...list];
    }
    return list;
  };

  const appendTransition = (toStage: Request['current_stage']): Request => {
    const nowIso = new Date().toISOString();
    const existing = request.transitions ?? [];
    const fromStage = existing.length
      ? existing[existing.length - 1].to_stage
      : request.current_stage;
    const transition: StageTransition = {
      id: `tr-${request.id}-${Date.now()}`,
      request_id: request.id,
      from_stage: fromStage,
      to_stage: toStage,
      transitioned_at: nowIso,
      transitioned_by: request.assigned_to ?? 'user-divya-krishnan',
    };
    return {
      ...request,
      current_stage: toStage,
      updated_at: nowIso,
      transitions: [...existing, transition],
    };
  };

  const handleStageChange = (newStage: string) => {
    if (newStage === request.current_stage) return;
    if (isFinalStage(newStage) && !canMarkComplete) { setStageError(completeBlockedMsg); return; }
    setStageError('');
    onUpdate(appendTransition(newStage as Request['current_stage']));
  };

  const handleAdvanceStage = () => {
    if (!nextStage) return;
    if (isFinalStage(nextStage) && !canMarkComplete) { setStageError(completeBlockedMsg); return; }
    setStageError('');
    onUpdate(appendTransition(nextStage as Request['current_stage']));
  };

  const handleMarkComplete = () => {
    if (!canMarkComplete) { setStageError(completeBlockedMsg); return; }
    setStageError('');
    const finalStage = stages[stages.length - 1];
    onUpdate(appendTransition(finalStage as Request['current_stage']));
  };

  const handleFieldChange = (field: string, value: string) => {
    const updated: Request = {
      ...request,
      [field]: value || undefined,
      updated_at: new Date().toISOString(),
    };
    onUpdate(updated);
  };

  const handleUploadLinkSave = () => {
    const updated: Request = {
      ...request,
      youtube_link: uploadLinks.youtube_link || undefined,
      instagram_link: uploadLinks.instagram_link || undefined,
      linkedin_link: uploadLinks.linkedin_link || undefined,
      pinterest_link: uploadLinks.pinterest_link || undefined,
      updated_at: new Date().toISOString(),
    };
    onUpdate(updated);
  };

  const assignedUser = users.find((u) => u.id === request.assigned_to);
  const tatCategories = getTATCategoriesForType(request.type);

  // The viewer, in both id spaces: legs carry the sample slug for bridged
  // users and the DB uuid for everyone else (same space as request POCs).
  const myUiId = me ? users.find((u) => u.db_id === me.id)?.id : undefined;
  const myIds = [me?.id, myUiId].filter(Boolean) as string[];
  const canActOnAnyLeg = !!me && (me.is_lead || me.role === 'admin');
  const legOwnerName = (l: RequestLeg) =>
    users.find((u) => u.id === l.user_id || u.db_id === l.user_id)?.name;

  /** After a leg action the DB has moved (stage, next leg, clocks) — re-read
   *  the request and hand the fresh copy to the parent so every view agrees. */
  const refreshAfterLegAction = async () => {
    const fresh = await fetchRequestById(request.id);
    if (fresh) {
      setLegs(fresh.legs ?? []);
      onUpdate(fresh);
    }
  };

  const handleMarkLegDone = async (leg: RequestLeg) => {
    if (legBusy) return;
    setLegBusy(leg.id);
    setLegError('');
    try {
      await markLegDone(request.id, leg.id);
      await refreshAfterLegAction();
    } catch (e) {
      setLegError((e as { message?: string })?.message ?? 'Could not mark this part done.');
    } finally {
      setLegBusy(null);
    }
  };

  const handleReopenLeg = async (leg: RequestLeg) => {
    if (legBusy) return;
    setLegBusy(leg.id);
    setLegError('');
    try {
      await reopenLeg(leg.id);
      await refreshAfterLegAction();
    } catch (e) {
      setLegError((e as { message?: string })?.message ?? 'Could not reopen this part.');
    } finally {
      setLegBusy(null);
    }
  };

  // The clock starts automatically the moment a leg goes active — this only
  // lets a lead/admin correct it (e.g. work actually started earlier/later
  // than the system saw, or a stage was moved by mistake).
  const [editingClockFor, setEditingClockFor] = useState<string | null>(null);
  const [clockDraft, setClockDraft] = useState('');
  const toLocalInputValue = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
  const handleStartEditClock = (leg: RequestLeg) => {
    setEditingClockFor(leg.id);
    setClockDraft(toLocalInputValue(leg.started_at));
    setLegError('');
  };
  const handleSaveClock = async (leg: RequestLeg) => {
    if (!clockDraft) { setEditingClockFor(null); return; }
    setLegBusy(leg.id);
    setLegError('');
    try {
      const iso = new Date(clockDraft).toISOString();
      const { error } = await supabase
        .from('request_assignments')
        .update({ started_at: iso })
        .eq('id', leg.id);
      if (error) throw error;
      setEditingClockFor(null);
      await refreshAfterLegAction();
    } catch (e) {
      setLegError((e as { message?: string })?.message ?? 'Could not update the clock.');
    } finally {
      setLegBusy(null);
    }
  };

  const linkFields = [
    { key: 'youtube_link', label: 'YouTube', placeholder: 'https://youtube.com/watch?v=...' },
    { key: 'instagram_link', label: 'Instagram', placeholder: 'https://instagram.com/p/...' },
    { key: 'linkedin_link', label: 'LinkedIn', placeholder: 'https://linkedin.com/posts/...' },
    { key: 'pinterest_link', label: 'Pinterest', placeholder: 'https://pinterest.com/pin/...' },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(15, 17, 23, 0.35)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-[540px] bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="gb-badge gb-badge-blue flex-shrink-0">
              {request.type}
            </span>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
              {request.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {canDelete && isDbRequest && (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDeleteRequest}
                    disabled={deleting}
                    className="gb-btn"
                    style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: 'var(--error)', color: '#fff' }}
                  >
                    {deleting ? 'Deleting…' : 'Delete task?'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="gb-btn gb-btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="gb-icon-btn"
                  title="Delete this task"
                >
                  <Trash2 size={15} strokeWidth={1.75} style={{ color: 'var(--error)' }} />
                </button>
              )
            )}
            <button
              onClick={onClose}
              className="gb-icon-btn"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {deleteError && (
          <div className="px-5 py-2 text-[12px]" style={{ color: 'var(--error)', borderBottom: '1px solid var(--border)' }}>
            {deleteError}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Workflow Stepper */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>
              Workflow
            </h3>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {stages.map((stage, idx) => {
                const isActive = stage === request.current_stage;
                const isDone = idx < currentStageIndex;

                return (
                  <div key={stage} className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleStageChange(stage)}
                      disabled={isFinalStage(stage) && !canMarkComplete}
                      className="flex flex-col items-center cursor-pointer group disabled:cursor-not-allowed disabled:opacity-50"
                      title={isFinalStage(stage) && !canMarkComplete ? completeBlockedMsg : `Move to ${stage}`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors group-hover:ring-2 group-hover:ring-offset-1 ${
                          isDone
                            ? 'bg-[var(--success)] text-white group-hover:ring-[var(--success)]'
                            : isActive
                            ? 'bg-[var(--accent)] text-[var(--on-accent)] group-hover:ring-[var(--accent)]'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] group-hover:ring-[var(--border)]'
                        }`}
                        style={{ /* ring offset handled by tailwind */ }}
                      >
                        {isDone ? (
                          <CheckCircle size={14} />
                        ) : (
                          <Circle size={14} />
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] whitespace-nowrap mt-1 max-w-[55px] truncate">
                        {stage.split(' ').slice(0, 2).join(' ')}
                      </div>
                    </button>
                    {idx < stages.length - 1 && (
                      <ChevronRight size={12} className="text-[var(--border)] mt-[-12px]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage change dropdown + advance button */}
          <div className="flex items-center gap-2">
            <select
              value={request.current_stage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="flex-1 input-base text-sm"
            >
              {stages.map((s) => (
                <option key={s} value={s} disabled={isFinalStage(s) && !canMarkComplete}>
                  {s}
                </option>
              ))}
            </select>
            {nextStage && !isFinal && !(isFinalStage(nextStage) && !canMarkComplete) && (
              <button
                onClick={handleAdvanceStage}
                className="gb-btn gb-btn-primary whitespace-nowrap"
              >
                → {nextStage.split(' ').slice(0, 2).join(' ')}
              </button>
            )}
          </div>
          {stageError && (
            <p className="text-[12px] -mt-2" style={{ color: 'var(--error)' }}>{stageError}</p>
          )}

          {/* Per-stakeholder parts. A request passes through several hands;
              each person closes only their own part, and only the time the
              request spent WITH them counts against them. */}
          {isDbRequest && legs.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                Who has the ball
              </h3>
              <p className="text-[11px] mb-2" style={{ color: 'var(--text-faint)' }}>
                Each person&apos;s clock starts the moment the request reaches them and runs
                only while it&apos;s with them — weekends don&apos;t count. Past the {' '}
                {legs[0]?.sla_hours ?? 24}h budget, that part is flagged as SLA-breached.
                Finished your part? Mark it done — your time stops and the next person is notified.
              </p>
              <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {legs.map((leg, i) => {
                  const isMine = !!leg.user_id && myIds.includes(leg.user_id);
                  const open = leg.status === 'pending' || leg.status === 'active';
                  const hours = getLegTAT(leg);
                  const busy = legBusy === leg.id;
                  const breached = isLegSLABreached(leg);
                  const editingClock = editingClockFor === leg.id;
                  return (
                    <div
                      key={leg.id}
                      className="flex items-center gap-2.5 px-3 py-2 text-[12.5px]"
                      style={{
                        borderTop: i ? '1px solid var(--border-light)' : undefined,
                        backgroundColor: breached
                          ? 'var(--error-bg)'
                          : leg.status === 'active' ? 'var(--bg-tertiary)' : undefined,
                        opacity: leg.status === 'skipped' ? 0.55 : 1,
                      }}
                    >
                      {leg.status === 'done' ? (
                        <CheckCircle size={14} className="flex-shrink-0" style={{ color: 'var(--success)' }} />
                      ) : (
                        <Circle
                          size={14}
                          className="flex-shrink-0"
                          style={{ color: leg.status === 'active' ? 'var(--accent)' : 'var(--text-faint)' }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {leg.label}
                          {isMine && (
                            <span className="ml-1.5 font-normal text-[11px]" style={{ color: 'var(--accent-text)' }}>
                              (you)
                            </span>
                          )}
                          {breached && (
                            <span className="ml-1.5 gb-badge gb-badge-red" style={{ fontSize: '10px' }}>
                              SLA raised
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>
                          {leg.status === 'skipped'
                            ? 'No one assigned'
                            : legOwnerName(leg) ?? 'Unassigned'}
                        </div>
                        {editingClock ? (
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="datetime-local"
                              value={clockDraft}
                              onChange={(e) => setClockDraft(e.target.value)}
                              className="input-base text-[11px] py-0.5 px-1"
                            />
                            <button
                              onClick={() => handleSaveClock(leg)}
                              disabled={busy}
                              className="gb-btn gb-btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingClockFor(null)}
                              className="gb-btn gb-btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          leg.started_at && (
                            <div className="text-[10.5px] truncate" style={{ color: 'var(--text-faint)' }}>
                              Started {new Date(leg.started_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              {canActOnAnyLeg && (
                                <button
                                  onClick={() => handleStartEditClock(leg)}
                                  className="ml-1 align-middle"
                                  title="Edit when this leg's clock started"
                                  style={{ color: 'var(--text-faint)' }}
                                >
                                  <Pencil size={9} style={{ display: 'inline' }} />
                                </button>
                              )}
                            </div>
                          )
                        )}
                      </div>
                      {!editingClock && (
                        <div className="flex-shrink-0 text-right text-[11.5px] tabular-nums" style={{ color: breached ? 'var(--error)' : 'var(--text-secondary)' }}>
                          {leg.status === 'done' && hours !== null && formatBusinessHours(hours)}
                          {leg.status === 'active' && hours !== null && `${formatBusinessHours(hours)} so far`}
                          {leg.status === 'pending' && 'waiting'}
                          {leg.status === 'skipped' && '—'}
                        </div>
                      )}
                      {open && (isMine || canActOnAnyLeg) && leg.status === 'active' && (
                        <button
                          onClick={() => handleMarkLegDone(leg)}
                          disabled={busy}
                          className="gb-btn flex-shrink-0"
                          style={{ padding: '3px 10px', fontSize: '11.5px', backgroundColor: 'var(--success)', color: '#fff' }}
                          title={isMine ? 'Mark your part of this request done' : `Close the ${leg.label} part`}
                        >
                          {busy ? 'Saving…' : isMine ? 'My part is done' : 'Mark done'}
                        </button>
                      )}
                      {leg.status === 'done' && (isMine || canActOnAnyLeg) && (
                        <button
                          onClick={() => handleReopenLeg(leg)}
                          disabled={busy}
                          className="gb-icon-btn flex-shrink-0"
                          title="Reopen this part (restarts its clock)"
                        >
                          <Undo2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {legError && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--error)' }}>{legError}</p>
              )}
            </div>
          )}

          {/* Stage-wise TAT Breakdown */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
              TAT Breakdown
              <span className="ml-1 font-normal">(business hours)</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {tatCategories.map((cat) => {
                const breakdown = getStageBreakdown(request.transitions ?? []);
                const row = breakdown.find((b) => b.stage === cat.stage);
                const hours = row?.hours ?? 0;
                return (
                  <div
                    key={cat.stage}
                    className="p-2 rounded-md text-xs"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {hours > 0 ? formatBusinessHours(hours) : '—'}
                    </div>
                    <div className="truncate" style={{ color: 'var(--text-muted)' }}>
                      {cat.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Request Details */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
              Details
            </h3>
            <div className="space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Requested By:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {request.requested_by}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Requestor:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {request.requestor_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Created:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {new Date(request.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Assigned Date:</span>
                <span
                  className="font-medium"
                  style={{
                    color: isOverdue(request) ? 'var(--error)' : 'var(--text-primary)',
                  }}
                >
                  {new Date(request.need_by).toLocaleDateString()}
                  {isOverdue(request) && ' (Overdue)'}
                </span>
              </div>
              {request.description && (
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Description:</span>
                  <p className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                    {request.description}
                  </p>
                </div>
              )}
              {request.reference_link && (
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Reference:</span>
                  <a
                    href={request.reference_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] inline-flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--link)' }}
                  >
                    Link <ExternalLink size={10} />
                  </a>
                </div>
              )}
              {request.shoot_date && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Shoot Date:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {new Date(request.shoot_date).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Revisions:</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {request.revisions}
                </span>
              </div>
            </div>
          </div>

          {/* POC Assignment */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
              Assignment
            </h3>
            {!canAssign && (
              <p className="text-[11px] mb-2" style={{ color: 'var(--text-faint)' }}>
                Assignment is managed by your team lead.
              </p>
            )}
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Assigned To (Design)
                </label>
                <select
                  value={request.assigned_to || ''}
                  onChange={(e) => handleFieldChange('assigned_to', e.target.value)}
                  className="w-full input-base text-sm"
                  disabled={!canAssign}
                >
                  <option value="">-- Select --</option>
                  {pocOptions('Graphics & Video', request.assigned_to).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Social POC
                </label>
                <select
                  value={request.social_poc || ''}
                  onChange={(e) => handleFieldChange('social_poc', e.target.value)}
                  className="w-full input-base text-sm"
                  disabled={!canAssign}
                >
                  <option value="">-- Select --</option>
                  {pocOptions('Social', request.social_poc).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {request.type === 'Video' && (
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Video POC
                  </label>
                  <select
                    value={request.video_poc || ''}
                    onChange={(e) => handleFieldChange('video_poc', e.target.value)}
                    className="w-full input-base text-sm"
                    disabled={!canAssign}
                  >
                    <option value="">-- Select --</option>
                    {pocOptions('Graphics & Video', request.video_poc).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Design POC
                </label>
                <select
                  value={request.design_poc || ''}
                  onChange={(e) => handleFieldChange('design_poc', e.target.value)}
                  className="w-full input-base text-sm"
                  disabled={!canAssign}
                >
                  <option value="">-- Select --</option>
                  {pocOptions('Graphics & Video', request.design_poc).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Upload Links — shown when request is Done / Uploaded / Ready to Upload */}
          {(isFinal || isReadyToUpload) && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
                <Link2 size={12} />
                Upload Links
              </h3>
              <div className="space-y-2.5">
                {linkFields.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {label}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="url"
                        value={uploadLinks[key as keyof typeof uploadLinks]}
                        onChange={(e) =>
                          setUploadLinks((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={placeholder}
                        className="flex-1 input-base text-sm"
                      />
                      {uploadLinks[key as keyof typeof uploadLinks] && (
                        <a
                          href={uploadLinks[key as keyof typeof uploadLinks]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gb-icon-btn flex-shrink-0"
                          title={`Open ${label}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleUploadLinkSave}
                  className="w-full gb-btn gb-btn-secondary mt-1 justify-center"
                >
                  Save links
                </button>
              </div>
            </div>
          )}

          {/* Project Summary (DB-backed — was "Comments") */}
          {isDbRequest && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                Project Summary
              </h3>
              <div className="space-y-2.5">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-md text-[13px]"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {c.author_name}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {formatCommentDate(c.created_at)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                      {c.body}
                    </p>
                  </div>
                ))}
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write the project summary..."
                  rows={3}
                  className="w-full input-base text-sm"
                />
                <button
                  onClick={handleAddComment}
                  disabled={posting || !newComment.trim()}
                  className="gb-btn gb-btn-secondary"
                >
                  {posting ? 'Saving...' : 'Save'}
                </button>
                {commentError && (
                  <p className="text-[11px]" style={{ color: 'var(--error)' }}>{commentError}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-secondary)] space-y-2">
          {!isFinal && canMarkComplete && (
            <button
              onClick={handleMarkComplete}
              className="w-full px-4 py-2 rounded-md text-white text-sm font-medium hover:opacity-90 transition-colors"
              style={{ backgroundColor: 'var(--success)' }}
            >
              Mark Complete
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-md border text-sm font-medium transition-colors"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

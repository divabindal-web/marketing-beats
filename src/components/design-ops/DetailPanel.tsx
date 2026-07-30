'use client';

import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, Circle, ChevronRight, ExternalLink, Link2, Trash2 } from 'lucide-react';
import { Request, User, StageTransition, getTATCategoriesForType } from '@/types';
import { getStagesForType, isOverdue } from '@/lib/sample-data';
import { getStageBreakdown, formatBusinessHours } from '@/lib/tat';
import {
  Subtask,
  CommentRow,
  AttachmentRow,
  listSubtasks,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  listComments,
  addComment,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  currentDbUser,
  userTeamByEmail,
  deleteRequestById,
} from '@/lib/work-api';

const UUID_RE = /^[0-9a-f-]{36}$/i;

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatCommentDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

interface DetailPanelProps {
  request: Request;
  users: User[];
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

  // Subtasks / attachments / comments (DB-backed, only for real uuid requests)
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [subtaskError, setSubtaskError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Leads/admins: can delete requests and reassign people. Members: read-only on
  // assignment (their lead assigns work to them), no delete.
  const [me, setMe] = useState<{ role: string; team: string | null; is_lead: boolean } | null>(null);
  const [teamByEmail, setTeamByEmail] = useState<Map<string, string>>(new Map());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [stageError, setStageError] = useState('');

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

  const teamOf = (u?: User) => (u?.email ? teamByEmail.get(u.email.toLowerCase()) ?? null : null);

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
    setSubtasks([]);
    setComments([]);
    setAttachments([]);
    setNewSubtask('');
    setNewComment('');
    setSubtaskError('');
    setCommentError('');
    setAttachmentError('');
    setConfirmDelete(false);
    setDeleteError('');
    if (!UUID_RE.test(request.id)) return;
    let cancelled = false;
    listSubtasks(request.id)
      .then((rows) => { if (!cancelled) setSubtasks(rows); })
      .catch(() => { if (!cancelled) setSubtaskError('Could not load subtasks.'); });
    listComments(request.id)
      .then((rows) => { if (!cancelled) setComments(rows); })
      .catch(() => { if (!cancelled) setCommentError('Could not load comments.'); });
    listAttachments(request.id)
      .then((rows) => { if (!cancelled) setAttachments(rows); })
      .catch(() => { if (!cancelled) setAttachmentError('Could not load attachments.'); });
    return () => { cancelled = true; };
  }, [request.id]);

  if (!isOpen) {
    return null;
  }

  const handleAddSubtask = async () => {
    const title = newSubtask.trim();
    if (!title) return;
    setSubtaskError('');
    try {
      const row = await addSubtask(request.id, title);
      setSubtasks((prev) => [...prev, row]);
      setNewSubtask('');
    } catch {
      setSubtaskError('Could not add subtask.');
    }
  };

  const handleToggleSubtask = async (s: Subtask) => {
    setSubtaskError('');
    setSubtasks((prev) => prev.map((r) => (r.id === s.id ? { ...r, done: !s.done } : r)));
    try {
      await toggleSubtask(s.id, !s.done);
    } catch {
      setSubtasks((prev) => prev.map((r) => (r.id === s.id ? { ...r, done: s.done } : r)));
      setSubtaskError('Could not update subtask.');
    }
  };

  const handleDeleteSubtask = async (s: Subtask) => {
    setSubtaskError('');
    try {
      await deleteSubtask(s.id);
      setSubtasks((prev) => prev.filter((r) => r.id !== s.id));
    } catch {
      setSubtaskError('Could not delete subtask.');
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setAttachmentError('');
    setUploading(true);
    try {
      await uploadAttachment(request.id, file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAttachments(await listAttachments(request.id));
    } catch {
      setAttachmentError('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (row: AttachmentRow) => {
    setAttachmentError('');
    try {
      await deleteAttachment(row);
      setAttachments((prev) => prev.filter((r) => r.id !== row.id));
    } catch {
      setAttachmentError('Could not delete attachment.');
    }
  };

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
      setCommentError('Could not post comment.');
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
  const canMarkComplete =
    !!me && (me.role === 'admin' || (me.is_lead && (!assigneeTeam || assigneeTeam === me.team)));
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
                            ? 'bg-[var(--accent)] text-white group-hover:ring-[var(--accent)]'
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
                <span style={{ color: 'var(--text-secondary)' }}>Need By:</span>
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
                    style={{ color: 'var(--accent)' }}
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
                  {users.map((u) => (
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

          {/* Subtasks (DB-backed) */}
          {isDbRequest && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                Subtasks
                {subtasks.length > 0 && (
                  <span className="ml-1 font-normal">
                    ({subtasks.filter((s) => s.done).length}/{subtasks.length} done)
                  </span>
                )}
              </h3>
              <div className="space-y-1.5">
                {subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-[13px] group">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() => handleToggleSubtask(s)}
                      className="flex-shrink-0 cursor-pointer"
                    />
                    <span
                      className={`flex-1 min-w-0 truncate ${s.done ? 'line-through' : ''}`}
                      style={{ color: s.done ? 'var(--text-muted)' : 'var(--text-primary)' }}
                    >
                      {s.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(s)}
                      className="gb-icon-btn flex-shrink-0"
                      title="Delete subtask"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); }}
                    placeholder="Add a subtask..."
                    className="flex-1 input-base text-sm"
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim()}
                    className="gb-btn gb-btn-secondary flex-shrink-0"
                  >
                    Add
                  </button>
                </div>
                {subtaskError && (
                  <p className="text-[11px]" style={{ color: 'var(--error)' }}>{subtaskError}</p>
                )}
              </div>
            </div>
          )}

          {/* Attachments (DB-backed) */}
          {isDbRequest && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                Attachments
              </h3>
              <div className="space-y-1.5">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-[13px]">
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 truncate hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        {a.file_name}
                      </a>
                    ) : (
                      <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                        {a.file_name}
                      </span>
                    )}
                    <span className="flex-shrink-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {formatFileSize(a.size_bytes)}
                    </span>
                    <button
                      onClick={() => handleDeleteAttachment(a)}
                      className="gb-icon-btn flex-shrink-0"
                      title="Delete attachment"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="flex-1 min-w-0 text-[12px]"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="gb-btn gb-btn-secondary flex-shrink-0"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
                {attachmentError && (
                  <p className="text-[11px]" style={{ color: 'var(--error)' }}>{attachmentError}</p>
                )}
              </div>
            </div>
          )}

          {/* Comments (DB-backed) */}
          {isDbRequest && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                Comments
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
                  placeholder="Write a comment..."
                  rows={3}
                  className="w-full input-base text-sm"
                />
                <button
                  onClick={handleAddComment}
                  disabled={posting || !newComment.trim()}
                  className="gb-btn gb-btn-secondary"
                >
                  {posting ? 'Posting...' : 'Comment'}
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

'use client';

import { useState } from 'react';
import { X, CheckCircle, Circle, ChevronRight, ExternalLink, Link2 } from 'lucide-react';
import { Request, User, StageTransition, getTATCategoriesForType } from '@/types';
import { getStagesForType, isOverdue } from '@/lib/sample-data';
import { getStageBreakdown, formatBusinessHours } from '@/lib/tat';

interface DetailPanelProps {
  request: Request;
  users: User[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Request) => void;
}

export default function DetailPanel({ request, users, isOpen, onClose, onUpdate }: DetailPanelProps) {
  const [uploadLinks, setUploadLinks] = useState({
    youtube_link: request.youtube_link || '',
    instagram_link: request.instagram_link || '',
    linkedin_link: request.linkedin_link || '',
    pinterest_link: request.pinterest_link || '',
  });

  if (!isOpen) {
    return null;
  }

  const stages = getStagesForType(request.type);
  const currentStageIndex = stages.indexOf(request.current_stage as any);
  const nextStage = currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1] : null;
  const isFinal = request.current_stage === 'Done' || request.current_stage === 'Uploaded';
  const isReadyToUpload = request.current_stage === 'Ready to Upload';

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
    if (newStage !== request.current_stage) {
      onUpdate(appendTransition(newStage as Request['current_stage']));
    }
  };

  const handleAdvanceStage = () => {
    if (nextStage) {
      onUpdate(appendTransition(nextStage as Request['current_stage']));
    }
  };

  const handleMarkComplete = () => {
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
          <button
            onClick={onClose}
            className="gb-icon-btn flex-shrink-0 ml-2"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

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
                      className="flex flex-col items-center cursor-pointer group"
                      title={`Move to ${stage}`}
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
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {nextStage && !isFinal && (
              <button
                onClick={handleAdvanceStage}
                className="gb-btn gb-btn-primary whitespace-nowrap"
              >
                → {nextStage.split(' ').slice(0, 2).join(' ')}
              </button>
            )}
          </div>

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
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Assigned To (Design)
                </label>
                <select
                  value={request.assigned_to || ''}
                  onChange={(e) => handleFieldChange('assigned_to', e.target.value)}
                  className="w-full input-base text-sm"
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
                >
                  <option value="">-- Select --</option>
                  {users.map((u) => (
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
                  >
                    <option value="">-- Select --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Upload POC
                </label>
                <select
                  value={request.upload_poc || ''}
                  onChange={(e) => handleFieldChange('upload_poc', e.target.value)}
                  className="w-full input-base text-sm"
                >
                  <option value="">-- Select --</option>
                  {users.map((u) => (
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
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-secondary)] space-y-2">
          {!isFinal && (
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

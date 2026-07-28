'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Request, RequestType, REQUESTED_BY_OPTIONS, REQUEST_TYPES, StageTransition, ENTITIES, Entity } from '@/types';
import { getStagesForType } from '@/lib/sample-data';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/components/layout/CurrentUserContext';

interface LeadOption {
  id: string;
  name: string;
  team: string | null;
}

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (request: Partial<Request>) => void;
}

export default function RequestModal({ isOpen, onClose, onSave }: RequestModalProps) {
  const { currentUser, email } = useCurrentUser();
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [assignLead, setAssignLead] = useState('');

  // Load team leads from the live DB (extensible: mark anyone is_lead=true and they appear here)
  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('users')
      .select('id, name, team')
      .eq('is_lead', true)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setLeads((data as LeadOption[]) ?? []));
  }, [isOpen]);

  const [formData, setFormData] = useState({
    type: 'Graphics' as RequestType,
    requestedBy: 'Social Team' as const,
    entity: 'SQY' as Entity,
    title: '',
    description: '',
    needBy: '',
    referenceLink: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.needBy) {
      newErrors.needBy = 'Need By date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const stages = getStagesForType(formData.type);
    const nowIso = new Date().toISOString();
    const tempId = `req-new-${Date.now()}`;
    const firstStage = stages[0];

    const initialTransition: StageTransition = {
      id: `tr-${tempId}-0`,
      request_id: tempId,
      from_stage: null,
      to_stage: firstStage,
      transitioned_at: nowIso,
      transitioned_by: 'user-divya-krishnan',
    };

    const newRequest: Partial<Request> = {
      type: formData.type,
      requested_by: formData.requestedBy as any,
      entity: formData.entity,
      title: formData.title,
      description: formData.description || undefined,
      requestor_name: currentUser?.name ?? (email ? email.split('@')[0] : 'Unknown'),
      requestor_id: currentUser?.id,
      assigned_to: assignLead || undefined,
      need_by: formData.needBy,
      reference_link: formData.referenceLink || undefined,
      current_stage: firstStage,
      revisions: 0,
      created_at: nowIso,
      updated_at: nowIso,
      transitions: [initialTransition],
    };

    onSave(newRequest);

    // Reset form
    setFormData({
      type: 'Graphics',
      requestedBy: 'Social Team',
      entity: 'SQY',
      title: '',
      description: '',
      needBy: '',
      referenceLink: '',
    });
    setAssignLead('');
    setErrors({});
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const isSubmitDisabled = !formData.title.trim() || !formData.needBy;

  return (
    <>
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              New Design Request
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
              title="Close"
            >
              <X size={20} className="text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Type <span className="text-[var(--error)]">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full input-base"
              >
                {REQUEST_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Entity <span className="text-[var(--error)]">*</span>
              </label>
              <select
                name="entity"
                value={formData.entity}
                onChange={handleChange}
                className="w-full input-base"
              >
                {ENTITIES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            {/* Assign to team lead (leaders then re-assign to their team) */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Assign to lead
              </label>
              <select
                value={assignLead}
                onChange={(e) => setAssignLead(e.target.value)}
                className="w-full input-base"
              >
                <option value="">— choose later —</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.team ? ` (${l.team})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Requested By */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Requested By <span className="text-[var(--error)]">*</span>
              </label>
              <select
                name="requestedBy"
                value={formData.requestedBy}
                onChange={handleChange}
                className="w-full input-base"
              >
                {REQUESTED_BY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Title <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Product Launch Graphics"
                className="w-full input-base"
              />
              {errors.title && (
                <p className="text-xs text-[var(--error)] mt-1">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Additional details about the request..."
                rows={3}
                className="w-full input-base resize-none"
              />
            </div>

            {/* Requestor Name (readonly) */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Requestor Name
              </label>
              <input
                type="text"
                value="Divya Krishnan"
                disabled
                className="w-full input-base bg-[var(--bg-tertiary)] cursor-not-allowed opacity-75"
              />
            </div>

            {/* Need By */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Need By <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="date"
                name="needBy"
                value={formData.needBy}
                onChange={handleChange}
                className="w-full input-base"
              />
              {errors.needBy && (
                <p className="text-xs text-[var(--error)] mt-1">{errors.needBy}</p>
              )}
            </div>

            {/* Reference Link */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Reference Link
              </label>
              <input
                type="url"
                name="referenceLink"
                value={formData.referenceLink}
                onChange={handleChange}
                placeholder="https://example.com/brief"
                className="w-full input-base"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className={`flex-1 px-4 py-2 rounded-md text-white font-medium transition-colors ${
                isSubmitDisabled
                  ? 'bg-[var(--accent)] opacity-50 cursor-not-allowed'
                  : 'bg-[var(--accent)] hover:opacity-90'
              }`}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

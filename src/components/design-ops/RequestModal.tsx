'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Request, RequestType, REQUESTED_BY_OPTIONS, REQUEST_TYPES, StageTransition, ENTITIES, Entity } from '@/types';
import { getStagesForType } from '@/lib/sample-data';
import { supabase } from '@/lib/supabase';
import { listProjects, addProject, currentDbUser, ProjectRow } from '@/lib/work-api';
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
  const [assignLabel, setAssignLabel] = useState('Assign to lead');
  const [showAssign, setShowAssign] = useState(true);
  const [assignLead, setAssignLead] = useState('');
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectEntity, setNewProjectEntity] = useState<Entity>('SQY');
  const [addingProject, setAddingProject] = useState(false);

  // Role-aware assignee list from the live DB:
  //  - Divya (admin) assigns to the team leads
  //  - a lead assigns to the members of their own team
  //  - team members don't assign at all — their lead routes the work
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const me = await currentDbUser();
        if (me && me.role !== 'admin' && !me.is_lead) {
          // Plain team member: no assign control
          setShowAssign(false);
          setLeads([]);
        } else if (me && me.is_lead && me.role !== 'admin' && me.team) {
          const { data } = await supabase
            .from('users')
            .select('id, name, team')
            .eq('team', me.team)
            .eq('is_active', true)
            .order('name');
          setShowAssign(true);
          setAssignLabel('Assign to team member');
          setLeads((data as LeadOption[]) ?? []);
        } else {
          const { data } = await supabase
            .from('users')
            .select('id, name, team')
            .eq('is_lead', true)
            .eq('is_active', true)
            .order('name');
          setShowAssign(true);
          setAssignLabel('Assign to lead');
          setLeads((data as LeadOption[]) ?? []);
        }
      } catch (err) {
        console.error('Failed to load assignees:', err);
      }
    })();
    listProjects()
      .then(setProjects)
      .catch((err) => console.error('Failed to load campaigns:', err));
  }, [isOpen]);

  const handleAddProject = async () => {
    const name = newProjectName.trim();
    if (!name || addingProject) return;
    setAddingProject(true);
    try {
      const created = await addProject(name, newProjectEntity);
      setProjects((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedProject(created.id);
      setShowNewProject(false);
      setNewProjectName('');
    } catch (err) {
      alert('Could not add campaign: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAddingProject(false);
    }
  };

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
      project_id: selectedProject || undefined,
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
    setSelectedProject('');
    setShowNewProject(false);
    setNewProjectName('');
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

            {/* Assign to lead (admin) or team member (lead); hidden for members */}
            {showAssign && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {assignLabel}
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
            )}

            {/* Campaign / Project */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Campaign / Project
              </label>
              <select
                value={showNewProject ? '__new__' : selectedProject}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setShowNewProject(true);
                  } else {
                    setShowNewProject(false);
                    setSelectedProject(e.target.value);
                  }
                }}
                className="w-full input-base"
              >
                <option value="">— none —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.entity ? ` (${p.entity})` : ''}
                  </option>
                ))}
                <option value="__new__">+ New campaign…</option>
              </select>
              {showNewProject && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Campaign name"
                    className="flex-1 input-base"
                  />
                  <select
                    value={newProjectEntity}
                    onChange={(e) => setNewProjectEntity(e.target.value as Entity)}
                    className="input-base"
                  >
                    {ENTITIES.map((en) => (
                      <option key={en} value={en}>
                        {en}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddProject}
                    disabled={!newProjectName.trim() || addingProject}
                    className={`px-3 py-2 rounded-md text-white text-sm font-medium transition-colors ${
                      !newProjectName.trim() || addingProject
                        ? 'bg-[var(--accent)] opacity-50 cursor-not-allowed'
                        : 'bg-[var(--accent)] hover:opacity-90'
                    }`}
                  >
                    {addingProject ? 'Adding…' : 'Add'}
                  </button>
                </div>
              )}
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

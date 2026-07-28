'use client';

import { useState } from 'react';
import { User, UserRole } from '@/types';
import { X } from 'lucide-react';

interface EditUserModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: User) => void;
}

export default function EditUserModal({
  user,
  isOpen,
  onClose,
  onSave,
}: EditUserModalProps) {
  const [formData, setFormData] = useState<User>(user);

  const handleSave = () => {
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-card)] rounded-lg border border-[var(--border)] shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Edit User
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--bg-secondary)] rounded transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* User Info (read-only) */}
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              disabled
              className="input-base mt-1 bg-[var(--bg-secondary)] opacity-60 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Employee Code
            </label>
            <input
              type="text"
              value={formData.employee_code}
              disabled
              className="input-base mt-1 bg-[var(--bg-secondary)] opacity-60 cursor-not-allowed"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as UserRole })
              }
              className="input-base mt-1 w-full"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="designer">Designer</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Status
            </label>
            <button
              onClick={() =>
                setFormData({ ...formData, is_active: !formData.is_active })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_active ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-md border border-[var(--border)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

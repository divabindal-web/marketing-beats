'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DbUserRow, TEAMS, addDbUser, currentDbUser, deleteDbUser, listDbUsers, updateDbUser } from '@/lib/work-api';
import { Search, Trash2, UserPlus, X } from 'lucide-react';

type EditablePatch = Partial<Pick<DbUserRow, 'role' | 'team' | 'is_lead' | 'is_active' | 'designation'>>;

/** Roles the app understands. `admin` is the CMO-level global master. */
const USER_ROLES = [
  { value: 'designer', label: 'Designer' },
  { value: 'manager', label: 'Manager' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'admin', label: 'Admin' },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ---------------- Add member modal (RequestModal overlay pattern) ---------------- */

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
  /** When set (a lead is adding), the new member joins this team — not editable. */
  lockTeam?: string | null;
}

function AddMemberModal({ isOpen, onClose, onAdded, lockTeam }: AddMemberModalProps) {
  const [form, setForm] = useState({ name: '', email: '', team: '', role: 'designer', designation: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown once after a successful add — the only time this password is visible.
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  // Escape closes; the page behind stops scrolling while the modal is up.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDisabled = !form.name.trim() || !form.email.trim() || submitting;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await addDbUser({
        name: form.name.trim(),
        email: form.email.trim(),
        team: lockTeam ?? (form.team.trim() || undefined),
        role: form.role,
        designation: form.designation.trim() || undefined,
      });
      await onAdded();
      setForm({ name: '', email: '', team: '', role: 'designer', designation: '' });
      // Stay open so the one-time password can be copied — closing here would
      // lose it, and there is no way to read it back afterwards.
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setSubmitting(false);
    }
  };

  // Portalled to <body> so it always covers the viewport, never confined to a
  // transformed/animated ancestor (which pushed it below the fold before).
  return createPortal(
    <>
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 backdrop-blur-sm z-[100]"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
        <div className="gb-card w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-xl mb-scale-in">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-[var(--border)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Add Member</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
              title="Close"
            >
              <X size={20} className="text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Body + actions in one <form>; only the field list scrolls. */}
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Name <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g., Priya Sharma"
                className="w-full input-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Email <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="name@squareyards.in"
                className="w-full input-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Team</label>
              {lockTeam ? (
                <>
                  <input type="text" value={lockTeam} disabled className="w-full input-base" />
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
                    New members you add join your team.
                  </p>
                </>
              ) : (
                <select name="team" value={form.team} onChange={handleChange} className="w-full input-base">
                  <option value="">— choose team —</option>
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Role</label>
              <select name="role" value={form.role} onChange={handleChange} className="w-full input-base">
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Designation</label>
              <input
                type="text"
                name="designation"
                value={form.designation}
                onChange={handleChange}
                placeholder="e.g., Senior Graphic Designer"
                className="w-full input-base"
              />
            </div>

            <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
              A sign-in account is created too. You&apos;ll get a one-time password to
              pass on — ask them to change it from the sidebar after first login.
            </p>

            {created && (
              <div
                className="rounded-md p-3"
                style={{ backgroundColor: 'var(--success-bg)', border: '1px solid var(--success)' }}
              >
                <div className="text-[12px] font-semibold" style={{ color: 'var(--success)' }}>
                  {created.email} can now sign in.
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Temporary password — shown only now:
                </div>
                <code
                  className="block mt-1 px-2 py-1.5 rounded text-[13px] font-semibold select-all"
                  style={{ backgroundColor: 'var(--bg-code)', color: 'var(--text-primary)' }}
                >
                  {created.password}
                </code>
              </div>
            )}

            {error && <p className="text-xs text-[var(--error)]">{error}</p>}
            </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex gap-3 p-6 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
            <button
              type="button"
              onClick={() => { setCreated(null); setError(null); onClose(); }}
              className="flex-1 px-4 py-2 rounded-md border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors font-medium"
            >
              {created ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isDisabled}
              className={`flex-1 px-4 py-2 rounded-md text-[var(--on-accent)] font-semibold transition-all active:scale-[0.98] ${
                isDisabled ? 'bg-[var(--accent)] opacity-50 cursor-not-allowed' : 'bg-[var(--accent)] hover:opacity-90'
              }`}
            >
              {submitting ? 'Adding…' : 'Add member'}
            </button>
          </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ---------------- Page ---------------- */

export default function UserManagementPage() {
  const [users, setUsers] = useState<DbUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // A lead (non-admin) adds members into their own team
  const [myTeamLock, setMyTeamLock] = useState<string | null>(null);

  useEffect(() => {
    currentDbUser()
      .then((me) => {
        if (me && me.is_lead && me.role !== 'admin' && me.team) setMyTeamLock(me.team);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const rows = await listDbUsers();
      setUsers(rows);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        (u.email ?? '').toLowerCase().includes(term) ||
        (u.team ?? '').toLowerCase().includes(term),
    );
  }, [users, searchTerm]);

  /** Optimistic inline edit: apply locally, persist, revert on failure. */
  const patchUser = async (id: string, patch: EditablePatch) => {
    const prev = users.find((u) => u.id === id);
    if (!prev) return;
    setUsers((cur) => cur.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    setRowErrors((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
    try {
      await updateDbUser(id, patch);
    } catch (e) {
      setUsers((cur) => cur.map((u) => (u.id === id ? prev : u)));
      setRowErrors((cur) => ({
        ...cur,
        [id]: e instanceof Error ? e.message : 'Update failed — change reverted',
      }));
    }
  };

  /** Two-step delete: first click arms the row, second click removes the person. */
  const removeUser = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    setRowErrors((cur) => {
      const next = { ...cur };
      delete next[id];
      return next;
    });
    try {
      await deleteDbUser(id);
      setUsers((cur) => cur.filter((u) => u.id !== id));
    } catch (e) {
      setRowErrors((cur) => ({
        ...cur,
        [id]: e instanceof Error ? e.message : 'Could not delete this member',
      }));
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Page Header */}
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">User Management</h1>
          <p className="gb-page-description">
            Manage teams, leads, and access for the marketing team. Changes save to the live database.
          </p>
        </div>
        <button className="gb-btn gb-btn-primary" onClick={() => setIsAddOpen(true)}>
          <UserPlus className="w-4 h-4" />
          Add member
        </button>
      </div>

      {/* Search + count */}
      <div className="gb-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="gb-search" style={{ width: '320px' }}>
            <Search className="w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, email, or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {filtered.length} member{filtered.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {loadError && (
        <div
          className="gb-card"
          style={{ padding: '14px 20px', marginBottom: '20px', color: 'var(--error)', fontSize: '13px' }}
        >
          {loadError}
          <button className="gb-btn gb-btn-secondary" style={{ marginLeft: '12px' }} onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {/* Members Table */}
      <div className="gb-card overflow-x-auto">
        <table className="gb-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Designation</th>
              <th>Team</th>
              <th>Role</th>
              <th>Lead?</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading members…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No members match your search.
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-light)',
                          color: 'var(--accent-text)',
                          border: '1px solid var(--border)',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {user.name}{' '}
                          {user.role === 'admin' && <span className="gb-badge gb-badge-red">admin</span>}
                        </div>
                        {rowErrors[user.id] && (
                          <div style={{ fontSize: '11.5px', color: 'var(--error)', marginTop: '2px' }}>
                            {rowErrors[user.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user.email ?? '—'}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user.designation ?? '—'}</span>
                  </td>
                  <td>
                    <select
                      value={user.team ?? ''}
                      className="input-base"
                      style={{ width: '150px', padding: '5px 8px', fontSize: '13px' }}
                      onChange={(e) => void patchUser(user.id, { team: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {TEAMS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      {user.team && !TEAMS.includes(user.team) && <option value={user.team}>{user.team}</option>}
                    </select>
                  </td>
                  <td>
                    <select
                      value={user.role ?? 'designer'}
                      className="input-base"
                      style={{ width: '120px', padding: '5px 8px', fontSize: '13px' }}
                      onChange={(e) => void patchUser(user.id, { role: e.target.value })}
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={user.is_lead}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                      onChange={(e) => void patchUser(user.id, { is_lead: e.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={user.is_active}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--success)', cursor: 'pointer' }}
                      onChange={(e) => void patchUser(user.id, { is_active: e.target.checked })}
                    />
                  </td>
                  <td>
                    {pendingDelete === user.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          className="gb-btn"
                          style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: 'var(--error)', color: '#fff' }}
                          disabled={deleting}
                          onClick={() => void removeUser(user.id)}
                        >
                          {deleting ? 'Removing…' : 'Confirm'}
                        </button>
                        <button
                          className="gb-btn gb-btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => setPendingDelete(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="gb-icon-btn"
                        title={`Remove ${user.name}`}
                        onClick={() => setPendingDelete(user.id)}
                      >
                        <Trash2 size={14} strokeWidth={1.75} style={{ color: 'var(--error)' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onAdded={load} lockTeam={myTeamLock} />
    </div>
  );
}

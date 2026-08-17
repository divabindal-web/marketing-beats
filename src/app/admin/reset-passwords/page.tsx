'use client';

import { useState, useMemo } from 'react';
import { Search, Key, CheckCircle2, AlertCircle, Loader2, Shield } from 'lucide-react';
import { useDirectory } from '@/lib/directory';
import { resetMemberPassword } from '@/lib/work-api';

export default function ResetPasswordsPage() {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const users = useDirectory();

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        u.employee_code.toLowerCase().includes(q),
    );
  }, [search, users]);

  const handleReset = async () => {
    if (!selectedUser || !newPwd) return;
    const user = users.find((u) => u.id === selectedUser);
    if (!user?.email) return;

    setLoading(true);
    setResult(null);
    try {
      // Goes through the admin-users edge function, which holds the
      // service_role key. This page used to just print a success message and
      // change nothing at all.
      await resetMemberPassword(user.email, newPwd);
      setResult({ ok: true, msg: `Password updated for ${user.name}. Share it with them and ask them to change it from the sidebar.` });
      setNewPwd('');
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Failed to reset password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="gb-page-header">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="gb-page-title" style={{ marginBottom: 0 }}>Reset Passwords</h1>
        </div>
        <p className="gb-page-description">
          Admin only. Search for a team member and reset their password. The user will need to use the new password on their next login.
        </p>
      </div>

      {/* Search */}
      <div className="gb-search mb-4" style={{ maxWidth: 480 }}>
        <Search size={14} style={{ color: 'var(--text-faint)' }} />
        <input
          type="text"
          placeholder="Search by name, email, or employee code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* User list */}
        <div className="gb-card overflow-hidden">
          <table className="gb-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Team</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 30).map((u) => (
                <tr
                  key={u.id}
                  onClick={() => { setSelectedUser(u.id); setResult(null); setNewPwd(''); }}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedUser === u.id ? 'var(--accent-light)' : 'transparent',
                  }}
                >
                  <td style={{ fontWeight: 500, color: selectedUser === u.id ? 'var(--accent-text)' : 'var(--text-primary)' }}>
                    {u.name}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{u.email}</td>
                  <td><span className="gb-badge">{u.team ?? '—'}</span></td>
                  <td style={{ color: 'var(--text-faint)', fontSize: '12px' }}>{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 30 && (
            <div className="px-4 py-2 text-[12px]" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
              Showing 30 of {filtered.length} — refine your search
            </div>
          )}
        </div>

        {/* Reset panel */}
        <div>
          {selectedUser ? (
            <div className="gb-card p-5">
              {(() => {
                const user = users.find((u) => u.id === selectedUser);
                if (!user) return null;
                return (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold"
                        style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}
                      >
                        {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{user.name}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{user.email}</div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                        New password
                      </label>
                      <input
                        type="text"
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        placeholder="Enter new password (min 8 chars)"
                        className="gb-input w-full"
                      />
                    </div>

                    {result && (
                      <div
                        className="mb-3 p-3 rounded-md text-[12px] flex items-start gap-2"
                        style={{
                          backgroundColor: result.ok ? 'rgba(22,163,74,0.08)' : 'var(--error-bg)',
                          color: result.ok ? '#15803d' : 'var(--error)',
                        }}
                      >
                        {result.ok ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />}
                        <span>{result.msg}</span>
                      </div>
                    )}

                    <button
                      onClick={handleReset}
                      disabled={loading || newPwd.length < 8}
                      className="gb-btn gb-btn-primary w-full"
                      style={{ opacity: loading || newPwd.length < 8 ? 0.5 : 1 }}
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                      {loading ? 'Resetting…' : 'Reset password'}
                    </button>

                    <div className="text-[11px] mt-3" style={{ color: 'var(--text-faint)' }}>
                      Admins can reset anyone; team leads only their own team.
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="gb-card p-8 text-center">
              <Key size={20} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
              <div className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
                Select a team member from the list to reset their password.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

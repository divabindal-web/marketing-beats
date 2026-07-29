'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  FolderDown,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Gauge,
  UserCircle,
  RefreshCw,
  BarChart3,
  Upload,
  BookOpen,
  Key,
  Search,
  Star,
  Megaphone,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRole } from './RoleContext';
import { useCurrentUser } from './CurrentUserContext';
import { getInitials } from '@/lib/sample-data';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Design Ops',
    items: [
      {
        label: 'Dashboard',
        href: '/design-ops/dashboard',
        icon: <LayoutDashboard size={16} strokeWidth={1.75} />,
      },
      {
        label: 'My Tasks',
        href: '/design-ops/my-tasks',
        icon: <UserCircle size={16} strokeWidth={1.75} />,
      },
      {
        label: 'All Requests',
        href: '/design-ops/requests',
        icon: <ClipboardList size={16} strokeWidth={1.75} />,
      },
      {
        label: 'Downloads / Uploads',
        href: '/design-ops/downloads',
        icon: <FolderDown size={16} strokeWidth={1.75} />,
      },
      {
        label: 'Reports — Output & TAT',
        href: '/design-ops/reports',
        icon: <Gauge size={16} strokeWidth={1.75} />,
      },
    ],
  },
  {
    title: 'Social',
    items: [
      {
        label: 'Calendar',
        href: '/social/calendar',
        icon: <Calendar size={16} strokeWidth={1.75} />,
      },
    ],
  },
    {
    title: 'Performance Data',
    items: [
      {
        label: 'SEO',
        href: '/performance-data/seo',
        icon: <Search size={16} strokeWidth={1.75} />,
      },
      {
        label: 'ORM',
        href: '/performance-data/orm',
        icon: <Star size={16} strokeWidth={1.75} />,
      },
      {
        label: 'Paid Campaigns',
        href: '/performance-data/paid',
        icon: <Megaphone size={16} strokeWidth={1.75} />,
      },
      {
        label: 'Social (Hootsuite)',
        href: '/performance-data/social',
        icon: <BarChart3 size={16} strokeWidth={1.75} />,
      },
      {
        label: 'Upload Data',
        href: '/performance-data/upload',
        icon: <Upload size={16} strokeWidth={1.75} />,
      },
    ],
  },
  {
    title: 'Team',
    items: [
      {
        label: 'User Management',
        href: '/user-management',
        icon: <Users size={16} strokeWidth={1.75} />,
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, toggleRole, setRole } = useRole();
  const { currentUser, email } = useCurrentUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [canManage, setCanManage] = useState(false);

  // Manager view is for leaders/admins only (users.is_lead or role=admin in the DB)
  useEffect(() => {
    if (!email) return;
    let active = true;
    supabase
      .from('users')
      .select('is_lead, role')
      .ilike('email', email)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const ok = !!data && (data.is_lead === true || data.role === 'admin');
        setCanManage(ok);
        // Leads & Divya land on the team (manager) view; members are always individual
        setRole(ok ? 'manager' : 'individual');
      });
    return () => { active = false; };
  }, [email, setRole]);

  const displayName = currentUser?.name ?? (email ? email.split('@')[0] : 'Loading…');
  const displayDesignation = currentUser?.designation ?? (email ?? '');
  const displayInitials = currentUser ? getInitials(currentUser.name) : (email ? email[0].toUpperCase() : '·');

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <aside className="gb-sidebar w-64 flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <Link href="/design-ops/dashboard" className="flex items-center gap-2.5 group">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-semibold text-[13px] flex-shrink-0"
            style={{
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-text)',
              border: '1px solid var(--border)',
            }}
          >
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Marketing Beats
            </div>
            <div className="text-[11px] leading-tight" style={{ color: 'var(--text-faint)' }}>
              Square Yards
            </div>
          </div>
          <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
        </Link>
      </div>

      {/* Workspace switcher / role pill — leaders & admins only */}
      {canManage && (
      <div className="px-4 mb-3">
        <button
          onClick={toggleRole}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md border text-left transition-colors"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
              View as
            </div>
            <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
              {role === 'manager' ? 'Manager' : 'Individual'}
            </div>
          </div>
          <div
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{
              backgroundColor: role === 'manager' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
              color: role === 'manager' ? 'var(--accent-text)' : 'var(--text-muted)',
            }}
          >
            {role === 'manager' ? 'MGR' : 'IND'}
          </div>
        </button>
      </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {navSections
          .filter((section) => section.title !== 'Admin' || canManage)
          .map((section) => (
          <div key={section.title} className="mb-5">
            <h3 className="gb-nav-section-title">{section.title}</h3>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`gb-nav-item ${isActive(item.href) ? 'gb-nav-item-active' : ''}`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isActive(item.href) ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: isActive(item.href) ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t relative" style={{ borderColor: 'var(--border)' }}>
        {/* Popup menu */}
        {showUserMenu && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1 rounded-md overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 50,
            }}
          >
            <button
              onClick={() => { setShowUserMenu(false); setShowChangePwd(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Settings size={14} strokeWidth={1.75} />
              Change password
            </button>
            <div style={{ height: 1, backgroundColor: 'var(--border)' }} />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--error)' }}
            >
              <LogOut size={14} strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        )}

        {/* Change password modal */}
        {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}

        <div
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
            style={{
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-text)',
              border: '1px solid var(--border)',
            }}
          >
            {displayInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {displayName}
            </div>
            <div className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>
              {displayDesignation}
            </div>
          </div>
          <button className="gb-icon-btn" title="Settings" style={{ width: 26, height: 26 }}>
            <Settings size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (newPwd.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPwd !== confirmPwd) { setError('Passwords do not match.'); return; }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPwd });
    setLoading(false);
    if (err) { setError(err.message); } else { setSuccess(true); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,17,23,0.5)' }} onClick={onClose}>
      <div className="gb-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Change password</h3>
        {success ? (
          <div>
            <div className="text-[13px] mb-4" style={{ color: 'var(--success)' }}>Password updated successfully.</div>
            <button onClick={onClose} className="gb-btn gb-btn-primary w-full">Done</button>
          </div>
        ) : (
          <>
            {error && <div className="mb-3 p-2 rounded text-[12px]" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)' }}>{error}</div>}
            <div className="mb-3">
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-faint)' }}>New password</label>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Min 8 characters" className="gb-input w-full" />
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-faint)' }}>Confirm password</label>
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Re-enter password" className="gb-input w-full" />
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="gb-btn gb-btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={loading} className="gb-btn gb-btn-primary flex-1">{loading ? 'Saving…' : 'Update'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

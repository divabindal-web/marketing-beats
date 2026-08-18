'use client';
import { Search, Sun, Moon, ChevronRight, Bell, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { myNotifications, unreadCount, markAllRead, NotificationRow } from '@/lib/work-api';
import SearchPalette from './SearchPalette';

interface TopbarProps {
  title: string;
  onNewRequest?: () => void;
  /** Opens the nav drawer on small screens, where the sidebar is hidden. */
  onOpenNav?: () => void;
}

const breadcrumbMap: Record<string, { section: string; sectionHref: string; label: string }> = {
  '/design-ops/dashboard': { section: 'Design Ops', sectionHref: '/design-ops/dashboard', label: 'Dashboard' },
  '/design-ops/requests': { section: 'Design Ops', sectionHref: '/design-ops/dashboard', label: 'All Requests' },
  '/design-ops/downloads': { section: 'Design Ops', sectionHref: '/design-ops/dashboard', label: 'Downloads / Uploads' },
  // Social used to point at /social/dashboard, which was one of the
  // sample-data pages — a live crumb from the real calendar into invented
  // numbers. It points at the calendar now, which is the only Social page in
  // the sidebar.
  '/social/calendar': { section: 'Social', sectionHref: '/social/calendar', label: 'Calendar' },
  '/social/how-to-fetch': { section: 'Social', sectionHref: '/social/calendar', label: 'How to fetch' },
  '/overview': { section: 'Home', sectionHref: '/overview', label: 'Overview' },
  '/performance-data/monthly': { section: 'Performance Data', sectionHref: '/performance-data/monthly', label: 'Monthly close' },
  '/performance-data/seo': { section: 'Performance Data', sectionHref: '/performance-data/monthly', label: 'SEO' },
  '/performance-data/orm': { section: 'Performance Data', sectionHref: '/performance-data/monthly', label: 'ORM' },
  '/performance-data/paid': { section: 'Performance Data', sectionHref: '/performance-data/monthly', label: 'Paid Campaigns' },
  '/performance-data/social': { section: 'Performance Data', sectionHref: '/performance-data/monthly', label: 'Social (Hootsuite)' },
  '/performance-data/upload': { section: 'Performance Data', sectionHref: '/performance-data/monthly', label: 'Upload Data' },
  '/design-ops/my-tasks': { section: 'Design Ops', sectionHref: '/design-ops/dashboard', label: 'My Tasks' },
  '/design-ops/reports': { section: 'Design Ops', sectionHref: '/design-ops/dashboard', label: 'Reports — Output & TAT' },
  '/user-management': { section: 'Admin', sectionHref: '/user-management', label: 'User Management' },
  '/admin/reset-passwords': { section: 'Admin', sectionHref: '/user-management', label: 'Reset Passwords' },
};

/**
 * Where a notification takes you. They were previously plain text, so being
 * told "you have been assigned X" gave you no way to reach X.
 * `request_id` covers everything Design Ops raises; the close has no request
 * behind it, so it routes by type instead.
 */
function notificationHref(n: NotificationRow): string {
  if (n.request_id) return `/design-ops/requests?open=${n.request_id}`;
  if (n.type === 'close_assigned') return '/performance-data/monthly';
  return '/overview';
}

export default function Topbar({ title, onNewRequest, onOpenNav }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [showBell, setShowBell] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notes, setNotes] = useState<NotificationRow[]>([]);

  useEffect(() => {
    let active = true;
    const poll = () => unreadCount().then((n) => { if (active) setUnread(n); }).catch(() => {});
    poll();
    const iv = setInterval(poll, 60000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  const openBell = async () => {
    setShowBell((v) => !v);
    if (!showBell) {
      try {
        setNotes(await myNotifications(15));
        await markAllRead();
        setUnread(0);
      } catch { /* noop */ }
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // The ⌘K hint has always been on screen; now it does something.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const crumb = breadcrumbMap[pathname] ?? { section: 'Workspace', sectionHref: '/', label: title };

  return (
    <header className="gb-topbar h-14 flex items-center justify-between px-4 md:px-6 fixed top-0 right-0 left-0 lg:left-64 z-40">
      {/* Left: nav toggle (small screens) + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onOpenNav} className="gb-icon-btn lg:hidden flex-shrink-0" title="Menu" aria-label="Open navigation">
          <Menu size={17} strokeWidth={1.75} />
        </button>
      <div className="gb-breadcrumb min-w-0">
        <Link href={crumb.sectionHref} className="gb-breadcrumb-link">
          {crumb.section}
        </Link>
        <ChevronRight size={13} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
        <span className="gb-breadcrumb-current truncate">{crumb.label}</span>
      </div>
      </div>

      {/* Right: Search + actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button onClick={() => setSearchOpen(true)} className="hidden md:flex w-72 text-left" aria-label="Search">
          <div className="gb-search w-full" style={{ cursor: 'pointer' }}>
            <Search size={14} strokeWidth={1.75} style={{ color: 'var(--text-faint)' }} />
            <span className="flex-1 text-[13px]" style={{ color: 'var(--text-faint)' }}>
              Search requests, people, pages…
            </span>
            <kbd>⌘K</kbd>
          </div>
        </button>
        <button onClick={() => setSearchOpen(true)} className="gb-icon-btn md:hidden" title="Search" aria-label="Search">
          <Search size={15} strokeWidth={1.75} />
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="gb-icon-btn"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <Moon size={15} strokeWidth={1.75} />
            ) : (
              <Sun size={15} strokeWidth={1.75} />
            )}
          </button>
        )}

        {/* Divider */}
        <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }} />

        {/* Notifications bell */}
        <div className="relative">
          <button onClick={openBell} className="gb-icon-btn relative" title="Notifications">
            <Bell size={15} strokeWidth={1.75} />
            {unread > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9.5px] font-bold flex items-center justify-center"
                style={{ backgroundColor: 'var(--error)', color: '#fff' }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {showBell && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-md overflow-hidden z-50"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
            >
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}>
                Notifications
              </div>
              {notes.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12.5px]" style={{ color: 'var(--text-faint)' }}>Nothing yet.</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {notes.map((n) => (
                    <Link
                      key={n.id}
                      href={notificationHref(n)}
                      onClick={() => setShowBell(false)}
                      className="block px-3 py-2.5 transition-colors hover:brightness-[0.98]"
                      style={{ borderBottom: '1px solid var(--border)', backgroundColor: n.read ? undefined : 'var(--bg-tertiary)' }}
                    >
                      <div className="text-[12.5px]" style={{ color: 'var(--text-primary)' }}>{n.message}</div>
                      <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

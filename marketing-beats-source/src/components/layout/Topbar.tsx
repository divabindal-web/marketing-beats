'use client';
import { Search, Sun, Moon, Plus, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import RequestModal from '@/components/design-ops/RequestModal';
import { createRequest } from '@/lib/requests-api';
import { Request } from '@/types';

interface TopbarProps {
  title: string;
  onNewRequest?: () => void;
}

const breadcrumbMap: Record<string, { section: string; sectionHref: string; label: string }> = {
  '/design-ops/dashboard': { section: 'Design Ops', sectionHref: '/design-ops/dashboard', label: 'Dashboard' },
  '/design-ops/requests': { section: 'Design Ops', sectionHref: '/design-ops/dashboard', label: 'All Requests' },
  '/design-ops/downloads': { section: 'Design Ops', sectionHref: '/design-ops/dashboard', label: 'Downloads / Uploads' },
  '/social/dashboard': { section: 'Social', sectionHref: '/social/dashboard', label: 'Dashboard' },
  '/social/upload': { section: 'Social', sectionHref: '/social/dashboard', label: 'Upload Metrics' },
  '/social/calendar': { section: 'Social', sectionHref: '/social/dashboard', label: 'Calendar' },
  '/social/how-to-fetch': { section: 'Social', sectionHref: '/social/dashboard', label: 'How to fetch' },
  '/performance/my': { section: 'Performance', sectionHref: '/performance/my', label: 'My Performance' },
  '/performance/team': { section: 'Performance', sectionHref: '/performance/team', label: 'Team Performance' },
  '/performance/change-requests': { section: 'Performance', sectionHref: '/performance/team', label: 'Change Requests' },
  '/user-management': { section: 'Admin', sectionHref: '/user-management', label: 'User Management' },
  '/admin/reset-passwords': { section: 'Admin', sectionHref: '/user-management', label: 'Reset Passwords' },
};

export default function Topbar({ title, onNewRequest }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [showGlobalModal, setShowGlobalModal] = useState(false);

  const handleGlobalSave = (newRequest: Partial<Request>) => {
    const id = 'req-' + Math.random().toString(36).slice(2, 11);
    const nowIso = new Date().toISOString();
    const firstStage = newRequest.current_stage || 'Assigned';
    const full: Request = {
      id,
      type: newRequest.type || 'Graphics',
      requested_by: newRequest.requested_by || 'Social Team',
      entity: newRequest.entity,
      title: newRequest.title || '',
      description: newRequest.description,
      requestor_name: newRequest.requestor_name || '',
      requestor_id: newRequest.requestor_id,
      need_by: newRequest.need_by || '',
      reference_link: newRequest.reference_link,
      current_stage: firstStage,
      revisions: 0,
      created_at: nowIso,
      updated_at: nowIso,
      transitions: newRequest.transitions ?? [],
    };
    createRequest(full)
      .then(() => {
        setShowGlobalModal(false);
        if (pathname === '/design-ops/requests') {
          window.location.reload();
        } else {
          router.push('/design-ops/requests');
        }
      })
      .catch((err) => {
        alert('Could not save the request: ' + (err?.message ?? String(err)));
      });
  };
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const crumb = breadcrumbMap[pathname] ?? { section: 'Workspace', sectionHref: '/', label: title };

  return (
    <header className="gb-topbar h-14 flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-40">
      {/* Left: Breadcrumb */}
      <div className="gb-breadcrumb">
        <Link href={crumb.sectionHref} className="gb-breadcrumb-link">
          {crumb.section}
        </Link>
        <ChevronRight size={13} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
        <span className="gb-breadcrumb-current">{crumb.label}</span>
      </div>

      {/* Right: Search + actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex w-72">
          <div className="gb-search">
            <Search size={14} strokeWidth={1.75} style={{ color: 'var(--text-faint)' }} />
            <input type="text" placeholder="Search requests, users, calendar..." />
            <kbd>⌘K</kbd>
          </div>
        </div>

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

        {/* New Request — works from every page: opens the form and saves to the DB */}
        <button
          onClick={() => (onNewRequest ? onNewRequest() : setShowGlobalModal(true))}
          className="gb-btn gb-btn-primary"
        >
          <Plus size={14} strokeWidth={2.25} />
          <span>New Request</span>
        </button>
      </div>

      {showGlobalModal && (
        <RequestModal
          isOpen={showGlobalModal}
          onClose={() => setShowGlobalModal(false)}
          onSave={handleGlobalSave}
        />
      )}
    </header>
  );
}

'use client';

/**
 * Command palette behind the topbar search.
 *
 * The topbar carried a search box and a ⌘K hint from the start, but the input
 * had no handler at all — it looked like the most-used control in the app and
 * did nothing on every page. This makes it real.
 *
 * Everything is searched client-side over data the app has already loaded:
 * requests, people and the nav itself. That keeps it instant and avoids a
 * round trip per keystroke on a dataset this size.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ClipboardList, CornerDownLeft, Search, User, Compass } from 'lucide-react';
import { fetchRequests } from '@/lib/requests-api';
import { loadDirectory, DirectoryUser } from '@/lib/directory';
import { Request } from '@/types';

type Kind = 'request' | 'person' | 'page';
interface Hit { kind: Kind; id: string; title: string; sub: string; href: string }

const PAGES: { title: string; sub: string; href: string }[] = [
  { title: 'Dashboard', sub: 'Design Ops', href: '/design-ops/dashboard' },
  { title: 'My Tasks', sub: 'Design Ops', href: '/design-ops/my-tasks' },
  { title: 'All Requests', sub: 'Design Ops', href: '/design-ops/requests' },
  { title: 'Downloads / Uploads', sub: 'Design Ops', href: '/design-ops/downloads' },
  { title: 'Team Output & TAT', sub: 'Design Ops', href: '/design-ops/reports' },
  { title: 'Social Calendar', sub: 'Social', href: '/social/calendar' },
  { title: 'Overview', sub: 'Home', href: '/overview' },
  { title: 'Monthly close', sub: 'Performance Data', href: '/performance-data/monthly' },
  { title: 'SEO', sub: 'Performance Data', href: '/performance-data/seo' },
  { title: 'ORM', sub: 'Performance Data', href: '/performance-data/orm' },
  { title: 'Paid Campaigns', sub: 'Performance Data', href: '/performance-data/paid' },
  { title: 'Social', sub: 'Performance Data', href: '/performance-data/social' },
  { title: 'Upload Data', sub: 'Performance Data', href: '/performance-data/upload' },
  { title: 'User Management', sub: 'Team', href: '/user-management' },
];

const KIND_ICON: Record<Kind, typeof Search> = {
  request: ClipboardList, person: User, page: Compass,
};

export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const [requests, setRequests] = useState<Request[]>([]);
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load once the palette is first opened, not on every app load.
  useEffect(() => {
    if (!open || requests.length || people.length) return;
    fetchRequests().then(setRequests).catch(() => {});
    loadDirectory().then(setPeople).catch(() => {});
  }, [open, requests.length, people.length]);

  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
      // Focus after paint so the caret lands in the field.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const out: Hit[] = [];
    const match = (s: string | undefined | null) => !!s && s.toLowerCase().includes(term);

    if (!term) {
      return PAGES.slice(0, 7).map((p) => ({ kind: 'page' as const, id: p.href, title: p.title, sub: p.sub, href: p.href }));
    }
    for (const r of requests) {
      if (match(r.title) || match(r.requestor_name) || match(r.id) || match(r.current_stage)) {
        out.push({
          kind: 'request', id: r.id, title: r.title,
          sub: `${r.type} · ${r.current_stage} · from ${r.requestor_name}`,
          href: `/design-ops/requests?q=${encodeURIComponent(r.title)}`,
        });
      }
    }
    for (const p of people) {
      if (match(p.name) || match(p.email) || match(p.team)) {
        out.push({
          kind: 'person', id: p.id, title: p.name,
          sub: [p.team, p.designation].filter(Boolean).join(' · ') || (p.email ?? ''),
          href: `/user-management?q=${encodeURIComponent(p.name)}`,
        });
      }
    }
    for (const p of PAGES) {
      if (match(p.title) || match(p.sub)) {
        out.push({ kind: 'page', id: p.href, title: p.title, sub: p.sub, href: p.href });
      }
    }
    return out.slice(0, 40);
  }, [q, requests, people]);

  const go = useCallback((h: Hit) => { onClose(); router.push(h.href); }, [onClose, router]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[cursor]) go(hits[cursor]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200] backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div className="fixed inset-x-0 top-[10vh] z-[201] flex justify-center px-4">
        <div className="gb-card w-full max-w-xl overflow-hidden shadow-xl mb-scale-in flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <Search size={16} style={{ color: 'var(--text-faint)' }} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setCursor(0); }}
              onKeyDown={onKey}
              placeholder="Search requests, people or pages…"
              className="flex-1 bg-transparent outline-none text-[14px]"
              style={{ color: 'var(--text-primary)' }}
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-faint)' }}>esc</kbd>
          </div>

          <div ref={listRef} className="overflow-y-auto flex-1">
            {hits.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
                Nothing matches “{q}”.
              </div>
            ) : hits.map((h, i) => {
              const Icon = KIND_ICON[h.kind];
              const active = i === cursor;
              return (
                <button
                  key={h.kind + h.id + i}
                  data-i={i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(h)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                  style={{ backgroundColor: active ? 'var(--bg-hover)' : 'transparent' }}
                >
                  <span className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    <Icon size={13} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{h.title}</span>
                    <span className="block text-[11.5px] truncate" style={{ color: 'var(--text-faint)' }}>{h.sub}</span>
                  </span>
                  {active && <CornerDownLeft size={13} style={{ color: 'var(--text-faint)' }} />}
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 text-[11px] flex items-center gap-3 flex-shrink-0"
               style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}>
            <span>↑↓ to move</span><span>↵ to open</span>
            <span className="ml-auto">{hits.length} result{hits.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

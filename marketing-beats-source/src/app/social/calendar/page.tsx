'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Send,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  SocialCalendarEntry,
  SocialPlatform,
  SocialContentType,
  RequestType,
} from '@/types';

/* ------------------------------------------------------------------ */
/*  Sample calendar entries — deterministic, current month             */
/* ------------------------------------------------------------------ */

function buildSampleEntries(): SocialCalendarEntry[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const seeds: Array<{
    day: number;
    title: string;
    platform: SocialPlatform;
    type: SocialContentType;
  }> = [
    { day: 2,  title: 'Q1 market recap reel',         platform: 'Instagram', type: 'Reel' },
    { day: 4,  title: 'Sales Director thought-piece', platform: 'LinkedIn',  type: 'Static' },
    { day: 6,  title: 'New Dubai project carousel',   platform: 'Instagram', type: 'Carousel' },
    { day: 8,  title: 'Property tour walkthrough',    platform: 'YouTube',   type: 'Video' },
    { day: 10, title: 'Client testimonial',           platform: 'Facebook',  type: 'Video' },
    { day: 12, title: 'Mortgage explainer thread',    platform: 'X/Twitter', type: 'Thread' },
    { day: 13, title: 'Behind the scenes shoot',      platform: 'Instagram', type: 'Story' },
    { day: 15, title: 'Mid-month market pulse',       platform: 'LinkedIn',  type: 'Carousel' },
    { day: 17, title: 'Office tour reel',             platform: 'Instagram', type: 'Reel' },
    { day: 19, title: 'Investor Q&A clip',            platform: 'YouTube',   type: 'Video' },
    { day: 21, title: 'New listing showcase',         platform: 'Instagram', type: 'Carousel' },
    { day: 23, title: 'Hiring announcement',          platform: 'LinkedIn',  type: 'Static' },
    { day: 26, title: 'Property comparison reel',     platform: 'Instagram', type: 'Reel' },
    { day: 28, title: 'Month wrap thread',            platform: 'X/Twitter', type: 'Thread' },
  ];

  return seeds.map((s, i) => {
    const date = new Date(Date.UTC(year, month, s.day));
    return {
      id: `cal-${i + 1}`,
      title: s.title,
      platform: s.platform,
      content_type: s.type,
      scheduled_date: date.toISOString().split('T')[0],
      caption: `${s.title} — autoschedule.`,
      hashtags: ['#realestate', '#dubai', '#squareyards'],
      created_at: date.toISOString(),
      created_by: 'user-divya-krishnan',
    };
  });
}

const PLATFORM_PILL: Record<SocialPlatform, { bg: string; text: string; border: string }> = {
  Instagram: { bg: 'rgba(193, 53, 132, 0.08)', text: '#a32a72', border: 'rgba(193, 53, 132, 0.2)' },
  LinkedIn:  { bg: 'rgba(10, 102, 194, 0.08)', text: '#0a66c2', border: 'rgba(10, 102, 194, 0.2)' },
  Facebook:  { bg: 'rgba(24, 119, 242, 0.08)', text: '#1565c0', border: 'rgba(24, 119, 242, 0.2)' },
  'X/Twitter': { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: 'var(--border)' },
  YouTube:   { bg: 'rgba(220, 38, 38, 0.08)', text: '#b91c1c', border: 'rgba(220, 38, 38, 0.2)' },
};

/** Map a content type to the right design request type. */
/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

interface LinkedRequest {
  id: string;
  type: RequestType;
  title: string;
  need_by: string;
}

export default function SocialCalendarPage() {
  const [entries, setEntries] = useState<SocialCalendarEntry[]>(() => buildSampleEntries());
  const [linkedRequests, setLinkedRequests] = useState<Record<string, LinkedRequest>>({});
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selectedEntry, setSelectedEntry] = useState<SocialCalendarEntry | null>(null);
  const [createForEntry, setCreateForEntry] = useState<SocialCalendarEntry | null>(null);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null; iso: string | null }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, iso });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
    return cells;
  }, [cursor]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, SocialCalendarEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.scheduled_date) ?? [];
      arr.push(e);
      map.set(e.scheduled_date, arr);
    }
    return map;
  }, [entries]);

  const todayIso = new Date().toISOString().split('T')[0];

  const goToday = () => {
    const t = new Date();
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  const handleCreateRequest = (entry: SocialCalendarEntry, payload: { type: RequestType; need_by: string }) => {
    const requestId = `req-cal-${entry.id}-${Date.now()}`;
    const linked: LinkedRequest = {
      id: requestId,
      type: payload.type,
      title: entry.title,
      need_by: payload.need_by,
    };
    setLinkedRequests((prev) => ({ ...prev, [entry.id]: linked }));
    // Update the entry to record the linked request
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, request_id: requestId } : e)),
    );
    setCreateForEntry(null);
    setSelectedEntry(null);
  };

  return (
    <div>
      {/* Page header */}
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Social Calendar</h1>
          <p className="gb-page-description">
            Maintained by the social team. Click any entry to spin up a design request — graphics
            and video items flow straight into the design-ops queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="gb-btn gb-btn-secondary">
            Today
          </button>
          <button className="gb-btn gb-btn-primary">
            <Plus size={14} strokeWidth={2.25} />
            New entry
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="gb-icon-btn"
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {monthLabel}
          </h2>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="gb-icon-btn"
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
          {entries.length} entries · {Object.keys(linkedRequests).length} linked to design ops
        </div>
      </div>

      {/* Calendar grid */}
      <div className="gb-card overflow-hidden mb-6">
        <div
          className="grid grid-cols-7 text-[11px] uppercase tracking-wider font-semibold"
          style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-3 py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((cell, idx) => {
            const dayEntries = cell.iso ? entriesByDay.get(cell.iso) ?? [] : [];
            const isToday = cell.iso === todayIso;
            return (
              <div
                key={idx}
                className="px-2 py-2"
                style={{
                  minHeight: '110px',
                  borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: isToday ? 'var(--accent-light)' : 'transparent',
                }}
              >
                {cell.date && (
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[11px] font-semibold"
                      style={{
                        color: isToday ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {dayEntries.slice(0, 3).map((e) => {
                    const pill = e.platform ? PLATFORM_PILL[e.platform] : null;
                    const isLinked = !!linkedRequests[e.id];
                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelectedEntry(e)}
                        className="w-full text-left px-1.5 py-1 rounded text-[11px] truncate transition-colors"
                        style={{
                          backgroundColor: pill?.bg ?? 'var(--bg-tertiary)',
                          color: pill?.text ?? 'var(--text-secondary)',
                          border: `1px solid ${pill?.border ?? 'var(--border)'}`,
                        }}
                        title={e.title}
                      >
                        {isLinked && '✓ '}
                        {e.title}
                      </button>
                    );
                  })}
                  {dayEntries.length > 3 && (
                    <div className="text-[10px] px-1" style={{ color: 'var(--text-faint)' }}>
                      +{dayEntries.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail drawer */}
      {selectedEntry && (
        <DetailDrawer
          entry={selectedEntry}
          linked={linkedRequests[selectedEntry.id]}
          onClose={() => setSelectedEntry(null)}
          onCreateRequest={() => setCreateForEntry(selectedEntry)}
        />
      )}

      {/* Create-request modal */}
      {createForEntry && (
        <CreateRequestModal
          entry={createForEntry}
          onClose={() => setCreateForEntry(null)}
          onSave={(payload) => handleCreateRequest(createForEntry, payload)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Drawer & modal                                                     */
/* ------------------------------------------------------------------ */

function DetailDrawer({
  entry,
  linked,
  onClose,
  onCreateRequest,
}: {
  entry: SocialCalendarEntry;
  linked?: LinkedRequest;
  onClose: () => void;
  onCreateRequest: () => void;
}) {
  const dateStr = new Date(entry.scheduled_date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const pill = entry.platform ? PLATFORM_PILL[entry.platform] : null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(15, 17, 23, 0.35)' }}
      />
      <div
        className="fixed right-0 top-0 h-screen w-[420px] z-50 flex flex-col"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {dateStr}
          </div>
          <button onClick={onClose} className="gb-icon-btn" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <h2 className="text-[16px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {entry.title}
            </h2>
            {entry.platform && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
                style={{
                  backgroundColor: pill?.bg,
                  color: pill?.text,
                  border: `1px solid ${pill?.border}`,
                }}
              >
                {entry.platform} · {entry.content_type}
              </span>
            )}
          </div>

          {entry.caption && (
            <div>
              <div
                className="text-[11px] uppercase tracking-wider mb-1"
                style={{ color: 'var(--text-faint)' }}
              >
                Caption
              </div>
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                {entry.caption}
              </p>
            </div>
          )}

          {entry.hashtags && entry.hashtags.length > 0 && (
            <div>
              <div
                className="text-[11px] uppercase tracking-wider mb-1"
                style={{ color: 'var(--text-faint)' }}
              >
                Hashtags
              </div>
              <div className="flex flex-wrap gap-1">
                {entry.hashtags.map((h) => (
                  <span
                    key={h}
                    className="px-1.5 py-0.5 rounded text-[11px]"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Linked design request */}
          <div>
            <div
              className="text-[11px] uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-faint)' }}
            >
              Design request
            </div>
            {linked ? (
              <div
                className="p-3 rounded-md"
                style={{
                  backgroundColor: 'rgba(22, 163, 74, 0.05)',
                  border: '1px solid rgba(22, 163, 74, 0.18)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={14} style={{ color: '#15803d' }} />
                  <span className="text-[12px] font-semibold" style={{ color: '#15803d' }}>
                    Request created
                  </span>
                </div>
                <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  {linked.type} · need by {new Date(linked.need_by).toLocaleDateString()}
                </div>
                <Link
                  href="/design-ops/requests"
                  className="text-[12px] mt-2 inline-flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  View in queue
                  <ExternalLink size={11} />
                </Link>
              </div>
            ) : (
              <button
                onClick={onCreateRequest}
                className="w-full gb-btn gb-btn-primary justify-center"
              >
                <Send size={13} strokeWidth={2.25} />
                Create design request
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function CreateRequestModal({
  entry,
  onClose,
  onSave,
}: {
  entry: SocialCalendarEntry;
  onClose: () => void;
  onSave: (payload: { type: RequestType; need_by: string }) => void;
}) {
  const [type, setType] = useState<RequestType>(suggestedRequestType(entry.content_type));
  const [needBy, setNeedBy] = useState(() => {
    // Default need-by = 2 days before scheduled date
    const d = new Date(entry.scheduled_date);
    d.setDate(d.getDate() - 2);
    return d.toISOString().split('T')[0];
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 17, 23, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="gb-card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Create design request
          </h3>
          <button onClick={onClose} className="gb-icon-btn">
            <X size={14} />
          </button>
        </div>

        <div className="text-[12px] mb-4" style={{ color: 'var(--text-secondary)' }}>
          Linking <strong>{entry.title}</strong> to a new request in the design-ops queue.
        </div>

        <div className="space-y-4 mb-5">
          <div>
            <label
              className="block text-[11px] uppercase tracking-wider mb-1.5 font-semibold"
              style={{ color: 'var(--text-faint)' }}
            >
              Request type
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['Video', 'Social Media Graphics', 'Graphics'] as RequestType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="px-2 py-1.5 rounded text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: type === t ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    color: type === t ? 'var(--accent-text)' : 'var(--text-secondary)',
                    border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {t === 'Social Media Graphics' ? 'Social GFX' : t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              className="block text-[11px] uppercase tracking-wider mb-1.5 font-semibold"
              style={{ color: 'var(--text-faint)' }}
            >
              Need by
            </label>
            <input
              type="date"
              value={needBy}
              onChange={(e) => setNeedBy(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-[13px]"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
              Scheduled to publish {new Date(entry.scheduled_date).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="gb-btn gb-btn-secondary">
            Cancel
          </button>
          <button onClick={() => onSave({ type, need_by: needBy })} className="gb-btn gb-btn-primary">
            <Send size={13} strokeWidth={2.25} />
            Create request
          </button>
        </div>
      </div>
    </div>
  );
}

function suggestedRequestType(contentType?: SocialContentType): RequestType {
  if (contentType === 'Video' || contentType === 'Reel') return 'Video';
  if (contentType === 'Story' || contentType === 'Carousel' || contentType === 'Static') {
    return 'Social Media Graphics';
  }
  return 'Graphics';
}

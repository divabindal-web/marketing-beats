'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  ExternalLink,
  CalendarDays,
  Target,
  Trash2,
} from 'lucide-react';
import { SocialCalendarEntry, SocialPlatform, SocialContentType } from '@/types';
import { supabase } from '@/lib/supabase';
import { currentDbUser } from '@/lib/work-api';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FINAL_STAGES = ['Done', 'Uploaded'];
const PLATFORMS: SocialPlatform[] = ['Instagram', 'LinkedIn', 'Facebook', 'X/Twitter', 'YouTube'];
const CONTENT_TYPES: SocialContentType[] = ['Static', 'Carousel', 'Reel', 'Story', 'Video', 'Thread'];

const PLATFORM_PILL: Record<SocialPlatform, { bg: string; text: string; border: string }> = {
  Instagram: { bg: 'rgba(193, 53, 132, 0.08)', text: '#a32a72', border: 'rgba(193, 53, 132, 0.2)' },
  LinkedIn:  { bg: 'rgba(10, 102, 194, 0.08)', text: '#0a66c2', border: 'rgba(10, 102, 194, 0.2)' },
  Facebook:  { bg: 'rgba(24, 119, 242, 0.08)', text: '#1565c0', border: 'rgba(24, 119, 242, 0.2)' },
  'X/Twitter': { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: 'var(--border)' },
  YouTube:   { bg: 'rgba(220, 38, 38, 0.08)', text: '#b91c1c', border: 'rgba(220, 38, 38, 0.2)' },
};

interface RequestOption {
  id: string;
  title: string;
}

interface LinkedRequestInfo {
  id: string;
  title: string;
  current_stage: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SocialCalendarPage() {
  const [entries, setEntries] = useState<SocialCalendarEntry[]>([]);
  /** Keyed by request id — stage/title of every request linked from this month. */
  const [linkedInfo, setLinkedInfo] = useState<Record<string, LinkedRequestInfo>>({});
  const [openRequests, setOpenRequests] = useState<RequestOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'All'>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayIso = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;

  const monthStart = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-01`;
  const monthEnd = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(
    new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate(),
  )}`;

  /* -------- load entries for the visible month -------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data, error } = await supabase
          .from('social_calendar')
          .select('*')
          .gte('scheduled_date', monthStart)
          .lte('scheduled_date', monthEnd)
          .order('scheduled_date', { ascending: true });
        if (error) throw error;
        const rows = (data as SocialCalendarEntry[]) ?? [];
        if (cancelled) return;
        setEntries(rows);

        const linkedIds = Array.from(
          new Set(rows.map((r) => r.request_id).filter((id): id is string => !!id)),
        );
        if (linkedIds.length > 0) {
          const { data: reqs, error: reqErr } = await supabase
            .from('requests')
            .select('id, title, current_stage')
            .in('id', linkedIds);
          if (reqErr) throw reqErr;
          if (cancelled) return;
          setLinkedInfo((prev) => {
            const next = { ...prev };
            for (const r of (reqs as LinkedRequestInfo[]) ?? []) next[r.id] = r;
            return next;
          });
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthStart, monthEnd]);

  /* -------- load link candidates once -------- */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) setOpenRequests((data as RequestOption[]) ?? []);
    })();
  }, []);

  /* -------- derived -------- */
  const isDelivered = (e: SocialCalendarEntry) =>
    !!e.request_id && FINAL_STAGES.includes(linkedInfo[e.request_id]?.current_stage ?? '');

  const visibleEntries = useMemo(
    () => (platformFilter === 'All' ? entries : entries.filter((e) => e.platform === platformFilter)),
    [entries, platformFilter],
  );

  const calendarDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null; iso: string | null }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
      cells.push({ date, iso });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
    return cells;
  }, [cursor]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, SocialCalendarEntry[]>();
    for (const e of visibleEntries) {
      const arr = map.get(e.scheduled_date) ?? [];
      arr.push(e);
      map.set(e.scheduled_date, arr);
    }
    return map;
  }, [visibleEntries]);

  /* -------- adherence stats (whole month, unfiltered) -------- */
  const plannedCount = entries.length;
  const deliveredCount = entries.filter(isDelivered).length;
  const dueCount = entries.filter((e) => e.scheduled_date <= todayIso).length;
  const adherence = dueCount === 0 ? null : Math.round((deliveredCount / dueCount) * 100);
  const linkedCount = entries.filter((e) => !!e.request_id).length;

  const selectedEntry = selectedId ? entries.find((e) => e.id === selectedId) ?? null : null;

  const goToday = () => {
    const t = new Date();
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  /* -------- mutations -------- */
  const handleAdd = async (payload: {
    title: string;
    platform: SocialPlatform;
    content_type: SocialContentType;
    scheduled_date: string;
    caption: string;
  }) => {
    const me = await currentDbUser();
    const { data, error } = await supabase
      .from('social_calendar')
      .insert({
        title: payload.title,
        platform: payload.platform,
        content_type: payload.content_type,
        scheduled_date: payload.scheduled_date,
        caption: payload.caption || null,
        created_by: me?.id ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    const row = data as SocialCalendarEntry;
    if (row.scheduled_date >= monthStart && row.scheduled_date <= monthEnd) {
      setEntries((prev) =>
        [...prev, row].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
      );
    }
    setAddOpen(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('social_calendar').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleLink = async (entryId: string, requestId: string | null) => {
    const { error } = await supabase
      .from('social_calendar')
      .update({ request_id: requestId })
      .eq('id', entryId);
    if (error) {
      setErr(error.message);
      return;
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, request_id: requestId ?? undefined } : e)),
    );
    if (requestId && !linkedInfo[requestId]) {
      const { data } = await supabase
        .from('requests')
        .select('id, title, current_stage')
        .eq('id', requestId)
        .maybeSingle();
      if (data) {
        const info = data as LinkedRequestInfo;
        setLinkedInfo((prev) => ({ ...prev, [info.id]: info }));
      }
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Social Calendar</h1>
          <p className="gb-page-description">
            Maintained by the social team. Link entries to design-ops requests to track whether
            planned posts actually shipped.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="gb-btn gb-btn-secondary">
            Today
          </button>
          <button onClick={() => setAddOpen(true)} className="gb-btn gb-btn-primary">
            <Plus size={14} strokeWidth={2.25} />
            New entry
          </button>
        </div>
      </div>

      {/* Adherence header */}
      <div className="grid grid-cols-3 gap-3 mb-2">
        <div className="gb-stat-card">
          <div className="flex items-start justify-between mb-1">
            <div className="gb-stat-label">Planned this month</div>
            <CalendarDays size={14} strokeWidth={1.75} style={{ color: 'var(--text-faint)' }} />
          </div>
          <div className="gb-stat-value">{loading ? '…' : plannedCount}</div>
        </div>
        <div className="gb-stat-card">
          <div className="flex items-start justify-between mb-1">
            <div className="gb-stat-label">Delivered</div>
            <CheckCircle2 size={14} strokeWidth={1.75} style={{ color: 'var(--success)' }} />
          </div>
          <div className="gb-stat-value">{loading ? '…' : deliveredCount}</div>
        </div>
        <div className="gb-stat-card">
          <div className="flex items-start justify-between mb-1">
            <div className="gb-stat-label">Adherence</div>
            <Target size={14} strokeWidth={1.75} style={{ color: 'var(--text-faint)' }} />
          </div>
          <div className="gb-stat-value">{loading ? '…' : adherence === null ? '—' : `${adherence}%`}</div>
        </div>
      </div>
      <div className="text-[11px] mb-4" style={{ color: 'var(--text-faint)' }}>
        Adherence = planned posts whose linked request was completed
      </div>

      {/* Month nav + platform filter */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {(['All', ...PLATFORMS] as const).map((p) => {
              const active = platformFilter === p;
              const pill = p !== 'All' ? PLATFORM_PILL[p] : null;
              return (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className="px-2 py-1 rounded text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: active ? pill?.bg ?? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    color: active ? pill?.text ?? 'var(--accent-text)' : 'var(--text-secondary)',
                    border: `1px solid ${active ? pill?.border ?? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <div className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {entries.length} entries · {linkedCount} linked to design ops
          </div>
        </div>
      </div>

      {err && (
        <p className="text-[12.5px] mb-3" style={{ color: 'var(--error)' }}>
          {err}
        </p>
      )}
      {loading && <p className="gb-page-description mb-3">Loading calendar…</p>}

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
                    return (
                      <div key={e.id} className="relative group">
                        <button
                          onClick={() => setSelectedId(e.id)}
                          className="w-full text-left px-1.5 py-1 pr-5 rounded text-[11px] truncate transition-colors"
                          style={{
                            backgroundColor: pill?.bg ?? 'var(--bg-tertiary)',
                            color: pill?.text ?? 'var(--text-secondary)',
                            border: `1px solid ${pill?.border ?? 'var(--border)'}`,
                          }}
                          title={e.title}
                        >
                          {isDelivered(e) && '✓ '}
                          {e.title}
                        </button>
                        <button
                          onClick={() => void handleDelete(e.id)}
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: pill?.text ?? 'var(--text-secondary)' }}
                          title="Delete entry"
                        >
                          <X size={11} strokeWidth={2.5} />
                        </button>
                      </div>
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
          linked={selectedEntry.request_id ? linkedInfo[selectedEntry.request_id] : undefined}
          openRequests={openRequests}
          onClose={() => setSelectedId(null)}
          onLink={(requestId) => void handleLink(selectedEntry.id, requestId)}
          onDelete={() => void handleDelete(selectedEntry.id)}
        />
      )}

      {/* Add-entry modal */}
      {addOpen && (
        <AddEntryModal
          defaultDate={cursor.getMonth() === new Date().getMonth() && cursor.getFullYear() === new Date().getFullYear() ? todayIso : monthStart}
          onClose={() => setAddOpen(false)}
          onSave={handleAdd}
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
  openRequests,
  onClose,
  onLink,
  onDelete,
}: {
  entry: SocialCalendarEntry;
  linked?: LinkedRequestInfo;
  openRequests: RequestOption[];
  onClose: () => void;
  onLink: (requestId: string | null) => void;
  onDelete: () => void;
}) {
  const dateStr = new Date(entry.scheduled_date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const pill = entry.platform ? PLATFORM_PILL[entry.platform] : null;
  const isDone = !!linked && FINAL_STAGES.includes(linked.current_stage);

  // Make sure the currently linked request is selectable even if it is
  // not among the 50 most recent requests.
  const options: RequestOption[] =
    linked && !openRequests.some((r) => r.id === linked.id)
      ? [{ id: linked.id, title: linked.title }, ...openRequests]
      : openRequests;

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
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="gb-icon-btn" title="Delete entry">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} className="gb-icon-btn" title="Close">
              <X size={16} />
            </button>
          </div>
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
                {entry.platform}
                {entry.content_type ? ` · ${entry.content_type}` : ''}
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
              Linked design request
            </div>

            {linked && (
              <div
                className="p-3 rounded-md mb-2"
                style={
                  isDone
                    ? {
                        backgroundColor: 'rgba(22, 163, 74, 0.05)',
                        border: '1px solid rgba(22, 163, 74, 0.18)',
                      }
                    : {
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                      }
                }
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2
                    size={14}
                    style={{ color: isDone ? '#15803d' : 'var(--text-faint)' }}
                  />
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: isDone ? '#15803d' : 'var(--text-secondary)' }}
                  >
                    {isDone ? 'Delivered' : `In progress · ${linked.current_stage}`}
                  </span>
                </div>
                <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  {linked.title}
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
            )}

            <select
              value={entry.request_id ?? ''}
              onChange={(e) => onLink(e.target.value === '' ? null : e.target.value)}
              className="w-full px-3 py-2 rounded-md text-[13px]"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">— No linked request —</option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
              Linking a request lets the calendar track delivery adherence.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function AddEntryModal({
  defaultDate,
  onClose,
  onSave,
}: {
  defaultDate: string;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    platform: SocialPlatform;
    content_type: SocialContentType;
    scheduled_date: string;
    caption: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('Instagram');
  const [contentType, setContentType] = useState<SocialContentType>('Static');
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const submit = async () => {
    if (!title.trim() || !scheduledDate) {
      setSaveErr('Title and date are required.');
      return;
    }
    setSaving(true);
    setSaveErr('');
    try {
      await onSave({
        title: title.trim(),
        platform,
        content_type: contentType,
        scheduled_date: scheduledDate,
        caption: caption.trim(),
      });
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const labelCls = 'block text-[11px] uppercase tracking-wider mb-1.5 font-semibold';
  const inputStyle = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 17, 23, 0.5)' }}
      onClick={onClose}
    >
      <div className="gb-card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            New calendar entry
          </h3>
          <button onClick={onClose} className="gb-icon-btn">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4 mb-5">
          <div>
            <label className={labelCls} style={{ color: 'var(--text-faint)' }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Dubai project carousel"
              className="w-full px-3 py-2 rounded-md text-[13px]"
              style={inputStyle}
            />
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--text-faint)' }}>
              Platform
            </label>
            <div className="grid grid-cols-3 gap-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className="px-2 py-1.5 rounded text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: platform === p ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    color: platform === p ? 'var(--accent-text)' : 'var(--text-secondary)',
                    border: `1px solid ${platform === p ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--text-faint)' }}>
              Content type
            </label>
            <div className="grid grid-cols-3 gap-1">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setContentType(t)}
                  className="px-2 py-1.5 rounded text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: contentType === t ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    color: contentType === t ? 'var(--accent-text)' : 'var(--text-secondary)',
                    border: `1px solid ${contentType === t ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--text-faint)' }}>
              Scheduled date
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-[13px]"
              style={inputStyle}
            />
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--text-faint)' }}>
              Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Optional caption"
              className="w-full px-3 py-2 rounded-md text-[13px] resize-none"
              style={inputStyle}
            />
          </div>
        </div>

        {saveErr && (
          <p className="text-[12px] mb-3" style={{ color: 'var(--error)' }}>
            {saveErr}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="gb-btn gb-btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button onClick={() => void submit()} className="gb-btn gb-btn-primary" disabled={saving}>
            <Plus size={13} strokeWidth={2.25} />
            {saving ? 'Adding…' : 'Add entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

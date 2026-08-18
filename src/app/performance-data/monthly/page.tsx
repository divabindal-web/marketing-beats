'use client';

/**
 * Monthly close — the one screen that replaces flipping between the ORM, SEO
 * and Social tabs of the planning sheet.
 *
 * Two jobs on one page, because they are the same job:
 *   1. see where the month stands (filled / blank / off target)
 *   2. fill the blanks, with the source link right next to the input
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CircleDashed, ExternalLink, Loader2, UserPlus,
} from 'lucide-react';
import {
  Assignee, Cell, Domain, DOMAIN_LABEL, MonthStatus, MonthView, defaultMonth, dueLabel,
  fetchAssignees, fetchMonth, fetchMonthStatuses, monthLabel, saveCell, setMonthDue,
  setMonthOwner, setMonthState, shiftMonth, shortMonth, standingOf, statusOf, todayKey,
} from '@/lib/perf-monthly';
import { useCurrentUser } from '@/components/layout/CurrentUserContext';
import { currentDbUser } from '@/lib/work-api';

const DOMAINS: Domain[] = ['orm', 'seo', 'social'];

const fmt = (n: number | null, isPct: boolean) => {
  if (n == null) return '';
  if (isPct) return (n * 100).toFixed(1) + '%';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 10_000) return Math.round(n).toLocaleString('en-IN');
  return String(n);
};

export default function MonthlyClosePage() {
  const { currentUser } = useCurrentUser();
  const [month, setMonth] = useState(defaultMonth);
  const [domain, setDomain] = useState<Domain>('orm');
  const [views, setViews] = useState<Partial<Record<Domain, MonthView>>>({});
  const [statuses, setStatuses] = useState<MonthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [me, setMe] = useState<{ id: string; role: string; is_lead: boolean } | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const today = useMemo(() => todayKey(), []);

  useEffect(() => { fetchAssignees().then(setAssignees).catch(() => {}); }, []);

  useEffect(() => { currentDbUser().then((m) => setMe(m ? { id: m.id, role: m.role, is_lead: m.is_lead } : null)).catch(() => {}); }, []);

  // Anyone on the team can type in the month's numbers — they are the people
  // reading them off the source. Declaring the month closed is a lead/CMO call.
  const canSignOff = !!me && (me.role === 'admin' || me.is_lead);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [orm, seo, social, st] = await Promise.all([
        fetchMonth('orm', month), fetchMonth('seo', month), fetchMonth('social', month),
        fetchMonthStatuses(month),
      ]);
      setViews({ orm, seo, social });
      setStatuses(st);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const view = views[domain];
  const statusFor = (d: Domain) => statuses.find((s) => s.domain === d);
  const stateOf = (d: Domain) => statusFor(d)?.state ?? 'open';

  /** Owner and due date are a lead/CMO call, same gate as signing off. */
  const assignOwner = async (d: Domain, ownerId: string | null) => {
    try {
      await setMonthOwner(d, month, ownerId);
      setStatuses(await fetchMonthStatuses(month));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not set the owner');
    }
  };

  const assignDue = async (d: Domain, due: string | null) => {
    try {
      await setMonthDue(d, month, due);
      setStatuses(await fetchMonthStatuses(month));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not set the due date');
    }
  };

  /** Optimistic write: the grid is a lot of small edits, waiting on each would
   *  make it feel like the spreadsheet it is replacing. */
  const onCellSave = async (entity: string, metric: string, raw: string) => {
    const trimmed = raw.trim().replace(/,/g, '');
    const value = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && !Number.isFinite(value)) return;

    setViews((prev) => {
      const v = prev[domain];
      if (!v) return prev;
      return {
        ...prev,
        [domain]: {
          ...v,
          rows: v.rows.map((r) =>
            r.entity === entity
              ? { ...r, cells: r.cells.map((c) => (c.metric === metric ? { ...c, value } : c)) }
              : r,
          ),
        },
      };
    });
    try {
      await saveCell(domain, entity, metric, month, value);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save that value');
      void load();
    }
  };

  const visibleRows = useMemo(() => {
    if (!view) return [];
    if (!onlyGaps) return view.rows;
    return view.rows.filter((r) =>
      r.cells.some((c) => statusOf(c) === 'missing' || statusOf(c) === 'off-target'),
    );
  }, [view, onlyGaps]);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof visibleRows>();
    for (const r of visibleRows) {
      const k = r.grp ?? '—';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [visibleRows]);

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="gb-page-title">Monthly close</h1>
          <p className="gb-page-description">
            ORM, SEO and Social for one month — what&apos;s in, what&apos;s missing, what missed target.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="gb-icon-btn" title="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ArrowLeft size={15} />
          </button>
          <div className="text-[14px] font-semibold px-2 tabular-nums" style={{ color: 'var(--text-primary)', minWidth: 130, textAlign: 'center' }}>
            {monthLabel(month)}
          </div>
          <button className="gb-icon-btn" title="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {err && <p className="text-[12.5px] mb-3" style={{ color: 'var(--error)' }}>{err}</p>}

      {/* Domain summary — the "where are we" row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {DOMAINS.map((d) => {
          const v = views[d];
          const pct = v && v.total ? Math.round((v.filled / v.total) * 100) : 0;
          const done = !!v && v.total > 0 && v.filled === v.total;
          const isActive = domain === d;
          return (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className="gb-card gb-card-hover p-4 text-left"
              style={isActive ? { borderColor: 'var(--brand)', boxShadow: 'var(--shadow-sm)' } : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {DOMAIN_LABEL[d]}
                </span>
                {stateOf(d) !== 'open' ? (
                  <span className="gb-badge gb-badge-green">Signed off</span>
                ) : done ? (
                  <span className="gb-badge gb-badge-blue">Ready</span>
                ) : (
                  <span className="gb-badge gb-badge-yellow">{v ? v.total - v.filled : '—'} to fill</span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-semibold leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>{pct}%</span>
                <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  {v ? `${v.filled} of ${v.total} values` : 'loading…'}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <div className="h-full rounded-full transition-[width] duration-500"
                     style={{ width: `${pct}%`, backgroundColor: done ? 'var(--success)' : 'var(--brand)' }} />
              </div>
              {!!v && v.offTarget > 0 && (
                <div className="text-[11.5px] mt-2 inline-flex items-center gap-1" style={{ color: 'var(--error)' }}>
                  <AlertTriangle size={11} /> {v.offTarget} below target
                </div>
              )}
              {/* Who owes this and by when. Text only — editing lives in the
                  strip below, since a <button> cannot hold a <select>. */}
              {(() => {
                const st = statusFor(d);
                const standing = standingOf(st, today);
                if (standing === 'signed-off') return null;
                const tone =
                  standing === 'overdue' ? 'var(--error)'
                  : standing === 'due-soon' ? 'var(--warning)'
                  : 'var(--text-faint)';
                return (
                  <div className="text-[11.5px] mt-2 flex items-center gap-1.5" style={{ color: tone }}>
                    <span style={{ color: st?.owner_name ? 'var(--text-secondary)' : 'var(--text-faint)' }}>
                      {st?.owner_name ?? 'Unassigned'}
                    </span>
                    {st?.due_on && (
                      <>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span>
                          {standing === 'overdue' ? 'was due ' : 'due '}{dueLabel(st.due_on)}
                        </span>
                      </>
                    )}
                  </div>
                );
              })()}
            </button>
          );
        })}
      </div>

      {/* Owner & due date for the selected domain. A domain-month with nobody
          against it is exactly how the sheet went stale, so this sits above
          the grid rather than behind a settings screen. */}
      <div className="gb-card p-3 mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <UserPlus size={14} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Owner</span>
          {canSignOff ? (
            <select
              className="gb-input py-1 text-[12.5px]"
              style={{ minWidth: 170 }}
              value={statusFor(domain)?.owner_id ?? ''}
              onChange={(e) => assignOwner(domain, e.target.value || null)}
            >
              <option value="">— Unassigned —</option>
              {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ) : (
            <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
              {statusFor(domain)?.owner_name ?? 'Unassigned'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Due</span>
          {canSignOff ? (
            <input
              type="date"
              className="gb-input py-1 text-[12.5px]"
              value={statusFor(domain)?.due_on ?? ''}
              onChange={(e) => assignDue(domain, e.target.value || null)}
            />
          ) : (
            <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
              {dueLabel(statusFor(domain)?.due_on ?? null)}
            </span>
          )}
        </div>
        {(() => {
          const standing = standingOf(statusFor(domain), today);
          if (standing === 'overdue') return <span className="gb-badge gb-badge-red">Overdue</span>;
          if (standing === 'due-soon') return <span className="gb-badge gb-badge-yellow">Due soon</span>;
          if (standing === 'signed-off') return <span className="gb-badge gb-badge-green">Signed off</span>;
          return null;
        })()}
      </div>

      {/* Grid */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="gb-section-title" style={{ marginBottom: 0 }}>
          {DOMAIN_LABEL[domain]} · {monthLabel(month)}
        </h2>
        <div className="flex items-center gap-3">
          <label className="text-[12px] inline-flex items-center gap-1.5 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)}
                   style={{ accentColor: 'var(--brand)' }} />
            Only rows needing attention
          </label>
          {canSignOff && view && view.filled === view.total && view.total > 0 && stateOf(domain) === 'open' && (
            <button className="gb-btn gb-btn-primary" onClick={async () => {
              await setMonthState(domain, month, 'submitted', me?.id ?? null);
              setStatuses(await fetchMonthStatuses(month));
            }}>
              <Check size={14} /> Sign off {DOMAIN_LABEL[domain]}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="gb-card p-8 text-center text-[13px] inline-flex items-center justify-center gap-2 w-full"
             style={{ color: 'var(--text-faint)' }}>
          <Loader2 size={14} className="animate-spin" /> Loading {monthLabel(month)}…
        </div>
      )}

      {!loading && view && view.rows.length === 0 && (
        <div className="gb-card p-10 text-center">
          <CircleDashed size={22} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            Nothing registered for {DOMAIN_LABEL[domain]} yet.
          </p>
        </div>
      )}

      {!loading && view && view.rows.length > 0 && (
        <div className="gb-card overflow-x-auto">
          <table className="gb-table" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Listing</th>
                {view.metrics.map((m) => (
                  <th key={m} style={{ textAlign: 'right', minWidth: 150 }}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(([group, rows]) => (
                <FragmentGroup key={group} group={group} rows={rows} metrics={view.metrics}
                               prevLabel={shortMonth(view.prevMonth)} onSave={onCellSave} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11.5px] mt-3" style={{ color: 'var(--text-faint)' }}>
        Values save as you leave each box. Grey text under an input is {view ? shortMonth(view.prevMonth) : 'last month'} for comparison;
        the arrow opens the page you read the number from.
      </p>
    </div>
  );
}

function FragmentGroup({
  group, rows, metrics, prevLabel, onSave,
}: {
  group: string;
  rows: { entity: string; label: string; link: string | null; kind: string | null; cells: Cell[] }[];
  metrics: string[];
  prevLabel: string;
  onSave: (entity: string, metric: string, raw: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={metrics.length + 1}
            style={{ backgroundColor: 'var(--bg-tertiary)', fontSize: 11, fontWeight: 700,
                     letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {group}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.entity}>
          <td>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{r.label}</span>
              {r.link && (
                <a href={r.link} target="_blank" rel="noopener noreferrer" title="Open the source"
                   style={{ color: 'var(--link)', display: 'inline-flex' }}>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            {r.kind && <div className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>{r.kind}</div>}
          </td>
          {metrics.map((m) => {
            const c = r.cells.find((x) => x.metric === m);
            if (!c) return <td key={m} />;
            return <CellInput key={m} cell={c} prevLabel={prevLabel}
                              onSave={(raw) => onSave(r.entity, m, raw)} />;
          })}
        </tr>
      ))}
    </>
  );
}

function CellInput({ cell, prevLabel, onSave }: { cell: Cell; prevLabel: string; onSave: (raw: string) => void }) {
  const [draft, setDraft] = useState(cell.value == null ? '' : String(cell.value));
  useEffect(() => { setDraft(cell.value == null ? '' : String(cell.value)); }, [cell.value]);

  const status = statusOf(cell);
  const border =
    status === 'off-target' ? 'var(--error)'
    : status === 'on-target' ? 'var(--success)'
    : 'var(--border)';

  return (
    <td style={{ textAlign: 'right' }}>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (cell.value == null ? '' : String(cell.value))) onSave(draft); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        inputMode="decimal"
        placeholder="—"
        className="input-base"
        style={{ width: 92, textAlign: 'right', padding: '4px 8px', fontSize: 13, borderColor: border }}
      />
      <div className="text-[10.5px] mt-0.5 tabular-nums" style={{ color: 'var(--text-faint)' }}>
        {cell.prev != null ? `${prevLabel} ${fmt(cell.prev, cell.is_pct)}` : ' '}
        {cell.target != null ? ` · target ${fmt(cell.target, cell.is_pct)}` : ''}
      </div>
    </td>
  );
}

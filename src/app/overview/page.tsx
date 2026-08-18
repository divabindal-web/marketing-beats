'use client';

/**
 * Overview — the app's front door, and the only screen that adapts to who you
 * are rather than what you clicked.
 *
 * Before this, everyone landed on the Design Ops dashboard: correct for a
 * designer, wrong for a CMO whose job is the numbers rather than the request
 * queue. And the two halves of the app — design requests and performance data
 * — never referenced each other, so nobody could see both at once.
 *
 * Three shapes from one page:
 *   admin  the business: every domain's close state, what missed target
 *   lead   their team: their people's load, their domain's close
 *   member their queue: what is due, what they raised
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, Clock, Star, TrendingUp, Users,
} from 'lucide-react';
import { fetchRequests } from '@/lib/requests-api';
import { useRequestsRealtime } from '@/lib/use-requests-realtime';
import { isFinal, isOverdue, getInitials } from '@/lib/sample-data';
import { Request } from '@/types';
import { DirectoryUser, findInDirectory, useDirectory } from '@/lib/directory';
import {
  Domain, DOMAIN_LABEL, MonthView, defaultMonth, fetchMonth, monthLabel,
} from '@/lib/perf-monthly';
import { useCurrentUser } from '@/components/layout/CurrentUserContext';
import { currentDbUser } from '@/lib/work-api';
import { supabase } from '@/lib/supabase';
import { Kpi, Section, EmptyNote } from '@/components/perf/PerfBlocks';

const DOMAINS: Domain[] = ['orm', 'seo', 'social'];
type Role = 'admin' | 'lead' | 'member';

export default function OverviewPage() {
  const { currentUser } = useCurrentUser();
  const directory = useDirectory();
  const [me, setMe] = useState<{ id: string; name: string; role: string; team: string | null; is_lead: boolean } | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [views, setViews] = useState<Partial<Record<Domain, MonthView>>>({});
  const [teamIds, setTeamIds] = useState<Set<string> | null>(null);
  const month = defaultMonth();

  useEffect(() => { currentDbUser().then((m) => setMe(m as never)).catch(() => {}); }, []);

  const load = useCallback(() => {
    fetchRequests().then(setRequests).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useRequestsRealtime(load);

  useEffect(() => {
    Promise.all(DOMAINS.map((d) => fetchMonth(d, month)))
      .then(([orm, seo, social]) => setViews({ orm, seo, social }))
      .catch(() => {});
  }, [month]);

  // A lead's world is their own team, in both id spaces.
  useEffect(() => {
    if (!me?.is_lead || me.role === 'admin' || !me.team) return;
    supabase.from('users').select('id, email').eq('team', me.team).then(({ data }) => {
      const ids = new Set<string>();
      (data ?? []).forEach((u: { id: string }) => ids.add(u.id));
      directory.forEach((d) => { if (ids.has(d.db_id)) ids.add(d.id); });
      setTeamIds(ids);
    });
  }, [me, directory]);

  const role: Role = me?.role === 'admin' ? 'admin' : me?.is_lead ? 'lead' : 'member';

  const myIds = useMemo(
    () => [currentUser?.id, me?.id].filter(Boolean) as string[],
    [currentUser, me],
  );

  /** Requests this person is accountable for seeing. */
  const scoped = useMemo(() => {
    if (role === 'admin') return requests;
    if (role === 'lead' && teamIds) {
      return requests.filter((r) =>
        (r.assigned_to && teamIds.has(r.assigned_to)) || (r.requestor_id && teamIds.has(r.requestor_id)));
    }
    if (role === 'member') {
      return requests.filter((r) => myIds.some((id) =>
        id === r.assigned_to || id === r.social_poc || id === r.video_poc || id === r.design_poc));
    }
    return requests;
  }, [requests, role, teamIds, myIds]);

  const open = scoped.filter((r) => !isFinal(r));
  const overdue = open.filter(isOverdue);
  const changeReq = open.filter((r) => r.current_stage === 'Change Req');
  const raised = requests.filter((r) => myIds.some((id) => id === r.requestor_id));

  const closeSummary = DOMAINS.map((d) => {
    const v = views[d];
    return {
      domain: d,
      pct: v && v.total ? Math.round((v.filled / v.total) * 100) : 0,
      missing: v ? v.total - v.filled : null,
      off: v?.offTarget ?? 0,
      ready: !!v && v.total > 0 && v.filled === v.total,
    };
  });
  const totalMissing = closeSummary.reduce((s, c) => s + (c.missing ?? 0), 0);
  const totalOff = closeSummary.reduce((s, c) => s + c.off, 0);

  const greeting = new Date().getHours() < 12 ? 'Good morning'
    : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (me?.name ?? currentUser?.name ?? '').split(' ')[0];

  return (
    <div>
      <div className="gb-page-header">
        <h1 className="gb-page-title">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="gb-page-description">
          {role === 'admin' && 'Everything across the marketing org — the month, the work and what needs a decision.'}
          {role === 'lead' && `${me?.team ?? 'Your team'} — your people's workload and the month's numbers.`}
          {role === 'member' && 'Your queue and the work you have raised.'}
        </p>
      </div>

      {/* ---------- headline ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 mb-stagger">
        <Kpi label={role === 'member' ? 'My open tasks' : 'Open requests'} value={String(open.length)} tone="brand"
             sub={role === 'admin' ? 'all teams' : role === 'lead' ? me?.team ?? '' : undefined} />
        <Kpi label="Overdue" value={String(overdue.length)} tone={overdue.length ? 'error' : 'success'} />
        <Kpi label="Change requests" value={String(changeReq.length)} tone={changeReq.length ? 'warning' : 'neutral'} />
        {role === 'member'
          ? <Kpi label="Raised by you" value={String(raised.filter((r) => !isFinal(r)).length)} tone="neutral" sub={`${raised.length} total`} />
          : <Kpi label="Below target" value={String(totalOff)} tone={totalOff ? 'error' : 'success'} sub={monthLabel(month)} />}
      </div>

      {/* ---------- the month (admin + lead) ---------- */}
      {role !== 'member' && (
        <Section
          title={`The month — ${monthLabel(month)}`}
          subtitle={totalMissing > 0
            ? `${totalMissing} value${totalMissing === 1 ? '' : 's'} still to enter across ORM, SEO and Social`
            : 'Every number is in'}
          right={<Link href="/performance-data/monthly" className="gb-btn gb-btn-secondary">
            <CalendarCheck size={14} /> Open monthly close
          </Link>}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {closeSummary.map((c) => (
              <Link key={c.domain} href="/performance-data/monthly" className="gb-card gb-card-hover p-4 block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {DOMAIN_LABEL[c.domain]}
                  </span>
                  {c.ready
                    ? <span className="gb-badge gb-badge-green">Ready</span>
                    : <span className="gb-badge gb-badge-yellow">{c.missing ?? '—'} to fill</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[24px] font-semibold leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>{c.pct}%</span>
                  {c.off > 0 && (
                    <span className="text-[11.5px] inline-flex items-center gap-1" style={{ color: 'var(--error)' }}>
                      <AlertTriangle size={11} /> {c.off} below target
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div className="h-full rounded-full transition-[width] duration-500"
                       style={{ width: `${c.pct}%`, backgroundColor: c.ready ? 'var(--success)' : 'var(--brand)' }} />
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- needs attention ---------- */}
      <Section
        title={role === 'member' ? 'Due next' : 'Needs attention'}
        subtitle={role === 'member' ? 'Your open work, soonest first' : 'Overdue and change-requested work, soonest first'}
        right={<Link href={role === 'member' ? '/design-ops/my-tasks' : '/design-ops/requests'}
                     className="text-[12px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--link)' }}>
          View all <ArrowRight size={11} />
        </Link>}
      >
        <AttentionList
          requests={role === 'member' ? open : [...overdue, ...changeReq]}
          fallback={role === 'member' ? open : open}
          directory={directory}
        />
      </Section>

      {/* ---------- team load (admin + lead) ---------- */}
      {role !== 'member' && (
        <Section title="Who is carrying what" subtitle="Open work per person, busiest first"
                 right={<Link href="/design-ops/dashboard" className="text-[12px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--link)' }}>
                   Full dashboard <ArrowRight size={11} />
                 </Link>}>
          <TeamLoad requests={scoped} directory={directory} />
        </Section>
      )}

      {/* ---------- quick links ---------- */}
      <Section title="Jump to" subtitle="">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/design-ops/my-tasks', label: 'My Tasks', icon: Clock },
            { href: '/performance-data/orm', label: 'ORM', icon: Star },
            { href: '/performance-data/seo', label: 'SEO', icon: TrendingUp },
            { href: role === 'member' ? '/design-ops/requests' : '/user-management', label: role === 'member' ? 'All Requests' : 'Team', icon: Users },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="gb-card gb-card-hover p-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--accent-text)' }}>
                <l.icon size={15} />
              </span>
              <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{l.label}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function AttentionList({
  requests, fallback, directory,
}: { requests: Request[]; fallback: Request[]; directory: DirectoryUser[] }) {
  const list = (requests.length ? requests : fallback)
    .slice()
    .sort((a, b) => (a.need_by ?? '').localeCompare(b.need_by ?? ''))
    .slice(0, 6);

  if (!list.length) {
    return (
      <div className="gb-card px-5 py-10 text-center">
        <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: 'var(--success)' }} />
        <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Nothing outstanding.</p>
      </div>
    );
  }
  return (
    <div className="gb-card p-0 overflow-hidden">
      {list.map((r, i) => {
        const late = isOverdue(r);
        const who = findInDirectory(directory, r.assigned_to);
        return (
          <Link key={r.id} href={`/design-ops/requests?q=${encodeURIComponent(r.title)}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                style={{ borderTop: i ? '1px solid var(--border-light)' : undefined }}>
            <span className="w-1.5 h-9 rounded-full flex-shrink-0"
                  style={{ backgroundColor: late ? 'var(--error)' : r.current_stage === 'Change Req' ? 'var(--warning)' : 'var(--brand)' }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</div>
              <div className="text-[11.5px] truncate" style={{ color: 'var(--text-faint)' }}>
                {r.type}{who ? ` · ${who.name}` : ''}
              </div>
            </div>
            <span className={`gb-badge ${late ? 'gb-badge-red' : 'gb-badge-blue'} flex-shrink-0 hidden sm:inline-flex`}>
              {r.current_stage}
            </span>
            <span className="text-[12px] flex-shrink-0 tabular-nums" style={{ color: late ? 'var(--error)' : 'var(--text-secondary)', width: 78, textAlign: 'right' }}>
              {r.need_by ?? '—'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function TeamLoad({ requests, directory }: { requests: Request[]; directory: DirectoryUser[] }) {
  const rows = useMemo(() => {
    const counts = new Map<string, { open: number; overdue: number }>();
    for (const r of requests) {
      if (!r.assigned_to || isFinal(r)) continue;
      const c = counts.get(r.assigned_to) ?? { open: 0, overdue: 0 };
      c.open += 1;
      if (isOverdue(r)) c.overdue += 1;
      counts.set(r.assigned_to, c);
    }
    return [...counts.entries()]
      .map(([id, c]) => ({ id, name: findInDirectory(directory, id)?.name ?? id, ...c }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
      .slice(0, 8);
  }, [requests, directory]);

  if (!rows.length) return <EmptyNote text="Nobody has open work right now." />;
  const max = Math.max(...rows.map((r) => r.open));

  return (
    <div className="gb-card p-5">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                 style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>
              {getInitials(r.name)}
            </div>
            <div className="text-[12.5px] flex-shrink-0 truncate" style={{ width: 130, color: 'var(--text-secondary)' }}>{r.name}</div>
            <div className="flex-1 h-4 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="h-full rounded transition-[width] duration-700"
                   style={{ width: `${(r.open / max) * 100}%`, backgroundColor: r.overdue ? 'var(--error)' : 'var(--brand)' }} />
            </div>
            <div className="text-[12px] tabular-nums flex-shrink-0" style={{ width: 92, textAlign: 'right', color: 'var(--text-primary)' }}>
              {r.open} open{r.overdue ? ` · ${r.overdue} late` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

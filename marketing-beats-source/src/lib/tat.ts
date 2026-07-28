/**
 * TAT (Turn Around Time) Engine
 * ================================
 *
 * Business rules (locked with product):
 *   1. Clock is business-hours only:  Mon–Fri, 10:00–19:00 IST (9 hours/day, 45 h/week)
 *   2. SLA is measured from `Assigned` -> first entry into `Ready to Upload`.
 *   3. Clock PAUSES while the request sits in a waiting stage (Content / Change Req /
 *      Shooting Scheduled). It RESUMES when the request re-enters an active work stage.
 *   4. SLA thresholds:
 *         Graphics               =>  8 business hours
 *         Social Media Graphics  =>  8 business hours
 *         Video                  => 48 business hours
 *   5. Change Requests are tracked separately as a QUALITY signal (count per person).
 *   6. "Low performer" = bottom 20% by composite score
 *      (tat component 45% + breach component 35% + volume component 20%).
 *
 * All timestamps in this module are ISO 8601 strings with explicit offset (e.g.
 * `"2026-03-14T11:45:00+05:30"`). Do not store date-only strings here.
 */

import { Request, RequestType, RequestStage, StageTransition } from '@/types';

// ─── Business-hours constants ────────────────────────────────────────────────

export const BUSINESS_HOURS = {
  startHour: 10,        // 10:00
  endHour: 19,          // 19:00
  workdays: [1, 2, 3, 4, 5] as number[], // Mon=1 .. Fri=5 (Sun=0)
  timezone: 'Asia/Kolkata',
  hoursPerDay: 9,
} as const;

// ─── SLA thresholds (in business hours) ──────────────────────────────────────

export const SLA_HOURS: Record<RequestType, number> = {
  Graphics: 8,
  'Social Media Graphics': 8,
  Video: 48,
};

// ─── Which stage counts as "delivered" per type ──────────────────────────────

export const DELIVERED_STAGE: Record<RequestType, RequestStage> = {
  Graphics: 'Ready to Upload',
  'Social Media Graphics': 'Ready to Upload',
  Video: 'Ready to Upload',
};

// ─── Stages where the clock pauses (waiting on external input) ───────────────

export const PAUSE_STAGES: readonly RequestStage[] = [
  'Content',             // waiting on copy/content from requestor
  'Change Req',          // waiting on reviewer feedback
  'Shooting Scheduled',  // waiting for the scheduled shoot date
] as const;

// ─── Active work stages (clock is ticking) ───────────────────────────────────

export const ACTIVE_STAGES: readonly RequestStage[] = [
  'Assigned',
  'Planning',
  'Design In Progress',
  'Shoot Done',
  'Editing In Progress',
  'Design Done',
  'Editing Done',
] as const;

// ─── Terminal stages (work is done from the maker's POV) ─────────────────────

export const MAKER_DONE_STAGES: readonly RequestStage[] = [
  'Ready to Upload',
  'Done',
  'Uploaded',
] as const;

// ─── Quality thresholds ──────────────────────────────────────────────────────

export const SLA_STATUS_THRESHOLDS = {
  // TAT ratio (actual / SLA).  <= green, > yellow, > red.
  greenMax: 0.8,   // delivered with 20%+ headroom
  yellowMax: 1.0,  // delivered within SLA
  // > 1.0 = red (missed SLA)
} as const;

export type SLAStatus = 'green' | 'yellow' | 'red';

// ─── Time helpers ────────────────────────────────────────────────────────────

/**
 * Convert a Date to the business timezone as a "wall clock" moment.
 * Returns {year, month, day, hour, minute, second, dayOfWeek}.
 */
function toBusinessWallClock(d: Date): {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
  dayOfWeek: number;
} {
  // Use Intl to get the wall-clock in the business timezone.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_HOURS.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'short',
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10) % 24,
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    dayOfWeek: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * True if the given Date falls inside the business window.
 */
export function isBusinessHour(d: Date): boolean {
  const wc = toBusinessWallClock(d);
  if (!BUSINESS_HOURS.workdays.includes(wc.dayOfWeek)) return false;
  const h = wc.hour + wc.minute / 60 + wc.second / 3600;
  return h >= BUSINESS_HOURS.startHour && h < BUSINESS_HOURS.endHour;
}

/**
 * Return the number of BUSINESS HOURS between two timestamps.
 * Iterates day-by-day; for each business day clips to [startHour, endHour]
 * and sums the overlap with [from, to]. Returns a decimal.
 *
 * `from` and `to` are compared in UTC ms — the business timezone is only
 * used for wall-clock windowing.
 */
export function businessHoursBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (to <= from) return 0;

  const msPerHour = 3_600_000;
  let total = 0;

  // Walk day-by-day in the business timezone, starting from the business-day
  // containing `from`.
  const cursor = new Date(from.getTime());
  // Cap the loop to prevent infinite runaway (max ~5 years).
  const maxIterations = 5 * 365 * 3;
  let iterations = 0;

  while (cursor < to && iterations < maxIterations) {
    iterations++;
    const wc = toBusinessWallClock(cursor);
    const isWorkday = BUSINESS_HOURS.workdays.includes(wc.dayOfWeek);

    if (isWorkday) {
      // Build the window [dayStart, dayEnd] in the SAME instant space as cursor.
      // We need a Date that represents "today at 10:00 in IST".
      // Strategy: format cursor's business-date, then construct an ISO with +05:30.
      const yyyy = wc.year;
      const mm = String(wc.month).padStart(2, '0');
      const dd = String(wc.day).padStart(2, '0');
      const sh = String(BUSINESS_HOURS.startHour).padStart(2, '0');
      const eh = String(BUSINESS_HOURS.endHour).padStart(2, '0');
      // IST is always +05:30 (no DST), so this is stable.
      const dayStart = new Date(`${yyyy}-${mm}-${dd}T${sh}:00:00+05:30`);
      const dayEnd = new Date(`${yyyy}-${mm}-${dd}T${eh}:00:00+05:30`);

      const windowStart = cursor > dayStart ? cursor : dayStart;
      const windowEnd = to < dayEnd ? to : dayEnd;

      if (windowEnd > windowStart) {
        total += (windowEnd.getTime() - windowStart.getTime()) / msPerHour;
      }
    }

    // Advance to 00:00 IST the next day.
    const nextYyyy = wc.year;
    const nextMm = String(wc.month).padStart(2, '0');
    const nextDd = String(wc.day).padStart(2, '0');
    const midnight = new Date(`${nextYyyy}-${nextMm}-${nextDd}T00:00:00+05:30`);
    cursor.setTime(midnight.getTime() + 24 * msPerHour);
  }

  return Math.round(total * 100) / 100; // 2 decimal places
}

/**
 * Advance a starting timestamp by the given number of BUSINESS hours.
 * Used to generate realistic fake data.
 */
export function addBusinessHours(fromISO: string, hours: number): string {
  let cursor = new Date(fromISO);
  let remaining = hours;
  const msPerHour = 3_600_000;
  const maxIter = 500;
  let iter = 0;

  // If we're outside a business window, fast-forward to the next business-day start.
  while (!isBusinessHour(cursor) && iter < maxIter) {
    iter++;
    const wc = toBusinessWallClock(cursor);
    const pad = (n: number) => String(n).padStart(2, '0');
    // Jump to today's start-of-business first.
    let candidate = new Date(
      `${wc.year}-${pad(wc.month)}-${pad(wc.day)}T${pad(BUSINESS_HOURS.startHour)}:00:00+05:30`
    );
    if (candidate <= cursor) {
      // Already past today's opening. Jump to tomorrow 00:00 then re-check.
      const midnight = new Date(
        `${wc.year}-${pad(wc.month)}-${pad(wc.day)}T00:00:00+05:30`
      );
      candidate = new Date(midnight.getTime() + 24 * msPerHour);
    }
    cursor = candidate;
  }

  while (remaining > 0 && iter < maxIter) {
    iter++;
    const wc = toBusinessWallClock(cursor);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dayEnd = new Date(
      `${wc.year}-${pad(wc.month)}-${pad(wc.day)}T${pad(BUSINESS_HOURS.endHour)}:00:00+05:30`
    );
    const availableToday = (dayEnd.getTime() - cursor.getTime()) / msPerHour;

    if (remaining <= availableToday) {
      cursor = new Date(cursor.getTime() + remaining * msPerHour);
      remaining = 0;
      break;
    }

    remaining -= availableToday;
    // Jump to tomorrow 00:00 then forward into business window.
    const midnight = new Date(
      `${wc.year}-${pad(wc.month)}-${pad(wc.day)}T00:00:00+05:30`
    );
    cursor = new Date(midnight.getTime() + 24 * msPerHour);
    while (!isBusinessHour(cursor) && iter < maxIter) {
      iter++;
      const wc2 = toBusinessWallClock(cursor);
      let candidate = new Date(
        `${wc2.year}-${pad(wc2.month)}-${pad(wc2.day)}T${pad(BUSINESS_HOURS.startHour)}:00:00+05:30`
      );
      if (candidate <= cursor) {
        const mn = new Date(
          `${wc2.year}-${pad(wc2.month)}-${pad(wc2.day)}T00:00:00+05:30`
        );
        candidate = new Date(mn.getTime() + 24 * msPerHour);
      }
      cursor = candidate;
    }
  }

  return cursor.toISOString();
}

/**
 * Given the transitions log of a request, compute the TOTAL ACTIVE business
 * hours spent — i.e. sum the business-hours between consecutive transitions,
 * but only for intervals whose `from_stage` was an active work stage (not a
 * pause stage).
 *
 * If the request has not yet been delivered, the "open" interval from the
 * last transition up to `asOf` (default: now) is included only if the current
 * stage is active.
 */
export function calculateActiveTAT(
  transitions: StageTransition[],
  asOf: string = new Date().toISOString()
): number {
  if (transitions.length === 0) return 0;

  const sorted = [...transitions].sort(
    (a, b) => new Date(a.transitioned_at).getTime() - new Date(b.transitioned_at).getTime()
  );

  let total = 0;

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];

    // For each interval [curr.transitioned_at, next.transitioned_at], the
    // "to_stage" of `curr` is the stage the request IS IN during that window.
    const activeStage: RequestStage = curr.to_stage;
    const intervalStart = curr.transitioned_at;
    const intervalEnd = next ? next.transitioned_at : asOf;

    const isActiveWindow =
      !PAUSE_STAGES.includes(activeStage) &&
      !MAKER_DONE_STAGES.includes(activeStage);

    if (isActiveWindow) {
      total += businessHoursBetween(intervalStart, intervalEnd);
    }
  }

  return Math.round(total * 100) / 100;
}

/**
 * Return the ISO timestamp at which the request FIRST reached the delivered
 * stage (default: `Ready to Upload`), or null if it never did.
 */
export function getDeliveredAt(
  transitions: StageTransition[],
  type: RequestType
): string | null {
  const target = DELIVERED_STAGE[type];
  const first = transitions
    .filter((t) => t.to_stage === target)
    .sort((a, b) => new Date(a.transitioned_at).getTime() - new Date(b.transitioned_at).getTime())[0];
  return first?.transitioned_at ?? null;
}

/**
 * Return the user_id who transitioned the request INTO the delivered stage
 * the first time. (i.e. the person credited with the delivery.)
 */
export function getDeliveredBy(
  transitions: StageTransition[],
  type: RequestType
): string | null {
  const target = DELIVERED_STAGE[type];
  const first = transitions
    .filter((t) => t.to_stage === target)
    .sort((a, b) => new Date(a.transitioned_at).getTime() - new Date(b.transitioned_at).getTime())[0];
  return first?.transitioned_by ?? null;
}

/**
 * Delivery TAT in business hours: only the time between `Assigned` and the
 * FIRST entry into the delivered stage. Returns null if not yet delivered.
 */
export function getDeliveryTAT(
  transitions: StageTransition[],
  type: RequestType
): number | null {
  const delivered = getDeliveredAt(transitions, type);
  if (!delivered) return null;

  // Build a truncated transitions list that ends at the delivered event.
  const deliveredTime = new Date(delivered).getTime();
  const truncated = transitions
    .filter((t) => new Date(t.transitioned_at).getTime() <= deliveredTime)
    .sort((a, b) => new Date(a.transitioned_at).getTime() - new Date(b.transitioned_at).getTime());

  return calculateActiveTAT(truncated, delivered);
}

/**
 * Compare a TAT (business hours) against the SLA for the given type.
 * Returns 'green' | 'yellow' | 'red'.
 */
export function getSLAStatus(tatHours: number, type: RequestType): SLAStatus {
  const sla = SLA_HOURS[type];
  const ratio = tatHours / sla;
  if (ratio <= SLA_STATUS_THRESHOLDS.greenMax) return 'green';
  if (ratio <= SLA_STATUS_THRESHOLDS.yellowMax) return 'yellow';
  return 'red';
}

/**
 * Per-stage time breakdown (business hours) from a transitions log.
 * Aggregates multiple passes through the same stage (e.g. after Change Req).
 */
export function getStageBreakdown(
  transitions: StageTransition[],
  asOf: string = new Date().toISOString()
): Array<{ stage: RequestStage; hours: number }> {
  if (transitions.length === 0) return [];

  const sorted = [...transitions].sort(
    (a, b) => new Date(a.transitioned_at).getTime() - new Date(b.transitioned_at).getTime()
  );

  const tally: Partial<Record<RequestStage, number>> = {};

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    const stage = curr.to_stage;
    const end = next ? next.transitioned_at : asOf;
    const hours = businessHoursBetween(curr.transitioned_at, end);
    tally[stage] = (tally[stage] ?? 0) + hours;
  }

  return Object.entries(tally)
    .map(([stage, hours]) => ({ stage: stage as RequestStage, hours: Math.round(hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Count how many times a request passed through `Change Req` stage.
 * Each re-entry = 1 change request received.
 */
export function getChangeRequestCount(transitions: StageTransition[]): number {
  return transitions.filter((t) => t.to_stage === 'Change Req').length;
}

/**
 * Return the ISO quarter key for a given date: "2026-Q1".
 */
export function getQuarter(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Use business timezone for quarter boundaries.
  const wc = toBusinessWallClock(d);
  const q = Math.ceil(wc.month / 3);
  return `${wc.year}-Q${q}`;
}

/**
 * Return the start and end ISO timestamps of a quarter (in IST).
 * e.g. getQuarterRange('2026-Q1') => { start: '2026-01-01T00:00:00+05:30', end: '2026-04-01T00:00:00+05:30' }
 */
export function getQuarterRange(quarterKey: string): { start: string; end: string } {
  const [yearStr, qStr] = quarterKey.split('-Q');
  const year = parseInt(yearStr, 10);
  const q = parseInt(qStr, 10);
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 3;
  const endYear = endMonth > 12 ? year + 1 : year;
  const endMonthNormalized = endMonth > 12 ? endMonth - 12 : endMonth;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `${year}-${pad(startMonth)}-01T00:00:00+05:30`,
    end: `${endYear}-${pad(endMonthNormalized)}-01T00:00:00+05:30`,
  };
}

/**
 * Return the current quarter key based on today's date in IST.
 */
export function getCurrentQuarter(): string {
  return getQuarter(new Date());
}

// ─── Performance aggregation ─────────────────────────────────────────────────

export interface PerformanceMetrics {
  userId: string;
  period: string;                // quarter key e.g. "2026-Q1"
  deliveries: number;            // count of requests delivered
  avgTATHours: number;           // mean of delivery TATs (business hours)
  medianTATHours: number;
  breachCount: number;           // requests where TAT > SLA
  breachRate: number;            // 0..1
  slaStatus: SLAStatus;          // overall status (based on avgTAT / type mix)
  byType: Partial<Record<RequestType, {
    deliveries: number;
    avgTATHours: number;
    breachRate: number;
    slaHours: number;
  }>>;
  changeRequestsReceived: number;  // count of Change Req transitions on requests they delivered
  stageBreakdown: Array<{ stage: RequestStage; hours: number }>;  // avg hours per stage across their deliveries
  worstRequests: Array<{ id: string; title: string; tatHours: number; slaHours: number; type: RequestType; ratio: number }>; // top 5 worst
  performanceScore: number;      // 0..100 — higher is better
}

interface DeliveredRequest {
  request: Request & { transitions: StageTransition[] };
  deliveredAt: string;
  deliveredBy: string;
  tatHours: number;
  slaHours: number;
  ratio: number;
  breached: boolean;
  changeReqCount: number;
}

/**
 * Build the set of "delivered" requests attributed to each user within a period.
 * A request is counted towards the user who transitioned it into the delivered
 * stage (`Ready to Upload`) for the FIRST time.
 */
export function extractDeliveriesByUser(
  requests: Array<Request & { transitions: StageTransition[] }>,
  period?: { start: string; end: string }
): Map<string, DeliveredRequest[]> {
  const result = new Map<string, DeliveredRequest[]>();

  for (const req of requests) {
    const deliveredAt = getDeliveredAt(req.transitions, req.type);
    if (!deliveredAt) continue;

    if (period) {
      const t = new Date(deliveredAt).getTime();
      if (t < new Date(period.start).getTime() || t >= new Date(period.end).getTime()) {
        continue;
      }
    }

    const deliveredBy = getDeliveredBy(req.transitions, req.type);
    if (!deliveredBy) continue;

    const tatHours = getDeliveryTAT(req.transitions, req.type) ?? 0;
    const slaHours = SLA_HOURS[req.type];
    const ratio = slaHours > 0 ? tatHours / slaHours : 0;
    const breached = tatHours > slaHours;
    const changeReqCount = getChangeRequestCount(req.transitions);

    const entry: DeliveredRequest = {
      request: req,
      deliveredAt,
      deliveredBy,
      tatHours,
      slaHours,
      ratio,
      breached,
      changeReqCount,
    };

    const arr = result.get(deliveredBy) ?? [];
    arr.push(entry);
    result.set(deliveredBy, arr);
  }

  return result;
}

/**
 * Compute a user's PerformanceMetrics for a given period.
 */
export function computeUserMetrics(
  userId: string,
  deliveries: DeliveredRequest[],
  periodKey: string
): PerformanceMetrics {
  if (deliveries.length === 0) {
    return {
      userId,
      period: periodKey,
      deliveries: 0,
      avgTATHours: 0,
      medianTATHours: 0,
      breachCount: 0,
      breachRate: 0,
      slaStatus: 'green',
      byType: {},
      changeRequestsReceived: 0,
      stageBreakdown: [],
      worstRequests: [],
      performanceScore: 0,
    };
  }

  const tats = deliveries.map((d) => d.tatHours).sort((a, b) => a - b);
  const avgTATHours = tats.reduce((s, v) => s + v, 0) / tats.length;
  const medianTATHours = tats.length % 2 === 0
    ? (tats[tats.length / 2 - 1] + tats[tats.length / 2]) / 2
    : tats[Math.floor(tats.length / 2)];

  const breachCount = deliveries.filter((d) => d.breached).length;
  const breachRate = breachCount / deliveries.length;

  // Per-type breakdown.
  const byType: PerformanceMetrics['byType'] = {};
  const typeGroups = new Map<RequestType, DeliveredRequest[]>();
  for (const d of deliveries) {
    const arr = typeGroups.get(d.request.type) ?? [];
    arr.push(d);
    typeGroups.set(d.request.type, arr);
  }
  for (const [type, arr] of typeGroups.entries()) {
    const typeTATs = arr.map((d) => d.tatHours);
    byType[type] = {
      deliveries: arr.length,
      avgTATHours: typeTATs.reduce((s, v) => s + v, 0) / typeTATs.length,
      breachRate: arr.filter((d) => d.breached).length / arr.length,
      slaHours: SLA_HOURS[type],
    };
  }

  // Average TAT ratio across all deliveries (since different types have different SLAs).
  const avgRatio = deliveries.reduce((s, d) => s + d.ratio, 0) / deliveries.length;
  const slaStatus: SLAStatus =
    avgRatio <= SLA_STATUS_THRESHOLDS.greenMax
      ? 'green'
      : avgRatio <= SLA_STATUS_THRESHOLDS.yellowMax
      ? 'yellow'
      : 'red';

  // Change requests on the requests they delivered.
  const changeRequestsReceived = deliveries.reduce((s, d) => s + d.changeReqCount, 0);

  // Stage breakdown averaged across deliveries.
  const stageTotals: Partial<Record<RequestStage, number>> = {};
  for (const d of deliveries) {
    const breakdown = getStageBreakdown(d.request.transitions, d.deliveredAt);
    for (const { stage, hours } of breakdown) {
      stageTotals[stage] = (stageTotals[stage] ?? 0) + hours;
    }
  }
  const stageBreakdown = Object.entries(stageTotals)
    .map(([stage, total]) => ({
      stage: stage as RequestStage,
      hours: Math.round(((total ?? 0) / deliveries.length) * 100) / 100,
    }))
    .sort((a, b) => b.hours - a.hours);

  // Worst 5 requests (highest TAT ratio).
  const worstRequests = [...deliveries]
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5)
    .map((d) => ({
      id: d.request.id,
      title: d.request.title,
      tatHours: d.tatHours,
      slaHours: d.slaHours,
      ratio: d.ratio,
      type: d.request.type,
    }));

  return {
    userId,
    period: periodKey,
    deliveries: deliveries.length,
    avgTATHours: Math.round(avgTATHours * 100) / 100,
    medianTATHours: Math.round(medianTATHours * 100) / 100,
    breachCount,
    breachRate: Math.round(breachRate * 1000) / 1000,
    slaStatus,
    byType,
    changeRequestsReceived,
    stageBreakdown,
    worstRequests,
    // performanceScore filled in by normalisation pass below.
    performanceScore: 0,
  };
}

/**
 * Compute team-wide performance metrics + composite performance score, and
 * flag the bottom 20% as low performers.
 *
 * The composite score (0..100, higher = better) is built from three
 * components, all normalised against the cohort:
 *
 *   tatComponent     (45%)  = max(0, (2 - tatRatio) / 2) * 100
 *                              where tatRatio = userAvgTAT / weightedSLA
 *   breachComponent  (35%)  = (1 - breachRate) * 100
 *   volumeComponent  (20%)  = min(deliveries / cohortMedianDeliveries, 1) * 100
 *
 * Bottom 20% are those with the lowest scores (min 5 deliveries threshold
 * to be eligible for ranking — below that, they're marked "insufficient data").
 */
export function computeTeamMetrics(
  requests: Array<Request & { transitions: StageTransition[] }>,
  allUserIds: string[],
  period?: { start: string; end: string; key: string }
): {
  metrics: Array<PerformanceMetrics & { isLowPerformer: boolean; eligibleForRanking: boolean }>;
  cohortMedianDeliveries: number;
  cohortAvgTAT: number;
  cohortBreachRate: number;
} {
  const periodKey = period?.key ?? getCurrentQuarter();
  const deliveriesByUser = extractDeliveriesByUser(requests, period);

  // Build a metric record for EVERY user in allUserIds (even if they have 0 deliveries).
  const rawMetrics = allUserIds.map((uid) =>
    computeUserMetrics(uid, deliveriesByUser.get(uid) ?? [], periodKey)
  );

  // Eligibility threshold.
  const MIN_DELIVERIES = 5;
  const eligible = rawMetrics.filter((m) => m.deliveries >= MIN_DELIVERIES);

  // Cohort stats (from eligible only).
  const cohortDeliveries = eligible.map((m) => m.deliveries).sort((a, b) => a - b);
  const cohortMedianDeliveries = cohortDeliveries.length === 0
    ? 0
    : cohortDeliveries.length % 2 === 0
    ? (cohortDeliveries[cohortDeliveries.length / 2 - 1] + cohortDeliveries[cohortDeliveries.length / 2]) / 2
    : cohortDeliveries[Math.floor(cohortDeliveries.length / 2)];

  const cohortAvgTAT =
    eligible.length > 0
      ? eligible.reduce((s, m) => s + m.avgTATHours, 0) / eligible.length
      : 0;
  const cohortBreachRate =
    eligible.length > 0
      ? eligible.reduce((s, m) => s + m.breachRate, 0) / eligible.length
      : 0;

  // Compute each user's performance score.
  const withScores = rawMetrics.map((m) => {
    if (m.deliveries < MIN_DELIVERIES) {
      return { ...m, performanceScore: 0, eligibleForRanking: false };
    }

    // Weighted SLA: weight by count-per-type
    const totalDeliveries = Object.values(m.byType).reduce(
      (s, t) => s + (t?.deliveries ?? 0),
      0
    );
    const weightedSLA = totalDeliveries === 0
      ? 8
      : Object.values(m.byType).reduce(
          (s, t) => s + (t ? (t.slaHours * t.deliveries) / totalDeliveries : 0),
          0
        );

    const tatRatio = weightedSLA > 0 ? m.avgTATHours / weightedSLA : 0;
    const tatComponent = Math.max(0, (2 - tatRatio) / 2) * 100;
    const breachComponent = (1 - m.breachRate) * 100;
    const volumeComponent =
      cohortMedianDeliveries > 0
        ? Math.min(m.deliveries / cohortMedianDeliveries, 1) * 100
        : 100;

    const performanceScore = Math.round(
      tatComponent * 0.45 + breachComponent * 0.35 + volumeComponent * 0.2
    );

    return { ...m, performanceScore, eligibleForRanking: true };
  });

  // Flag bottom 20% among eligible.
  const eligibleSorted = withScores
    .filter((m) => m.eligibleForRanking)
    .sort((a, b) => a.performanceScore - b.performanceScore);

  const lowPerformerCount = Math.max(1, Math.ceil(eligibleSorted.length * 0.2));
  const lowPerformerIds = new Set(
    eligibleSorted.slice(0, lowPerformerCount).map((m) => m.userId)
  );

  const finalMetrics = withScores.map((m) => ({
    ...m,
    isLowPerformer: lowPerformerIds.has(m.userId),
  }));

  return {
    metrics: finalMetrics,
    cohortMedianDeliveries,
    cohortAvgTAT: Math.round(cohortAvgTAT * 100) / 100,
    cohortBreachRate: Math.round(cohortBreachRate * 1000) / 1000,
  };
}

// ─── Format helpers ──────────────────────────────────────────────────────────

/**
 * Format a number of business hours as a human string.
 *  0.25 => "15m"
 *  1.5  => "1h 30m"
 *  9    => "1d"  (1 business day = 9h)
 *  13.5 => "1d 4.5h"
 */
export function formatBusinessHours(hours: number): string {
  if (hours < 1 / 60) return '0m';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < BUSINESS_HOURS.hoursPerDay) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(hours / BUSINESS_HOURS.hoursPerDay);
  const remHours = hours - days * BUSINESS_HOURS.hoursPerDay;
  if (remHours < 0.1) return `${days}d`;
  return `${days}d ${Math.round(remHours * 10) / 10}h`;
}

export function formatSLAStatus(status: SLAStatus): string {
  return status === 'green' ? 'On track' : status === 'yellow' ? 'At risk' : 'Breaching';
}

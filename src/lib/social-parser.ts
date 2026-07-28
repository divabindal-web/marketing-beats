/**
 * Social metrics parser
 *
 * Detects which platform a CSV/XLSX export came from based on header
 * fingerprints, then maps platform-specific column names to the unified
 * SocialMetricRow shape.
 *
 * Supports: YouTube Studio, LinkedIn Page Analytics, Instagram Insights,
 * Meta Business Suite (Facebook).
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { SocialMetricRow, SocialMetricPlatform } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ParseResult {
  platform: SocialMetricPlatform | null;
  confidence: number; // 0..1
  rows: SocialMetricRow[];
  warnings: string[];
  rawHeaders: string[];
  rawRowCount: number;
}

type RawRow = Record<string, string | number | undefined>;

/* ------------------------------------------------------------------ */
/*  Header fingerprints                                                */
/* ------------------------------------------------------------------ */

const HEADER_HINTS: Record<SocialMetricPlatform, string[]> = {
  YouTube: ['video title', 'watch time', 'views', 'subscribers', 'impressions', 'channel'],
  LinkedIn: ['follower', 'impressions (organic)', 'engagement rate', 'reactions', 'company page'],
  Instagram: ['reach', 'plays', 'saves', 'profile visits', 'media product type', 'permalink'],
  Facebook: ['page likes', 'post reach', 'page impressions', 'page engaged users', 'page followers'],
};

/* ------------------------------------------------------------------ */
/*  Public entry points                                                */
/* ------------------------------------------------------------------ */

/** Parse a File object (CSV or XLSX), auto-detect platform, return rows. */
export async function parseSocialFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
  const isCsv = name.endsWith('.csv');

  if (!isXlsx && !isCsv) {
    return {
      platform: null,
      confidence: 0,
      rows: [],
      warnings: [`Unsupported file extension. Use .csv or .xlsx (got "${file.name}").`],
      rawHeaders: [],
      rawRowCount: 0,
    };
  }

  let headers: string[] = [];
  let rawRows: RawRow[] = [];

  if (isXlsx) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json<RawRow>(firstSheet, { defval: '' });
    headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  } else {
    const text = await file.text();
    const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
    rawRows = parsed.data;
    headers = parsed.meta.fields ?? [];
  }

  const detection = detectPlatform(headers);
  const warnings: string[] = [];

  if (!detection.platform) {
    warnings.push(
      'Could not auto-detect the platform from the column headers. ' +
      'Pick the platform manually below.',
    );
  }

  const rows = detection.platform
    ? mapRows(rawRows, detection.platform, file.name, warnings)
    : [];

  return {
    platform: detection.platform,
    confidence: detection.confidence,
    rows,
    warnings,
    rawHeaders: headers,
    rawRowCount: rawRows.length,
  };
}

/** Re-map raw rows assuming a manually-chosen platform. Useful when auto-detect fails. */
export function reparseAs(
  rawHeaders: string[],
  rawRows: RawRow[],
  platform: SocialMetricPlatform,
  filename: string,
): { rows: SocialMetricRow[]; warnings: string[] } {
  void rawHeaders;
  const warnings: string[] = [];
  const rows = mapRows(rawRows, platform, filename, warnings);
  return { rows, warnings };
}

/* ------------------------------------------------------------------ */
/*  Platform detection                                                 */
/* ------------------------------------------------------------------ */

function detectPlatform(headers: string[]): {
  platform: SocialMetricPlatform | null;
  confidence: number;
} {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const scores: Array<{ p: SocialMetricPlatform; hits: number }> = [];

  for (const platform of Object.keys(HEADER_HINTS) as SocialMetricPlatform[]) {
    const hints = HEADER_HINTS[platform];
    const hits = hints.filter((hint) =>
      lower.some((h) => h.includes(hint)),
    ).length;
    scores.push({ p: platform, hits });
  }

  scores.sort((a, b) => b.hits - a.hits);
  const top = scores[0];
  if (!top || top.hits === 0) {
    return { platform: null, confidence: 0 };
  }

  const confidence = Math.min(1, top.hits / 3);
  return { platform: top.p, confidence };
}

/* ------------------------------------------------------------------ */
/*  Field mapping per platform                                         */
/* ------------------------------------------------------------------ */

/** Look up a value in a row using any of the candidate header names (case-insensitive). */
function pick(row: RawRow, candidates: string[]): string | number | undefined {
  for (const cand of candidates) {
    const key = Object.keys(row).find(
      (k) => k.toLowerCase().trim() === cand.toLowerCase().trim(),
    );
    if (key) return row[key];
  }
  return undefined;
}

function num(v: string | number | undefined): number {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  // Strip commas, percent signs, currency
  const cleaned = String(v).replace(/[,%$]/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Convert any reasonable date to "YYYY-MM-01" (first day of that month). */
function toMonthString(v: string | number | undefined): string | null {
  if (!v) return null;
  // Already a date-like string?
  const d = typeof v === 'number' ? excelSerialToDate(v) : new Date(String(v));
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

function excelSerialToDate(serial: number): Date {
  // Excel epoch is 1899-12-30 for the 1900 date system
  const utcDays = serial - 25569;
  const utcMs = utcDays * 86400 * 1000;
  return new Date(utcMs);
}

function mapRows(
  rawRows: RawRow[],
  platform: SocialMetricPlatform,
  filename: string,
  warnings: string[],
): SocialMetricRow[] {
  if (rawRows.length === 0) return [];

  // Aggregate: most exports are per-post or per-day. We collapse to one
  // row per (platform, month) by summing counters and taking the latest
  // follower count.
  type Bucket = {
    month: string;
    followers: number;
    followers_gained: number;
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    profile_views: number;
    link_clicks: number;
    posts: number;
  };

  const buckets = new Map<string, Bucket>();
  let droppedNoDate = 0;

  for (const row of rawRows) {
    const mapped = mapSingleRow(row, platform);
    if (!mapped.month) {
      droppedNoDate += 1;
      continue;
    }
    const key = mapped.month;
    const bucket = buckets.get(key) ?? {
      month: key,
      followers: 0,
      followers_gained: 0,
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      profile_views: 0,
      link_clicks: 0,
      posts: 0,
    };

    bucket.impressions += mapped.impressions;
    bucket.reach += mapped.reach;
    bucket.likes += mapped.likes;
    bucket.comments += mapped.comments;
    bucket.shares += mapped.shares;
    bucket.saves += mapped.saves;
    bucket.profile_views += mapped.profile_views;
    bucket.link_clicks += mapped.link_clicks;
    bucket.posts += mapped.posts || 1;
    bucket.followers_gained += mapped.followers_gained;
    // followers is a snapshot — keep the largest seen for the month
    if (mapped.followers > bucket.followers) bucket.followers = mapped.followers;

    buckets.set(key, bucket);
  }

  if (droppedNoDate > 0) {
    warnings.push(
      `${droppedNoDate} row${droppedNoDate === 1 ? '' : 's'} dropped — could not parse the date column.`,
    );
  }

  const now = new Date().toISOString();
  return Array.from(buckets.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((b) => {
      const reach = b.reach || 0;
      const engagement = b.likes + b.comments + b.shares + b.saves;
      const engagement_rate = reach > 0 ? Math.round((engagement / reach) * 1000) / 10 : undefined;
      return {
        id: `sm-${platform.toLowerCase()}-${b.month}-${Math.random().toString(36).slice(2, 7)}`,
        platform,
        month: b.month,
        followers: b.followers,
        followers_gained: b.followers_gained || undefined,
        impressions: b.impressions,
        reach: b.reach || undefined,
        likes: b.likes,
        comments: b.comments,
        shares: b.shares,
        saves: b.saves || undefined,
        profile_views: b.profile_views || undefined,
        link_clicks: b.link_clicks || undefined,
        posts: b.posts,
        engagement_rate,
        uploaded_by: 'user-divya-krishnan',
        uploaded_at: now,
        source_file: filename,
      };
    });
}

interface MappedRow {
  month: string | null;
  followers: number;
  followers_gained: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profile_views: number;
  link_clicks: number;
  posts: number;
}

function mapSingleRow(row: RawRow, platform: SocialMetricPlatform): MappedRow {
  switch (platform) {
    case 'YouTube':
      return {
        month: toMonthString(pick(row, ['Date', 'Day', 'Month', 'Period'])),
        followers: num(pick(row, ['Subscribers', 'Total subscribers'])),
        followers_gained: num(pick(row, ['Subscribers gained', 'Subs gained'])),
        impressions: num(pick(row, ['Impressions', 'Views'])),
        reach: num(pick(row, ['Unique viewers', 'Reach'])),
        likes: num(pick(row, ['Likes'])),
        comments: num(pick(row, ['Comments added', 'Comments'])),
        shares: num(pick(row, ['Shares'])),
        saves: 0,
        profile_views: num(pick(row, ['Channel views'])),
        link_clicks: num(pick(row, ['End screen clicks', 'Card clicks'])),
        posts: num(pick(row, ['Videos published'])),
      };
    case 'LinkedIn':
      return {
        month: toMonthString(pick(row, ['Date', 'Day', 'Month'])),
        followers: num(pick(row, ['Total followers', 'Followers'])),
        followers_gained: num(pick(row, ['New followers', 'Net followers'])),
        impressions: num(pick(row, ['Impressions (organic)', 'Impressions', 'Total impressions'])),
        reach: num(pick(row, ['Unique impressions', 'Reach'])),
        likes: num(pick(row, ['Reactions', 'Likes'])),
        comments: num(pick(row, ['Comments'])),
        shares: num(pick(row, ['Shares', 'Reposts'])),
        saves: num(pick(row, ['Saves'])),
        profile_views: num(pick(row, ['Page views'])),
        link_clicks: num(pick(row, ['Clicks', 'Custom button clicks'])),
        posts: num(pick(row, ['Posts'])),
      };
    case 'Instagram':
      return {
        month: toMonthString(pick(row, ['Publish time', 'Post date', 'Date'])),
        followers: num(pick(row, ['Followers', 'Total followers'])),
        followers_gained: num(pick(row, ['Follows', 'New followers'])),
        impressions: num(pick(row, ['Impressions', 'Plays'])),
        reach: num(pick(row, ['Reach', 'Accounts reached'])),
        likes: num(pick(row, ['Likes'])),
        comments: num(pick(row, ['Comments'])),
        shares: num(pick(row, ['Shares'])),
        saves: num(pick(row, ['Saves'])),
        profile_views: num(pick(row, ['Profile visits'])),
        link_clicks: num(pick(row, ['Link clicks', 'Website taps'])),
        posts: 1,
      };
    case 'Facebook':
      return {
        month: toMonthString(pick(row, ['Date', 'Day', 'Publish time'])),
        followers: num(pick(row, ['Page followers', 'Page likes'])),
        followers_gained: num(pick(row, ['New page likes', 'Net likes'])),
        impressions: num(pick(row, ['Page impressions', 'Post reach'])),
        reach: num(pick(row, ['Post reach', 'Reach'])),
        likes: num(pick(row, ['Reactions', 'Likes'])),
        comments: num(pick(row, ['Comments'])),
        shares: num(pick(row, ['Shares'])),
        saves: 0,
        profile_views: num(pick(row, ['Page views'])),
        link_clicks: num(pick(row, ['Link clicks', 'Page CTA clicks'])),
        posts: num(pick(row, ['Posts published'])),
      };
  }
}

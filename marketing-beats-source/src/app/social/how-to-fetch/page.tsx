'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Clock, Upload } from 'lucide-react';
import { SocialMetricPlatform, SOCIAL_METRIC_PLATFORMS } from '@/types';
import { PLATFORM_COLOR } from '@/lib/social-metrics';

interface PlatformGuide {
  platform: SocialMetricPlatform;
  url: string;
  exportFormat: string;
  duration: string;
  steps: { title: string; detail?: string }[];
  tips: string[];
}

const GUIDES: PlatformGuide[] = [
  {
    platform: 'YouTube',
    url: 'https://studio.youtube.com',
    exportFormat: 'CSV',
    duration: '~3 min',
    steps: [
      {
        title: 'Open YouTube Studio',
        detail: 'Sign in with the channel owner account at studio.youtube.com.',
      },
      {
        title: 'Go to Analytics → Advanced Mode',
        detail: 'Left sidebar → Analytics, then click the Advanced Mode button at the top right.',
      },
      {
        title: 'Pick the date range',
        detail: 'Set the calendar to the full month you want (1st → last day).',
      },
      {
        title: 'Add the metrics you need',
        detail: 'Click the “+” next to the chart and add: Views, Impressions, Watch time, Subscribers gained, Likes, Comments added, Shares.',
      },
      {
        title: 'Group by Day',
        detail: 'Set the “Group by” dropdown to Day. The aggregator will collapse to monthly automatically.',
      },
      {
        title: 'Export',
        detail: 'Click the Export icon (top right) → Comma-separated values (.csv).',
      },
    ],
    tips: [
      'If you have multiple channels, switch channels in the avatar menu before exporting.',
      'YouTube Studio occasionally throttles big exports — pull one month at a time.',
    ],
  },
  {
    platform: 'LinkedIn',
    url: 'https://www.linkedin.com/company/admin',
    exportFormat: 'XLSX',
    duration: '~2 min',
    steps: [
      {
        title: 'Open the Page admin view',
        detail: 'Go to your LinkedIn Page → click Admin tools → Page Analytics.',
      },
      {
        title: 'Pick the analytics tab',
        detail: 'You\'ll need to export from each tab separately: Followers, Visitors, Updates.',
      },
      {
        title: 'Set the time range',
        detail: 'Use the date picker at the top right and pick the calendar month.',
      },
      {
        title: 'Click Export',
        detail: 'Top-right Export button → choose .xls. The file is named like Followers_<page>_<date>.xls.',
      },
      {
        title: 'Use the “Updates” export',
        detail: 'For impressions / engagement / posts published, the Updates tab is the source of truth — export it and upload that one.',
      },
    ],
    tips: [
      'Only Page admins can export. Ask the Marketing admin to give you the “Analyst” role at minimum.',
      'LinkedIn rounds everything below 100 — that\'s a platform quirk, not a parser bug.',
    ],
  },
  {
    platform: 'Instagram',
    url: 'https://business.facebook.com/latest/insights',
    exportFormat: 'CSV',
    duration: '~4 min',
    steps: [
      {
        title: 'Open Meta Business Suite',
        detail: 'Go to business.facebook.com and pick the brand account. Make sure Instagram is connected.',
      },
      {
        title: 'Navigate to Insights → Content',
        detail: 'Left sidebar → Insights → Content. Filter by Instagram only.',
      },
      {
        title: 'Pick the date range',
        detail: 'Top-right calendar → choose the calendar month.',
      },
      {
        title: 'Choose the columns',
        detail: 'Click the column picker and add: Reach, Impressions, Likes, Comments, Shares, Saves, Profile visits, Follows.',
      },
      {
        title: 'Export to CSV',
        detail: 'Top right → Export → Download as CSV. You\'ll get one row per post.',
      },
    ],
    tips: [
      'For follower count, also export the Audience tab — that\'s a separate snapshot.',
      'Instagram Insights only goes back 90 days. Pull monthly to avoid losing data.',
    ],
  },
  {
    platform: 'Facebook',
    url: 'https://business.facebook.com/latest/insights',
    exportFormat: 'CSV',
    duration: '~3 min',
    steps: [
      {
        title: 'Open Meta Business Suite',
        detail: 'business.facebook.com → pick the Facebook Page.',
      },
      {
        title: 'Insights → Overview → Page',
        detail: 'Left sidebar → Insights. Filter by Facebook only.',
      },
      {
        title: 'Set time period',
        detail: 'Top-right date picker → calendar month.',
      },
      {
        title: 'Add Reach, Engagement, Page metrics',
        detail: 'Use the column picker to ensure Page reach, Page impressions, Page engagement, Page followers, Posts published are all selected.',
      },
      {
        title: 'Export to CSV',
        detail: 'Top right → Export → CSV.',
      },
    ],
    tips: [
      'Facebook reach is now de-duplicated across the day — totals look smaller than they used to. This is normal.',
      'Page CTA clicks live in a different section: Insights → Page → Actions on Page.',
    ],
  },
];

export default function HowToFetchPage() {
  const [active, setActive] = useState<SocialMetricPlatform>('YouTube');
  const guide = GUIDES.find((g) => g.platform === active)!;
  const color = PLATFORM_COLOR[active];

  return (
    <div>
      {/* Page header */}
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">How to Fetch Data</h1>
          <p className="gb-page-description">
            Step-by-step guides for pulling monthly metrics from each platform. Pick a platform on
            the left, follow the steps, then upload the file on the upload page.
          </p>
        </div>
        <Link href="/social/upload" className="gb-btn gb-btn-primary">
          <Upload size={14} strokeWidth={2.25} />
          Go to upload
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Platform list */}
        <aside>
          <div className="gb-card overflow-hidden">
            {SOCIAL_METRIC_PLATFORMS.map((p, idx) => {
              const isActive = active === p;
              const c = PLATFORM_COLOR[p];
              return (
                <button
                  key={p}
                  onClick={() => setActive(p)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.dot }}
                  />
                  <span className="text-[13px] font-medium flex-1">{p}</span>
                  {isActive && <ArrowRight size={12} style={{ color: 'var(--text-faint)' }} />}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Guide body */}
        <div>
          {/* Header strip */}
          <div className="gb-card p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-semibold"
                  style={{
                    backgroundColor: color.bg,
                    color: color.text,
                    border: `1px solid ${color.border}`,
                  }}
                >
                  {guide.platform.charAt(0)}
                </span>
                <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {guide.platform}
                </h2>
              </div>
              <a
                href={guide.url}
                target="_blank"
                rel="noopener noreferrer"
                className="gb-btn gb-btn-secondary"
              >
                Open dashboard
                <ExternalLink size={12} strokeWidth={2} />
              </a>
            </div>
            <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              <span className="flex items-center gap-1">
                <Clock size={12} strokeWidth={2} />
                {guide.duration}
              </span>
              <span>·</span>
              <span>Format: {guide.exportFormat}</span>
            </div>
          </div>

          {/* Steps */}
          <h3 className="gb-section-title">Steps</h3>
          <div className="space-y-3 mb-6">
            {guide.steps.map((step, idx) => (
              <div key={idx} className="gb-card p-4 flex gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                  style={{
                    backgroundColor: 'var(--accent-light)',
                    color: 'var(--accent-text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                    {step.title}
                  </div>
                  {step.detail && (
                    <div className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {step.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          {guide.tips.length > 0 && (
            <>
              <h3 className="gb-section-title">Tips</h3>
              <div className="gb-card p-4 space-y-2">
                {guide.tips.map((tip, idx) => (
                  <div key={idx} className="text-[12px] flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-faint)' }}>•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

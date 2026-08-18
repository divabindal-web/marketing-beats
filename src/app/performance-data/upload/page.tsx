'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload, Download, FileText, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { parsePerfCsv, upsertSeries, type SeriesRow } from '@/lib/perf-api';

const TEMPLATE_CSV = [
  'Domain,Entity,Metric,Month,Value,Baseline,Target',
  'seo,SQY - SEO,clicks,2026-07,612000,613017,757424',
  'orm,TrustPilot,rating,2026-03,4.7,,',
  'paid,INCO-IN,roas,2026-03,7,,',
].join('\n');

const EXAMPLE_ROWS = [
  { d: 'seo', e: 'SQY - SEO', m: 'clicks', mo: '2026-07', v: '612,000', b: '613017', t: '757424' },
  { d: 'orm', e: 'TrustPilot', m: 'rating', mo: '2026-03', v: '4.7', b: '', t: '' },
  { d: 'paid', e: 'INCO-IN', m: 'roas', mo: '2026-03-01', v: '7', b: '', t: '' },
  { d: 'social', e: 'All accounts', m: 'followers', mo: '2026-03', v: '740,095', b: '', t: '' },
];

export default function UploadDataPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ rows: SeriesRow[]; errors: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const templateHref = useMemo(
    () => 'data:text/csv;charset=utf-8,' + encodeURIComponent(TEMPLATE_CSV),
    [],
  );

  const onFile = async (f: File | undefined) => {
    setSavedCount(null);
    setSaveError(null);
    if (!f) {
      setFileName(null);
      setParsed(null);
      return;
    }
    setFileName(f.name);
    try {
      const text = await f.text();
      setParsed(parsePerfCsv(text));
    } catch (e) {
      setParsed({ rows: [], errors: [e instanceof Error ? e.message : String(e)] });
    }
  };

  const onSave = async () => {
    if (!parsed || !parsed.rows.length) return;
    setSaving(true);
    setSaveError(null);
    setSavedCount(null);
    try {
      const n = await upsertSeries(parsed.rows);
      setSavedCount(n);
      setParsed(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const th = 'text-left py-2 px-2.5 font-semibold uppercase text-[10.5px] tracking-wide';
  const td = 'text-left py-2 px-2.5';

  return (
    <div>
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Upload Data</h1>
          <p className="gb-page-description">
            One CSV feeds every performance dashboard — SEO, ORM, Paid and Social
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-faint)' }}>
            Rows are upserted by Domain + Entity + Metric + Month, so re-uploading a month updates it in place.
          </p>
          {/* These instructions existed but were only reachable from the
              sample-data pages, so the one page that needs them never
              offered them. */}
          <Link href="/social/how-to-fetch"
                className="text-[12px] mt-2 inline-flex items-center gap-1.5"
                style={{ color: 'var(--link)' }}>
            <BookOpen size={13} /> How to fetch the numbers from Hootsuite
          </Link>
        </div>
        <a href={templateHref} download="performance-data-template.csv" className="gb-btn gb-btn-secondary">
          <Download size={14} strokeWidth={2} />
          Download template
        </a>
      </div>

      {/* Format explainer */}
      <div className="gb-card p-4 mb-4">
        <h3 className="gb-section-title" style={{ marginBottom: 2 }}>CSV format</h3>
        <p className="gb-page-description mb-3">
          Header row (case-insensitive): <code>Domain,Entity,Metric,Month,Value,Baseline,Target</code>.
          Domain is one of <code>seo</code>, <code>orm</code>, <code>paid</code>, <code>social</code>.
          Month is <code>YYYY-MM</code> or <code>YYYY-MM-DD</code>. Numbers may contain commas; Baseline and Target are optional.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr style={{ color: 'var(--text-faint)' }}>
                <th className={th}>Domain</th>
                <th className={th}>Entity</th>
                <th className={th}>Metric</th>
                <th className={th}>Month</th>
                <th className={th}>Value</th>
                <th className={th}>Baseline</th>
                <th className={th}>Target</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_ROWS.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className={td}>{r.d}</td>
                  <td className={td}>{r.e}</td>
                  <td className={td}>{r.m}</td>
                  <td className={td}>{r.mo}</td>
                  <td className={td}>{r.v}</td>
                  <td className={td}>{r.b || '—'}</td>
                  <td className={td}>{r.t || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* File picker */}
      <div className="gb-card p-4 mb-4">
        <h3 className="gb-section-title" style={{ marginBottom: 2 }}>Upload a CSV</h3>
        <p className="gb-page-description mb-3">Pick a file to preview it before saving.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="gb-btn gb-btn-primary cursor-pointer">
            <Upload size={14} strokeWidth={2.25} />
            Choose file
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {fileName && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
              <FileText size={14} strokeWidth={2} />
              {fileName}
            </span>
          )}
        </div>
        {savedCount != null && (
          <p className="text-[12.5px] mt-3 font-semibold" style={{ color: 'var(--success)' }}>
            {savedCount} rows saved — dashboards updated.
          </p>
        )}
        {saveError && (
          <p className="text-[12.5px] mt-3" style={{ color: 'var(--error)' }}>
            Save failed: {saveError}
          </p>
        )}
      </div>

      {/* Preview + errors */}
      {parsed && (
        <div className="gb-card p-4 mb-4">
          <h3 className="gb-section-title" style={{ marginBottom: 2 }}>
            Preview <span className="gb-badge">{parsed.rows.length} rows parsed</span>
          </h3>
          <p className="gb-page-description mb-3">first 10 rows shown</p>

          {parsed.errors.length > 0 && (
            <ul className="mb-3 space-y-1">
              {parsed.errors.map((e, i) => (
                <li key={i} className="text-[12px]" style={{ color: 'var(--error)' }}>
                  {e}
                </li>
              ))}
            </ul>
          )}

          {parsed.rows.length > 0 && (
            <>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ color: 'var(--text-faint)' }}>
                      <th className={th}>Domain</th>
                      <th className={th}>Entity</th>
                      <th className={th}>Metric</th>
                      <th className={th}>Month</th>
                      <th className={th.replace('text-left', 'text-right')}>Value</th>
                      <th className={th.replace('text-left', 'text-right')}>Baseline</th>
                      <th className={th.replace('text-left', 'text-right')}>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className={td}>{r.domain}</td>
                        <td className={td}>{r.entity}</td>
                        <td className={td}>{r.metric}</td>
                        <td className={td}>{r.month}</td>
                        <td className="text-right py-2 px-2.5">{r.value ?? '—'}</td>
                        <td className="text-right py-2 px-2.5">{r.baseline ?? '—'}</td>
                        <td className="text-right py-2 px-2.5">{r.target ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="gb-btn gb-btn-primary" onClick={onSave} disabled={saving}>
                <Upload size={14} strokeWidth={2.25} />
                {saving ? 'Saving…' : `Save ${parsed.rows.length} rows`}
              </button>
            </>
          )}
          {parsed.rows.length === 0 && parsed.errors.length === 0 && (
            <p className="gb-page-description">No data rows found in this file.</p>
          )}
        </div>
      )}
    </div>
  );
}

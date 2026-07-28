'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  BookOpen,
  Eye,
  Loader2,
} from 'lucide-react';
import {
  SocialMetricRow,
  SocialMetricPlatform,
  SOCIAL_METRIC_PLATFORMS,
} from '@/types';
import { parseSocialFile, ParseResult } from '@/lib/social-parser';
import {
  PLATFORM_COLOR,
  formatCompact,
  formatMonth,
} from '@/lib/social-metrics';

type Stage = 'idle' | 'parsing' | 'review' | 'committed';

export default function SocialUploadPage() {
  const [stage, setStage] = useState<Stage>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [overridePlatform, setOverridePlatform] = useState<SocialMetricPlatform | ''>('');
  const [committedRows, setCommittedRows] = useState<SocialMetricRow[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setStage('parsing');
    setResult(null);
    try {
      const r = await parseSocialFile(f);
      setResult(r);
      setOverridePlatform(r.platform || '');
      setStage('review');
    } catch (err) {
      setResult({
        platform: null,
        confidence: 0,
        rows: [],
        warnings: [`Failed to read file: ${err instanceof Error ? err.message : String(err)}`],
        rawHeaders: [],
        rawRowCount: 0,
      });
      setStage('review');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleCommit = () => {
    if (result) {
      setCommittedRows(result.rows);
      setStage('committed');
    }
  };

  const handleReset = () => {
    setStage('idle');
    setFile(null);
    setResult(null);
    setOverridePlatform('');
    setCommittedRows([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      {/* Page header */}
      <div className="gb-page-header flex items-start justify-between gap-6">
        <div>
          <h1 className="gb-page-title">Upload Metrics</h1>
          <p className="gb-page-description">
            Drop in a CSV or XLSX export from any social platform. We&apos;ll detect the platform,
            map columns and aggregate to monthly totals.
          </p>
        </div>
        <Link href="/social/how-to-fetch" className="gb-btn gb-btn-secondary">
          <BookOpen size={14} strokeWidth={2} />
          How to fetch data
        </Link>
      </div>

      {/* Drop zone */}
      {stage === 'idle' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="gb-card flex flex-col items-center justify-center text-center cursor-pointer"
          style={{
            padding: '48px 24px',
            borderStyle: 'dashed',
            borderColor: isDragOver ? 'var(--accent)' : 'var(--border)',
            backgroundColor: isDragOver ? 'var(--accent-light)' : 'var(--bg-card)',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            className="w-12 h-12 rounded-md flex items-center justify-center mb-4"
            style={{
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-text)',
              border: '1px solid var(--border)',
            }}
          >
            <Upload size={20} strokeWidth={1.75} />
          </div>
          <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Drop your file here, or click to browse
          </div>
          <div className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            CSV or XLSX from YouTube Studio, LinkedIn Page Analytics, Instagram Insights, Meta Business Suite
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {/* Parsing */}
      {stage === 'parsing' && (
        <div className="gb-card flex items-center justify-center" style={{ padding: '48px' }}>
          <Loader2 size={20} className="animate-spin mr-3" style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-primary)' }}>Parsing {file?.name}…</span>
        </div>
      )}

      {/* Review */}
      {stage === 'review' && result && (
        <div className="space-y-6">
          {/* File summary */}
          <div className="gb-card p-4 flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-text)',
                border: '1px solid var(--border)',
              }}
            >
              <FileText size={18} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {file?.name}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {result.rawRowCount} raw rows · {result.rawHeaders.length} columns ·{' '}
                {file ? `${(file.size / 1024).toFixed(1)} KB` : ''}
              </div>
            </div>
            <button onClick={handleReset} className="gb-icon-btn" title="Discard">
              <X size={14} />
            </button>
          </div>

          {/* Detection */}
          <section>
            <h2 className="gb-section-title">Platform detection</h2>
            <div className="gb-card p-4">
              {result.platform ? (
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                  <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                    Detected as <strong>{result.platform}</strong>{' '}
                    <span style={{ color: 'var(--text-faint)' }}>
                      ({Math.round(result.confidence * 100)}% confidence)
                    </span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
                  <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                    Could not auto-detect — please pick the platform manually below.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wider mr-1" style={{ color: 'var(--text-faint)' }}>
                  Override
                </span>
                {SOCIAL_METRIC_PLATFORMS.map((p) => {
                  const isActive = overridePlatform === p;
                  const color = PLATFORM_COLOR[p];
                  return (
                    <button
                      key={p}
                      onClick={() => setOverridePlatform(p)}
                      className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: isActive ? color.bg : 'var(--bg-tertiary)',
                        color: isActive ? color.text : 'var(--text-secondary)',
                        border: `1px solid ${isActive ? color.border : 'var(--border)'}`,
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <section>
              <h2 className="gb-section-title">Notes</h2>
              <div className="gb-card p-4 space-y-2">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Mapped rows preview */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="gb-section-title" style={{ marginBottom: 0 }}>
                Aggregated rows
              </h2>
              <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                {result.rows.length} month{result.rows.length === 1 ? '' : 's'}
              </span>
            </div>
            {result.rows.length === 0 ? (
              <div className="gb-card p-6 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
                <Eye size={20} strokeWidth={1.75} className="mx-auto mb-2" />
                Nothing to preview yet. Pick a platform to map the columns.
              </div>
            ) : (
              <div className="gb-card overflow-hidden">
                <table className="gb-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={{ textAlign: 'right' }}>Followers</th>
                      <th style={{ textAlign: 'right' }}>Impressions</th>
                      <th style={{ textAlign: 'right' }}>Reach</th>
                      <th style={{ textAlign: 'right' }}>Likes</th>
                      <th style={{ textAlign: 'right' }}>Comments</th>
                      <th style={{ textAlign: 'right' }}>Shares</th>
                      <th style={{ textAlign: 'right' }}>Posts</th>
                      <th style={{ textAlign: 'right' }}>Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {formatMonth(r.month)}
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatCompact(r.followers)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCompact(r.impressions)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCompact(r.reach)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCompact(r.likes)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCompact(r.comments)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCompact(r.shares)}</td>
                        <td style={{ textAlign: 'right' }}>{r.posts}</td>
                        <td style={{ textAlign: 'right' }}>
                          {r.engagement_rate ? `${r.engagement_rate.toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Commit bar */}
          <div className="flex items-center justify-end gap-2">
            <button onClick={handleReset} className="gb-btn gb-btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleCommit}
              disabled={result.rows.length === 0}
              className="gb-btn gb-btn-primary"
              style={{
                opacity: result.rows.length === 0 ? 0.5 : 1,
                cursor: result.rows.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <CheckCircle2 size={14} strokeWidth={2.25} />
              Commit {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {/* Committed */}
      {stage === 'committed' && (
        <div className="gb-card p-8 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              color: '#15803d',
              border: '1px solid rgba(22, 163, 74, 0.2)',
            }}
          >
            <CheckCircle2 size={20} strokeWidth={2} />
          </div>
          <div className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {committedRows.length} row{committedRows.length === 1 ? '' : 's'} committed
          </div>
          <div className="text-[12px] mb-6" style={{ color: 'var(--text-faint)' }}>
            (Demo only — rows would be persisted to the database in production.)
          </div>
          <div className="flex items-center justify-center gap-2">
            <Link href="/social/dashboard" className="gb-btn gb-btn-primary">
              View dashboard
            </Link>
            <button onClick={handleReset} className="gb-btn gb-btn-secondary">
              Upload another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

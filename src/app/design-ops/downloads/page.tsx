'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { Request } from '@/types';
import { createRequest, fetchRequests } from '@/lib/requests-api';
import { FileDown, Download, Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface ImportRow {
  Type: string;
  'Requested By': string;
  Title: string;
  Description: string;
  Requestor: string;
  'Need By': string;
  'Reference Link': string;
}

interface ParsedRequest extends Request {
  stage_timestamps?: Record<string, string>;
}

export default function DownloadsUploadsPage() {
  const [importedRequests, setImportedRequests] = useState<Request[]>([]);
  const [allRows, setAllRows] = useState<ImportRow[]>([]);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Generate CSV template
  const downloadTemplate = () => {
    const headers = ['Type', 'Requested By', 'Title', 'Description', 'Requestor', 'Need By', 'Reference Link'];

    const sampleRows = [
      ['Video', 'Social Team', 'Product Demo', 'Create product demo video', 'John Doe', '2026-04-15', 'https://example.com/demo'],
      ['Graphics', 'Marketing', 'Banner Set', 'Design web banners', 'Jane Smith', '2026-04-20', 'https://example.com/banners'],
      ['Social Media Graphics', 'Social Team', 'Instagram Templates', 'Design Instagram story templates', 'Alice Brown', '2026-04-18', 'https://example.com/instagram'],
      ['Video', 'Management', 'Company Overview', 'Create company overview video', 'Bob Wilson', '2026-05-01', 'https://example.com/overview'],
      ['Graphics', 'Paid Campaign', 'Ad Creatives', 'Design Facebook ad creatives', 'Carol Davis', '2026-04-25', 'https://example.com/ads'],
    ];

    const csv = [
      headers.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'social_calendar_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage({ type: 'success', message: 'Template downloaded successfully!' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as ImportRow[];
        setAllRows(rows);
        setPreviewData(rows.slice(0, 10));
        setIsProcessing(false);
        setStatusMessage({ type: 'success', message: `${rows.length} rows loaded and ready to preview.` });
      },
      error: (error: any) => {
        console.error('CSV parse error:', error);
        setIsProcessing(false);
        setStatusMessage({ type: 'error', message: 'Error parsing file: ' + error.message });
      },
    });
  };

  // Convert rows to Request objects and persist each one to the database
  const handleImport = async () => {
    setIsProcessing(true);
    const saved: Request[] = [];
    let failed = 0;

    for (let index = 0; index < allRows.length; index++) {
      const row = allRows[index];
      const id = `req-${Date.now()}-${index}`;
      const nowIso = new Date().toISOString();
      const request = {
        id,
        type: (row.Type as any) || 'Graphics',
        requested_by: (row['Requested By'] as any) || 'Others',
        title: row.Title || 'Untitled',
        description: row.Description || '',
        requestor_name: row.Requestor || 'Unknown',
        need_by: row['Need By'] || new Date().toISOString().split('T')[0],
        reference_link: row['Reference Link'] || '',
        current_stage: 'Assigned',
        revisions: 0,
        created_at: nowIso,
        updated_at: nowIso,
        transitions: [
          {
            id: `tr-${id}-0`,
            request_id: id,
            from_stage: null,
            to_stage: 'Assigned' as const,
            transitioned_at: nowIso,
            transitioned_by: 'user-divya-krishnan',
          },
        ],
      } as Request;

      try {
        saved.push(await createRequest(request));
      } catch (error) {
        console.error('Failed to save imported request:', row.Title, error);
        failed++;
      }
    }

    setImportedRequests(saved);
    setAllRows([]);
    setPreviewData([]);
    setFileName('');
    setIsProcessing(false);
    setStatusMessage({
      type: failed > 0 ? 'error' : 'success',
      message: `${saved.length} requests imported and saved${failed > 0 ? `, ${failed} failed` : ''}`,
    });
    setTimeout(() => setStatusMessage(null), 6000);
  };

  // Export all requests.
  //
  // This used to export SAMPLE_REQUESTS — the hardcoded demo rows — so
  // "Export all requests" handed you a CSV of invented work rather than the
  // team's. It reads the real table now.
  const handleExportAll = async () => {
    setIsExporting(true);
    const headers = ['Type', 'Entity', 'Requested By', 'Title', 'Description',
                     'Requestor', 'Need By', 'Stage', 'Reference Link'];

    let live: Request[] = [];
    try {
      live = await fetchRequests();
    } catch (e) {
      setStatusMessage({ type: 'error', message: 'Could not load requests to export: ' + (e instanceof Error ? e.message : String(e)) });
      setTimeout(() => setStatusMessage(null), 6000);
      setIsExporting(false);
      return;
    }

    // Anything staged in this session but not yet saved is worth including,
    // without listing it twice if it has already been created.
    const seen = new Set(live.map((r) => r.id));
    const rows = [...live, ...importedRequests.filter((r) => !seen.has(r.id))].map((req) => [
      req.type,
      (req as { entity?: string }).entity ?? '',
      req.requested_by,
      req.title,
      req.description || '',
      req.requestor_name,
      req.need_by,
      req.current_stage ?? '',
      req.reference_link || '',
    ]);

    if (rows.length === 0) {
      setStatusMessage({ type: 'error', message: 'There are no requests to export yet.' });
      setTimeout(() => setStatusMessage(null), 4000);
      setIsExporting(false);
      return;
    }

    const csv = [
      headers.join(','),
      // Escape embedded quotes so a title containing one cannot break the row.
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `marketing-requests-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage({ type: 'success', message: `Exported ${rows.length} request${rows.length === 1 ? '' : 's'}.` });
    setIsExporting(false);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleCancel = () => {
    setAllRows([]);
    setPreviewData([]);
    setFileName('');
    setStatusMessage(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }} className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="gb-page-header">
          <h1 className="gb-page-title">Downloads & Uploads</h1>
          <p className="gb-page-description">
            Import a social calendar to auto-create requests, or download a CSV template to populate offline.
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            style={{
              backgroundColor: statusMessage.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
              color: statusMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
            }}
            className="flex items-center gap-2 mb-6 rounded-[var(--radius)] border border-current border-opacity-20 p-3"
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span className="text-sm font-medium">{statusMessage.message}</span>
          </div>
        )}

        {/* Two-Card Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Download Template */}
          <div className="gb-card" style={{ padding: '24px' }}>
            <div className="flex items-start gap-3 mb-4">
              <FileDown size={20} style={{ color: 'var(--accent)', marginTop: '2px' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Download Template</h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              Get the standard social calendar CSV template with all required columns.
            </p>
            <button onClick={downloadTemplate} className="gb-btn gb-btn-primary w-full">
              <FileDown size={14} />
              Download CSV Template
            </button>

            {/* The export existed as a function but no button ever called it,
                so a page called "Downloads" offered no way to get your own
                data out. */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.5' }}>
                Or export every request currently in Marketing Beats, with its entity and stage.
              </p>
              <button onClick={() => void handleExportAll()} disabled={isExporting}
                      className="gb-btn gb-btn-secondary w-full">
                <Download size={14} />
                {isExporting ? 'Exporting…' : 'Export all requests'}
              </button>
            </div>
          </div>

          {/* Card 2: Upload Social Calendar */}
          <div className="gb-card" style={{ padding: '24px' }}>
            <div className="flex items-start gap-3 mb-4">
              <Upload size={20} style={{ color: 'var(--accent)', marginTop: '2px' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Upload Social Calendar</h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
              Import your social calendar data to auto-create requests with the correct format.
            </p>

            {previewData.length === 0 ? (
              <div
                onClick={() => document.getElementById('file-upload')?.click()}
                style={{
                  border: '2px dashed var(--border-strong)',
                  borderRadius: '8px',
                  padding: '32px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                className="group hover:border-[var(--accent)]"
              >
                <Upload size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '4px' }}>Click to upload CSV</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>or drag and drop (CSV, XLS, XLSX)</p>

                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="mb-4">
                <h3 className="gb-section-title">Preview</h3>
                <div className="gb-card overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <table className="gb-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Title</th>
                        <th>Requestor</th>
                        <th>Need By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.Type}</td>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.Title}
                          </td>
                          <td>{row.Requestor}</td>
                          <td>{row['Need By']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {previewData.length > 0 && (
              <div className="flex gap-3 mt-4">
                <button onClick={() => void handleImport()} disabled={isProcessing} className="gb-btn gb-btn-primary flex-1">
                  {isProcessing ? 'Saving…' : `Import ${allRows.length} Entries`}
                </button>
                <button onClick={handleCancel} disabled={isProcessing} className="gb-btn gb-btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Imported Requests Section */}
        {importedRequests.length > 0 && (
          <div className="mt-6">
            <h3 className="gb-section-title">Recently Imported (saved to database)</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {importedRequests.map(req => (
                <div key={req.id} className="gb-card gb-card-hover p-4">
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>{req.title}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{req.type}</p>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-faint)', marginTop: '4px', fontFamily: 'monospace' }}>
                    id: {req.id}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

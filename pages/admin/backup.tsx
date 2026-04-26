import { useState, useEffect, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

interface Preview {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: { shifts: number; employees: number; leave_requests: number; time_logs: number }
  conflicts: { existingShifts: number; existingEmployees: number }
}

interface HistoryEntry {
  id: number
  action: string
  performed_by: string
  record_counts: Record<string, number>
  created_at: string
}

export default function BackupPage({ user }: Props) {
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importErr, setImportErr] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [backupData, setBackupData] = useState<unknown>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [histLoading, setHistLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    fetch('/api/admin/backup?action=history').then(r => r.json()).then(d => {
      if (d.success) setHistory(d.data)
      setHistLoading(false)
    }).catch(() => setHistLoading(false))
  }, [])

  // ── Export ──
  async function handleExport() {
    setExporting(true); setExportMsg('')
    try {
      const res = await fetch('/api/admin/backup')
      if (!res.ok) throw new Error('Export mislukt')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `denotenman-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportMsg('✅ Backup gedownload')
      // Refresh history
      const hRes = await fetch('/api/admin/backup?action=history')
      const hData = await hRes.json()
      if (hData.success) setHistory(hData.data)
    } catch (err) {
      setExportMsg('❌ Export mislukt')
    }
    setExporting(false)
  }

  // ── File handling ──
  function handleFile(file: File) {
    setImportErr(''); setImportMsg(''); setPreview(null); setBackupData(null)
    if (!file.name.endsWith('.json')) { setImportErr('Alleen .json bestanden zijn toegestaan'); return }
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        setBackupData(data)
        const res = await fetch('/api/admin/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        const result = await res.json()
        if (result.success) setPreview(result.data)
        else setImportErr(result.error || 'Validatie mislukt')
      } catch { setImportErr('Ongeldig JSON bestand') }
    }
    reader.readAsText(file)
  }

  // ── Import execute ──
  async function handleImport() {
    if (!backupData) return
    setImporting(true); setImportMsg(''); setImportErr('')
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: backupData, mode }),
      })
      const result = await res.json()
      if (result.success && result.data.success) {
        const d = result.data.imported
        setImportMsg(`✅ Import voltooid: ${d.shifts} diensten, ${d.employees} medewerkers, ${d.leave_requests} verlofaanvragen, ${d.time_logs} uren`)
        setPreview(null); setBackupData(null)
        // Refresh history
        const hRes = await fetch('/api/admin/backup?action=history')
        const hData = await hRes.json()
        if (hData.success) setHistory(hData.data)
      } else {
        setImportErr(result.data?.errors?.join(', ') || result.error || 'Import mislukt')
      }
    } catch { setImportErr('Import mislukt — serverfout') }
    setImporting(false)
  }

  return (
    <AdminLayout user={user} title="Backup & Herstel">

      <div className="backup-grid">

        {/* ── Export section ── */}
        <section className="backup-card">
          <div className="card-header">
            <span className="card-icon">📤</span>
            <h2>Exporteren</h2>
          </div>
          <p className="card-desc">Download een volledige backup van alle data: diensten, medewerkers, verlof en uren.</p>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? <><Spinner /> Exporteren…</> : '⬇ Download backup'}
          </button>
          {exportMsg && <p className="msg">{exportMsg}</p>}
        </section>

        {/* ── Import section ── */}
        <section className="backup-card">
          <div className="card-header">
            <span className="card-icon">📥</span>
            <h2>Importeren</h2>
          </div>
          <p className="card-desc">Upload een eerder geëxporteerd backup-bestand om data te herstellen.</p>

          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Klik of sleep een backup-bestand hierheen"
          >
            <span className="drop-icon">📁</span>
            <span>Klik of sleep een .json backup-bestand hierheen</span>
            <input ref={fileRef} type="file" accept=".json" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
          </div>

          {importErr && <p className="msg msg-error">❌ {importErr}</p>}
          {importMsg && <p className="msg msg-success">{importMsg}</p>}

          {/* Preview */}
          {preview && (
            <div className="preview-box">
              <h3>Preview</h3>
              {!preview.valid && <p className="msg msg-error">Bestand ongeldig: {preview.errors.join(', ')}</p>}
              {preview.valid && (
                <>
                  <div className="preview-stats">
                    <div className="stat"><span className="stat-num">{preview.stats.shifts}</span><span className="stat-label">Diensten</span></div>
                    <div className="stat"><span className="stat-num">{preview.stats.employees}</span><span className="stat-label">Medewerkers</span></div>
                    <div className="stat"><span className="stat-num">{preview.stats.leave_requests}</span><span className="stat-label">Verlof</span></div>
                    <div className="stat"><span className="stat-num">{preview.stats.time_logs}</span><span className="stat-label">Uren</span></div>
                  </div>

                  {preview.warnings.length > 0 && (
                    <div className="preview-warnings">
                      {preview.warnings.map((w, i) => <p key={i} className="warn-item">⚠️ {w}</p>)}
                    </div>
                  )}

                  <div className="import-mode">
                    <label className="mode-label">Importmodus:</label>
                    <label className="mode-option">
                      <input type="radio" name="mode" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')} />
                      <span><strong>Samenvoegen</strong> — voegt ontbrekende data toe</span>
                    </label>
                    <label className="mode-option">
                      <input type="radio" name="mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                      <span><strong>Vervangen</strong> — overschrijft bestaande data</span>
                    </label>
                  </div>

                  <button className="btn btn-danger" onClick={handleImport} disabled={importing}>
                    {importing ? <><Spinner /> Importeren…</> : '⬆ Start import'}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── History ── */}
      <section className="backup-card history-card">
        <div className="card-header">
          <span className="card-icon">📋</span>
          <h2>Geschiedenis</h2>
        </div>
        {histLoading ? (
          <div className="loading-row"><Spinner /> Laden…</div>
        ) : history.length === 0 ? (
          <p className="empty-text">Nog geen backup-acties uitgevoerd.</p>
        ) : (
          <table className="history-table" aria-label="Backup geschiedenis">
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Actie</th>
                <th scope="col">Door</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleString('nl-NL')}</td>
                  <td><span className={`action-badge ${h.action}`}>{h.action === 'export' ? '📤 Export' : '📥 Import'}</span></td>
                  <td>{h.performed_by}</td>
                  <td className="details-cell">
                    {h.record_counts && Object.entries(h.record_counts).map(([k, v]) => (
                      <span key={k} className="detail-chip">{k}: {typeof v === 'number' ? v : String(v)}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <style jsx>{`
        .backup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s5); margin-bottom: var(--s5); }
        .backup-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: var(--s5); display: flex; flex-direction: column; gap: var(--s3);
        }
        .card-header { display: flex; align-items: center; gap: var(--s2); }
        .card-icon { font-size: 1.5rem; }
        .card-header h2 { font-size: 1.125rem; font-weight: 600; margin: 0; }
        .card-desc { font-size: .875rem; color: var(--text-sub); line-height: 1.5; margin: 0; }

        .drop-zone {
          border: 2px dashed var(--border); border-radius: var(--radius);
          padding: var(--s6); display: flex; flex-direction: column; align-items: center; gap: var(--s2);
          cursor: pointer; transition: all .2s; color: var(--text-sub); font-size: .875rem; text-align: center;
        }
        .drop-zone:hover, .drop-zone.drag-over {
          border-color: var(--brand); background: var(--brand-subtle); color: var(--brand);
        }
        .drop-icon { font-size: 2rem; }

        .msg { font-size: .875rem; margin: 0; padding: var(--s2); border-radius: var(--radius); }
        .msg-error { background: rgba(220,53,69,.1); color: #dc3545; }
        .msg-success { background: rgba(46,125,50,.1); color: #2E7D32; }

        .preview-box {
          background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius);
          padding: var(--s4); display: flex; flex-direction: column; gap: var(--s3);
        }
        .preview-box h3 { font-size: 1rem; font-weight: 600; margin: 0; }
        .preview-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s2); }
        .stat {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          padding: var(--s2);
        }
        .stat-num { font-size: 1.25rem; font-weight: 700; color: var(--brand); }
        .stat-label { font-size: .75rem; color: var(--text-muted); }

        .preview-warnings { display: flex; flex-direction: column; gap: 4px; }
        .warn-item { font-size: .8125rem; color: #E65100; margin: 0; }

        .import-mode { display: flex; flex-direction: column; gap: var(--s2); }
        .mode-label { font-size: .875rem; font-weight: 600; }
        .mode-option {
          display: flex; align-items: flex-start; gap: var(--s2); font-size: .8125rem;
          cursor: pointer; padding: var(--s2); border-radius: var(--radius);
          transition: background .15s;
        }
        .mode-option:hover { background: var(--surface); }
        .mode-option input { margin-top: 3px; }

        .btn-danger {
          background: #dc3545; color: #fff; border: none; padding: 10px 20px;
          border-radius: var(--radius); font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: var(--s2); justify-content: center;
          transition: background .15s;
        }
        .btn-danger:hover { background: #b02a37; }
        .btn-danger:disabled { opacity: .6; cursor: not-allowed; }

        .history-card { grid-column: 1 / -1; }
        .history-table { width: 100%; border-collapse: collapse; font-size: .8125rem; }
        .history-table th {
          text-align: left; padding: var(--s2) var(--s3);
          background: var(--surface-alt); border-bottom: 1px solid var(--border);
          font-weight: 600; color: var(--text-sub);
        }
        .history-table td {
          padding: var(--s2) var(--s3); border-bottom: 1px solid var(--border);
        }
        .action-badge { font-weight: 600; }
        .action-badge.export { color: var(--brand); }
        .action-badge.import { color: #2E7D32; }
        .details-cell { display: flex; flex-wrap: wrap; gap: 4px; }
        .detail-chip {
          background: var(--surface-alt); border: 1px solid var(--border);
          border-radius: 4px; padding: 2px 6px; font-size: .75rem;
        }

        .loading-row { display: flex; align-items: center; gap: var(--s2); color: var(--text-muted); }
        .empty-text { color: var(--text-muted); font-size: .875rem; margin: 0; }

        @media (max-width: 768px) {
          .backup-grid { grid-template-columns: 1fr; }
          .preview-stats { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}

import { useState, useEffect, useRef } from 'react'
import TeamLayout from '@/components/layout/TeamLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, EmployeeDocument, DocType, Location } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

const DOC_TYPE_LABELS: Record<DocType, string> = {
  legitimatie:       'Legitimatiebewijs',
  arbeidsovereenkomst: 'Arbeidsovereenkomst',
  overig:            'Overig',
}

const DOC_TYPE_COLORS: Record<DocType, string> = {
  legitimatie:         '#1d4ed8',
  arbeidsovereenkomst: '#7B4F2E',
  overig:              '#6b7280',
}

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg':      'JPEG',
  'image/png':       'PNG',
  'image/webp':      'WebP',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage({ user }: Props) {
  const [docs, setDocs]         = useState<EmployeeDocument[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState<{
    doc_type: DocType; file: File | null; notes: string
  }>({ doc_type: 'legitimatie', file: null, notes: '' })

  const fileRef = useRef<HTMLInputElement>(null)

  const locProp = (user.location && user.location !== 'both' ? user.location : 'markt') as Exclude<Location, 'both'>

  async function loadDocs() {
    setLoading(true)
    const r = await fetch('/api/me/documents')
    const d = await r.json()
    setDocs(d.success ? d.data : [])
    setLoading(false)
  }

  useEffect(() => { loadDocs() }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadForm.file) { setError('Selecteer een bestand'); return }
    setUploading(true); setError(''); setSuccess('')

    const { file } = uploadForm
    if (!ALLOWED_MIME[file.type]) {
      setError('Bestandstype niet toegestaan. Gebruik PDF, JPEG of PNG.')
      setUploading(false); return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Bestand mag maximaal 10 MB zijn')
      setUploading(false); return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result    = reader.result as string
        const base64    = result.split(',')[1]
        const mime_type = file.type

        const r = await fetch('/api/me/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doc_type:  uploadForm.doc_type,
            filename:  file.name,
            mime_type,
            base64,
            notes: uploadForm.notes || undefined,
          }),
        })
        const d = await r.json()
        setUploading(false)
        if (!d.success) { setError(d.message ?? 'Upload mislukt'); return }
        setSuccess('Document succesvol geüpload')
        setShowUpload(false)
        setUploadForm({ doc_type: 'legitimatie', file: null, notes: '' })
        if (fileRef.current) fileRef.current.value = ''
        loadDocs()
      } catch {
        setError('Upload mislukt — probeer het opnieuw')
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleDelete(id: number) {
    if (!confirm('Weet je zeker dat je dit document wilt verwijderen?')) return
    setDeleting(id); setError(''); setSuccess('')
    const r = await fetch(`/api/me/documents/${id}`, { method: 'DELETE' })
    const d = await r.json()
    setDeleting(null)
    if (!d.success) { setError(d.message ?? 'Verwijderen mislukt'); return }
    setSuccess('Document verwijderd')
    loadDocs()
  }

  async function handleDownload(doc: EmployeeDocument) {
    // Gebruik de al aanwezige signed URL of haal er een op
    const url = doc.download_url ?? (await fetch(`/api/me/documents/${doc.id}`).then(r => r.json()).then(d => d.data?.url))
    if (url) window.open(url, '_blank', 'noopener')
  }

  if (!user.employee_id) return (
    <TeamLayout user={user} location={locProp}>
      <div className="no-emp">
        <div className="no-emp-icon">🔒</div>
        <p>Geen medewerker gekoppeld aan dit account.</p>
      </div>
    </TeamLayout>
  )

  return (
    <TeamLayout user={user} location={locProp}>
      <div className="docs-page">

        <div className="docs-header">
          <div>
            <h1 className="docs-title">Mijn documenten</h1>
            <p className="docs-sub">Hier staan je vertrouwelijke documenten veilig opgeslagen.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowUpload(v => !v); setError('') }}>
            {showUpload ? 'Annuleren' : '+ Document uploaden'}
          </button>
        </div>

        {error   && <div className="alert alert-danger"  role="alert"  >{error}</div>}
        {success && <div className="alert alert-success" role="status">{success}</div>}

        {/* ── Upload formulier ──────────────────────────────────────────── */}
        {showUpload && (
          <div className="upload-card">
            <h2 className="upload-title">Nieuw document uploaden</h2>

            <div className="security-notice">
              <span className="security-icon">🔒</span>
              <span>Documenten worden versleuteld opgeslagen. Alleen jijzelf en de beheerder hebben toegang.</span>
            </div>

            <form onSubmit={handleUpload}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="doc_type" className="form-label required">Documenttype</label>
                  <select id="doc_type" className="form-control"
                    value={uploadForm.doc_type}
                    onChange={e => setUploadForm(f => ({ ...f, doc_type: e.target.value as DocType }))}>
                    {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="file_input" className="form-label required">Bestand</label>
                  <input
                    id="file_input"
                    ref={fileRef}
                    type="file"
                    className="form-control file-input"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={e => setUploadForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                  />
                  <span className="form-hint">PDF, JPEG, PNG of WebP — maximaal 10 MB</span>
                </div>

                <div className="form-group form-group-full">
                  <label htmlFor="notes" className="form-label">Opmerking (optioneel)</label>
                  <input id="notes" className="form-control"
                    value={uploadForm.notes}
                    onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="bijv. Geldig t/m 2028" />
                </div>
              </div>

              <div className="upload-footer">
                <button type="submit" className="btn btn-primary btn-sm" disabled={uploading || !uploadForm.file}>
                  {uploading ? <><Spinner /> Uploaden…</> : 'Upload document'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Document lijst ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="loading-row"><Spinner /> Documenten laden…</div>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p className="empty-title">Nog geen documenten</p>
            <p className="empty-sub">Upload je legitimatie of arbeidsovereenkomst via de knop hierboven.</p>
          </div>
        ) : (
          <div className="doc-list">
            {docs.map(doc => (
              <div key={doc.id} className="doc-row">
                <div className="doc-type-badge" style={{ background: DOC_TYPE_COLORS[doc.doc_type] + '22', color: DOC_TYPE_COLORS[doc.doc_type] }}>
                  {DOC_TYPE_LABELS[doc.doc_type]}
                </div>
                <div className="doc-info">
                  <span className="doc-filename">{doc.filename}</span>
                  <span className="doc-meta">
                    {new Date(doc.uploaded_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
                    {doc.notes ? ` · ${doc.notes}` : ''}
                  </span>
                </div>
                <div className="doc-actions">
                  <button className="btn btn-outline btn-xs" onClick={() => handleDownload(doc)} title="Bekijken/downloaden">
                    Bekijken
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-danger"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleting === doc.id}
                    title="Verwijderen"
                  >
                    {deleting === doc.id ? <Spinner /> : 'Verwijderen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .docs-page { max-width: 760px; }

        .docs-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: var(--s4); margin-bottom: var(--s5);
        }
        .docs-title { margin: 0 0 4px; font-size: 1.375rem; font-weight: 700; }
        .docs-sub   { margin: 0; font-size: .875rem; color: var(--text-muted); }

        .no-emp { text-align: center; padding: var(--s12); }
        .no-emp-icon { font-size: 3rem; margin-bottom: var(--s3); }

        /* Upload card */
        .upload-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s5);
          margin-bottom: var(--s5);
        }
        .upload-title { font-size: 1rem; font-weight: 600; margin: 0 0 var(--s3); }
        .security-notice {
          display: flex; align-items: flex-start; gap: var(--s2);
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: var(--radius); padding: var(--s3);
          font-size: .8125rem; color: #166534;
          margin-bottom: var(--s4);
        }
        .security-icon { flex-shrink: 0; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-group-full { grid-column: 1 / -1; }
        .form-label { font-size: .875rem; font-weight: 500; }
        .form-hint  { font-size: .8125rem; color: var(--text-muted); }
        .file-input { padding: 8px; }

        .upload-footer { margin-top: var(--s4); display: flex; justify-content: flex-end; }

        /* Alerts */
        .alert { padding: var(--s3) var(--s4); border-radius: var(--radius); margin-bottom: var(--s4); font-size: .9375rem; }
        .alert-danger  { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
        .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }

        /* Empty state */
        .empty-state { text-align: center; padding: var(--s12) var(--s8); }
        .empty-icon  { font-size: 3rem; margin-bottom: var(--s3); }
        .empty-title { font-weight: 600; margin: 0 0 var(--s2); }
        .empty-sub   { color: var(--text-muted); font-size: .9375rem; margin: 0; }

        /* Doc list */
        .doc-list {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
        }
        .doc-row {
          display: flex; align-items: center; gap: var(--s3);
          padding: var(--s3) var(--s4);
          border-bottom: 1px solid var(--border);
        }
        .doc-row:last-child { border-bottom: none; }
        .doc-type-badge {
          flex-shrink: 0; padding: 3px 9px; border-radius: 12px;
          font-size: .75rem; font-weight: 700; white-space: nowrap;
        }
        .doc-info { flex: 1; min-width: 0; }
        .doc-filename { display: block; font-size: .9375rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .doc-meta    { display: block; font-size: .8125rem; color: var(--text-muted); margin-top: 2px; }
        .doc-actions { display: flex; gap: var(--s2); flex-shrink: 0; }
        .text-danger { color: #dc2626; }

        @media (max-width: 600px) {
          .docs-header { flex-direction: column; }
          .form-grid { grid-template-columns: 1fr; }
          .doc-row { flex-wrap: wrap; }
          .doc-info { order: -1; width: 100%; }
        }
      `}</style>
    </TeamLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
